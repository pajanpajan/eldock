"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";
import { Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ChangeRequestPriority } from "@/generated/prisma/enums";
import { CHANGE_REQUEST_PRIORITY } from "@/lib/status";
import { cn } from "@/lib/utils";

import type { WizardAction } from "./wizard-state";

const QUICK_PHRASES = ["Vyměněn stykač", "Přepojena svorka", "Doplněn jistič", "Změna kabeláže", "Nový štítek"];
const PRIORITIES: ChangeRequestPriority[] = ["NORMAL", "HIGH", "CRITICAL"];
/** Ukázkový přepis pro prohlížeče bez rozpoznávání řeči (simulace). */
const SAMPLE_TRANSCRIPT = "Vyměněn stykač K2 za typ Siemens 3RT2, přepojena svorka A2 na X1:14.";

// Minimální typy Web Speech API (nejsou v lib.dom).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const appendText = (base: string, addition: string) => {
  const trimmed = base.trimEnd();
  if (!trimmed) return addition;
  return /[.,;:!?]$/.test(trimmed) ? `${trimmed} ${addition}` : `${trimmed}, ${addition.charAt(0).toLowerCase()}${addition.slice(1)}`;
};

/** Krok 3 – hlasová / rychlá poznámka: Web Speech API (cs-CZ), jinak simulace; vždy editovatelný text. */
export function VoiceNote({
  text,
  priority,
  dispatch,
  showPriority,
}: {
  text: string;
  priority: ChangeRequestPriority;
  dispatch: Dispatch<WizardAction>;
  showPriority: boolean;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const simulation = useRef<number | null>(null);
  const textRef = useRef(text);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Podpora se zjišťuje až v prohlížeči (server ji nezná → žádný hydration mismatch).
  useEffect(() => {
    const id = requestAnimationFrame(() => setSupported(getRecognition() !== null));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(
    () => () => {
      recognition.current?.stop();
      if (simulation.current) window.clearInterval(simulation.current);
    },
    [],
  );

  function stop() {
    recognition.current?.stop();
    recognition.current = null;
    if (simulation.current) window.clearInterval(simulation.current);
    simulation.current = null;
    setInterim("");
    setRecording(false);
  }

  function start() {
    const Ctor = getRecognition();
    setRecording(true);
    if (Ctor) {
      const instance = new Ctor();
      instance.lang = "cs-CZ";
      instance.continuous = true;
      instance.interimResults = true;
      instance.onresult = (event) => {
        let pending = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const chunk = result[0].transcript.trim();
          if (!chunk) continue;
          if (result.isFinal) {
            const next = appendText(textRef.current, chunk.charAt(0).toUpperCase() + chunk.slice(1));
            textRef.current = next;
            dispatch({ type: "setText", text: next, dictated: true });
          } else pending += ` ${chunk}`;
        }
        setInterim(pending.trim());
      };
      instance.onerror = () => stop();
      instance.onend = () => {
        setRecording(false);
        setInterim("");
      };
      recognition.current = instance;
      instance.start();
      return;
    }
    // Simulace: „nahrávání“ s průběžným přepisem ukázkové věty.
    const words = SAMPLE_TRANSCRIPT.split(" ");
    let index = 0;
    const base = textRef.current;
    simulation.current = window.setInterval(() => {
      index += 1;
      const partial = words.slice(0, index).join(" ");
      if (index >= words.length) {
        const next = appendText(base, SAMPLE_TRANSCRIPT);
        textRef.current = next;
        dispatch({ type: "setText", text: next, dictated: true });
        stop();
      } else setInterim(partial);
    }, 220);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center">
        <Button
          type="button"
          onClick={recording ? stop : start}
          className={cn(
            "size-24 rounded-full text-base shadow-lg",
            recording ? "bg-red-500 text-white hover:bg-red-400" : "",
          )}
          aria-label={recording ? "Zastavit nahrávání" : "Nadiktovat poznámku"}
          aria-pressed={recording}
        >
          {recording ? <Square className="size-9" /> : <Mic className="size-10" />}
        </Button>
        {recording ? (
          <div className="flex h-8 items-end gap-1" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="w-1.5 animate-pulse rounded-full bg-red-400" style={{ height: `${8 + ((i * 7) % 22)}px`, animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {recording
            ? interim || "Poslouchám… mluvte česky."
            : supported === false
              ? "Prohlížeč nepodporuje rozpoznávání řeči – nahrávání je simulované (vloží ukázkový přepis)."
              : "Klepněte a nadiktujte, co se změnilo. Text pak můžete upravit."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="change-note" className="text-base">
          Poznámka
        </Label>
        <Textarea
          id="change-note"
          value={text}
          onChange={(event) => dispatch({ type: "setText", text: event.target.value })}
          placeholder="Např. Vyměněn stykač K4 za jiný typ, přepojena svorka A2."
          rows={4}
          maxLength={4000}
          className="min-h-28 text-base"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Rychlé fráze">
          {QUICK_PHRASES.map((phrase) => (
            <Button
              key={phrase}
              type="button"
              variant="outline"
              className="h-11 rounded-full px-4"
              onClick={() => dispatch({ type: "setText", text: appendText(text, phrase) })}
            >
              + {phrase}
            </Button>
          ))}
        </div>
      </div>

      {showPriority ? (
        <div className="space-y-2">
          <div className="text-base font-medium" id="priority-label">
            Priorita
          </div>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="priority-label">
            {PRIORITIES.map((value) => {
              const style = CHANGE_REQUEST_PRIORITY[value];
              const Icon = style.icon;
              const active = priority === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => dispatch({ type: "setPriority", priority: value })}
                  className={cn(
                    "flex h-14 items-center justify-center gap-2 rounded-xl border-2 text-base font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? style.badge : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {style.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
