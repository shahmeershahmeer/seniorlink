"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (not in TS's DOM lib).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
}

export function useSpeech(lang: string) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const doneRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => setSupported(getRecognition() !== null), []);

  const start = useCallback(
    (onDone: (text: string) => void) => {
      const Rec = getRecognition();
      if (!Rec) return;
      const rec = new Rec();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      finalRef.current = "";
      doneRef.current = onDone;
      setTranscript("");
      setError(null);

      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        finalRef.current = text;
        setTranscript(text);
      };
      rec.onerror = (e) => {
        if (e.error !== "no-speech" && e.error !== "aborted") setError(e.error);
      };
      rec.onend = () => {
        setListening(false);
        const text = finalRef.current.trim();
        if (text) doneRef.current?.(text);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    },
    [lang],
  );

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported, listening, transcript, error, start, stop };
}

/** Reads text aloud — used to read the request back to the senior. */
export function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}
