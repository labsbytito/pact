import { useEffect, useRef, useState } from "react";
import { openMicPermissionPage, probeMicrophone, queryMicPermission } from "../lib/mic";

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  active?: boolean;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }>;
  }) => void) | null;
};

export function useDictation(
  deviceId: string | undefined,
  setDraft: (value: string | ((current: string) => string)) => void,
  setNote: (value: string) => void,
) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<Rec | null>(null);
  const baseRef = useRef("");
  const lastSet = useRef("");
  const latest = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    // The grant page tells us when the mic is allowed, so start straight away instead of asking for a second tap.
    const onMessage = (message: { type?: string }) => {
      if (message?.type === "pact-mic-granted" && !recRef.current?.active) void latest.current();
    };
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  const busy = useRef(false);
  async function run() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const permission = await queryMicPermission();
    if (permission === "denied") {
      setNote("Microphone is blocked. Open mic settings, allow Pact, then try again.");
      return;
    }
    if (permission !== "granted" && !(typeof chrome !== "undefined" && chrome.runtime?.id)) {
      // Web demo: an ordinary page can ask for the microphone itself.
      try {
        await probeMicrophone();
      } catch {
        setNote("Microphone is blocked. Allow it in your browser’s address bar, then try again.");
        return;
      }
    } else if (permission !== "granted") {
      try {
        await openMicPermissionPage();
      } catch (error) {
        setNote(error instanceof Error ? error.message : "Microphone setup needs the installed Pact extension.");
      }
      return;
    }
    const chosen = deviceId && deviceId !== "default" ? deviceId : undefined;
    try {
      await probeMicrophone(chosen);
    } catch {
      if (chosen) {
        try {
          await probeMicrophone("default");
          setNote("That microphone is gone. Dictation is using the system default.");
        } catch {
          setNote("Microphone isn’t available yet. Allow it once, then try dictation again.");
          return;
        }
      } else {
        setNote("Microphone isn’t available yet. Allow it once, then try dictation again.");
        return;
      }
    }
    const Speech = (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
    if (!Speech) {
      setNote("Dictation isn’t available in this browser. You can still type.");
      return;
    }
    const recognition = new Speech();
    recognition.lang = navigator.language || "en";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => {
      recognition.active = true;
      setListening(true);
      setDraft((current) => {
        baseRef.current = current;
        return current;
      });
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i]?.isFinal) finalText += piece;
        else interim += piece;
      }
      const join = (base: string, text: string) => (text.trim() ? `${base}${base && !/\s$/.test(base) ? " " : ""}${text.trim()}` : base);
      if (finalText.trim()) {
        setDraft((current) => {
          if (current !== lastSet.current) baseRef.current = current;
          return current;
        });
        baseRef.current = join(baseRef.current, finalText);
      }
      // Words appear as they are spoken; the draft settles when the phrase is final.
      // Rebase on whatever is in the box now, so text typed or sent during dictation is never overwritten.
      setDraft((current) => {
        if (current !== lastSet.current) baseRef.current = current;
        const next = join(baseRef.current, interim);
        lastSet.current = next;
        return next;
      });
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed")
        setNote("Microphone is blocked for Pact. Open mic settings to allow it.");
      else if (event.error !== "aborted" && event.error !== "no-speech")
        setNote("Dictation couldn’t finish. Try again, or type your message.");
      setListening(false);
    };
    recognition.onend = () => {
      recognition.active = false;
      setListening(false);
    };
    recRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setListening(false);
      setNote("Dictation couldn’t start. Try again in a moment.");
    }
  }

  async function dictate() {
    if (busy.current) return;
    busy.current = true;
    try { await run(); } finally { busy.current = false; }
  }
  latest.current = dictate;
  return { listening, dictate };
}
