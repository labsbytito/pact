import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COMPANION, normalizeCompanion } from "../lib/character";
import type { Pact, Settings } from "../lib/model";
import { read, write } from "../lib/storage";

const empty: Settings = {
  onboarded: true,
  theme: "system",
  accent: "pact",
  motion: "on",
  micDeviceId: "default",
  companion: DEFAULT_COMPANION,
};

export function useVault() {
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [settings, setSettings] = useState<Settings>(empty);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void (async () => {
      const [saved, prefs] = await Promise.all([
        read<Pact[]>("pact.pacts", []),
        read<Settings>("pact.settings", empty),
      ]);
      setPacts(Array.isArray(saved) ? saved : []);
      setSettings({
        ...empty,
        ...prefs,
        accent: prefs.accent === "character" ? "pact" : prefs.accent ?? empty.accent,
        motion: prefs.motion ?? "on",
        companion: normalizeCompanion(prefs.companion ?? empty.companion),
      });
      setReady(true);
    })();
  }, []);
  const savePact = useCallback((next: Pact) => {
    setPacts((list) => {
      const updated = [next, ...list.filter((item) => item.id !== next.id)];
      void write("pact.pacts", updated);
      return updated;
    });
  }, []);
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void write("pact.settings", next);
      return next;
    });
  }, []);
  return { pacts, settings, ready, savePact, updateSettings };
}
