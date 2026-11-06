"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Ruler } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseLength, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { CALIBRATION_TOLERANCE_PCT, DRAWING_SCALES, calibrationPreview, deviationPct, extentWarning, mmPerPxFromDrawingScale } from "@/lib/panel-builder/floorplan-pdf";
import { cn } from "@/lib/utils";

const m = (mm: number, digits = 2) => `${(mm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: digits })} m`;
const pct = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %`;

export interface CalibrationResult {
  realMm: number;
  drawingScale: number | null;
  scaleDeviationPct: number | null;
}

/**
 * Fáze 57: kalibrace měřítka podkladu a její ověření. Krok 1 – skutečná délka označené kóty (volitelně kontrola proti
 * měřítku výkresu z razítka u PDF), krok 2 – druhá známá kóta v novém měřítku; potvrdit lze jen v toleranci ±2 %.
 */
export function CalibrationDialog({
  mode,
  segmentMm,
  draft,
  onCalibrate,
  onVerified,
  onRetry,
  onClose,
}: {
  mode: "calibrate" | "verify";
  segmentMm: number;
  draft: FloorplanDraft;
  onCalibrate: (result: CalibrationResult) => void;
  onVerified: (check: { measuredMm: number; expectedMm: number; deviationPct: number }) => void;
  /** Znovu kalibrovat / změřit jinou kótu. */
  onRetry: (mode: "calibrate" | "verify") => void;
  onClose: () => void;
}) {
  const [length, setLength] = useState("");
  const [scale, setScale] = useState<string>(draft.calibration.drawingScale ? String(draft.calibration.drawingScale) : "");
  const realMm = parseLength(length);
  const segmentPx = segmentMm / draft.mmPerPx;

  // Měřítko výkresu z razítka (jen PDF se známou velikostí stránky)
  const scaleMmPerPx = scale ? mmPerPxFromDrawingScale(draft.background, Number(scale)) : null;
  const expectedFromScale = scaleMmPerPx ? segmentPx * scaleMmPerPx : null;
  const scaleDeviation = expectedFromScale && realMm ? deviationPct(realMm, expectedFromScale) : null;

  if (mode === "verify") {
    const deviation = realMm ? deviationPct(segmentMm, realMm) : null;
    const ok = deviation !== null && Math.abs(deviation) <= CALIBRATION_TOLERANCE_PCT;
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md" data-testid="calibration-verify">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" aria-hidden /> Ověření měřítka
            </DialogTitle>
            <DialogDescription>Druhá známá kóta (ideálně kolmá na kalibrační) změřená v novém měřítku. Zadejte, kolik má mít podle výkresu.</DialogDescription>
          </DialogHeader>
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            Naměřeno v půdorysu: <b className="font-mono" data-testid="verify-measured">{m(segmentMm)}</b>
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Délka kóty podle výkresu
            <Input autoFocus value={length} onChange={(event) => setLength(event.target.value)} placeholder="např. 3600 mm nebo 3,6 m" aria-label="Délka ověřovací kóty" />
          </label>
          {deviation !== null ? (
            <p className={cn("flex items-start gap-2 rounded-lg border p-2.5 text-sm", ok ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-red-500/50 bg-red-500/10 text-red-200")} data-testid="verify-result">
              {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
              {ok
                ? `Měřítko sedí – odchylka ${pct(deviation)} (povoleno ±${CALIBRATION_TOLERANCE_PCT} %).`
                : `Odchylka ${pct(deviation)} je větší než ±${CALIBRATION_TOLERANCE_PCT} %. Zkontrolujte, že jste klikli přesně na konce kót, že kóta platí pro stejnou stěnu a že výkres nemá v osách různé měřítko – pak kalibrujte znovu.`}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => onRetry("verify")}>
              Změřit jinou kótu
            </Button>
            {ok ? (
              <Button type="button" onClick={() => onVerified({ measuredMm: Math.round(segmentMm), expectedMm: realMm!, deviationPct: deviation! })} data-testid="verify-confirm">
                ✅ Potvrdit měřítko
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onRetry("calibrate")} disabled={deviation === null}>
                Kalibrovat znovu
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const preview = realMm ? calibrationPreview(draft, segmentMm, realMm) : null;
  const warning = preview ? extentWarning(preview.widthMm, preview.heightMm) : null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="calibration-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="size-5 text-primary" aria-hidden /> Kalibrace měřítka
          </DialogTitle>
          <DialogDescription>Zadejte skutečnou délku označené stěny nebo kóty. Po kalibraci ji ověříte druhou známou kótou.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1 text-sm">
          Skutečná délka označené kóty
          <Input autoFocus value={length} onChange={(event) => setLength(event.target.value)} placeholder="např. 4500 mm nebo 4,5 m" aria-label="Skutečná délka kóty" />
        </label>
        {draft.background?.pagePt ? (
          <label className="flex flex-col gap-1 text-sm">
            Měřítko výkresu z razítka (nepovinné – kontrola)
            <select value={scale} onChange={(event) => setScale(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30" aria-label="Měřítko výkresu">
              <option value="">neznám / výkres není v měřítku</option>
              {DRAWING_SCALES.map((value) => (
                <option key={value} value={value}>
                  1 : {value}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {expectedFromScale ? (
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="scale-check">
            Podle měřítka 1 : {scale} má úsečka {m(expectedFromScale)}
            {scaleDeviation !== null ? (
              <b className={Math.abs(scaleDeviation) <= CALIBRATION_TOLERANCE_PCT ? "text-emerald-300" : "text-amber-300"}>
                {Math.abs(scaleDeviation) <= CALIBRATION_TOLERANCE_PCT ? `✓ shoda (${pct(scaleDeviation)})` : `⚠ odchylka ${pct(scaleDeviation)} – výkres nemusí být vytištěn v měřítku`}
              </b>
            ) : (
              <button type="button" className="underline underline-offset-2" onClick={() => setLength(String(Math.round(expectedFromScale)))}>
                použít tuto délku
              </button>
            )}
          </p>
        ) : null}
        {preview ? (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs" data-testid="calibration-preview">
            Plocha výkresu po kalibraci: <b>{(preview.widthMm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} × {m(preview.heightMm, 1)}</b> · 1 px podkladu = {preview.mmPerPx.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} mm
          </p>
        ) : null}
        {warning ? (
          <p className="flex items-start gap-2 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {warning}
          </p>
        ) : null}
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="button" disabled={!realMm} onClick={() => realMm && onCalibrate({ realMm, drawingScale: scale ? Number(scale) : null, scaleDeviationPct: scaleDeviation })} data-testid="calibration-apply">
            Použít a ověřit druhou kótou
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
