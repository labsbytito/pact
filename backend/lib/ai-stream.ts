import {
  AiError,
  DEFAULT_MODEL,
  aiReady,
  buildMessageContent,
  classifyAiFailure,
  provider,
  reserveBudget,
  type ClaudeImage,
} from "./ai";
import { costFromUsage, refundBudget, settleBudget, type TokenUsage } from "./ai-budget";

export type StreamChunk =
  | { type: "delta"; text: string }
  | { type: "done"; raw: string }
  | { type: "error"; error: AiError };

/** Anthropic Messages API streaming. Claude Code must use askClaude instead. */
export async function* askClaudeStream(
  system: string,
  content: string,
  images: readonly ClaudeImage[] = [],
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  if (!aiReady()) throw new AiError("AI isn’t connected. Your Pact is saved.");
  if (provider() !== "anthropic-api")
    throw new AiError(
      "Streaming needs the Anthropic API. Use the standard reply path.",
      501,
    );
  const reserved = await reserveBudget();
  let closed = false;
  const usage: TokenUsage = {};
  const close = async (mode: "settle" | "refund") => {
    if (closed) return;
    closed = true;
    if (mode === "refund") await refundBudget(reserved);
    else await settleBudget(reserved, costFromUsage(usage) ?? reserved);
  };
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
        stream: true,
        thinking: { type: "between_tools" },
        system,
        messages: [{ role: "user", content: messageContent }],
      }),
      signal,
    });
  } catch (e) {
    await close("refund");
    if ((e as Error)?.name === "AbortError") return;
    throw new AiError(
      "Pact couldn’t reach Claude. Check your connection and try again. Your Pact is saved.",
      504,
    );
  }
  if (!response.ok) {
    const body: any = await response.json().catch(() => undefined);
    await close("refund");
    throw classifyAiFailure(
      `${body?.error?.type ?? ""} ${body?.error?.message ?? ""}`,
      response.status,
    );
  }
  if (!response.body) {
    await close("refund");
    throw new AiError("Claude returned an empty stream.", 502);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  try {
    while (true) {
      if (signal?.aborted) {
        await close("refund");
        yield { type: "done", raw };
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let event: any;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }
        noteUsage(usage, event);
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          const text = String(event.delta.text ?? "");
          if (text) {
            raw += text;
            yield { type: "delta", text };
          }
        } else if (event.type === "error") {
          await close("refund");
          yield {
            type: "error",
            error: classifyAiFailure(
              `${event.error?.type ?? ""} ${event.error?.message ?? ""}`,
            ),
          };
          return;
        }
      }
    }
  } catch (e) {
    await close("refund");
    if ((e as Error)?.name === "AbortError") {
      yield { type: "done", raw };
      return;
    }
    throw e;
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
  await close("settle");
  yield { type: "done", raw };
}

function noteUsage(usage: TokenUsage, event: any) {
  const reported = event?.message?.usage ?? event?.usage;
  if (!reported || typeof reported !== "object") return;
  for (const key of ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"] as const) {
    if (typeof reported[key] === "number") usage[key] = reported[key];
  }
}

export const canStream = () => provider() === "anthropic-api";
