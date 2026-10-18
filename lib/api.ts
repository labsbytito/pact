import { interpretationContext } from "./context";
import type { Attachment } from "./attachments";
import type { Pact } from "./model";
import { consumeSseBuffer } from "./stream-parse";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export class AbortInterpretError extends Error {
  constructor(public partial = "") {
    super("stopped");
    this.name = "AbortInterpretError";
  }
}

const base = "http://127.0.0.1:4317";

export function combineAbortSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal {
  const list = signals.filter((s): s is AbortSignal => !!s);
  if (list.length === 0) return new AbortController().signal;
  if (list.length === 1) return list[0]!;
  const any = (AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
  }).any;
  if (typeof any === "function") return any(list);
  const controller = new AbortController();
  for (const signal of list) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener(
      "abort",
      () => controller.abort(signal.reason),
      { once: true },
    );
  }
  return controller.signal;
}

export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  try {
    const timeout = AbortSignal.timeout(path.startsWith("/interpret") ? 95000 : 15000);
    const res = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combineAbortSignals(signal, timeout),
    });
    const data = await res.json();
    if (!res.ok)
      throw new ApiError(
        data.error ??
          (res.status === 402
            ? "AI replies are paused by a credit or local budget limit. Your Pact is saved. Check Settings before retrying."
            : res.status === 429
              ? "Claude’s usage limit was reached. Your Pact is saved; try again later."
              : "The companion service could not complete this request."),
        res.status,
      );
    return data;
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    if (e instanceof TypeError)
      throw new Error(
        "The local companion is offline. Your Pact is saved. Start the companion service to use AI and Fo.",
      );
    throw e;
  }
}

export type Health = {
  ai: boolean;
  aiStatus?: {
    provider: "none" | "anthropic-api" | "claude-code";
    model: string | null;
    budget: {
      spentUsd: number;
      capUsd: number;
      remainingUsd: number;
      perRequestUsd: number;
      exhausted: boolean;
    };
  };
  fo: boolean;
  tools: { name: string; description?: string }[];
};

export type Interpretation = {
  reply: string;
  title?: string;
  action?: {
    title: string;
    instruction: string;
    planId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    expiresAt?: string;
  };
};

export const interpret = (
  pact: Pact,
  attachments: readonly Attachment[] = [],
  signal?: AbortSignal,
) =>
  api<Interpretation>(
    "/interpret",
    interpretationContext(pact, attachments),
    signal,
  );

export type StreamHandlers = {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
};

/** Stream from the side panel page (not the service worker). Falls back to /interpret. */
export async function interpretLive(
  pact: Pact,
  attachments: readonly Attachment[] = [],
  handlers: StreamHandlers = {},
): Promise<Interpretation> {
  const body = interpretationContext(pact, attachments);
  const timeout = AbortSignal.timeout(95000);
  const signal = combineAbortSignals(handlers.signal, timeout);
  let res: Response;
  try {
    res = await fetch(base + "/interpret/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError")
      throw new AbortInterpretError("");
    if (e instanceof TypeError)
      throw new Error(
        "The local companion is offline. Your Pact is saved. Start the companion service to use AI and Fo.",
      );
    throw e;
  }
  if (res.status === 501) {
    return interpret(pact, attachments, handlers.signal);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      (data as { error?: string }).error ??
        "The companion service could not complete this request.",
      res.status,
    );
  }
  if (!res.body) return interpret(pact, attachments, handlers.signal);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let partial = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = consumeSseBuffer(buffer);
      buffer = rest;
      for (const event of events) {
        const e = event as {
          type?: string;
          text?: string;
          reply?: string;
          error?: string;
          partial?: string;
          title?: string;
          action?: Interpretation["action"];
        };
        if (e.type === "delta" && e.text) {
          partial += e.text;
          handlers.onDelta?.(e.text);
        } else if (e.type === "stopped") {
          throw new AbortInterpretError(e.reply ?? partial);
        } else if (e.type === "error") {
          if (e.partial) partial = e.partial;
          throw new ApiError(
            e.error ?? "Claude could not return a reply.",
            502,
          );
        } else if (e.type === "done") {
          return {
            reply: e.reply ?? partial,
            title: e.title,
            action: e.action,
          };
        }
      }
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError")
      throw new AbortInterpretError(partial);
    throw e;
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
  if (partial.trim()) return { reply: partial };
  throw new ApiError("Claude’s reply was empty. Please try again.", 502);
}
