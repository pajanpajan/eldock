import Link from "next/link";
import { Cpu, QrCode, ScanLine } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/format";
import { EQUIPMENT_GROUPS } from "@/lib/plant-phases";
import { equipmentHref } from "@/lib/routes";
import type { PlantAgendaRow } from "@/server/queries/plant-agenda";

/**
 * Fáze 98: agenda „2. Rozváděče, Stroje & QR štítky“ – karty rozváděčů, strojů a ostatních zařízení závodu se stavem
 * dokumentace, odkazem na kartu zařízení a tiskem QR štítku (A7 na dveře rozváděče / stroj).
 */
export function PlantEquipmentBoard({ rows, fieldView }: { rows: readonly PlantAgendaRow[]; fieldView: boolean }) {
  if (!rows.length) {
    return <EmptyState icon={Cpu} title="Závod zatím nemá žádná zařízení" description="Rozváděče a stroje přidáte ve Studiu výstavby, importem BIM (.ifc) nebo importem soupisu z revizí." />;
  }
  const labelled = rows.filter((row) => row.hasQr).length;
  return (
    <section aria-label="Rozváděče, stroje a QR štítky" className="flex flex-col gap-5" data-testid="plant-equipment">
      <p className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground" data-testid="plant-qr-summary">
        <ScanLine className="size-5 shrink-0 text-primary" aria-hidden />
        {fieldView ? "Naskenujte QR štítek na rozváděči nebo stroji – otevře se rovnou jeho schéma. " : null}
        QR štítek vygenerován u <b className="font-mono text-foreground">{labelled} / {rows.length}</b> zařízení – tisk štítku z karty níže (A7, odolný štítek na dveře rozváděče).
      </p>
      {EQUIPMENT_GROUPS.map((group) => {
        const items = rows.filter((row) => row.group === group.id);
        if (!items.length) return null;
        return (
          <div key={group.id} className="flex flex-col gap-2" data-testid={`plant-equipment-${group.id}`}>
            <h2 className="text-sm font-semibold">
              {group.label} <span className="font-mono text-xs text-muted-foreground">({items.length})</span>
            </h2>
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {items.map((row) => (
                <li key={row.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-sm" data-testid="plant-equipment-card" data-tag={row.tag}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={equipmentHref(row.id)} className="min-w-0 font-semibold hover:text-primary">
                      <span className="font-mono">{row.tag}</span> <span className="text-muted-foreground">·</span> {row.name}
                    </Link>
                    <StatusBadge kind="equipment" status={row.status} className="shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {EQUIPMENT_TYPE_LABELS[row.type]} · {row.location}
                    {row.manufacturer ? ` · ${[row.manufacturer, row.model].filter(Boolean).join(" ")}` : ""}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <Link href={equipmentHref(row.id)} className="touch-target flex items-center rounded-md border border-border px-2.5 text-xs font-semibold hover:border-primary/60" data-testid="plant-equipment-open">
                      📋 Karta zařízení
                    </Link>
                    <a href={`${equipmentHref(row.id)}/label`} target="_blank" rel="noopener" className="touch-target flex items-center gap-1 rounded-md border border-border px-2.5 text-xs font-semibold hover:border-primary/60" data-testid="plant-equipment-qr">
                      <QrCode className="size-3.5" aria-hidden /> {row.hasQr ? "Tisk QR štítku" : "Vygenerovat a vytisknout QR štítek"}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
