/** Session greeting + blob state helpers for PactBlob. */

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

/** Once per browser session (chrome.storage.session when available). */
export async function shouldGreet(): Promise<boolean> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      const { [GREET_KEY]: greeted } = await chrome.storage.session.get(GREET_KEY);
      if (greeted) return false;
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
