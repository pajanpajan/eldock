"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Nativní rozpoznávání řeči prohlížeče (Web Speech API, `cs-CZ`). Bez podpory (Firefox,
// bez mikrofonu, zakázané oprávnění) hook hlásí `supported = false` / chybu a UI nabídne psaní.

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => Recognition;

function getConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Přístup k mikrofonu je zakázaný – povolte ho v prohlížeči, nebo požadavek napište.",
  "service-not-allowed": "Rozpoznávání řeči není v tomto prohlížeči povolené – požadavek napište.",
  "no-speech": "Nic jsem neslyšel – zkuste to znovu, nebo požadavek napište.",
  "audio-capture": "Mikrofon nebyl nalezen – požadavek napište.",
  network: "Rozpoznávání řeči je nedostupné (bez připojení) – požadavek napište nebo zvolte ukázkový povel.",
};

/** `onText(text, final)` dostává průběžný i konečný přepis. */
export function useSpeechRecognition(onText: (text: string, final: boolean) => void) {
  const supported = useSyncExternalStore(noopSubscribe, () => getConstructor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onText);

  useEffect(() => {
    callback.current = onText;
  }, [onText]);

  useEffect(() => () => recognition.current?.abort(), []);

  const start = useCallback(() => {
    const Constructor = getConstructor();
    if (!Constructor) {
      setError("Tento prohlížeč neumí rozpoznávat řeč – požadavek napište nebo zvolte ukázkový povel.");
      return;
    }
    recognition.current?.abort();
    const instance = new Constructor();
    instance.lang = "cs-CZ";
    instance.interimResults = true;
    instance.continuous = false;
    instance.maxAlternatives = 1;
    instance.onresult = (event) => {
      let text = "";
      let final = false;
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
        if (event.results[i].isFinal) final = true;
      }
      callback.current(text.trim(), final);
    };
    instance.onerror = (event) => {
      if (event.error !== "aborted") setError(ERROR_MESSAGES[event.error] ?? "Rozpoznávání řeči selhalo – požadavek napište.");
    };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setError(null);
    try {
      instance.start();
      setListening(true);
    } catch {
      setError("Rozpoznávání řeči se nepodařilo spustit – požadavek napište.");
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    recognition.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
