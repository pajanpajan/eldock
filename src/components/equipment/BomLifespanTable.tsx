"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALERT_LEAD_OPTIONS, SHIFT_REGIMES, daysWord, endOfLifeText, remainingText, remainingTone } from "@/lib/component-lifespan";
import { toCsv } from "@/lib/csv";
import { normalizeSearch } from "@/lib/equipment-filter";
import type { LifespanRowView } from "@/lib/lifespan-view";
import { cn } from "@/lib/utils";
import { replaceBomComponentAction, setComponentStockAction, updateBomComponentAction, updateOperatingProfileAction } from "@/server/actions/lifespan";

import { ComponentDatasheetDialog } from "./ComponentDatasheetDialog";

const TONE = {
  green: { bar: "bg-emerald-500", text: "text-emerald-300" },
  amber: { bar: "bg-amber-400", text: "text-amber-300" },
  red: { bar: "bg-red-500", text: "text-red-300" },
} as const;

const TEMP_PRESETS = [35, 48] as const;
const n = (value: number, digits = 0) => value.toLocaleString("cs-CZ", { maximumFractionDigits: digits });
const parseNumber = (value: string) => {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
};

export type LifespanCall = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) => void;

/** Volání akce s hláškou a obnovením dat (přepočet životnosti na serveru). */
export function useLifespanCall(): [boolean, LifespanCall] {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const call: LifespanCall = (action, success) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error);
      toast.success(success);
      router.refresh();
    });
  return [pending, call];
}

/** Ukazatel zbývající životnosti 100 % (nová) → 0 % (konec); po překročení „🔴 0 % zbývá (překročeno o +38 %)“. */
export function RemainingBar({ row }: { row: LifespanRowView }) {
  const assessment = row.assessment;
  if (!assessment) return <span className="text-xs text-muted-foreground">bez opotřebení</span>;
  const tone = TONE[remainingTone(assessment)];
  return (
    <div className="flex min-w-36 flex-col gap-1" data-testid="bom-remaining" data-remaining={assessment.remainingPercent} data-overrun={assessment.overrunPercent}>
      <span className={cn("text-sm font-bold", tone.text)}>{remainingText(assessment)}</span>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(assessment.remainingPercent)} aria-label={`Zbývající životnost ${row.designation}`}>
        <div className={cn("h-full", tone.bar)} style={{ width: `${Math.max(assessment.expired ? 0 : 2, assessment.remainingPercent)}%` }} />
      </div>
    </div>
  );
}

export function endText(row: LifespanRowView) {
  const assessment = row.assessment;
  if (!assessment) return "–";
  return endOfLifeText({ ...assessment, predictedReplacementDate: assessment.endDate ? new Date(assessment.endDate) : null });
}

/**
 * Fáze 116: záložka „📋 Kusovník & Životnost“ – ovládací pruh provozu stroje (směnnost, teplota v rozváděči, předstih
 * upozornění, nákupní report) a kusovník s životností každé sledované součástky: zbývající %, předpokládaný konec,
 * četnost spínání / motohodiny, sklad a předstih, výměna (Reset 100 %) a oficiální datasheet.
 */
export function BomLifespanTable({
  equipmentId,
  revisionId,
  version,
  rows,
  profile,
  alertDays,
  canEdit,
  purchaseHref,
  fileName,
}: {
  equipmentId: string;
  revisionId: string | null;
  version: string | null;
  rows: LifespanRowView[];
  profile: { shiftRegime: number; internalTempC: number | null };
  alertDays: number;
  canEdit: boolean;
  purchaseHref: string | null;
  fileName: string;
}) {
  const [pending, call] = useLifespanCall();
  const [query, setQuery] = useState("");
  const [temp, setTemp] = useState(profile.internalTempC === null ? "" : String(profile.internalTempC).replace(".", ","));
  const [sheet, setSheet] = useState<LifespanRowView | null>(null);
  const visible = useMemo(() => {
    const q = normalizeSearch(query);
    return q ? rows.filter((row) => normalizeSearch([row.designation, row.description, row.manufacturer, row.partNumber, row.kindLabel].join(" ")).includes(q)) : rows;
  }, [rows, query]);
  const tracked = rows.filter((row) => row.assessment);
  const critical = tracked.filter((row) => row.assessment!.expired || row.assessment!.alert).length;

  const saveProfile = (patch: Partial<{ shiftRegime: number; internalTempC: number | null; lifespanAlertDays: number }>, success: string) =>
    call(() => updateOperatingProfileAction({ equipmentId, shiftRegime: profile.shiftRegime, internalTempC: profile.internalTempC, ...patch }), success);
  const ref = (row: LifespanRowView) => ({ equipmentId, designation: row.designation, revisionId });

  function exportCsv() {
    const csv = toCsv([
      ["Pozice", "Označení", "Popis", "Výrobce", "Objednací číslo", "Množství", "Jednotka", "Zbývající životnost [%]", "Překročeno [%]", "Předpokládaný konec", "Četnost [sepnutí/h]", "Odpracováno [h]", "Skladem [ks]", "Předstih [dny]", "Model životnosti"],
      ...visible.map((row) => [
        row.position,
        row.designation,
        row.description,
        row.manufacturer,
        row.partNumber,
        String(row.quantity).replace(".", ","),
        row.unit,
        row.assessment ? String(row.assessment.remainingPercent).replace(".", ",") : "",
        row.assessment ? String(row.assessment.overrunPercent).replace(".", ",") : "",
        row.assessment ? endText(row) : "",
        row.usesCycles && row.cyclesPerHour !== null ? String(row.cyclesPerHour).replace(".", ",") : "",
        row.assessment ? row.assessment.operatingHours : "",
        row.assessment ? row.stock : "",
        row.assessment ? row.alertLeadDays : "",
        row.assessment ? row.basis : "bez opotřebení",
      ]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="bom-lifespan">
      {/* Ovládací pruh provozu stroje */}
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm" aria-label="Provoz stroje a upozornění" data-testid="lifespan-controls">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Provozní režim stroje:</span>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Provozní režim stroje">
            {SHIFT_REGIMES.map((regime) => (
              <button
                key={regime.id}
                type="button"
                role="radio"
                aria-checked={profile.shiftRegime === regime.id}
                disabled={!canEdit || pending}
                onClick={() => saveProfile({ shiftRegime: regime.id }, `Provozní režim ${regime.longLabel} – životnost přepočtena.`)}
                className={cn("rounded-md border px-2.5 py-1.5 text-xs font-semibold", profile.shiftRegime === regime.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                title={`${n(regime.hoursPerYear)} h/rok`}
                data-testid={`lifespan-shift-${regime.id}`}
              >
                {regime.longLabel}
              </button>
            ))}
          </div>
          {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Přepočítávám" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">Teplota v rozváděči:</span>
            {TEMP_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                disabled={!canEdit || pending}
                onClick={() => {
                  setTemp(String(value));
                  saveProfile({ internalTempC: value }, `Teplota v rozváděči ${value} °C – životnost přepočtena.`);
                }}
                className={cn("rounded-md border px-2 py-1 text-xs font-semibold", profile.internalTempC === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                data-testid={`lifespan-temp-${value}`}
              >
                {value} °C
              </button>
            ))}
            <Input
              className="h-8 w-20 font-mono text-xs"
              inputMode="decimal"
              value={temp}
              disabled={!canEdit}
              placeholder="35"
              aria-label="Vnitřní teplota rozváděče [°C]"
              onChange={(event) => setTemp(event.target.value)}
              onBlur={() => {
                const value = temp.trim() === "" ? null : parseNumber(temp);
                if (value !== profile.internalTempC && (value === null || Number.isFinite(value))) saveProfile({ internalTempC: value }, "Teplota v rozváděči uložena – životnost přepočtena.");
              }}
              data-testid="lifespan-temp"
            />
            <span className="text-xs text-muted-foreground">°C</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">Předstih upozornění (všechny součástky):</span>
            {ALERT_LEAD_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                disabled={!canEdit || pending}
                onClick={() => saveProfile({ lifespanAlertDays: days }, `Předstih upozornění ${days} dní pro všechny součástky.`)}
                className={cn("rounded-md border px-2 py-1 text-xs font-semibold", alertDays === days ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                data-testid={`lifespan-lead-${days}`}
              >
                {days} dní
              </button>
            ))}
          </div>
          {purchaseHref ? (
            <Button asChild size="sm" className="ml-auto h-9 gap-1.5" data-testid="purchase-report-link">
              <Link href={purchaseHref}>📦 Souhrnný nákupní report součástek před koncem životnosti</Link>
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground" data-testid="lifespan-summary">
          Kusovník revize <span className="font-mono text-foreground">{version ?? "–"}</span> · {tracked.length} sledovaných součástek
          {critical ? (
            <>
              {" · "}
              <b className="text-red-300">{critical} po životnosti / v okně upozornění</b>
            </>
          ) : null}{" "}
          · limity z technického listu výrobce, jinak odhad kategorie (označeno „odhad“).
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat označení, popis, číslo…" aria-label="Hledat v kusovníku" className="h-10 pl-9" />
        </div>
        <span className="text-sm text-muted-foreground">
          {visible.length} / {rows.length} položek
        </span>
        <Button variant="outline" className="ml-auto gap-2" onClick={exportCsv}>
          <FileSpreadsheet className="size-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-2 py-2">Poz.</th>
              <th className="px-2 py-2">Označení</th>
              <th className="px-2 py-2">Popis</th>
              <th className="px-2 py-2 text-right">Množství</th>
              <th className="px-2 py-2">Zbývající životnost (%)</th>
              <th className="px-2 py-2">Předpokládaný konec životnosti</th>
              <th className="px-2 py-2">Parametry provozu (Spínání / Hodiny)</th>
              <th className="px-2 py-2">Sklad & Upozornění</th>
              <th className="px-2 py-2">📄 Oficiální Datasheet</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <BomRow key={`${row.key}|${row.cyclesPerHour}|${row.stock}|${row.alertLeadDays}|${row.assessment?.operatingHours ?? ""}`} row={row} canEdit={canEdit} pending={pending} call={call} refOf={ref} onSheet={() => setSheet(row)} />
            ))}
          </tbody>
        </table>
      </div>
      {sheet ? <ComponentDatasheetDialog row={sheet} open onOpenChange={(open) => (!open ? setSheet(null) : undefined)} /> : null}
    </div>
  );
}

function BomRow({ row, canEdit, pending, call, refOf, onSheet }: { row: LifespanRowView; canEdit: boolean; pending: boolean; call: LifespanCall; refOf: (row: LifespanRowView) => { equipmentId: string; designation: string; revisionId: string | null }; onSheet: () => void }) {
  const assessment = row.assessment;
  const [rate, setRate] = useState(row.cyclesPerHour === null ? "" : String(row.cyclesPerHour).replace(".", ","));
  const [hours, setHours] = useState(assessment ? String(assessment.operatingHours) : "");
  const [stock, setStock] = useState(String(row.stock));
  const editable = canEdit && !!assessment;
  return (
    <tr className={cn("border-b border-border align-top last:border-0", assessment?.expired && "bg-red-500/5")} data-testid="bom-row" data-designation={row.designation} data-status={assessment?.status ?? "NONE"} data-alert={assessment?.alert ? "true" : "false"}>
      <td className="px-2 py-2 font-mono text-muted-foreground">{row.position ?? "–"}</td>
      <td className="px-2 py-2 font-mono font-semibold text-primary">{row.designation}</td>
      <td className="max-w-72 px-2 py-2">
        <p>{row.description}</p>
        <p className="text-xs text-muted-foreground">
          {[row.manufacturer, row.partNumber].filter(Boolean).join(" · ") || "–"} · {row.kindLabel}
        </p>
        {row.note ? <p className="text-xs text-amber-300">{row.note}</p> : null}
      </td>
      <td className="px-2 py-2 text-right font-mono tabular-nums">
        {n(row.quantity, 2)} {row.unit}
      </td>
      <td className="px-2 py-2">
        <RemainingBar row={row} />
        {assessment ? (
          <p className="mt-1 text-[11px] text-muted-foreground" title={row.basis}>
            {row.limitSource === "datasheet" ? "výrobce: " : row.limitSource === "estimate" && !row.basis.startsWith("odhad") ? "odhad: " : ""}
            {row.basis}
          </p>
        ) : null}
      </td>
      <td className={cn("px-2 py-2 text-xs", assessment?.expired ? "font-semibold text-red-300" : assessment?.alert ? "font-semibold text-amber-300" : "")} data-testid="bom-end">
        {endText(row)}
        {assessment?.alert && !assessment.expired ? <p className="font-normal text-amber-200">🔔 v okně upozornění ({daysWord(row.alertLeadDays)})</p> : null}
      </td>
      <td className="px-2 py-2 text-xs">
        {assessment && row.usesCycles ? (
          <label className="flex items-center gap-1.5" data-testid="bom-rate">
            <Input
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              onBlur={() => {
                const value = parseNumber(rate);
                if (value !== null && value !== row.cyclesPerHour) call(() => updateBomComponentAction({ ...refOf(row), cyclesPerHour: value }), `${row.designation}: ${n(value, 1)} sepnutí/hod – životnost přepočtena.`);
              }}
              onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
              disabled={!editable || pending}
              inputMode="decimal"
              className="h-8 w-16 font-mono text-xs"
              aria-label={`Četnost spínání ${row.designation} [sepnutí/hod]`}
            />
            sepnutí/hod{row.rateSource === "estimate" ? <span className="text-amber-300"> (odhad)</span> : null}
          </label>
        ) : assessment && row.usesHours ? (
          <label className="flex items-center gap-1.5" data-testid="bom-hours">
            <Input
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              onBlur={() => {
                const value = parseNumber(hours);
                if (value !== null && Math.round(value) !== assessment.operatingHours) call(() => updateBomComponentAction({ ...refOf(row), hoursReading: Math.round(value) }), `${row.designation}: odečet ${n(value)} h – životnost přepočtena.`);
              }}
              onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
              disabled={!editable || pending}
              inputMode="numeric"
              className="h-8 w-20 font-mono text-xs"
              aria-label={`Odpracované motohodiny ${row.designation}`}
            />
            h odpracováno
          </label>
        ) : assessment ? (
          <span className="text-muted-foreground">{assessment.limits.map((limit) => limit.label).join(" · ")}</span>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
        {assessment?.thermalDerating ? <p className="mt-1 text-amber-200">🌡️ Arrhenius {n(assessment.thermalDerating.tempC, 1)} °C: {n(assessment.thermalDerating.fromHours)} → {n(assessment.thermalDerating.toHours)} h</p> : null}
      </td>
      <td className="px-2 py-2 text-xs">
        {assessment ? (
          <div className="flex flex-col gap-1.5">
            <span className={row.stock > 0 ? "text-emerald-300" : "font-semibold text-red-300"} data-testid="bom-stock">
              {row.stock > 0 ? `🟢 Skladem: ${row.stock} ks` : "⚠️ 0 ks – Chybí!"}
            </span>
            {editable ? (
              <div className="flex flex-wrap items-center gap-1">
                <Input
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                  onBlur={() => {
                    const value = parseNumber(stock);
                    if (value !== null && Math.round(value) !== row.stock) call(() => setComponentStockAction({ ...refOf(row), quantity: Math.round(value) }), row.sharedStock ? `Sklad ${row.partNumber}: ${Math.round(value)} ks (platí pro celý závod).` : `${row.designation}: skladem ${Math.round(value)} ks.`);
                  }}
                  onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
                  disabled={pending}
                  inputMode="numeric"
                  className="h-7 w-14 font-mono text-xs"
                  aria-label={`Kusů skladem ${row.designation}`}
                  title={row.sharedStock ? "Sklad závodu podle objednacího čísla (všechny stroje)" : "Skladem pro tuto součástku"}
                  data-testid="bom-stock-input"
                />
                <select
                  value={row.ownLead ? String(row.alertLeadDays) : ""}
                  onChange={(event) => call(() => updateBomComponentAction({ ...refOf(row), alertLeadDays: event.target.value ? Number(event.target.value) : null }), `${row.designation}: předstih upozornění ${event.target.value ? `${event.target.value} dní` : "podle stroje"}.`)}
                  disabled={pending}
                  className="h-7 rounded-md border border-input bg-background px-1 text-xs"
                  aria-label={`Předstih upozornění ${row.designation}`}
                  data-testid="bom-lead"
                >
                  <option value="">předstih dle stroje</option>
                  {ALERT_LEAD_OPTIONS.map((days) => (
                    <option key={days} value={days}>
                      {days} dní
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-muted-foreground">předstih {row.alertLeadDays} dní</span>
            )}
            {editable ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 self-start px-2 text-xs"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Zapsat výměnu ${row.designation} za nový kus? Životnost začne znovu na 100 % k dnešnímu dni${row.stock > 0 ? " a 1 ks se odepíše ze skladu" : ""}.`)) {
                    call(() => replaceBomComponentAction(refOf(row)), `${row.designation}: vyměněno – zbývá 100 %.`);
                  }
                }}
                data-testid="bom-replace"
              >
                <RefreshCw className="size-3" aria-hidden /> 🔄 Vyměněno (Reset 100 %)
              </Button>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </td>
      <td className="px-2 py-2">
        {row.partNumber ? (
          <Button type="button" size="sm" variant={row.datasheet?.verified ? "default" : "outline"} className="h-8 gap-1 px-2 text-xs" onClick={onSheet} data-testid="bom-datasheet" data-verified={row.datasheet?.verified ? "true" : "false"}>
            📄 Datasheet
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">–</span>
        )}
      </td>
    </tr>
  );
}
