import { CalendarClock, ClipboardList, FileDown, Gauge, Thermometer, TriangleAlert, UserRound } from "lucide-react";

import type { BuildingType, EquipmentType } from "@/generated/prisma/enums";

import { formatCount, formatDateShort, INSPECTION_TYPE_LABELS, plural } from "@/lib/format";
import { effectiveIntervalMonths, intervalIssue, isLightCard, isPortable, legalDeadline, type InspectionRule } from "@/lib/inspection-rules";
import type { ReportDefaults } from "@/lib/inspection-report";
import { scopeFromLicense } from "@/lib/inspector-certificate";
import { FUNCTION_TEST_INTERVAL_MONTHS, VISUAL_CHECK_INTERVAL_MONTHS, computeValidUntil, governingInspection, inspectionStateFor, latestOfType, type InspectionState, type InspectionSummary } from "@/lib/inspection";
import { defectState, thermalLevel } from "@/lib/defects";
import { DEFECT_STATE, INSPECTION_RESULT, INSPECTION_STATE, THERMAL_LEVEL } from "@/lib/status";
import { inspectionReportHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { EquipmentInspection } from "@/server/queries/equipment";

import { DefectList } from "./DefectList";
import { DocumentPreviewButton } from "./DocumentPreviewButton";
import { InspectionSettingsDialog, type InspectionSettings } from "./InspectionSettingsDialog";
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
  /** Uložená lhůta zařízení (u VTZ se nové revize zapíší nejvýš se zákonnou). */
  intervalMonths: number;
  rule: InspectionRule;
  inspections: EquipmentInspection[];
  summary: InspectionSummary;
  today: string;
  now: Date;
  /** Fáze 66: podklady lhůty (dialog „Upravit lhůtu“) a kontrola osvědčení při zápisu. */
  building: { name: string; type: BuildingType; crowdOver200: boolean };
  settings: InspectionSettings;
  ratedVoltage: string | null;
  /** Předvyplněné náležitosti zprávy (NV 190/2022 Sb., § 10 odst. 1). */
  reportDefaults: ReportDefaults;
  /** Zápis nové revize a úprava lhůty (revizní technik, vedení údržby). */
  canRecord?: boolean;
  canResolveDefects?: boolean;
  /** Generování PDF revizních zpráv (modul Revize & Legislativa). */
  showReports?: boolean;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Záložka „Revize & Lhůtník“: semafor, odpočet, zákonná lhůta, historie revizních zpráv a termovizí, zápis nové revize. */
export function InspectionLogbook({
  equipmentId,
  tag,
  type,
  protectionClass,
  intervalMonths,
  rule,
  inspections,
  summary,
  today,
  now,
  building,
  settings,
  ratedVoltage,
  reportDefaults,
  canRecord = true,
  canResolveDefects = true,
  showReports = true,
}: Props) {
  const measurable = isPortable(type);
  const openDefects = inspections.flatMap((record) => record.defects).filter((defect) => defect.status === "OPEN");
  const overdueDefects = openDefects.filter((defect) => defectState(defect, now).state === "OVERDUE").length;
  const style = INSPECTION_STATE[summary.state];
  const governing = governingInspection(inspections);
  const thermo = latestOfType(inspections, "THERMOVISION");
  const thermoState = thermo ? inspectionStateFor(thermo.validUntil, now) : null;
  const inspectors: KnownInspector[] = [];
  for (const record of inspections) {
    const known = inspectors.find((item) => item.name === record.inspectorName && item.license === record.inspectorLicense);
    if (!known) {
      inspectors.push({
        name: record.inspectorName,
        license: record.inspectorLicense,
        scope: record.inspectorScope ?? scopeFromLicense(record.inspectorLicense),
        validUntil: record.inspectorValidUntil ? isoDay(record.inspectorValidUntil) : null,
      });
    } else if (!known.validUntil && record.inspectorValidUntil) known.validUntil = isoDay(record.inspectorValidUntil);
  }
  // Předvyplní se revizní technik s osvědčením (ne termodiagnostik z poslední termovize); jinak podle data
  inspectors.sort((a, b) => Number(!!b.scope) - Number(!!a.scope));
  const year = today.slice(0, 4);
  const suggestedReportNumber = `RZ-${year}-${String(inspections.length + 1).padStart(3, "0")}/${tag}`;
  const days = summary.daysLeft;
  // Fáze 66: zákonná lhůta (NV 190/2022 Sb., příloha č. 4) – delší uložená lhůta se ořízne, nejzazší termín do konce roku
  const effective = effectiveIntervalMonths(intervalMonths, rule);
  const issue = intervalIssue(intervalMonths, rule);
  const deadline = governing && governing.result !== "INCAPABLE" ? legalDeadline(governing.inspectionDate, governing.validUntil, rule) : null;
  // Zobrazí se, když se liší od platnosti: dřív (delší starší lhůta) nebo později (konec kalendářního roku)
  const legal = deadline && governing && deadline.getTime() !== governing.validUntil.getTime() ? { date: deadline, shorter: deadline.getTime() < governing.validUntil.getTime(), past: inspectionStateFor(deadline, now) === "EXPIRED" } : null;
  // Vizuální kontrola LPS 1× ročně: poslední kontrola nebo revize (revize kontrolu zahrnuje)
  const visual = latestOfType(inspections, "VISUAL_CHECK");
  const lastVisual = [visual?.inspectionDate, governing?.inspectionDate].filter((date): date is Date => !!date).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const visualDue = lastVisual ? computeValidUntil(lastVisual, VISUAL_CHECK_INTERVAL_MONTHS) : null;
  const visualState = visualDue ? inspectionStateFor(visualDue, now) : "MISSING";
  // Fáze 93: měsíční zkouška funkce nouzového osvětlení (revize ji zahrnuje)
  const functionTest = latestOfType(inspections, "FUNCTION_TEST");
  const lastFunction = [functionTest?.inspectionDate, governing?.inspectionDate].filter((date): date is Date => !!date).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const functionDue = lastFunction ? computeValidUntil(lastFunction, FUNCTION_TEST_INTERVAL_MONTHS) : null;
  const functionState = functionDue ? inspectionStateFor(functionDue, now) : "MISSING";

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
            <dd className="font-medium" title={rule.basis} data-testid="inspection-interval">
              {formatCount(effective, ["měsíc", "měsíce", "měsíců"])}
              {effective < rule.months ? <span className="block text-xs font-normal text-muted-foreground">vlastní kratší (předpis {rule.months} m)</span> : null}
              {effective > rule.months ? <span className="block text-xs font-normal text-muted-foreground">řád preventivní údržby</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Poslední revize</dt>
            <dd className="font-medium">
              {governing ? `${formatDateShort(governing.inspectionDate)} · ${governing.reportNumber}` : "–"}
            </dd>
          </div>
          {type === "LIGHTNING_ROD" ? (
            <div>
              <dt className="text-muted-foreground">Vizuální kontrola (1× ročně)</dt>
              <dd className={cn("font-medium", INSPECTION_STATE[visualState].text)} data-testid="lps-visual-check">
                {visualDue ? `${visualState === "EXPIRED" ? "propadlá" : "do"} ${formatDateShort(visualDue)}` : "chybí"}
              </dd>
            </div>
          ) : type === "EMERGENCY_LIGHTING" ? (
            <div>
              <dt className="text-muted-foreground">Zkouška funkce (1× měsíčně)</dt>
              <dd className={cn("font-medium", INSPECTION_STATE[functionState].text)} data-testid="emergency-function-test">
                {functionDue ? `${functionState === "EXPIRED" ? "propadlá" : "do"} ${formatDateShort(functionDue)}` : "chybí"}
              </dd>
            </div>
          ) : isLightCard(type) ? (
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
          {legal ? (
            <div className="col-span-2">
              <dt className="text-muted-foreground">
                Nejzazší termín podle NV 190/2022 Sb. {legal.shorter ? "(zákonná lhůta od poslední revize)" : "(příloha č. 4, pozn. b – do konce roku)"}
              </dt>
              <dd className={cn("font-mono font-medium", legal.past ? INSPECTION_STATE.EXPIRED.text : legal.shorter ? INSPECTION_STATE.EXPIRING.text : "")} data-testid="inspection-legal-deadline">
                do {formatDateShort(legal.date)}
                {legal.past ? " – po zákonném termínu" : ""}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-col gap-2 sm:self-start">
          {canRecord ? (
            <>
              <RecordInspectionDialog
                equipmentId={equipmentId}
                tag={tag}
                type={type}
                intervalMonths={effective}
                rule={rule}
                ratedVoltage={ratedVoltage}
                externalInfluences={settings.externalInfluences}
                today={today}
                suggestedReportNumber={suggestedReportNumber}
                inspectors={inspectors}
                reportDefaults={reportDefaults}
                lastInstrument={inspections.find((record) => record.measuringInstrument)?.measuringInstrument ?? null}
                measurable={measurable}
                protectionClass={protectionClass}
              />
              <InspectionSettingsDialog
                equipmentId={equipmentId}
                tag={tag}
                type={type}
                building={building}
                settings={settings}
                governing={governing ? { inspectionDate: isoDay(governing.inspectionDate), validUntil: isoDay(governing.validUntil) } : null}
              />
            </>
          ) : null}
        </div>
      </section>

      {issue ? (
        <p className={cn("flex items-start gap-2 rounded-xl border p-4 text-sm", issue.level === "error" ? DEFECT_STATE.OVERDUE.soft : DEFECT_STATE.OPEN.soft)} data-testid="inspection-interval-issue">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{issue.message}</span>
        </p>
      ) : null}
      {governing?.validUntilOriginal ? (
        <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground" data-testid="inspection-capped">
          Platnost revize {governing.reportNumber} je zkrácená na nejdelší zákonnou lhůtu (NV 190/2022 Sb., příloha č. 4) – ve zprávě bylo uvedeno {formatDateShort(governing.validUntilOriginal)}.
        </p>
      ) : null}

      {openDefects.length ? (
        <p className={cn("flex items-start gap-2 rounded-xl border p-4 text-sm", overdueDefects ? DEFECT_STATE.OVERDUE.soft : DEFECT_STATE.OPEN.soft)}>
          <TriangleAlert className={cn("mt-0.5 size-4 shrink-0", overdueDefects ? DEFECT_STATE.OVERDUE.text : DEFECT_STATE.OPEN.text)} aria-hidden />
          <span>
            <span className="font-semibold">
              Neodstraněné závady z revizí: {openDefects.length}
              {overdueDefects ? ` (z toho ${overdueDefects} po lhůtě)` : ""}
            </span>{" "}
            – {openDefects.map((defect) => defect.description).join(" · ")}
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
                      {/* Fáze 108: podepsaná revize (pečeť SHA-256, PAdES) a zneplatnění technikem */}
                      {record.sealHash ? (
                        <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200" title={`SHA-256 ${record.sealHash}`} data-testid="record-signed">
                          🔏 podepsáno{record.padesUrl ? " + PAdES" : ""}
                        </span>
                      ) : null}
                      {record.misuseFlaggedAt ? (
                        <span className="rounded-full border border-red-500/60 bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-200" data-testid="record-flagged">
                          ⛔ zneplatněno technikem
                        </span>
                      ) : null}
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
                    {record.maxTempC !== null || record.deltaTempC !== null ? (
                      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <Thermometer className="size-4 text-muted-foreground" aria-hidden />
                        <span>
                          Max. <span className="font-mono">{record.maxTempC === null ? "–" : `${String(record.maxTempC).replace(".", ",")} °C`}</span>
                        </span>
                        {record.deltaTempC !== null ? (
                          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", THERMAL_LEVEL[thermalLevel(record.deltaTempC)].badge)}>
                            ΔT {String(record.deltaTempC).replace(".", ",")} K · {THERMAL_LEVEL[thermalLevel(record.deltaTempC)].label}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    {record.defects.length ? (
                      <DefectList defects={record.defects} now={now} canResolve={canResolveDefects} />
                    ) : record.defectsSummary ? (
                      <p className={cn("rounded-lg border p-2.5 text-sm", result.soft)}>
                        <span className="font-medium">Závady: </span>
                        {record.defectsSummary}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <DocumentPreviewButton
                        url={record.reportUrl}
                        title={`${INSPECTION_TYPE_LABELS[record.type]} ${record.reportNumber}`}
                        subtitle={`${tag} · platnost do ${formatDateShort(record.validUntil)}`}
                      />
                      {showReports ? (
                      <Button asChild variant="outline" className="touch-target gap-2">
                        <a href={inspectionReportHref(record.id)} target="_blank" rel="noopener">
                          <FileDown className="size-4" aria-hidden />
                          Generovat revizní zprávu (PDF)
                        </a>
                      </Button>
                      ) : null}
                    </div>
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
