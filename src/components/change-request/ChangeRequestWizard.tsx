"use client";

import { useEffect, useReducer, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { RedlineCanvas } from "@/components/canvas/RedlineCanvas";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MarkupPreview } from "@/components/equipment/MarkupPreview";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { MarkupData } from "@/lib/markup";
import { equipmentHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { addCommentAction, submitChangeRequestAction } from "@/server/actions/workflow";

import { PhotoStep } from "./PhotoStep";
import { VoiceNote } from "./VoiceNote";
import {
  STEP_LABELS,
  canSubmit,
  draftKey,
  initialWizardState,
  isEmptyDraft,
  parseDraft,
  serializeDraft,
  stepsFor,
  uploadedPhotos,
  wizardReducer,
} from "./wizard-state";

interface Props {
  equipment: { id: string; tag: string; name: string };
  /** Platná revize – podklad pro zákres. */
  schematic: { url: string; version: string; sheetCount: number; pdf: boolean } | null;
  /** Kreslení do fotek (modul CAE Advanced). */
  annotatePhotos?: boolean;
  /** Otevřený požadavek → režim „Doplnit k otevřené změně“. */
  openChange: { id: string; number: string } | null;
}

/** Průvodce „Zadat změnu“: Zákres → Fotky → Poznámka → Souhrn (u otevřené změny bez zákresu). */
export function ChangeRequestWizard({ equipment, schematic, openChange, annotatePhotos = true }: Props) {
  const router = useRouter();
  const mode = openChange ? "comment" : "new";
  const steps = stepsFor(mode).filter((step) => step !== "markup" || schematic);
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const [submitting, startSubmit] = useTransition();
  const [restored, setRestored] = useState(false);
  const submitted = useRef(false);
  const key = draftKey(equipment.id, mode);

  const stepIndex = Math.min(state.stepIndex, steps.length - 1);
  const step = steps[stepIndex];
  const validation = canSubmit(state, mode);
  const markup: MarkupData | null = state.strokes.length ? { version: 1, sheet: state.sheet, strokes: state.strokes } : null;

  // Obnova konceptu (až v prohlížeči). sessionStorage může být blokovaný → try/catch.
  useEffect(() => {
    let draft = null;
    try {
      draft = parseDraft(sessionStorage.getItem(key));
    } catch {
      draft = null;
    }
    if (draft && !isEmptyDraft(draft)) {
      dispatch({ type: "restore", state: draft });
      toast.info("Obnoven rozpracovaný koncept změny.");
    }
    const id = requestAnimationFrame(() => setRestored(true));
    return () => cancelAnimationFrame(id);
  }, [key]);

  useEffect(() => {
    if (!restored || submitted.current) return;
    try {
      if (isEmptyDraft(state)) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, serializeDraft(state));
    } catch {
      // Koncept je jen pohodlí – bez úložiště průvodce funguje dál.
    }
  }, [state, key, restored]);

  const goto = (index: number) => {
    dispatch({ type: "goto", index });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function submit() {
    if (!validation.ok) {
      toast.error(validation.reason);
      return;
    }
    const attachments = uploadedPhotos(state).map((photo) => ({
      url: photo.url!,
      type: "PHOTO" as const,
      fileName: photo.fileName,
      mimeType: "image/jpeg",
      sizeBytes: photo.sizeBytes,
      caption: photo.caption || null,
    }));
    const text = state.text.trim() || null;

    startSubmit(async () => {
      const result = openChange
        ? await addCommentAction({ changeRequestId: openChange.id, comment: text, attachments })
        : await submitChangeRequestAction({
            equipmentId: equipment.id,
            priority: state.priority,
            markupData: markup ? JSON.stringify(markup) : null,
            markupSheet: state.sheet,
            voiceTranscript: state.dictated ? text : null,
            note: state.dictated ? null : text,
            attachments,
          });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      submitted.current = true;
      try {
        sessionStorage.removeItem(key);
      } catch {
        // viz výše
      }
      toast.success(
        openChange ? `Doplněno k ${result.data.number}.` : `Změna ${result.data.number} odeslána do CAE.`,
        { description: openChange ? undefined : "Zařízení je označeno jako „Čeká na aktualizaci“." },
      );
      router.push(equipmentHref(equipment.id));
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-28">
      {/* Ukazatel průběhu */}
      <nav aria-label="Kroky průvodce" className="space-y-3">
        <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((item, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => index < stepIndex && goto(index)}
                  disabled={index > stepIndex}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex h-14 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition-colors",
                    current ? "border-primary bg-primary/15 text-foreground" : done ? "border-border bg-card text-foreground" : "border-border bg-card/40 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-sm",
                      current ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500 text-emerald-950" : "bg-muted",
                    )}
                  >
                    {done ? <Check className="size-4" /> : index + 1}
                  </span>
                  <span className="hidden truncate sm:inline">{STEP_LABELS[item]}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <Progress value={((stepIndex + 1) / steps.length) * 100} aria-label="Průběh průvodce" />
      </nav>

      <section aria-labelledby="wizard-step-title" className="space-y-4">
        <h2 id="wizard-step-title" className="text-xl font-semibold">
          {stepIndex + 1}. {STEP_LABELS[step]}
          <span className="ml-2 text-base font-normal text-muted-foreground">
            {step === "markup" && "– zakroužkujte místo změny ve schématu"}
            {step === "photos" && "– zapojení nebo štítek přístroje"}
            {step === "note" && "– co se změnilo"}
            {step === "summary" && "– zkontrolujte a odešlete"}
          </span>
        </h2>

        {step === "markup" && schematic ? (
          <RedlineCanvas
            src={schematic.url}
            alt={`Schéma ${equipment.tag} ${schematic.version}`}
            strokes={state.strokes}
            onChange={(strokes) => dispatch({ type: "setStrokes", strokes })}
            sheet={state.sheet}
            sheetCount={schematic.sheetCount}
            onSheetChange={(sheet) => dispatch({ type: "setSheet", sheet })}
            pdf={schematic.pdf}
          />
        ) : null}
        {step === "photos" ? <PhotoStep photos={state.photos} dispatch={dispatch} annotate={annotatePhotos} /> : null}
        {step === "note" ? <VoiceNote text={state.text} priority={state.priority} dispatch={dispatch} showPriority={!openChange} /> : null}
        {step === "summary" ? (
          <div className="space-y-4">
            {openChange ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm">
                Fotky a poznámka se připojí k otevřené změně <span className="font-mono font-semibold">{openChange.number}</span> jako
                komentář. CAE projektant je uvidí v timeline ticketu.
              </p>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2">
              {!openChange && schematic ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Zákres ({state.strokes.length} tahů)</h3>
                  {markup ? (
                    <MarkupPreview src={schematic.url} markup={markup} alt={`Zákres nad ${schematic.version}`} pdfPage={schematic.pdf ? state.sheet : null} />
                  ) : (
                    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Bez zákresu.</p>
                  )}
                </div>
              ) : null}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Fotky ({uploadedPhotos(state).length})</h3>
                  {state.photos.length ? (
                    <ul className="flex flex-wrap gap-2">
                      {state.photos.map((photo) => (
                        // eslint-disable-next-line @next/next/no-img-element -- náhled z /api/files
                        <img key={photo.key} src={photo.previewUrl} alt={photo.caption || photo.fileName} className="h-20 w-28 rounded-lg object-cover" />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Bez fotek.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{state.dictated ? "Přepis hlasové poznámky" : "Poznámka"}</h3>
                  <p className="rounded-xl border border-border bg-card p-3 text-base">{state.text.trim() || "—"}</p>
                </div>
                {!openChange ? (
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Priorita</h3>
                    <StatusBadge kind="priority" status={state.priority} />
                  </div>
                ) : null}
              </div>
            </div>
            {!validation.ok ? (
              <p role="alert" className="rounded-xl border border-orange-500/50 bg-orange-500/10 p-3 text-sm text-orange-200">
                {validation.reason}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Velká tlačítka Zpět / Další – přilepená dole (rukavice, tablet) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-safe backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl gap-3 px-3 pt-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="h-14 flex-1 gap-2 text-base sm:flex-none sm:px-8"
            onClick={() => (stepIndex === 0 ? router.push(equipmentHref(equipment.id)) : goto(stepIndex - 1))}
            disabled={submitting}
          >
            <ArrowLeft className="size-5" />
            {stepIndex === 0 ? "Zrušit" : "Zpět"}
          </Button>
          {step === "summary" ? (
            <Button type="button" className="h-14 flex-[2] gap-2 text-base font-semibold sm:ml-auto sm:flex-none sm:px-10" onClick={submit} disabled={submitting || !validation.ok}>
              {submitting ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
              {openChange ? "Doplnit ke změně" : "Odeslat do CAE"}
            </Button>
          ) : (
            <Button type="button" className="h-14 flex-[2] gap-2 text-base font-semibold sm:ml-auto sm:flex-none sm:px-10" onClick={() => goto(stepIndex + 1)}>
              Další
              <ArrowRight className="size-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
