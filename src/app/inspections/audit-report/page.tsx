import type { Metadata } from "next";
import Link from "next/link";
import { Construction, ShieldCheck, ShieldX, Wrench } from "lucide-react";

import { KpiTile } from "@/components/common/KpiTile";
import { PageHeader } from "@/components/common/PageHeader";
import { AuditReportActions } from "@/components/inspections/AuditReportActions";
import { InspectionStatusBadge } from "@/components/inspections/InspectionStatusBadge";
import { PageTransition } from "@/components/layout/PageTransition";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarizeAudit } from "@/lib/audit-report";
import { defectState } from "@/lib/defects";
import { EQUIPMENT_TYPE_LABELS, formatDateShort, formatDateTime } from "@/lib/format";
import { inspectionRuleFor } from "@/lib/inspection-rules";
import { equipmentHref } from "@/lib/routes";
import { DEFECT_SEVERITY, DEFECT_STATE, INSPECTION_RESULT, INSPECTION_STATE, TEMP_MOD_OVERDUE, TEMP_MOD_STATUS, inspectionBadgeLabel } from "@/lib/status";
import { tempModCountdown } from "@/lib/temporary-mod";
import { cn } from "@/lib/utils";
import { getAuditReport } from "@/server/queries/inspections";
import { getPlants } from "@/server/queries/plant";
import { getCurrentRole, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = { title: "Auditní report revizí" };

// Kniha revizí závodu pro kontrolu TIČR / ISO: shoda, kategorie, závady, provizoria; tisk a CSV.
export default async function AuditReportPage() {
  const [role, plants, rememberedId] = await Promise.all([getCurrentRole(), getPlants(), getRememberedPlantId()]);
  const plant = role === "MAINTENANCE" ? (plants.find((entry) => entry.id === rememberedId) ?? plants[0]) : undefined;
  const now = new Date();
  const { rows, defects, mods } = await getAuditReport(plant?.id, now);
  const { overall, byLayer } = summarizeAudit(rows.map((row) => ({ type: row.type, state: row.summary.state })));
  const overdueDefects = defects.filter((defect) => defectState(defect, now).state === "OVERDUE").length;
  const overdueMods = mods.filter((mod) => tempModCountdown(mod.expiresAt, now).overdue).length;
  const plantName = plant?.name ?? "Všechny závody";

  const csvRows = [
    ["Tag", "Zařízení", "Typ", "Umístění", "Norma", "Lhůta (měsíce)", "Poslední revize", "Číslo zprávy", "Revizní technik", "Posudek", "Platnost do", "Stav"],
    ...rows.map((row) => [
      row.tag,
      row.name.replace(`${row.tag} - `, ""),
      EQUIPMENT_TYPE_LABELS[row.type],
      row.location,
      inspectionRuleFor(row).standard,
      String(row.inspectionIntervalMonths),
      row.last ? formatDateShort(row.last.inspectionDate) : "",
      row.last?.reportNumber ?? "",
      row.last?.inspectorName ?? "",
      row.last ? INSPECTION_RESULT[row.last.result].label : "",
      row.summary.validUntil ? formatDateShort(row.summary.validUntil) : "",
      inspectionBadgeLabel(row.summary.state, row.summary.validUntil, row.summary.daysLeft),
    ]),
  ];

  return (
    <PageTransition>
      <div className="print-report space-y-8">
        <PageHeader
          title="Auditní report – Kniha revizí"
          description={`${plantName} · stav k ${formatDateTime(now)} · ČSN 33 1500, ČSN 33 1600 ed. 2, NV 378/2001 Sb., NV 190/2022 Sb.`}
          actions={<AuditReportActions csvRows={csvRows} fileName={`kniha-revizi-${now.toISOString().slice(0, 10)}.csv`} />}
        />

        <section aria-label="Souhrn shody" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label="Shoda závodu"
            value={`${String(overall.percent).replace(".", ",")} %`}
            hint={`${overall.valid + overall.expiring} z ${overall.total} zařízení s platnou revizí`}
            icon={ShieldCheck}
            accent={overall.percent >= 95 ? INSPECTION_STATE.VALID.text : overall.percent >= 85 ? INSPECTION_STATE.EXPIRING.text : INSPECTION_STATE.EXPIRED.text}
          />
          <KpiTile label="Propadlé / vyřazené / bez revize" value={overall.nonCompliant} icon={ShieldX} accent={overall.nonCompliant ? INSPECTION_STATE.EXPIRED.text : undefined} hint={`Končí do 30 dnů: ${overall.expiring}`} />
          <KpiTile label="Otevřené revizní závady" value={defects.length} icon={Wrench} accent={overdueDefects ? DEFECT_STATE.OVERDUE.text : defects.length ? DEFECT_STATE.OPEN.text : undefined} hint={`Po lhůtě: ${overdueDefects}`} />
          <KpiTile label="Aktivní provizoria" value={mods.length} icon={Construction} accent={mods.length ? TEMP_MOD_STATUS.ACTIVE.text : undefined} hint={`Po termínu: ${overdueMods}`} />
        </section>

        <section aria-labelledby="audit-categories" className="space-y-3">
          <h2 id="audit-categories" className="text-lg font-semibold">
            Revize podle kategorií
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">Celkem</TableHead>
                  <TableHead className="text-right">Platné</TableHead>
                  <TableHead className="text-right">Končí do 30 dnů</TableHead>
                  <TableHead className="text-right">Nevyhovuje</TableHead>
                  <TableHead className="text-right">Shoda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byLayer.map((entry) => (
                  <TableRow key={entry.key}>
                    <TableCell className="font-medium">{entry.label}</TableCell>
                    <TableCell className="text-right font-mono">{entry.total}</TableCell>
                    <TableCell className="text-right font-mono">{entry.valid}</TableCell>
                    <TableCell className="text-right font-mono">{entry.expiring}</TableCell>
                    <TableCell className={cn("text-right font-mono", entry.nonCompliant && INSPECTION_STATE.EXPIRED.text)}>{entry.nonCompliant}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{String(entry.percent).replace(".", ",")} %</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section aria-labelledby="audit-defects" className="space-y-3">
          <h2 id="audit-defects" className="text-lg font-semibold">
            Otevřené revizní závady <span className="font-mono text-sm text-muted-foreground">{defects.length}</span>
          </h2>
          {defects.length ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zařízení</TableHead>
                    <TableHead>Závada</TableHead>
                    <TableHead>Závažnost</TableHead>
                    <TableHead>Zpráva</TableHead>
                    <TableHead>Lhůta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defects.map((defect) => {
                    const { state } = defectState(defect, now);
                    return (
                      <TableRow key={defect.id}>
                        <TableCell>
                          <Link href={`${equipmentHref(defect.equipment.id)}?tab=inspections`} className="font-mono font-semibold text-primary underline-offset-4 hover:underline">
                            {defect.equipment.tag}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-normal">{defect.description}</TableCell>
                        <TableCell>{DEFECT_SEVERITY[defect.severity].label}</TableCell>
                        <TableCell className="font-mono text-xs">{defect.inspection.reportNumber}</TableCell>
                        <TableCell className={cn("font-mono", DEFECT_STATE[state].text)}>
                          {formatDateShort(defect.deadline)}
                          {state === "OVERDUE" ? " · po lhůtě" : ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Žádné otevřené závady.</p>
          )}
        </section>

        <section aria-labelledby="audit-mods" className="space-y-3">
          <h2 id="audit-mods" className="text-lg font-semibold">
            Aktivní dočasná provizoria v hale <span className="font-mono text-sm text-muted-foreground">{mods.length}</span>
          </h2>
          {mods.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {mods.map((mod) => {
                const { daysLeft, overdue } = tempModCountdown(mod.expiresAt, now);
                const style = overdue ? TEMP_MOD_OVERDUE : TEMP_MOD_STATUS.ACTIVE;
                return (
                  <li key={mod.id} className={cn("space-y-1 rounded-xl border p-4", style.soft)}>
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono font-semibold">{mod.number}</span>
                      <Link href={equipmentHref(mod.equipment.id)} className="font-mono text-primary underline-offset-4 hover:underline">
                        {mod.equipment.tag}
                      </Link>
                      <span className={cn("ml-auto font-medium", style.text)}>
                        {overdue ? `PO TERMÍNU (${-daysLeft} d)` : `odstranit do ${formatDateShort(mod.expiresAt)} (${daysLeft} d)`}
                      </span>
                    </p>
                    <p className="font-medium">{mod.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {mod.equipment.floor.building.name} › {mod.equipment.floor.name} · {mod.createdByName} ({mod.createdByRole})
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">V závodě nejsou žádná aktivní provizoria.</p>
          )}
        </section>

        <section aria-labelledby="audit-book" className="space-y-3">
          <h2 id="audit-book" className="text-lg font-semibold">
            Kniha revizí závodu <span className="font-mono text-sm text-muted-foreground">{rows.length}</span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Zařízení</TableHead>
                  <TableHead>Umístění</TableHead>
                  <TableHead>Norma · lhůta</TableHead>
                  <TableHead>Poslední revize</TableHead>
                  <TableHead>Stav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={equipmentHref(row.id)} className="font-mono font-semibold text-primary underline-offset-4 hover:underline">
                        {row.tag}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal">
                      {row.name.replace(`${row.tag} - `, "")}
                      <span className="block text-xs text-muted-foreground">{EQUIPMENT_TYPE_LABELS[row.type]}</span>
                    </TableCell>
                    <TableCell className="text-sm whitespace-normal text-muted-foreground">{row.location}</TableCell>
                    <TableCell className="text-sm">
                      {inspectionRuleFor(row).standard} · {row.inspectionIntervalMonths} m
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.last ? (
                        <>
                          {formatDateShort(row.last.inspectionDate)} · <span className="font-mono text-xs">{row.last.reportNumber}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.last.inspectorName} · {INSPECTION_RESULT[row.last.result].label}
                          </span>
                        </>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell>
                      <InspectionStatusBadge summary={row.summary} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="hidden pt-6 text-sm print:block">Kontroloval: ____________________ · Datum: ____________ · Podpis: ____________</p>
        </section>
      </div>
    </PageTransition>
  );
}
