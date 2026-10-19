import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  BUDGET_PAUSE,
  BudgetExhausted,
  budgetSnapshot,
  costFromUsage,
  refundBudget,
  reserveBudget as holdBudget,
  settleBudget,
  type TokenUsage,
} from "./ai-budget";
import { localPath } from "./paths";

// An error whose message is safe and actionable to show the user as-is.
export class AiError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const provider = () =>
  process.env.PACT_AI === "claude-code"
    ? "claude-code"
    : process.env.ANTHROPIC_API_KEY
      ? "anthropic-api"
      : "none";
export const aiReady = () => provider() !== "none";
// Non-secret status for /health: never includes keys, paths or internal ids.
export function aiStatus() {
  const p = provider();
  const model =
    p === "anthropic-api"
      ? (process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL)
      : p === "claude-code"
        ? (process.env.PACT_CLAUDE_MODEL ?? "claude-code-default")
        : null;
  return { provider: p, model, budget: budgetSnapshot() };
}
export async function reserveBudget() {
  try {
    return await holdBudget();
  } catch (error) {
    if (error instanceof BudgetExhausted) throw new AiError(BUDGET_PAUSE, 402);
    throw error;
  }
}

// Maps a provider failure to a short actionable message. Raw provider text is never passed through.
export function classifyAiFailure(text: string, httpStatus?: number) {
  const t = text.toLowerCase();
  if (/credit balance|billing|payment|insufficient (funds|credit)/.test(t))
    return new AiError(
      "Claude’s account has no available credit. Add credit or switch provider. Your Pact is saved.",
      402,
    );
  if (httpStatus === 400 && /invalid_request_error/.test(t))
    return new AiError(
      "Claude couldn’t accept that request. Try again. Your Pact is saved.",
      502,
    );
  if (httpStatus === 401 || /invalid api key|\/login|not logged in|authentication|unauthorized/.test(t))
    return new AiError(
      "Claude isn’t signed in, so Pact can’t reply yet. Your Pact is saved.",
      503,
    );
  if (httpStatus === 403 || /permission|forbidden/.test(t))
    return new AiError(
      "This Claude account or key isn’t permitted to use that model. Your Pact is saved.",
      503,
    );
  if (httpStatus === 429 || /rate limit|usage limit|limit reached|too many requests/.test(t))
    return new AiError(
      "Claude’s usage limit was reached. Try again later. Your Pact is saved.",
      429,
    );
  if (httpStatus === 404 || /model.*(not found|unavailable|does not exist|issue with the selected model)/.test(t))
    return new AiError(
      "That Claude model isn’t available right now. Your Pact is saved.",
      503,
    );
  if (/max.?budget|budget/.test(t))
    return new AiError(
      "That reply is longer than Pact can send right now. Try a shorter message. Your Pact is saved.",
      402,
    );
  if (httpStatus === 529 || (httpStatus && httpStatus >= 500) || /overloaded/.test(t))
    return new AiError(
      "Claude is temporarily overloaded. Try again in a moment. Your Pact is saved.",
      503,
    );
  return new AiError(
    "Pact didn't get a reply. Try again. Your Pact is saved.",
    502,
  );
}
// Reads the CLI's JSON result (or stderr) after exit and returns the reply text or throws a classified error.
export function readCliResult(output: string, stderr: string, timedOut: boolean) {
  if (timedOut)
    throw new AiError(
      "Claude took too long to reply. Try again with a shorter message. Your Pact is saved.",
      504,
    );
  let result: any;
  try {
    result = JSON.parse(output);
  } catch {
    throw classifyAiFailure(stderr || output);
  }
  if (result?.subtype === "error_max_budget_usd")
    throw classifyAiFailure("max budget");
  if (result?.is_error || result?.subtype !== "success" || typeof result?.result !== "string")
    throw classifyAiFailure(
      `${typeof result?.result === "string" ? result.result : ""} ${stderr}`,
    );
  return result.result as string;
}
// Model output may be fenced or have prose around the JSON; a plain-text reply is still a usable reply.
export function parseModelReply(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  for (const candidate of [
    text,
    text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
  ]) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value))
        return value;
    } catch {}
  }
  if (!text || /^[{[]/.test(text))
    throw new AiError(
      "Claude’s reply could not be read. Please send that again. Your Pact is saved.",
      502,
    );
  return { reply: text };
}

export type ClaudeImage = {
  mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string;
};

// Opt-in local hackathon/testing adapter. Uses Claude Code's supported signed-in CLI;
// no credential extraction, filesystem tools, MCP servers or action tools are available.
export async function askClaude(
  system: string,
  content: string,
  images: readonly ClaudeImage[] = [],
): Promise<string> {
  if (!aiReady()) throw new AiError("AI isn’t connected. Your Pact is saved.");
  const reserved = await reserveBudget();
  try {
    return await completeClaude(system, content, images, reserved);
  } catch (error) {
    await refundBudget(reserved);
    throw error;
  }
}

async function completeClaude(
  system: string,
  content: string,
  images: readonly ClaudeImage[],
  reserved: number,
): Promise<string> {
  if (provider() === "claude-code") {
    const cliContent =
      images.length === 0
        ? content
        : `${content}\n\n[${images.length} image attachment(s) were included by the user. The CLI path cannot render pixels; rely on attachment names and any text files in the JSON.]`;
    return new Promise<string>((resolve, reject) => {
      const model = process.env.PACT_CLAUDE_MODEL;
      const child = spawn(
        process.env.PACT_CLAUDE_BIN ?? join(homedir(), ".local/bin/claude"),
        [
          "-p",
          "--output-format",
          "json",
          "--no-session-persistence",
          "--tools",
          "",
          "--strict-mcp-config",
          "--mcp-config",
          '{"mcpServers":{}}',
          "--max-budget-usd",
          String(Math.min(Number(process.env.PACT_AI_REQUEST_CAP ?? 0.15) || 0.15, 0.5)),
          ...(model ? ["--model", model] : []),
          "--system-prompt",
          system,
        ],
        {
          cwd: localPath(),
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let output = "";
      let error = "";
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, 90000);
      child.stdout.on("data", (chunk) => {
        output += String(chunk);
        if (output.length > 1000000) child.kill("SIGTERM");
      });
      child.stderr.on("data", (chunk) => {
        error = (error + String(chunk)).slice(0, 2000);
      });
      child.on("error", () => {
        clearTimeout(timeout);
        reject(
          new AiError(
            "Claude Code could not start. Check PACT_CLAUDE_BIN and that Claude Code is installed.",
          ),
        );
      });
      child.on("close", () => {
        clearTimeout(timeout);
        try {
          resolve(readCliResult(output, error, timedOut));
        } catch (e) {
          reject(e);
        }
      });
      child.stdin.end(cliContent);
    }).then(async (text) => {
      await settleBudget(reserved, reserved);
      return text;
    });
  }
  const messageContent = buildMessageContent(content, images);
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
        max_tokens: 1800,
        thinking: { type: "between_tools" },
        system,
        messages: [{ role: "user", content: messageContent }],
      }),
      signal: AbortSignal.timeout(90000),
    });
  } catch (e) {
    throw new AiError(
      (e as Error)?.name === "TimeoutError"
        ? "Claude took too long to reply. Try again. Your Pact is saved."
        : "Pact couldn’t reach Claude. Check your connection and try again. Your Pact is saved.",
      504,
    );
  }
  if (!response.ok) {
    const body: any = await response.json().catch(() => undefined);
    throw classifyAiFailure(
      `${body?.error?.type ?? ""} ${body?.error?.message ?? ""}`,
      response.status,
    );
  }
  const body: any = await response.json().catch(() => undefined);
  await settleBudget(reserved, costFromUsage(body?.usage as TokenUsage) ?? reserved);
  return (
    body?.content
      ?.filter((x: any) => x.type === "text")
      .map((x: any) => x.text)
      .join("") ?? ""
  );
}

export function buildMessageContent(
  content: string,
  images: readonly ClaudeImage[],
) {
  if (images.length === 0) return content;
  return [
    ...images.slice(0, 3).map((image) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: image.mime,
        data: image.data,
      },
    })),
    { type: "text" as const, text: content },
  ];
}

export { askClaudeStream, canStream, type StreamChunk } from "./ai-stream";
