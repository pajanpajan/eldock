"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPlus, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DefectSeverity, InspectionResult, InspectionType } from "@/generated/prisma/enums";
import { INSPECTION_TYPE_LABELS, formatDateShort } from "@/lib/format";
import { computeValidUntil, defaultValidityMonths } from "@/lib/inspection";
import { evaluateMeasurements, measurementLimits } from "@/lib/inspection-rules";
import { leakageLimitMa } from "@/lib/inspection-protocol";
import { MAX_TRIP_TIME_MS, RCD_TEST_TYPES, maxMeasuredLoopOhm, tripCurrentRange, type RcdTestType } from "@/lib/rcd-test";
import { DEFECT_DEADLINE_DAYS, severityForResult, thermalLevel } from "@/lib/defects";
import { DEFECT_SEVERITY, INSPECTION_RESULT, THERMAL_LEVEL } from "@/lib/status";
import { uploadFile, type UploadedFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { recordInspectionAction } from "@/server/actions/inspection";

const TYPES: InspectionType[] = ["PERIODIC", "EXTRAORDINARY", "THERMOVISION", "INITIAL"];
const RESULTS: InspectionResult[] = ["CAPABLE", "CAPABLE_WITH_DEFECTS", "INCAPABLE"];
const ITEM = "touch-target rounded-md border-0! px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

export interface KnownInspector {
  name: string;
  license: string;
}

interface Props {
  equipmentId: string;
  tag: string;
  intervalMonths: number;
  /** Dnešní den `YYYY-MM-DD` (ze serveru, ať se neliší hydratace). */
  today: string;
  suggestedReportNumber: string;
  inspectors: KnownInspector[];
  /** Přenosný spotřebič / nářadí – zobrazí pole měření R_PE a R_iso. */
  measurable?: boolean;
  protectionClass?: string | null;
}

/** Dialog „Zapsat novou revizi“: druh, datum, platnost, technik s osvědčením TIČR, posudek, závady a zpráva. */
export function RecordInspectionDialog({ equipmentId, tag, intervalMonths, today, suggestedReportNumber, inspectors, measurable = false, protectionClass = null }: Props) {
  const limits = measurementLimits(protectionClass);
  const [instrument, setInstrument] = useState("Metrel MI 3309 BT");
  const [rpe, setRpe] = useState(limits.typical.rpe === null ? "" : String(limits.typical.rpe));
  const [riso, setRiso] = useState(String(limits.typical.riso));
  const [leakage, setLeakage] = useState(measurable ? "0,4" : "");
  // Funkční zkouška: "ok" / "fail" / "" (neprováděla se)
  const [functional, setFunctional] = useState<"ok" | "fail" | "">(measurable ? "ok" : "");
  // Fáze 52: zkoušky proudového chrániče (ČSN EN 61557-6 ed. 2) u pevných instalací / rozváděčů
  const [rcd, setRcd] = useState({ ratedMa: "30", type: "A" as RcdTestType, noTrip: "" as "" | "ok" | "trip", tripTime: "", tripCurrent: "", loop: "", breakerA: "16", curve: "B" as "B" | "C" });
  const [maxTemp, setMaxTemp] = useState("");
  const [deltaTemp, setDeltaTemp] = useState("");
  const [severity, setSeverity] = useState<DefectSeverity | null>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<InspectionType>("PERIODIC");
  const [date, setDate] = useState(today);
  const [months, setMonths] = useState<number | null>(null);
  const [reportNumber, setReportNumber] = useState(suggestedReportNumber);
  const [inspectorName, setInspectorName] = useState(inspectors[0]?.name ?? "");
  const [inspectorLicense, setInspectorLicense] = useState(inspectors[0]?.license ?? "");
  const [result, setResult] = useState<InspectionResult>("CAPABLE");
  const [defects, setDefects] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const validity = months ?? defaultValidityMonths(type, intervalMonths);
  let validUntil: string | null = null;
  try {
    validUntil = date && validity > 0 ? formatDateShort(computeValidUntil(new Date(`${date}T10:00:00Z`), validity)) : null;
  } catch {
    validUntil = null;
  }
  const needsDefects = result !== "CAPABLE";
  const toNumber = (value: string) => (value.trim() === "" ? null : Number(value.replace(",", ".")));
  const measurement = measurable ? evaluateMeasurements(protectionClass, { rpe: toNumber(rpe), riso: toNumber(riso) }) : null;
  const valid =
    !!date &&
    date <= today &&
    validity >= 1 &&
    validity <= 120 &&
    reportNumber.trim() !== "" &&
    inspectorName.trim() !== "" &&
    inspectorLicense.trim() !== "" &&
    (!needsDefects || defects.trim().length >= 3) &&
    progress === null;

  async function onFile(selected: File | undefined) {
    if (!selected) return;
    setProgress(0);
    try {
      setFile(await uploadFile("document", selected, setProgress));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nahrání se nepodařilo.");
    } finally {
      setProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function submit() {
    if (!valid) return;
    startTransition(async () => {
      const response = await recordInspectionAction({
        equipmentId,
        type,
        inspectionDate: date,
        validityMonths: validity,
        reportNumber,
        inspectorName,
        inspectorLicense,
        result,
        defectsSummary: needsDefects ? defects : defects.trim() || null,
        reportUrl: file?.url ?? null,
        ...(type === "THERMOVISION" ? { maxTempC: toNumber(maxTemp), deltaTempC: toNumber(deltaTemp) } : {}),
        defectSeverity: needsDefects ? (severity ?? severityForResult(result)) : null,
        ...(measurable
          ? { measuringInstrument: instrument || null, protectiveConductorResistance: toNumber(rpe), insulationResistance: toNumber(riso), leakageCurrent: toNumber(leakage) }
          : {}),
        ...(type === "THERMOVISION" ? {} : { functionalTest: functional === "" ? null : functional === "ok" }),
        ...(!measurable && type !== "THERMOVISION" && (rcd.noTrip || rcd.tripTime || rcd.tripCurrent || rcd.loop)
          ? {
              rcdTest: {
                ratedMa: toNumber(rcd.ratedMa) ?? 30,
                type: rcd.type,
                noTripAtHalf: rcd.noTrip === "" ? null : rcd.noTrip === "ok",
                tripTimeMs: toNumber(rcd.tripTime),
                tripCurrentMa: toNumber(rcd.tripCurrent),
                loopOhm: toNumber(rcd.loop),
                breakerA: toNumber(rcd.breakerA),
                breakerCurve: rcd.curve,
              },
            }
          : {}),
      });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      toast.success(`${INSPECTION_TYPE_LABELS[type]} zapsána k ${tag}.`, {
        description: `Platnost do ${formatDateShort(response.data.validUntil)}${response.data.generated ? " · revizní zpráva vygenerována" : ""}.`,
      });
      setOpen(false);
      setFile(null);
      setDefects("");
      setResult("CAPABLE");
      router.refresh();
    });
  }

  return (
    <>
      <Button size="lg" className="touch-target gap-2" onClick={() => setOpen(true)}>
        <ClipboardPlus className="size-4" aria-hidden />
        Zapsat novou revizi
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Zapsat novou revizi – {tag}</DialogTitle>
            <DialogDescription>Revizní zpráva dle ČSN 33 1500. Platnost se dopočítá z data a lhůty.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label id="inspection-type-label">Druh</Label>
              <ToggleGroup
                type="single"
                value={type}
                onValueChange={(value) => {
                  if (!value) return;
                  setType(value as InspectionType);
                  setMonths(null);
                }}
                variant="outline"
                spacing={0}
                aria-labelledby="inspection-type-label"
                className="flex-wrap border border-border bg-card/60 p-0.5"
              >
                {TYPES.map((value) => (
                  <ToggleGroupItem key={value} value={value} className={ITEM}>
                    {INSPECTION_TYPE_LABELS[value]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="inspection-date">Datum provedení</Label>
                <Input id="inspection-date" type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspection-months">Platnost (měsíce)</Label>
                <Input
                  id="inspection-months"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  value={validity}
                  onChange={(event) => setMonths(event.target.value === "" ? 0 : Number(event.target.value))}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Platí do</Label>
                <p className="flex h-11 items-center rounded-md border border-border bg-muted/40 px-3 font-mono">{validUntil ?? "–"}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inspection-number">Číslo zprávy</Label>
                <Input id="inspection-number" value={reportNumber} onChange={(event) => setReportNumber(event.target.value)} maxLength={60} className="h-11 font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspection-inspector">{type === "THERMOVISION" ? "Termodiagnostik" : "Revizní technik"}</Label>
                <Input id="inspection-inspector" value={inspectorName} onChange={(event) => setInspectorName(event.target.value)} maxLength={120} className="h-11" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="inspection-license">Ev. č. osvědčení TIČR (NV 190/2022 Sb.) / certifikát</Label>
                <Input id="inspection-license" value={inspectorLicense} onChange={(event) => setInspectorLicense(event.target.value)} maxLength={120} className="h-11 font-mono" />
                {inspectors.length ? (
                  <div className="flex flex-wrap gap-2">
                    {inspectors.map((inspector) => (
                      <Button
                        key={`${inspector.name}|${inspector.license}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => {
                          setInspectorName(inspector.name);
                          setInspectorLicense(inspector.license);
                        }}
                      >
                        {inspector.name}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {type === "THERMOVISION" ? (
              <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="inspection-max-temp">Max. teplota [°C]</Label>
                  <Input id="inspection-max-temp" inputMode="decimal" value={maxTemp} onChange={(event) => setMaxTemp(event.target.value)} className="h-11 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inspection-delta-temp">ΔT vůči okolí [K]</Label>
                  <Input id="inspection-delta-temp" inputMode="decimal" value={deltaTemp} onChange={(event) => setDeltaTemp(event.target.value)} className="h-11 font-mono" />
                </div>
                <div className="flex items-end">
                  {toNumber(deltaTemp) !== null && !Number.isNaN(toNumber(deltaTemp)) ? (
                    <span className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", THERMAL_LEVEL[thermalLevel(toNumber(deltaTemp)!)].badge)}>
                      {THERMAL_LEVEL[thermalLevel(toNumber(deltaTemp)!)].label}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">ΔT do 10 K v normě, nad 40 K kritické.</span>
                  )}
                </div>
              </div>
            ) : null}

            {measurable ? (
              <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="inspection-rpe">
                    R<sub>PE</sub> [Ω] {limits.rpeMax === null ? "" : `≤ ${String(limits.rpeMax).replace(".", ",")}`}
                  </Label>
                  <Input
                    id="inspection-rpe"
                    inputMode="decimal"
                    value={limits.rpeMax === null ? "neměří se" : rpe}
                    disabled={limits.rpeMax === null}
                    onChange={(event) => setRpe(event.target.value)}
                    className="h-11 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inspection-riso">
                    R<sub>iso</sub> [MΩ] ≥ {String(limits.risoMin).replace(".", ",")}
                  </Label>
                  <Input id="inspection-riso" inputMode="decimal" value={riso} onChange={(event) => setRiso(event.target.value)} className="h-11 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inspection-instrument">Měřicí přístroj</Label>
                  <Input id="inspection-instrument" value={instrument} onChange={(event) => setInstrument(event.target.value)} maxLength={120} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inspection-leakage">
                    I<sub>PE</sub> / I<sub>Δ</sub> [mA] ≤ {leakageLimitMa(protectionClass).toLocaleString("cs-CZ")}
                  </Label>
                  <Input id="inspection-leakage" inputMode="decimal" value={leakage} onChange={(event) => setLeakage(event.target.value)} className="h-11 font-mono" />
                </div>
                {measurement && !measurement.ok ? (
                  <p className="text-sm text-red-300 sm:col-span-3">{measurement.failures.join(" ")}</p>
                ) : null}
              </div>
            ) : null}

            {!measurable && type !== "THERMOVISION" ? (
              <details className="rounded-md border border-border p-3" data-testid="rcd-test">
                <summary className="cursor-pointer text-sm font-semibold">Zkouška proudového chrániče (ČSN EN 61557-6 ed. 2) a impedance smyčky</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor="rcd-rated">I<sub>Δn</sub> [mA]</Label>
                    <Input id="rcd-rated" inputMode="decimal" value={rcd.ratedMa} onChange={(event) => setRcd({ ...rcd, ratedMa: event.target.value })} className="h-11 font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rcd-type">Typ chrániče</Label>
                    <select id="rcd-type" value={rcd.type} onChange={(event) => setRcd({ ...rcd, type: event.target.value as RcdTestType })} className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm dark:bg-input/30">
                      {RCD_TEST_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="rcd-notrip">1) 0,5 · I<sub>Δn</sub> po dobu ≥ 300 ms</Label>
                    <select id="rcd-notrip" value={rcd.noTrip} onChange={(event) => setRcd({ ...rcd, noTrip: event.target.value as "" | "ok" | "trip" })} className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm dark:bg-input/30">
                      <option value="">Neměřeno</option>
                      <option value="ok">Nevybavil (vyhovuje)</option>
                      <option value="trip">Vybavil (nevyhovuje)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rcd-time">2) t<sub>Δ</sub> při 1 · I<sub>Δn</sub> [ms] ≤ {MAX_TRIP_TIME_MS}</Label>
                    <Input id="rcd-time" inputMode="decimal" value={rcd.tripTime} onChange={(event) => setRcd({ ...rcd, tripTime: event.target.value })} className="h-11 font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rcd-current">
                      3) I<sub>Δ</sub> [mA] {tripCurrentRange(rcd.type).min.toLocaleString("cs-CZ")}–{tripCurrentRange(rcd.type).max.toLocaleString("cs-CZ")} · I<sub>Δn</sub>
                    </Label>
                    <Input id="rcd-current" inputMode="decimal" value={rcd.tripCurrent} onChange={(event) => setRcd({ ...rcd, tripCurrent: event.target.value })} className="h-11 font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rcd-loop">Z<sub>sm</sub> [Ω]{toNumber(rcd.breakerA) ? ` ≤ ${maxMeasuredLoopOhm(toNumber(rcd.breakerA)!, rcd.curve).toLocaleString("cs-CZ")}` : ""}</Label>
                    <Input id="rcd-loop" inputMode="decimal" value={rcd.loop} onChange={(event) => setRcd({ ...rcd, loop: event.target.value })} className="h-11 font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rcd-breaker">Jistič okruhu</Label>
                    <div className="flex gap-1">
                      <select aria-label="Charakteristika jističe" value={rcd.curve} onChange={(event) => setRcd({ ...rcd, curve: event.target.value as "B" | "C" })} className="h-11 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30">
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                      <Input id="rcd-breaker" inputMode="decimal" value={rcd.breakerA} onChange={(event) => setRcd({ ...rcd, breakerA: event.target.value })} className="h-11 font-mono" />
                    </div>
                  </div>
                </div>
              </details>
            ) : null}

            {type !== "THERMOVISION" ? (
              <div className="space-y-2">
                <Label htmlFor="inspection-functional">Funkční zkouška</Label>
                <select
                  id="inspection-functional"
                  value={functional}
                  onChange={(event) => setFunctional(event.target.value as "ok" | "fail" | "")}
                  className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm dark:bg-input/30"
                >
                  <option value="ok">Vyhovuje</option>
                  <option value="fail">Nevyhovuje</option>
                  <option value="">Neprováděla se</option>
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label id="inspection-result-label">Celkový posudek</Label>
              <div role="radiogroup" aria-labelledby="inspection-result-label" className="grid gap-2 sm:grid-cols-3">
                {RESULTS.map((value) => {
                  const style = INSPECTION_RESULT[value];
                  const Icon = style.icon;
                  const active = result === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setResult(value)}
                      className={cn(
                        "touch-target flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        active ? style.badge : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", style.text)} aria-hidden />
                      {style.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inspection-defects">
                Soupis závad {needsDefects ? <span className="text-red-400">*</span> : <span className="text-muted-foreground">(nepovinné)</span>}
              </Label>
              <Textarea
                id="inspection-defects"
                value={defects}
                onChange={(event) => setDefects(event.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Např. Chybí krytí živých částí IP2X u stykače K2."
                aria-invalid={needsDefects && defects.length > 0 && defects.trim().length < 3 ? true : undefined}
              />
              {needsDefects ? (
                <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Závažnost závad">
                  <span className="text-sm text-muted-foreground">Závažnost (lhůta odstranění):</span>
                  {(["MINOR", "MAJOR", "CRITICAL"] as const).map((value) => {
                    const active = (severity ?? severityForResult(result)) === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSeverity(value)}
                        className={cn("h-9 rounded-full border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50", active ? DEFECT_SEVERITY[value].badge : "border-border bg-card")}
                      >
                        {DEFECT_SEVERITY[value].label} · {DEFECT_DEADLINE_DAYS[value] ? `${DEFECT_DEADLINE_DAYS[value]} dní` : "ihned"}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Revizní zpráva</Label>
              <input ref={fileInput} type="file" accept=".pdf,.svg,.png,.jpg,.jpeg" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} aria-label="Nahrát revizní zprávu" />
              {file ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <span className="truncate">{file.fileName}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Odebrat soubor">
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="touch-target w-full gap-2 border-dashed" onClick={() => fileInput.current?.click()} disabled={progress !== null}>
                  <FileUp className="size-4" aria-hidden />
                  Nahrát PDF / sken zprávy (nepovinné)
                </Button>
              )}
              {progress !== null ? <Progress value={progress} /> : null}
              <p className="text-xs text-muted-foreground">Bez souboru aplikace vygeneruje zprávu z vyplněných údajů.</p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zrušit
              </Button>
            </DialogClose>
            <Button className="touch-target gap-2" onClick={submit} disabled={pending || !valid}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPlus className="size-4" />}
              Zapsat revizi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
