import { normalizeCompanion } from "./character";
import type { Settings } from "./model";

export const emptySettings: Settings = {
  onboarded: true,
  theme: "system",
  accent: "teal",
  motion: "on",
  background: "dusk",
  micDeviceId: "default",
  companion: { shape: 0, color: "#F59E0B" },
  responseStyle: "detailed",
  askBefore: "suggested",
  sendWithEnter: true,
  textSize: "default",
};

export function normalizeSettings(prefs: Partial<Settings> | null | undefined): Settings {
  const stored = prefs ?? {};
  const accent =
    !stored.accent || stored.accent === "pact" || stored.accent === "character" || stored.accent === "violet"
      ? "teal"
      : stored.accent;
  return {
    ...emptySettings,
    ...stored,
    accent,
    motion: stored.motion ?? "on",
    background: stored.background ?? "dusk",
    responseStyle: stored.responseStyle === "short" ? "short" : "detailed",
    askBefore: stored.askBefore === "always" ? "always" : "suggested",
    sendWithEnter: stored.sendWithEnter !== false,
    textSize: stored.textSize === "large" ? "large" : "default",
    companion: normalizeCompanion(stored.companion ?? emptySettings.companion),
  };
}

export function autoApprove(explicit: boolean | undefined, askBefore: string | undefined, signedOut: boolean) {
  return Boolean(explicit) && askBefore !== "always" && !signedOut;
}
