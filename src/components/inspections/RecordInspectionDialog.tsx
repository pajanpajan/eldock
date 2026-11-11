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
import type { DefectSeverity, EquipmentType, InspectionResult, InspectionType } from "@/generated/prisma/enums";
import { INSPECTION_TYPE_LABELS, formatDateShort } from "@/lib/format";
import { DEADLINE_TYPES, computeValidUntil, defaultValidityMonths } from "@/lib/inspection";
import { isReportType, type ReportDefaults } from "@/lib/inspection-report";
import { evaluateMeasurements, measurementLimits, requiresCertificate, type InspectionRule } from "@/lib/inspection-rules";
import { leakageLimitMa } from "@/lib/inspection-protocol";
import { INSPECTOR_SCOPES, certificateIssues } from "@/lib/inspector-certificate";
import { MAX_TRIP_TIME_MS, RCD_TEST_TYPES, maxMeasuredLoopOhm, tripCurrentRange, type RcdTestType } from "@/lib/rcd-test";
import { DEFECT_DEADLINE_DAYS, severityForResult, splitDefects, splitProvision, thermalLevel } from "@/lib/defects";
import { DEFECT_SEVERITY, INSPECTION_RESULT, THERMAL_LEVEL } from "@/lib/status";
import { uploadFile, type UploadedFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { recordInspectionAction } from "@/server/actions/inspection";

const BASE_TYPES: InspectionType[] = ["PERIODIC", "EXTRAORDINARY", "THERMOVISION", "INITIAL"];
const RESULTS: InspectionResult[] = ["CAPABLE", "CAPABLE_WITH_DEFECTS", "INCAPABLE"];
const ITEM = "touch-target rounded-md border-0! px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";
const SELECT = "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm dark:bg-input/30";

export interface KnownInspector {
  name: string;
  license: string;
  /** Rozsah osvědčení „E2A“ (NV 190/2022 Sb., příloha č. 5). */
  scope: string | null;
  /** Platnost osvědčení `YYYY-MM-DD`. */
  validUntil: string | null;
}

interface Props {
  equipmentId: string;
  tag: string;
  type: EquipmentType;
  /** Lhůta, se kterou se revize zapíše (u VTZ nejvýš zákonná). */
  intervalMonths: number;
  rule: InspectionRule;
  /** Údaje pro kontrolu rozsahu osvědčení (VN, prostor s nebezpečím výbuchu). */
  ratedVoltage: string | null;
  externalInfluences: string | null;
  /** Dnešní den `YYYY-MM-DD` (ze serveru, ať se neliší hydratace). */
  today: string;
  suggestedReportNumber: string;
  inspectors: KnownInspector[];
  /** Předvyplněné náležitosti zprávy (NV 190/2022 Sb., § 10 odst. 1). */
  reportDefaults: ReportDefaults;
  lastInstrument?: string | null;
  /** Přenosný spotřebič / nářadí – zobrazí pole měření R_PE a R_iso. */
  measurable?: boolean;
  protectionClass?: string | null;
}

const day = (value: string) => new Date(`${value}T10:00:00Z`);

/** Dialog „Zapsat novou revizi“: druh, data, platnost, technik s osvědčením, posudek, závady s ustanoveními, náležitosti zprávy. */
export function RecordInspectionDialog({
  equipmentId,
  tag,
  type: equipmentType,
  intervalMonths,
  rule,
  ratedVoltage,
  externalInfluences,
  today,
  suggestedReportNumber,
  inspectors,
  reportDefaults,
  lastInstrument = null,
  measurable = false,
  protectionClass = null,
}: Props) {
  const limits = measurementLimits(protectionClass);
  const [instrument, setInstrument] = useState(lastInstrument ?? (measurable ? "Metrel MI 3309 BT" : ""));
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
  const [scope, setScope] = useState(inspectors[0]?.scope ?? "");
  const [certValidUntil, setCertValidUntil] = useState(inspectors[0]?.validUntil ?? "");
  const [result, setResult] = useState<InspectionResult>("CAPABLE");
  const [defects, setDefects] = useState("");
  // Fáze 66: náležitosti zprávy o revizi (NV 190/2022 Sb., § 10 odst. 1)
  const [reason, setReason] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [reportedAt, setReportedAt] = useState("");
  const [handedOverAt, setHandedOverAt] = useState("");
  const [scopeNote, setScopeNote] = useState(reportDefaults.scopeNote);
  const [documentsUsed, setDocumentsUsed] = useState(reportDefaults.documentsUsed);
  const [actsPerformed, setActsPerformed] = useState(reportDefaults.actsPerformed);
  const [previousEvaluation, setPreviousEvaluation] = useState(reportDefaults.previousEvaluation);
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Fáze 93: nouzové osvětlení – měsíční zkouška funkce mezi ročními zkouškami plné doby
  const types = equipmentType === "LIGHTNING_ROD" ? [...BASE_TYPES, "VISUAL_CHECK" as const] : equipmentType === "EMERGENCY_LIGHTING" ? [...BASE_TYPES, "FUNCTION_TEST" as const] : BASE_TYPES;
  const report = isReportType(type);
  const validity = months ?? defaultValidityMonths(type, intervalMonths);
  let validUntil: string | null = null;
  try {
    validUntil = date && validity > 0 ? formatDateShort(computeValidUntil(day(date), validity)) : null;
  } catch {
    validUntil = null;
  }
  const overLimit = rule.binding && DEADLINE_TYPES.includes(type) && validity > rule.maxMonths;
  const needsDefects = result !== "CAPABLE";
  const toNumber = (value: string) => (value.trim() === "" ? null : Number(value.replace(",", ".")));
  const measurement = measurable ? evaluateMeasurements(protectionClass, { rpe: toNumber(rpe), riso: toNumber(riso) }) : null;
  const certificateRequired = report && requiresCertificate(rule);
  const certificate = certificateRequired && date
    ? certificateIssues({ scope, validUntil: certValidUntil ? day(certValidUntil) : null, inspectionDate: day(date), rule, equipment: { type: equipmentType, ratedVoltage, externalInfluences } })
    : [];
  // U zprávy o revizi VTZ a LPS musí mít každá závada porušené ustanovení (§ 10 odst. 1 písm. k)
  const defectItems = needsDefects && defects.trim() ? splitDefects(defects).map(splitProvision) : [];
  const missingProvision = certificateRequired && defectItems.some((item) => !item.provision);
  const dateIssues = [
    report && startedAt && date && startedAt > date ? "Zahájení revize nemůže být po jejím ukončení." : null,
    report && reportedAt && (reportedAt < date || reportedAt > today) ? "Vypracování zprávy musí být mezi ukončením revize a dneškem." : null,
    report && handedOverAt && (handedOverAt < (reportedAt || date) || handedOverAt > today) ? "Předání zprávy musí být mezi vypracováním a dneškem." : null,
  ].filter(Boolean) as string[];
  const valid =
    !!date &&
    date <= today &&
    validity >= 1 &&
    validity <= 120 &&
    !overLimit &&
    reportNumber.trim() !== "" &&
    inspectorName.trim() !== "" &&
    inspectorLicense.trim() !== "" &&
    certificate.length === 0 &&
    (type !== "EXTRAORDINARY" || reason.trim().length >= 3) &&
    (!needsDefects || defects.trim().length >= 3) &&
    !missingProvision &&
    dateIssues.length === 0 &&
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
        inspectorScope: scope || null,
        inspectorValidUntil: certValidUntil || null,
        result,
        defectsSummary: needsDefects ? defects : defects.trim() || null,
        reportUrl: file?.url ?? null,
        ...(type === "THERMOVISION" ? { maxTempC: toNumber(maxTemp), deltaTempC: toNumber(deltaTemp) } : {}),
        defectSeverity: needsDefects ? (severity ?? severityForResult(result)) : null,
        ...(measurable
          ? { measuringInstrument: instrument || null, protectiveConductorResistance: toNumber(rpe), insulationResistance: toNumber(riso), leakageCurrent: toNumber(leakage) }
          : { measuringInstrument: instrument.trim() || null }),
        ...(type === "THERMOVISION" || type === "VISUAL_CHECK" ? {} : { functionalTest: type === "FUNCTION_TEST" ? result !== "INCAPABLE" : functional === "" ? null : functional === "ok" }),
        ...(!measurable && report && (rcd.noTrip || rcd.tripTime || rcd.tripCurrent || rcd.loop)
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
        ...(report
          ? {
              extraordinaryReason: type === "EXTRAORDINARY" ? reason : null,
              startedAt: startedAt || null,
              reportedAt: reportedAt || null,
              handedOverAt: handedOverAt || null,
              scopeNote,
              documentsUsed,
              actsPerformed,
              previousEvaluation,
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
      setReason("");
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
            <DialogDescription>
              {rule.kind === "VTZ" || rule.kind === "LPS"
                ? "Zpráva o revizi VTZ podle NV 190/2022 Sb., § 10. Platnost se dopočítá z data a lhůty, nejvýš zákonné."
                : `Revize podle ${rule.standard}. Platnost se dopočítá z data a lhůty.`}
            </DialogDescription>
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
                {types.map((value) => (
                  <ToggleGroupItem key={value} value={value} className={ITEM}>
                    {INSPECTION_TYPE_LABELS[value]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {type === "VISUAL_CHECK" ? (
                <p className="text-xs text-muted-foreground">Vizuální kontrola LPS nejméně 1× ročně (NV 190/2022 Sb., příloha č. 4) – ověří, že LPS není viditelně poškozen. Lhůtu revize neposouvá.</p>
              ) : type === "FUNCTION_TEST" ? (
                <p className="text-xs text-muted-foreground">Měsíční zkouška funkce nouzového únikového osvětlení (ČSN EN 50172) – krátké přepnutí na baterii, kontrola rozsvícení a signalizace. Roční zkoušku plné doby funkce zapište jako pravidelnou revizi.</p>
              ) : null}
            </div>

            {type === "EXTRAORDINARY" ? (
              <div className="space-y-2">
                <Label htmlFor="inspection-reason">
                  Důvod mimořádné revize <span className="text-red-400">*</span>
                </Label>
                <Input id="inspection-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Např. po rekonstrukci rozváděče, po úderu blesku, na žádost pojišťovny" className="h-11" />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="inspection-date">{report ? "Ukončení revize" : "Datum provedení"}</Label>
                <Input id="inspection-date" type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspection-months">Platnost (měsíce)</Label>
                <Input
                  id="inspection-months"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={rule.binding && DEADLINE_TYPES.includes(type) ? rule.maxMonths : 120}
                  value={validity}
                  onChange={(event) => setMonths(event.target.value === "" ? 0 : Number(event.target.value))}
                  className="h-11"
                  aria-invalid={overLimit || undefined}
                />
              </div>
              <div className="space-y-2">
                <Label>Platí do</Label>
                <p className="flex h-11 items-center rounded-md border border-border bg-muted/40 px-3 font-mono">{validUntil ?? "–"}</p>
              </div>
              {overLimit ? (
                <p className="text-sm text-red-300 sm:col-span-3" data-testid="inspection-over-limit">
                  Nejdelší zákonná lhůta je {rule.maxMonths} měsíců – {rule.basis}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inspection-number">Číslo zprávy</Label>
                <Input id="inspection-number" value={reportNumber} onChange={(event) => setReportNumber(event.target.value)} maxLength={60} className="h-11 font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspection-inspector">{type === "THERMOVISION" ? "Termodiagnostik" : type === "VISUAL_CHECK" ? "Kontrolu provedl" : "Revizní technik"}</Label>
                <Input id="inspection-inspector" value={inspectorName} onChange={(event) => setInspectorName(event.target.value)} maxLength={120} className="h-11" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="inspection-license">{report ? "Ev. č. osvědčení revizního technika (zákon 250/2021 Sb., § 11)" : "Číslo osvědčení / certifikátu"}</Label>
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
                          setScope(inspector.scope ?? "");
                          setCertValidUntil(inspector.validUntil ?? "");
                        }}
                      >
                        {inspector.name}
                        {inspector.scope ? <span className="font-mono text-xs text-muted-foreground">{inspector.scope}</span> : null}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
              {report ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="inspection-scope">
                      Rozsah osvědčení {certificateRequired ? <span className="text-red-400">*</span> : <span className="text-muted-foreground">(nepovinné)</span>}
                    </Label>
                    <select id="inspection-scope" value={scope} onChange={(event) => setScope(event.target.value)} className={SELECT}>
                      <option value="">Neuvedeno</option>
                      {INSPECTOR_SCOPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inspection-cert-valid">
                      Osvědčení platí do {certificateRequired ? <span className="text-red-400">*</span> : <span className="text-muted-foreground">(nepovinné)</span>}
                    </Label>
                    <Input id="inspection-cert-valid" type="date" value={certValidUntil} onChange={(event) => setCertValidUntil(event.target.value)} className="h-11" />
                  </div>
                  {certificate.length ? (
                    <ul className="space-y-1 text-sm text-red-300 sm:col-span-2" data-testid="inspection-certificate-issues">
                      {certificate.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
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
                  <Input id="inspection-instrument" value={instrument} onChange={(event) => setInstrument(event.target.value)} maxLength={500} className="h-11" />
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

            {!measurable && report ? (
              <details className="rounded-md border border-border p-3" data-testid="rcd-test">
                <summary className="cursor-pointer text-sm font-semibold">Zkouška proudového chrániče (ČSN EN 61557-6 ed. 2) a impedance smyčky</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor="rcd-rated">I<sub>Δn</sub> [mA]</Label>
                    <Input id="rcd-rated" inputMode="decimal" value={rcd.ratedMa} onChange={(event) => setRcd({ ...rcd, ratedMa: event.target.value })} className="h-11 font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rcd-type">Typ chrániče</Label>
                    <select id="rcd-type" value={rcd.type} onChange={(event) => setRcd({ ...rcd, type: event.target.value as RcdTestType })} className={SELECT}>
                      {RCD_TEST_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="rcd-notrip">1) 0,5 · I<sub>Δn</sub> po dobu ≥ 300 ms</Label>
                    <select id="rcd-notrip" value={rcd.noTrip} onChange={(event) => setRcd({ ...rcd, noTrip: event.target.value as "" | "ok" | "trip" })} className={SELECT}>
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

            {report ? (
              <div className="space-y-2">
                <Label htmlFor="inspection-functional">Funkční zkouška</Label>
                <select id="inspection-functional" value={functional} onChange={(event) => setFunctional(event.target.value as "ok" | "fail" | "")} className={SELECT}>
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
                placeholder={certificateRequired ? "Každá závada na řádek, porušené ustanovení v hranatých závorkách: Chybí krytí živých částí IP2X u stykače K2 [ČSN 33 2000-4-41 ed. 3, čl. 411.2]" : "Např. Chybí krytí živých částí IP2X u stykače K2."}
                aria-invalid={(needsDefects && defects.length > 0 && defects.trim().length < 3) || missingProvision ? true : undefined}
              />
              {certificateRequired && needsDefects ? (
                <p className={cn("text-xs", missingProvision ? "text-red-300" : "text-muted-foreground")} data-testid="inspection-provision-hint">
                  U zprávy o revizi VTZ uveďte u každé závady porušené ustanovení předpisu nebo normy v hranatých závorkách (NV 190/2022 Sb., § 10 odst. 1 písm. k).
                  {defectItems.length ? ` Závady: ${defectItems.length}, s ustanovením ${defectItems.filter((item) => item.provision).length}.` : ""}
                </p>
              ) : null}
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

            {report ? (
              <details className="rounded-md border border-border p-3" data-testid="inspection-report-details">
                <summary className="cursor-pointer text-sm font-semibold">
                  Náležitosti zprávy (NV 190/2022 Sb., § 10) – rozsah, data, přístroje, podklady, úkony a předchozí revize
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="inspection-started">Zahájení revize</Label>
                    <Input id="inspection-started" type="date" value={startedAt} max={date} onChange={(event) => setStartedAt(event.target.value)} className="h-11" />
                    <p className="text-[11px] text-muted-foreground">Prázdné = den ukončení.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="inspection-reported">Vypracování zprávy</Label>
                    <Input id="inspection-reported" type="date" value={reportedAt} min={date} max={today} onChange={(event) => setReportedAt(event.target.value)} className="h-11" />
                    <p className="text-[11px] text-muted-foreground">Prázdné = den ukončení.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="inspection-handed">Předání zprávy</Label>
                    <Input id="inspection-handed" type="date" value={handedOverAt} min={reportedAt || date} max={today} onChange={(event) => setHandedOverAt(event.target.value)} className="h-11" />
                    <p className="text-[11px] text-muted-foreground">Prázdné = potvrdí se podpisem převzetí.</p>
                  </div>
                  {dateIssues.length ? <p className="text-sm text-red-300 sm:col-span-3">{dateIssues.join(" ")}</p> : null}
                  {!measurable ? (
                    <div className="space-y-1 sm:col-span-3">
                      <Label htmlFor="inspection-instruments">Měřicí přístroje (typ, výrobní číslo, kalibrace)</Label>
                      <Input id="inspection-instruments" value={instrument} onChange={(event) => setInstrument(event.target.value)} maxLength={500} placeholder="Metrel MI 3152 EurotestXC, v. č. 21460312, kalibrace do 05/2027" className="h-11" />
                    </div>
                  ) : null}
                  <div className="space-y-1 sm:col-span-3">
                    <Label htmlFor="inspection-scope-note">Rozsah revize</Label>
                    <Textarea id="inspection-scope-note" value={scopeNote} onChange={(event) => setScopeNote(event.target.value)} rows={2} maxLength={4000} />
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <Label htmlFor="inspection-documents">Podklady a jejich vyhodnocení</Label>
                    <Textarea id="inspection-documents" value={documentsUsed} onChange={(event) => setDocumentsUsed(event.target.value)} rows={3} maxLength={4000} />
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <Label htmlFor="inspection-acts">Provedené úkony</Label>
                    <Textarea id="inspection-acts" value={actsPerformed} onChange={(event) => setActsPerformed(event.target.value)} rows={3} maxLength={4000} />
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <Label htmlFor="inspection-previous">Vyhodnocení předchozí revize, provozu a údržby</Label>
                    <Textarea id="inspection-previous" value={previousEvaluation} onChange={(event) => setPreviousEvaluation(event.target.value)} rows={2} maxLength={4000} />
                  </div>
                </div>
              </details>
            ) : null}

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
