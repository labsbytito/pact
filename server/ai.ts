import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const usageFile = new URL("../.local/ai-usage.json", import.meta.url);
// Reserved spend only ever grows; a missing or unreadable file never resets it to a fresh budget silently.
let spent = 0;
try {
  spent = Number(JSON.parse(await readFile(usageFile, "utf8")).reserved) || 0;
} catch {}
let reservationQueue: Promise<unknown> = Promise.resolve();

// An error whose message is safe and actionable to show the user as-is.
export class AiError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
const DEFAULT_MODEL = "claude-sonnet-5-5";
const provider = () =>
  process.env.PACT_AI === "claude-code"
    ? "claude-code"
    : process.env.ANTHROPIC_API_KEY
      ? "anthropic-api"
      : "none";
export const aiReady = () => provider() !== "none";
const limits = () => ({
  perRequest: Math.min(Number(process.env.PACT_AI_REQUEST_CAP ?? 0.15), 0.5),
  cap: Number(process.env.PACT_AI_SESSION_CAP ?? 1),
});
// Non-secret status for /health: never includes keys, paths or internal ids.
export function aiStatus() {
  const { perRequest, cap } = limits();
  const p = provider();
  const model =
    p === "anthropic-api"
      ? (process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL)
      : p === "claude-code"
        ? (process.env.PACT_CLAUDE_MODEL ?? "claude-code-default")
        : null;
  const remaining = Number.isFinite(cap) ? Math.max(0, cap - spent) : 0;
  return {
    provider: p,
    model,
    budget: {
      spentUsd: Math.round(spent * 100) / 100,
      capUsd: Number.isFinite(cap) ? cap : 0,
      remainingUsd: Math.round(remaining * 100) / 100,
      perRequestUsd: Number.isFinite(perRequest) ? perRequest : 0,
      exhausted: !(perRequest > 0) || spent + perRequest > cap,
    },
  };
}
async function reserveBudget() {
  const { perRequest, cap } = limits();
  const task = reservationQueue.then(async () => {
    if (
      !Number.isFinite(cap) ||
      !Number.isFinite(perRequest) ||
      perRequest <= 0 ||
      spent + perRequest > cap
    )
      throw new AiError(
        "The local prototype AI budget is reached, so Pact paused AI replies. Your Pact is saved.",
        402,
      );
    await mkdir(new URL("../.local/", import.meta.url), {
      recursive: true,
      mode: 0o700,
    });
    const temp = new URL(
      `ai-usage.${randomUUID()}.tmp`,
      new URL("../.local/", import.meta.url),
    );
    const next = spent + perRequest;
    await writeFile(temp, JSON.stringify({ reserved: next, cap }), {
      mode: 0o600,
    });
    await rename(temp, usageFile);
    spent = next;
    return perRequest;
  });
  reservationQueue = task.catch(() => {});
  return task;
}

// Maps a provider failure to a short actionable message. Raw provider text is never passed through.
export function classifyAiFailure(text: string, httpStatus?: number) {
  const t = text.toLowerCase();
  if (/credit balance|billing|payment|insufficient (funds|credit)/.test(t))
    return new AiError(
      "Claude’s account has no available credit. Add credit or switch provider. Your Pact is saved.",
      402,
    );
  if (httpStatus === 401 || /invalid api key|\/login|not logged in|authentication|unauthorized/.test(t))
    return new AiError(
      "Claude isn’t signed in or the key was rejected. Sign in to Claude Code or fix ANTHROPIC_API_KEY, then retry. Your Pact is saved.",
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
      "The configured Claude model isn’t available. Set ANTHROPIC_MODEL or PACT_CLAUDE_MODEL to a model this account can use. Your Pact is saved.",
      503,
    );
  if (/max.?budget|budget/.test(t))
    return new AiError(
      "That reply would exceed the per-request prototype budget. Try a shorter message or raise PACT_AI_REQUEST_CAP. Your Pact is saved.",
      402,
    );
  if (httpStatus === 529 || (httpStatus && httpStatus >= 500) || /overloaded/.test(t))
    return new AiError(
      "Claude is temporarily overloaded. Try again in a moment. Your Pact is saved.",
      503,
    );
  return new AiError(
    "Claude could not return a reply. Check the local companion setup and try again. Your Pact is saved.",
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

// Opt-in local hackathon/testing adapter. Uses Claude Code's supported signed-in CLI;
// no credential extraction, filesystem tools, MCP servers or action tools are available.
export async function askClaude(
  system: string,
  content: string,
): Promise<string> {
  if (!aiReady()) throw new AiError("AI isn’t connected. Your Pact is saved.");
  const cap = await reserveBudget();
  if (provider() === "claude-code") {
    return new Promise((resolve, reject) => {
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
          String(cap),
          ...(model ? ["--model", model] : []),
          "--system-prompt",
          system,
        ],
        {
          cwd: new URL("../.local/", import.meta.url),
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
      child.stdin.end(content);
    });
  }
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
        system,
        messages: [{ role: "user", content }],
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
  return (
    body?.content
      ?.filter((x: any) => x.type === "text")
      .map((x: any) => x.text)
      .join("") ?? ""
  );
}
