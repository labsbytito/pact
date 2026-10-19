import { newCharacterSeed } from "./character";
export type Source = {
  title: string;
  url: string;
  description: string;
  text: string;
  selection: string;
  capturedAt: string;
  tabId?: number;
  windowId?: number;
  captureMode?: "page" | "selection" | "picked";
  viewportText?: string;
  selectionContext?: string;
  selectionLabel?: string;
  pageTextPartial?: boolean;
  videoTime?: number;
  transcript: { start: number; text: string }[];
  transcriptPartial?: boolean;
  transcriptStatus: "available" | "unavailable" | "not-video";
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  /** User stopped generation; keep partial text. */
  stopped?: boolean;
};
export type Action = {
  id: string;
  title: string;
  instruction: string;
  planId?: string;
  expiresAt?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
  contextHash?: string;
  consequential?: boolean;
  /** Stable for the life of this proposal, including a retry after a lost response. */
  requestId?: string;
  status:
    | "proposed"
    | "approved"
    | "running"
    | "returned"
    | "needs_answer"
    | "failed"
    | "unknown"
    | "superseded";
  result?: string;
  progress?: string;
  at?: string;
  runId?: string;
};
export type Pact = {
  id: string;
  characterSeed?: string;
  title: string;
  intention: string;
  source?: Source;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  action?: Action;
  actions?: Action[];
  archived?: boolean;
  pinned?: boolean;
  /** User-created section / folder id. */
  sectionId?: string | null;
};
export type PactSection = {
  id: string;
  name: string;
  createdAt: string;
};
export type ThemePreference = "system" | "light" | "dark";
export type AccentPreference = "pact" | "blue" | "teal" | "violet" | "black" | "character";
export type MotionPreference = "on" | "reduced" | "off";
export type Settings = {
  onboarded: boolean;
  theme?: ThemePreference;
  accent?: AccentPreference;
  motion?: MotionPreference;
  /** Selected microphone device id, or "default". */
  micDeviceId?: string;
  companion?: { shape: number; color: string };
};
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const message = (role: Message["role"], text: string): Message => ({
  id: uid(),
  role,
  text,
  at: now(),
});
export function makePact(
  intention: string,
  source?: Source,
  existing: readonly Pact[] = [],
): Pact {
  const at = now();
  const id = uid();
  return {
    id,
    characterSeed: newCharacterSeed(
      id,
      existing.map((p) => p.characterSeed ?? p.id),
    ),
    title: intention.trim().slice(0, 72),
    intention: intention.trim(),
    source,
    createdAt: at,
    updatedAt: at,
    messages: [message("user", intention.trim())],
  };
}
export function approve(action: Action): Action {
  if (action.status !== "proposed" && action.status !== "failed")
    throw new Error("This action has already been submitted.");
  return { ...action, status: "approved", at: now(), runId: uid() };
}
export function safeUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    return ["https:", "http:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export function timestamp(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
