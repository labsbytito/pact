/** Session greeting. The large blob may ease its eyes by a couple of pixels. */

export type BlobState =
  | "idle"
  | "greeting"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "error"
  | "still"
  | "sleepy";

const GREET_KEY = "pact-blob-greeted";

export async function shouldGreet(): Promise<boolean> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      const stored = await chrome.storage.session.get(GREET_KEY);
      if (stored[GREET_KEY]) return false;
      await chrome.storage.session.set({ [GREET_KEY]: true });
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(GREET_KEY)) return false;
      sessionStorage.setItem(GREET_KEY, "1");
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Eye offset (viewBox units) toward a pointer delta in px; smaller blobs reach further so it reads. */
export function lookOffset(dx: number, dy: number, size: number): { x: number; y: number } {
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return { x: 0, y: 0 };
  const cap = size < 32 ? 6 : size < 72 ? 4.5 : 3.2;
  const amount = Math.min(cap, (dist / 90) * cap);
  return { x: (dx / dist) * amount, y: (dy / dist) * amount };
}

export type IdleMove = "stretch" | "look" | "yawn";
const IDLE_MOVES: IdleMove[] = ["stretch", "look", "yawn"];

/** Randomised 8–20s wait between idle micro-behaviours. */
export function idleDelay(rand = Math.random()): number {
  return 8000 + Math.min(1, Math.max(0, rand)) * 12000;
}

export function pickIdle(rand = Math.random()): IdleMove {
  return IDLE_MOVES[Math.min(IDLE_MOVES.length - 1, Math.floor(Math.max(0, rand) * IDLE_MOVES.length))] ?? "stretch";
}

/** Reaction to a state change: finishing work is a happy hop, error is a worried shake. */
export function reactionFor(prev: BlobState, next: BlobState): "cheer" | "worry" | null {
  if (next === "error" && prev !== "error") return "worry";
  const busy = prev === "thinking" || prev === "speaking" || prev === "listening";
  if (busy && (next === "idle" || next === "happy" || next === "still")) return "cheer";
  return null;
}
