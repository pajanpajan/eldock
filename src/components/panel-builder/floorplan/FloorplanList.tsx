"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { clearLegacyDraft, defaultFloorplanName, hasLegacySlot, readLegacyDraft } from "@/lib/panel-builder/floorplan-storage";
import { cn } from "@/lib/utils";
import { duplicateFloorplanAction, importBrowserFloorplanAction, trashFloorplanAction, updateFloorplanMetaAction } from "@/server/actions/floorplans";
import type { FloorplanRow } from "@/server/queries/floorplans";

import { FloorplanMetaDialog } from "./FloorplanMetaDialog";
import { StartChoiceButtons } from "./FloorplanStartChoice";

// Fáze 64: seznam uložených 2D půdorysů firmy – otevření, údaje, kopie, koš s obnovením. Rozpracovaný nákres z prohlížeče
// (do fáze 63 jediný slot `eldock.pb.floorplan`) se při otevření seznamu převezme na server.

const count = (value: number, forms: [string, string, string]) => `${value} ${value === 1 ? forms[0] : value >= 2 && value <= 4 ? forms[1] : forms[2]}`;

function summary(row: FloorplanRow) {
  return [count(row.floorCount, ["podlaží", "podlaží", "podlaží"]), count(row.roomCount, ["místnost", "místnosti", "místností"]), count(row.elementCount, ["prvek", "prvky", "prvků"])].join(" · ");
}

export function FloorplanList({ active, deleted }: { active: FloorplanRow[]; deleted: FloorplanRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<FloorplanRow | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const imported = useRef(false);

  // Převzetí rozpracovaného nákresu z prohlížeče (jednou – i ve vývojovém dvojím spuštění efektu)
  useEffect(() => {
    if (imported.current || !hasLegacySlot()) return;
    imported.current = true;
    const legacy = readLegacyDraft();
    if (!legacy) {
      clearLegacyDraft();
      return;
    }
    void importBrowserFloorplanAction({ draft: legacy, name: `Půdorys z prohlížeče (${new Date().toLocaleDateString("cs-CZ")})` }).then((result) => {
      if (!result.ok) return void toast.error(`${result.error} Nákres zůstává v tomto prohlížeči.`);
      clearLegacyDraft();
      toast.success(result.data.created ? "Rozpracovaný půdorys z tohoto prohlížeče je teď uložený na serveru." : "Rozpracovaný půdorys z tohoto prohlížeče už na serveru je.");
      router.refresh();
    });
  }, [router]);

  function run(id: string, task: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) {
    setBusy(id);
    startTransition(async () => {
      const result = await task();
      setBusy(null);
      if (!result.ok) return void toast.error(result.error);
      if (done) toast.success(done);
      router.refresh();
    });
  }

  function duplicate(row: FloorplanRow) {
    setBusy(row.id);
    startTransition(async () => {
      const result = await duplicateFloorplanAction(row.id);
      setBusy(null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Vytvořena kopie půdorysu „${row.name}“.`);
      router.refresh();
    });
  }

  const icon = (id: string, Icon: typeof Copy) => (busy === id && pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />);

  return (
    <div className="flex flex-col gap-4" data-testid="floorplan-list">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/panel-builder/floorplan/novy" className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" data-testid="floorplan-new">
          <Plus className="size-4" aria-hidden /> Nový půdorys
        </Link>
        {/* Fáze 92: trenažér nanečisto – rozdělaný bungalov 4+kk, rozváděč bez kreditu */}
        <Link href="/panel-builder/floorplan/trenazer" className="inline-flex h-10 items-center gap-1.5 rounded-md border border-yellow-400/70 px-4 text-sm font-semibold text-yellow-200 hover:bg-yellow-400/10" data-testid="floorplan-trainer-open">
          🎯 Vyzkoušet nanečisto (Trenažér zdarma)
        </Link>
        <p className="text-xs text-muted-foreground">Půdorysy se ukládají na server průběžně při kreslení – otevřete je z libovolného počítače.</p>
      </div>

      {active.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3" data-testid="floorplan-card">
              <Link href={`/panel-builder/floorplan/${row.id}`} className="group flex flex-col gap-1">
                <span className="font-semibold group-hover:text-primary">
                  {/* Fáze 78: kód půdorysu ve firmě */}
                  {row.code ? <span className="mr-1.5 rounded border border-border bg-muted px-1 font-mono text-xs font-normal text-muted-foreground" data-testid="floorplan-row-code">{row.code}</span> : null}
                  📐 {row.name}
                </span>
                {row.customerName || row.installationSite ? (
                  <span className="text-xs text-muted-foreground">{[row.customerName, row.installationSite ? `📍 ${row.installationSite}` : null].filter(Boolean).join(" · ")}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">{summary(row)}</span>
                {/* Relativní čas se na serveru a v prohlížeči může lišit o pár sekund */}
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  upraveno {formatRelative(row.updatedAt)}
                </span>
              </Link>
              {row.project ? (
                <Link href={`/panel-builder/${row.project.id}`} className="w-fit rounded-md border border-border px-2 py-0.5 text-xs hover:border-primary">
                  ⚡ Rozváděč <span className="font-mono">{row.project.code}</span>
                </Link>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-1 border-t border-border pt-2">
                <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => setEditing(row)} aria-label={`Upravit údaje půdorysu ${row.name}`}>
                  <Pencil className="size-4" aria-hidden /> Údaje
                </Button>
                <Button type="button" variant="ghost" size="sm" className="gap-1" disabled={pending} onClick={() => duplicate(row)} aria-label={`Kopie půdorysu ${row.name}`}>
                  {icon(row.id, Copy)} Kopie
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto gap-1 text-red-300 hover:text-red-200"
                  disabled={pending}
                  onClick={() => run(row.id, () => trashFloorplanAction(row.id, "trash"), `Půdorys „${row.name}“ je v koši – jde obnovit.`)}
                  aria-label={`Smazat půdorys ${row.name}`}
                >
                  <Trash2 className="size-4" aria-hidden /> Smazat
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground" data-testid="floorplan-empty">
          <p className="text-center">Zatím nemáte žádný uložený půdorys. Jak chcete začít?</p>
          {/* Fáze 92: přívětivá volba pro nového uživatele */}
          <StartChoiceButtons />
        </div>
      )}

      {deleted.length ? (
        <section className="flex flex-col gap-2" aria-label="Koš půdorysů">
          <button type="button" className="w-fit text-sm text-muted-foreground underline-offset-2 hover:underline" onClick={() => setShowTrash((value) => !value)} aria-expanded={showTrash} data-testid="floorplan-trash-toggle">
            🗑️ Koš ({deleted.length}) {showTrash ? "▾" : "▸"}
          </button>
          {showTrash ? (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {deleted.map((row) => (
                <li key={row.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2 text-sm")} data-testid="floorplan-trash-row">
                  <span className="font-medium">
                    {row.code ? <span className="mr-1 font-mono text-xs text-muted-foreground">{row.code}</span> : null}
                    {row.name}
                  </span>
                  <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {summary(row)} · smazáno {formatRelative(row.deletedAt ?? row.updatedAt)}
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto gap-1" disabled={pending} onClick={() => run(row.id, () => trashFloorplanAction(row.id, "restore"), `Půdorys „${row.name}“ je obnovený.`)}>
                    {icon(row.id, RotateCcw)} Obnovit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-red-300 hover:text-red-200"
                    disabled={pending}
                    onClick={() => window.confirm(`Smazat půdorys „${row.name}“ natrvalo i s historií verzí? Tuto akci nejde vrátit.`) && run(row.id, () => trashFloorplanAction(row.id, "purge"), "Půdorys je smazaný natrvalo.")}
                  >
                    <Trash2 className="size-4" aria-hidden /> Smazat natrvalo
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {editing ? (
        <FloorplanMetaDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          meta={editing}
          onSave={async (meta) => {
            const result = await updateFloorplanMetaAction(editing.id, { ...meta, name: meta.name || defaultFloorplanName() });
            if (!result.ok) return result.error;
            toast.success("Údaje půdorysu jsou uložené.");
            router.refresh();
            return null;
          }}
        />
      ) : null}
    </div>
  );
}
