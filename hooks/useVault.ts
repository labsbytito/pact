import { useCallback, useEffect, useRef, useState } from "react";
import type { Pact, Settings } from "../lib/model";
import type { PactCompanion } from "../lib/model";
import { migratePact, retainPactMetadata, changePact } from "../lib/pact-data";
import { emptySettings, normalizeSettings } from "../lib/settings";
import { read, write } from "../lib/storage";

const empty = emptySettings;

export function useVault() {
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(empty);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const pending = useRef<Pact[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef(Promise.resolve());
  useEffect(() => {
    void (async () => {
      const [saved, prefs, storedActive] = await Promise.all([
        read<Pact[]>("pact.pacts", []),
        read<Settings>("pact.settings", empty),
        read<string | null>("pact.activeId", null),
      ]);
      const normalized = normalizeSettings(prefs);
      const list = (Array.isArray(saved) ? saved : []).map((pact) => migratePact(pact, { name: "Pact", appearance: normalized.companion ?? { shape: 0, color: "#F59E0B", v: 2 } }));
      await write("pact.pacts", list).catch(() => setStorageError("Pact could not save on this device. Chrome storage may be full; keep this panel open and free space before leaving."));
      setPacts(list);
      setActiveIdState(list.some((item) => item.id === storedActive) ? storedActive : null);
      setSettings(normalizeSettings(prefs));
      setReady(true);
    })();
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local") return;
      if (changes["pact.settings"]?.newValue)
        setSettings(normalizeSettings(changes["pact.settings"].newValue as Settings));
      if (changes["pact.pacts"]?.newValue && Array.isArray(changes["pact.pacts"].newValue) && !pending.current)
        setPacts(changes["pact.pacts"].newValue as Pact[]);
      if (changes["pact.activeId"])
        setActiveIdState((changes["pact.activeId"].newValue as string | null) ?? null);
    };
    chrome.storage?.onChanged?.addListener(onChanged);
    return () => chrome.storage?.onChanged?.removeListener(onChanged);
  }, []);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!pending.current) return;
    const snapshot = pending.current;
    pending.current = null;
    chain.current = chain.current.catch(() => undefined).then(async () => {
      try { await write("pact.pacts", snapshot); setStorageError(""); }
      catch { setStorageError("Pact could not save on this device. Chrome storage may be full; keep this panel open and free space before leaving."); }
    });
  }, []);
  useEffect(() => () => flush(), [flush]);
  const savePact = useCallback((next: Pact) => {
    setPacts((list) => {
      const updated = [retainPactMetadata(list.find((item) => item.id === next.id), next), ...list.filter((item) => item.id !== next.id)];
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
    if (timer.current) clearTimeout(timer.current);
    timer.current = null; pending.current = null;
    setPacts([]);
    setActiveIdState(null);
    chain.current = chain.current.catch(() => undefined).then(() => write("pact.pacts", []));
    void write("pact.activeId", null);
  }, [flush]);
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void write("pact.settings", next);
      return next;
    });
  }, []);
  const change = useCallback((id: string, command: "pin" | "archive" | "delete" | "rename" | "companion", name?: string | PactCompanion) => {
    setPacts((list) => {
      const updated = list.map((p) => p.id === id ? changePact(p, command, name) : p);
      pending.current = updated;
      return updated;
    });
    if (!timer.current) timer.current = setTimeout(flush, 0);
  }, [flush]);
  return { storageError, change, pacts, activeId, setActiveId, settings, ready, savePact, updateSettings, clearPacts };
}
