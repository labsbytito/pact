import { useCallback, useEffect, useRef, useState } from "react";
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
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(empty);
  const [ready, setReady] = useState(false);
  const pending = useRef<Pact[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    void (async () => {
      const [saved, prefs, storedActive] = await Promise.all([
        read<Pact[]>("pact.pacts", []),
        read<Settings>("pact.settings", empty),
        read<string | null>("pact.activeId", null),
      ]);
      const list = Array.isArray(saved) ? saved : [];
      setPacts(list);
      setActiveIdState(list.some((item) => item.id === storedActive) ? storedActive : null);
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
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!pending.current) return;
    const snapshot = pending.current;
    pending.current = null;
    void write("pact.pacts", snapshot);
  }, []);
  useEffect(() => () => flush(), [flush]);
  const savePact = useCallback((next: Pact) => {
    setPacts((list) => {
      const updated = [next, ...list.filter((item) => item.id !== next.id)];
      pending.current = updated;
      return updated;
    });
    if (!timer.current) timer.current = setTimeout(flush, 250);
  }, [flush]);
  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    void write("pact.activeId", id);
  }, []);
  const clearPacts = useCallback(() => {
    flush();
    setPacts([]);
    setActiveIdState(null);
    void write("pact.pacts", []);
    void write("pact.activeId", null);
  }, [flush]);
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void write("pact.settings", next);
      return next;
    });
  }, []);
  return { pacts, activeId, setActiveId, settings, ready, savePact, updateSettings, clearPacts };
}
