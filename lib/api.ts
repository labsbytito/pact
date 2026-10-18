import { interpretationContext } from "./context";
import type { Attachment } from "./attachments";
import type { Pact } from "./model";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const base = "http://127.0.0.1:4317";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  try {
    const res = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(path === "/interpret" ? 95000 : 15000),
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
) => api<Interpretation>("/interpret", interpretationContext(pact, attachments));
