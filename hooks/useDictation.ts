import { useRef, useState } from "react";
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

  async function dictate() {
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
    if (permission !== "granted") {
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
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i]?.isFinal) finalText += piece;
      }
      if (finalText.trim())
        setDraft((current) => `${current}${current ? " " : ""}${finalText.trim()}`);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed")
        setNote("Microphone is blocked for Pact. Open mic settings to allow it.");
      else if (event.error !== "aborted" && event.error !== "no-speech")
        setNote("Dictation couldn’t finish. Try again, or type your message.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setListening(false);
      setNote("Dictation couldn’t start. Try again in a moment.");
    }
  }

  return { listening, dictate };
}
