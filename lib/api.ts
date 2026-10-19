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
  constructor(
    public partial = "",
    public userInitiated = true,
  ) {
    super(userInitiated ? "stopped" : "stream-aborted");
    this.name = "AbortInterpretError";
  }
}

const base =
  (import.meta as { env?: { WXT_PUBLIC_PACT_API?: string } }).env
    ?.WXT_PUBLIC_PACT_API || "http://localhost:3000";

let installToken = "";

async function authHeaders(): Promise<Record<string, string>> {
  if (!installToken && typeof chrome !== "undefined" && chrome.storage?.local) {
    const stored = await chrome.storage.local.get("pactInstallToken");
    installToken =
      typeof stored.pactInstallToken === "string" ? stored.pactInstallToken : "";
    if (!installToken) {
      const issued = await fetch(base + "/api/install", { method: "POST" });
      const body = (await issued.json().catch(() => ({}))) as { token?: string };
      if (!issued.ok || !body.token)
        throw new Error("Pact could not start a session with the companion.");
      installToken = body.token;
      await chrome.storage.local.set({ pactInstallToken: installToken });
    }
  }
  return installToken ? { Authorization: `Bearer ${installToken}` } : {};
}

export function combineAbortSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal {
  const list = signals.filter((s): s is AbortSignal => !!s);
  if (list.length === 0) return new AbortController().signal;
  if (list.length === 1) return list[0]!;
  const any = (
    AbortSignal as typeof AbortSignal & {
      any?: (signals: AbortSignal[]) => AbortSignal;
    }
  ).any;
  if (typeof any === "function") return any(list);
  const controller = new AbortController();
  for (const signal of list) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

function offlineError() {
  return new Error(
    "Can’t reach Pact. Your Pact is saved. In a terminal run: pnpm --filter backend dev",
  );
}

async function readErrorBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) {
    return res.status === 404
      ? "Companion route missing. Restart the companion with pnpm server after updating Pact."
      : `Companion returned HTTP ${res.status}.`;
  }
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data.error) return data.error;
  } catch {
    /* not JSON */
  }
  return text.slice(0, 240);
}

export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  try {
    const timeout = AbortSignal.timeout(
      path.includes("/interpret") ? 95000 : 15000,
    );
    const headers = await authHeaders();
    const res = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers:
        body === undefined
          ? headers
          : { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combineAbortSignals(signal, timeout),
    });
    const raw = await res.text();
    let data: any = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        if (!res.ok)
          throw new ApiError(
            `Companion returned a non-JSON error (HTTP ${res.status}). Restart pnpm server.`,
            res.status,
          );
        throw new ApiError(
          "Companion returned a non-JSON response. Restart pnpm server.",
          res.status || 502,
        );
      }
    }
    if (!res.ok)
      throw new ApiError(
        data.error ??
          (res.status === 402
            ? "AI replies are paused by a credit or local budget limit. Your Pact is saved. Check Settings before retrying."
            : res.status === 429
              ? "Claude’s usage limit was reached. Your Pact is saved; try again later."
              : `The companion could not complete this request (HTTP ${res.status}).`),
        res.status,
      );
    return data as T;
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    if (e instanceof TypeError) throw offlineError();
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
  needsReconnect?: boolean;
  keyPresent?: boolean;
  model?: string | null;
  foLogin?: "signed-in" | "reconnect" | "signed-out";
  line?: string;
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
    contextHash?: string;
    consequential?: boolean;
  };
};

export const interpret = (
  pact: Pact,
  attachments: readonly Attachment[] = [],
  signal?: AbortSignal,
) =>
  api<Interpretation>(
    "/api/interpret",
    interpretationContext(pact, attachments),
    signal,
  );

export type StreamHandlers = {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  /** Prefer streaming when true (Anthropic API). Default: try stream then fall back. */
  preferStream?: boolean;
};

function shouldFallbackFromStream(res: Response): boolean {
  if ([404, 405, 501].includes(res.status)) return true;
  const type = res.headers.get("content-type") ?? "";
  if (res.ok && !type.includes("text/event-stream") && type.includes("json"))
    return true;
  return false;
}

async function readStream(
  res: Response,
  handlers: StreamHandlers,
): Promise<Interpretation> {
  if (!res.body)
    throw new ApiError("Companion returned an empty stream body.", 502);
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
          throw new AbortInterpretError(
            e.reply ?? partial,
            handlers.signal?.aborted === true,
          );
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
      throw new AbortInterpretError(partial, true);
    throw e;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
  if (partial.trim()) return { reply: partial };
  throw new ApiError(
    "Claude’s reply was empty. Check ANTHROPIC_API_KEY or PACT_AI=claude-code, then retry.",
    502,
  );
}

/**
 * Stream from the side panel page (not the service worker).
 * Falls back to /interpret for Claude Code, older companions, or stream failures.
 */
export async function interpretLive(
  pact: Pact,
  attachments: readonly Attachment[] = [],
  handlers: StreamHandlers = {},
): Promise<Interpretation> {
  const body = interpretationContext(pact, attachments);
  const timeout = AbortSignal.timeout(95000);
  const signal = combineAbortSignals(handlers.signal, timeout);
  const preferStream = handlers.preferStream !== false;

  if (preferStream) {
    let res: Response;
    try {
      res = await fetch(base + "/api/interpret/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(await authHeaders()),
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError")
        throw new AbortInterpretError("", true);
      if (e instanceof TypeError) throw offlineError();
      // Network quirk — try non-stream path.
      return interpret(pact, attachments, handlers.signal);
    }

    if (shouldFallbackFromStream(res)) {
      return interpret(pact, attachments, handlers.signal);
    }

    if (!res.ok) {
      const message = await readErrorBody(res);
      // AI offline / auth: surface clearly, do not pretend it streamed.
      throw new ApiError(message, res.status);
    }

    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/event-stream")) {
      return interpret(pact, attachments, handlers.signal);
    }

    try {
      return await readStream(res, handlers);
    } catch (e) {
      if (e instanceof AbortInterpretError) throw e;
      if (e instanceof ApiError) throw e;
      if ((e as Error)?.name === "AbortError")
        throw new AbortInterpretError("", true);
      // Corrupt SSE → non-stream fallback once.
      return interpret(pact, attachments, handlers.signal);
    }
  }

  return interpret(pact, attachments, handlers.signal);
}
