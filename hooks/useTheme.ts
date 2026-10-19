import { useEffect } from "react";
import type { AccentPreference, BackgroundPreference, MotionPreference, ThemePreference } from "../lib/model";

export function useTheme(
  theme: ThemePreference = "system",
  accent: AccentPreference = "pact",
  character?: string,
  motion: MotionPreference = "on",
  background: BackgroundPreference = "dusk",
) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme !== "light" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.dataset.accent = accent === "character" ? "pact" : accent;
      document.documentElement.dataset.motion = motion;
      document.documentElement.dataset.bg = background;
      if (character) document.documentElement.style.setProperty("--character", character);
      document.documentElement.style.background = dark ? "#121212" : "#fcfcfc";
      try { localStorage.setItem("pact-theme", JSON.stringify(theme)); } catch { /* ignore */ }
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, accent, character, motion, background]);
}
