"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDot, Loader2, Pencil, Redo2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { cn } from "@/lib/utils";

import { FloorplanMetaDialog } from "./FloorplanMetaDialog";
import type { FloorplanMetaState, SyncStatus } from "./useFloorplanSync";
import { VersionHistoryButton } from "./VersionHistory";

// Fáze 64: lišta uloženého půdorysu nad editorem – název a údaje, Zpět / Znovu, stav ukládání, historie verzí,
// vygenerovaný rozváděč a volba při souběhu dvou oken. Fáze 78: kód půdorysu (FP-001), „☁️ Uloženo v cloudu (HH:MM:SS)“,
// uložené půdorysy firmy a soubor projektu do počítače (`FloorplanFileMenu`).

const time = (iso: string) => new Date(iso).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function SaveState({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  const base = "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs";
  if (status.kind === "saved")
    return (
      <span className={cn(base, status.at ? "border-emerald-500/50 text-emerald-300" : "border-border text-muted-foreground")} data-testid="floorplan-save-status" data-state="saved" role="status">
        <CheckCircle2 className="size-3.5" aria-hidden /> {status.at ? `☁️ Uloženo v cloudu (${time(status.at)})` : "Nový půdorys – uloží se po první změně"}
      </span>
    );
  if (status.kind === "pending" || status.kind === "saving")
    return (
      <span className={cn(base, "border-sky-500/50 text-sky-200")} data-testid="floorplan-save-status" data-state={status.kind} role="status">
        {status.kind === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CircleDot className="size-3.5" aria-hidden />} {status.kind === "saving" ? "Ukládám…" : "Neuložené změny"}
      </span>
    );
  if (status.kind === "error")
    return (
      <span className={cn(base, "border-red-500/60 text-red-200")} data-testid="floorplan-save-status" data-state="error" role="status" title={status.message}>
        <AlertTriangle className="size-3.5" aria-hidden /> Neuloženo
        <button type="button" className="underline underline-offset-2" onClick={onRetry}>
          Uložit znovu
        </button>
      </span>
    );
  return (
    <span className={cn(base, "border-amber-400/60 text-amber-200")} data-testid="floorplan-save-status" data-state="conflict" role="status">
      <AlertTriangle className="size-3.5" aria-hidden /> Souběh – vyberte verzi
    </span>
  );
}

export function FloorplanDocumentBar({
  leading = null,
  meta,
  code = null,
  fileMenu = null,
  onMeta,
  floorplanId,
  status,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  project,
  flush,
  onRestored,
  onReload,
  onKeepMine,
  trainer = false,
}: {
  /** Fáze 92: trenažér – nákres se nikam neukládá (místo stavu ukládání štítek trenažéru). */
  trainer?: boolean;
  /** Fáze 89: nadpis stránky s nápovědou (?) v jednom řádku s projektovou lištou. */
  leading?: ReactNode;
  meta: FloorplanMetaState;
  /** Fáze 78: kód půdorysu ve firmě („FP-001“). */
  code?: string | null;
  /** Fáze 78: 📂 uložené půdorysy, 💾 / 📥 soubor projektu. */
  fileMenu?: ReactNode;
  onMeta: (meta: FloorplanMetaState) => Promise<string | null>;
  floorplanId: string | null;
  status: SyncStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  project: { id: string; code: string; name: string } | null;
  flush: () => Promise<boolean>;
  onRestored: (state: { draft: FloorplanDraft; version: number; savedAt: string }) => void;
  onReload: () => Promise<void>;
  onKeepMine: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState<"reload" | "keep" | null>(null);
  const details = [meta.customerName, meta.installationSite ? `📍 ${meta.installationSite}` : null].filter(Boolean).join(" · ");

  async function resolve(kind: "reload" | "keep") {
    setResolving(kind);
    await (kind === "reload" ? onReload() : onKeepMine());
    setResolving(null);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2" data-testid="floorplan-docbar">
      <div className="flex flex-wrap items-center gap-2">
        {leading}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {code ? (
            <span className="shrink-0 rounded border border-border bg-muted px-1.5 font-mono text-xs" data-testid="floorplan-code">
              {code}
            </span>
          ) : null}
          <span className="truncate font-semibold" data-testid="floorplan-name">
            📐 {meta.name}
          </span>
          {details ? <span className="hidden truncate text-xs text-muted-foreground sm:inline">{details}</span> : null}
          <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setEditing(true)} aria-label="Upravit název a údaje půdorysu">
            <Pencil className="size-3.5" aria-hidden /> Údaje
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onUndo} disabled={!canUndo} title="Zpět (Ctrl+Z)" aria-label="Zpět (Ctrl+Z)" data-testid="floorplan-undo">
            <Undo2 className="size-4" aria-hidden /> Zpět
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onRedo} disabled={!canRedo} title="Znovu (Ctrl+Shift+Z / Ctrl+Y)" aria-label="Znovu (Ctrl+Shift+Z)" data-testid="floorplan-redo">
            <Redo2 className="size-4" aria-hidden /> Znovu
          </Button>
          {trainer ? (
            <span className="flex items-center gap-1.5 rounded-full border border-yellow-400/60 px-2.5 py-0.5 text-xs text-yellow-200" data-testid="floorplan-save-status" data-state="trainer" role="status">
              🎯 Trenažér – nic se neukládá
            </span>
          ) : (
            <SaveState status={status} onRetry={() => void flush()} />
          )}
          <VersionHistoryButton floorplanId={floorplanId} flush={flush} onRestored={onRestored} />
          {fileMenu}
          {project ? (
            <Link href={`/panel-builder/${project.id}`} className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary" title={`Rozváděč vygenerovaný z tohoto půdorysu: ${project.name}`} data-testid="floorplan-project-link">
              ⚡ Rozváděč <span className="font-mono">{project.code}</span>
            </Link>
          ) : null}
        </div>
      </div>
      {status.kind === "conflict" ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" data-testid="floorplan-conflict">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            Půdorys mezitím uložilo jiné okno nebo zařízení (verze {status.serverVersion}). Vaše poslední změny jsou bezpečně v historii verzí – vyberte, se kterou verzí pokračovat.
          </span>
          <Button type="button" size="sm" variant="outline" disabled={resolving !== null} onClick={() => void resolve("reload")} className="gap-1.5">
            {resolving === "reload" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Načíst aktuální verzi
          </Button>
          <Button type="button" size="sm" disabled={resolving !== null} onClick={() => void resolve("keep")} className="gap-1.5">
            {resolving === "keep" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Ponechat mou verzi
          </Button>
        </div>
      ) : null}
      {editing ? <FloorplanMetaDialog open onOpenChange={setEditing} meta={meta} onSave={onMeta} /> : null}
    </div>
  );
}
