import { CalendarClock, ClipboardList, Gauge, Thermometer, TriangleAlert, UserRound } from "lucide-react";

import type { EquipmentType } from "@/generated/prisma/enums";

import { formatCount, formatDateShort, INSPECTION_TYPE_LABELS, plural } from "@/lib/format";
import { isLightCard, isPortable, type InspectionRule } from "@/lib/inspection-rules";
import { governingInspection, inspectionStateFor, latestOfType, type InspectionState, type InspectionSummary } from "@/lib/inspection";
import { INSPECTION_RESULT, INSPECTION_STATE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { EquipmentInspection } from "@/server/queries/equipment";

import { DocumentPreviewButton } from "./DocumentPreviewButton";
import { InspectionStatusBadge } from "./InspectionStatusBadge";
import { RecordInspectionDialog, type KnownInspector } from "./RecordInspectionDialog";

const LAMPS: InspectionState[] = ["EXPIRED", "EXPIRING", "VALID"];

/** Semafor platnosti revize: rozsvícená je jen lampa aktuálního stavu. */
function TrafficLight({ state }: { state: InspectionState }) {
  return (
    <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 p-2.5 shadow-inner" role="img" aria-label={`Semafor: ${INSPECTION_STATE[state].label}`}>
      {LAMPS.map((lamp) => {
        const style = INSPECTION_STATE[lamp];
        const on = lamp === (state === "FAILED" ? "EXPIRED" : state);
        return (
          <span
            key={lamp}
            className={cn("size-9 rounded-full border border-black/60 transition-opacity sm:size-11", style.dot, on ? "opacity-100" : "opacity-15")}
            style={on ? { boxShadow: `0 0 18px 4px ${style.hex}99` } : undefined}
          />
        );
      })}
    </div>
  );
}

interface Props {
  equipmentId: string;
  tag: string;
  type: EquipmentType;
  protectionClass: string | null;
  intervalMonths: number;
  rule: InspectionRule;
  inspections: EquipmentInspection[];
  summary: InspectionSummary;
  today: string;
  now: Date;
}

/** Záložka „Revize & Lhůtník“: semafor, odpočet, historie revizních zpráv a termovizí, zápis nové revize. */
export function InspectionLogbook({ equipmentId, tag, type, protectionClass, intervalMonths, rule, inspections, summary, today, now }: Props) {
  const measurable = isPortable(type);
  const style = INSPECTION_STATE[summary.state];
  const governing = governingInspection(inspections);
  const thermo = latestOfType(inspections, "THERMOVISION");
  const thermoState = thermo ? inspectionStateFor(thermo.validUntil, now) : null;
  const inspectors: KnownInspector[] = [];
  for (const record of inspections) {
    if (!inspectors.some((known) => known.name === record.inspectorName && known.license === record.inspectorLicense)) {
      inspectors.push({ name: record.inspectorName, license: record.inspectorLicense });
    }
  }
  const year = today.slice(0, 4);
  const suggestedReportNumber = `RZ-${year}-${String(inspections.length + 1).padStart(3, "0")}/${tag}`;
  const days = summary.daysLeft;

  return (
    <div className="space-y-6">
      <section aria-label="Stav elektrorevize" className={cn("flex flex-col gap-5 rounded-2xl border p-5 sm:flex-row sm:items-center", style.soft)}>
        <div className="flex items-center gap-5">
          <TrafficLight state={summary.state} />
          <div>
            <p className={cn("text-sm font-semibold tracking-wide uppercase", style.text)}>{style.label}</p>
            {days !== null ? (
              <p className="mt-1 font-mono text-5xl font-bold tabular-nums">
                {Math.abs(days)}
                <span className="ml-2 font-sans text-base font-medium text-muted-foreground">
                  {days >= 0 ? `${plural(days, ["den", "dny", "dní"])} do konce platnosti` : `${plural(-days, ["den", "dny", "dní"])} po termínu`}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-lg">Bez záznamu o výchozí ani pravidelné revizi.</p>
            )}
            <div className="mt-2">
              <InspectionStatusBadge summary={summary} className="text-sm" />
            </div>
          </div>
        </div>

        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm sm:border-l sm:border-border sm:pl-6">
          <div>
            <dt className="text-muted-foreground">{summary.state === "EXPIRED" ? "Revize měla proběhnout do" : "Příští pravidelná revize"}</dt>
            <dd className="font-mono text-base font-semibold">
              {summary.state === "FAILED" ? "po opravě" : summary.validUntil ? formatDateShort(summary.validUntil) : "ihned"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lhůta dle {rule.standard}</dt>
            <dd className="font-medium" title={rule.basis}>
              {formatCount(intervalMonths, ["měsíc", "měsíce", "měsíců"])}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Poslední revize</dt>
            <dd className="font-medium">
              {governing ? `${formatDateShort(governing.inspectionDate)} · ${governing.reportNumber}` : "–"}
            </dd>
          </div>
          {isLightCard(type) ? (
            <div>
              <dt className="text-muted-foreground">Pravidlo</dt>
              <dd className="text-xs text-muted-foreground">{rule.basis}</dd>
            </div>
          ) : (
          <div>
            <dt className="text-muted-foreground">Termovize</dt>
            <dd className={cn("font-medium", thermoState ? INSPECTION_STATE[thermoState].text : "text-muted-foreground")}>
              {thermo ? `${thermoState === "EXPIRED" ? "propadlá" : "platná"} do ${formatDateShort(thermo.validUntil)}` : "neprovádí se"}
            </dd>
          </div>
          )}
        </dl>

        <div className="sm:self-start">
          <RecordInspectionDialog
            equipmentId={equipmentId}
            tag={tag}
            intervalMonths={intervalMonths}
            today={today}
            suggestedReportNumber={suggestedReportNumber}
            inspectors={inspectors}
            measurable={measurable}
            protectionClass={protectionClass}
          />
        </div>
      </section>

      {governing?.defectsSummary && summary.state !== "VALID" ? (
        <p className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-400" aria-hidden />
          <span>
            <span className="font-semibold">Neodstraněné závady z poslední revize:</span> {governing.defectsSummary}
          </span>
        </p>
      ) : null}

      <section aria-labelledby="inspection-history" className="space-y-3">
        <h2 id="inspection-history" className="flex items-center gap-2 text-lg font-semibold">
          <ClipboardList className="size-5 text-primary" aria-hidden />
          {isLightCard(type) ? "Historie revizí a měření" : "Historie revizních zpráv a termovizí"}
        </h2>
        {inspections.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Zatím nebyla zapsána žádná revize.</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-border pl-6">
            {inspections.map((record) => {
              const result = INSPECTION_RESULT[record.result];
              const ResultIcon = result.icon;
              const isGoverning = record.id === governing?.id;
              const recordState = inspectionStateFor(record.validUntil, now);
              const TypeIcon = record.type === "THERMOVISION" ? Thermometer : CalendarClock;
              return (
                <li key={record.id} className="relative">
                  <span className={cn("absolute top-5 -left-[33px] size-4 rounded-full border-4 border-background", result.dot)} aria-hidden />
                  <article className={cn("space-y-3 rounded-xl border bg-card p-4", isGoverning ? "border-primary/60" : "border-border")}>
                    <header className="flex flex-wrap items-center gap-2">
                      <TypeIcon className="size-4 text-muted-foreground" aria-hidden />
                      <span className="font-semibold">{INSPECTION_TYPE_LABELS[record.type]}</span>
                      <span className="rounded-full border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">{record.reportNumber}</span>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", result.badge)}>
                        <ResultIcon className="size-3.5" aria-hidden />
                        {result.label}
                      </span>
                      {isGoverning ? <span className="text-xs font-medium text-primary">určuje lhůtu</span> : null}
                      <span className="ml-auto text-sm text-muted-foreground">{formatDateShort(record.inspectionDate)}</span>
                    </header>
                    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">Platnost do</dt>
                        <dd className={cn("font-mono", recordState === "EXPIRED" ? "text-muted-foreground line-through decoration-1" : INSPECTION_STATE[recordState].text)}>
                          {formatDateShort(record.validUntil)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{record.type === "THERMOVISION" ? "Termodiagnostik" : "Revizní technik"}</dt>
                        <dd className="flex items-center gap-1.5">
                          <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
                          {record.inspectorName}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Osvědčení</dt>
                        <dd className="font-mono text-xs">{record.inspectorLicense}</dd>
                      </div>
                    </dl>
                    {record.measuringInstrument ? (
                      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <Gauge className="size-4 text-muted-foreground" aria-hidden />
                        <span>
                          R<sub>PE</sub>{" "}
                          <span className="font-mono">
                            {record.protectiveConductorResistance === null ? "neměří se" : `${String(record.protectiveConductorResistance).replace(".", ",")} Ω`}
                          </span>
                        </span>
                        <span>
                          R<sub>iso</sub>{" "}
                          <span className="font-mono">{record.insulationResistance === null ? "–" : `${String(record.insulationResistance).replace(".", ",")} MΩ`}</span>
                        </span>
                        <span className="text-muted-foreground">{record.measuringInstrument}</span>
                      </p>
                    ) : null}
                    {record.defectsSummary ? (
                      <p className={cn("rounded-lg border p-2.5 text-sm", result.soft)}>
                        <span className="font-medium">Závady: </span>
                        {record.defectsSummary}
                      </p>
                    ) : null}
                    <DocumentPreviewButton
                      url={record.reportUrl}
                      title={`${INSPECTION_TYPE_LABELS[record.type]} ${record.reportNumber}`}
                      subtitle={`${tag} · platnost do ${formatDateShort(record.validUntil)}`}
                    />
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
