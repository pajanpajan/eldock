"use client";

import { useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { parseDraft, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { listFloorplanVersionsAction, restoreFloorplanVersionAction, saveFloorplanVersionAction, type FloorplanVersionDto } from "@/server/actions/floorplans";

// Fáze 64: historie verzí uloženého půdorysu – automatické snímky (nejvýš 1× za 10 min), ručně pojmenované verze,
// stav při generování rozváděče, stav před obnovením a změny odmítnuté kvůli souběhu dvou oken. Obnovení jde vrátit.

const REASON: Record<FloorplanVersionDto["reason"], string> = {
  AUTO: "🕘 Automaticky uloženo",
  MANUAL: "📌 Uložená verze",
  GENERATE: "⚡ Vygenerován rozváděč",
  RESTORE: "↺ Před obnovením",
  CONFLICT: "⚠️ Neuložené změny z jiného okna",
  OVERWRITE: "⚠️ Přepsaná verze",
  IMPORT: "📥 Převzato",
};

const elements = (count: number) => `${count} ${count === 1 ? "prvek" : count >= 2 && count <= 4 ? "prvky" : "prvků"}`;

export function VersionHistoryButton({
  floorplanId,
  flush,
  onRestored,
}: {
  floorplanId: string | null;
  /** Uložit rozpracované změny před uložením / obnovením verze. */
  flush: () => Promise<boolean>;
  onRestored: (state: { draft: FloorplanDraft; version: number; savedAt: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<FloorplanVersionDto[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  async function load(id: string) {
    const result = await listFloorplanVersionsAction(id);
    if (!result.ok) return void toast.error(result.error);
    setVersions(result.data);
  }

  async function saveVersion() {
    if (!floorplanId) return;
    setBusy("save");
    const flushed = await flush();
    const result = flushed ? await saveFloorplanVersionAction(floorplanId, label.trim() || null) : null;
    setBusy(null);
    if (!result) return void toast.error("Rozpracované změny se nepodařilo uložit – verzi uložte, až bude půdorys uložený.");
    if (!result.ok) return void toast.error(result.error);
    setLabel("");
    toast.success("Verze je uložená v historii.");
    await load(floorplanId);
  }

  async function restore(version: FloorplanVersionDto) {
    if (!floorplanId || !window.confirm(`Obnovit verzi z ${formatDateTime(version.createdAt)}? Současný stav zůstane v historii verzí.`)) return;
    setBusy(version.id);
    await flush();
    const result = await restoreFloorplanVersionAction(floorplanId, version.id);
    setBusy(null);
    if (!result.ok) return void toast.error(result.error);
    const draft = parseDraft(result.data.draft);
    if (!draft) return void toast.error("Verzi se nepodařilo načíst.");
    onRestored({ draft, version: result.data.version, savedAt: result.data.savedAt });
    setOpen(false);
    toast.success(`Obnovena verze z ${formatDateTime(version.createdAt)} – předchozí stav najdete v historii verzí.`);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={!floorplanId}
        title={floorplanId ? "Historie verzí půdorysu" : "Historie verzí bude k dispozici po prvním uložení"}
        onClick={() => {
          setOpen(true);
          setVersions(null);
          if (floorplanId) void load(floorplanId);
        }}
        data-testid="floorplan-versions"
      >
        <History className="size-4" aria-hidden /> Verze
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" data-testid="floorplan-versions-dialog">
          <DialogHeader>
            <DialogTitle>🕘 Historie verzí půdorysu</DialogTitle>
            <DialogDescription>Automatický snímek vzniká při ukládání nejvýš jednou za 10 minut, drží se posledních 30 verzí. Obnovení jde vrátit – současný stav se uloží do historie.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveVersion();
            }}
          >
            <Input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} placeholder="Popis verze, např. „Před úpravou kuchyně“" aria-label="Popis verze" className="h-9 min-w-48 flex-1" />
            <Button type="submit" size="sm" className="gap-1.5" disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} 📌 Uložit aktuální stav jako verzi
            </Button>
          </form>
          {versions === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Načítám historii…
            </p>
          ) : versions.length ? (
            <ol className="flex flex-col divide-y divide-border rounded-lg border border-border" data-testid="floorplan-version-list">
              {versions.map((version) => (
                <li key={version.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm" data-testid="floorplan-version">
                  <span className="font-mono text-xs text-muted-foreground">{formatDateTime(version.createdAt)}</span>
                  <span className="font-medium">{REASON[version.reason]}</span>
                  {version.label ? <span className="text-muted-foreground">{version.label}</span> : null}
                  <span className="text-xs text-muted-foreground">{elements(version.elementCount)}</span>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto gap-1" disabled={busy !== null} onClick={() => void restore(version)} aria-label={`Obnovit verzi z ${formatDateTime(version.createdAt)}`}>
                    {busy === version.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />} Obnovit
                  </Button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Historie je zatím prázdná.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
