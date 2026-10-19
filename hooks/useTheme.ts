import { useEffect } from "react";
import type { AccentPreference, BackgroundPreference, MotionPreference, TextSize, ThemePreference } from "../lib/model";

export function useTheme(
  theme: ThemePreference = "system",
  accent: AccentPreference = "teal",
  character?: string,
  motion: MotionPreference = "on",
  background: BackgroundPreference = "dusk",
  textSize: TextSize = "default",
) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const dark = theme === "dark" || (theme !== "light" && media.matches);
      const resolved = !accent || accent === "pact" || accent === "character" ? "teal" : accent;
      const motionValue = motion === "off" ? "off" : motion === "reduced" || reduce.matches ? "reduced" : "on";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.dataset.accent = resolved;
      document.documentElement.dataset.motion = motionValue;
      document.documentElement.dataset.bg = background;
      document.documentElement.dataset.text = textSize === "large" ? "large" : "default";
      if (character) document.documentElement.style.setProperty("--character", character);
      document.documentElement.style.background = dark ? "#121212" : "#fcfcfc";
      try { localStorage.setItem("pact-theme", JSON.stringify(theme)); } catch { /* ignore */ }
    };
    apply();
    media.addEventListener("change", apply);
    reduce.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      reduce.removeEventListener("change", apply);
    };
  }, [theme, accent, character, motion, background, textSize]);
}
