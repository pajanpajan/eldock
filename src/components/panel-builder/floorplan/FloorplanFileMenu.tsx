"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FolderOpen, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_ELDOCK_FILE_BYTES, assetUrls, buildEldockFile, eldockFileName, isCadAsset, parseEldockFile, replaceBackgroundUrls, stripMissingAssets } from "@/lib/panel-builder/eldock-file";
import type { FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import type { AssemblyTemplate } from "@/lib/panel-builder/floorplan-library";
import { uploadPanelFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { createFloorplanAction, listFloorplansAction, type CloudFloorplanRow } from "@/server/actions/floorplans";

import type { FloorplanMetaState } from "./useFloorplanSync";

// Fáze 78: projekt půdorysu do počítače (`<název>.eldock.json`) a zpět, přepínání uložených zakázek firmy v cloudu.

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Soubor se nepodařilo přečíst."));
    reader.readAsDataURL(blob);
  });

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  const extension = blob.type === "application/json" ? "json" : blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${name}.${extension}`, { type: blob.type || "image/jpeg" });
}


export function FloorplanFileMenu({
  draft,
  meta,
  code,
  templates,
  floorplanId,
  flush,
  onTemplates,
}: {
  draft: FloorplanDraft;
  meta: FloorplanMetaState;
  code: string | null;
  templates: readonly AssemblyTemplate[];
  floorplanId: string | null;
  flush: () => Promise<boolean>;
  /** Šablony sestav ze souboru → knihovna firmy (stejné se nezdvojí). */
  onTemplates: (templates: AssemblyTemplate[]) => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [cloudOpen, setCloudOpen] = useState(false);

  async function exportFile() {
    setBusy("export");
    try {
      const assets: Record<string, string> = {};
      // Obrázky podkladů a fáze 79 geometrie podkladů CAD (JSON)
      for (const url of assetUrls(draft)) {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Podklad výkresu se nepodařilo načíst – zkuste to znovu.");
        const blob = await response.blob();
        assets[url] = await blobToDataUrl(url.endsWith(".json") ? new Blob([await blob.text()], { type: "application/json" }) : blob);
      }
      const file = buildEldockFile({ meta: { code, ...meta }, draft, templates, assets });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
      link.download = eldockFileName(meta.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      toast.success(`Uloženo do počítače: ${link.download}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Soubor projektu se nepodařilo uložit.");
    } finally {
      setBusy(null);
    }
  }

  async function importFile(picked: File) {
    if (picked.size > MAX_ELDOCK_FILE_BYTES) return void toast.error("Soubor je větší než 40 MB – projekt Eldock to být nemůže.");
    setBusy("import");
    try {
      const parsed = parseEldockFile(await picked.text());
      if ("error" in parsed) throw new Error(parsed.error);
      const { file } = parsed;
      // Rozpracované změny otevřeného půdorysu se nejdřív uloží
      await flush();
      const map = new Map<string, string>();
      for (const [url, data] of Object.entries(file.assets)) {
        const cad = isCadAsset(data);
        const uploaded = await uploadPanelFile(cad ? "markup" : "photo", await dataUrlToFile(data, cad ? "vykres-cad" : "podklad"));
        map.set(url, uploaded.url);
      }
      const missing = new Set(assetUrls(file.draft).filter((url) => !map.has(url)));
      const moved = replaceBackgroundUrls(file.draft, map);
      const result = await createFloorplanAction({ meta: { name: file.meta.name, customerName: file.meta.customerName, installationSite: file.meta.installationSite }, draft: missing.size ? stripMissingAssets(moved, missing) : moved });
      if (!result.ok) throw new Error(result.error);
      if (file.templates.length) onTemplates(file.templates);
      toast.success(`Projekt „${file.meta.name}“ nahrán z počítače jako ${result.data.code ?? "nový půdorys"}${missing.size ? ` (bez ${missing.size} podkladů, které soubor neobsahoval)` : ""}.`);
      router.push(`/panel-builder/floorplan/${result.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Soubor projektu se nepodařilo nahrát.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setCloudOpen(true)} data-testid="floorplan-cloud-list">
        <FolderOpen className="size-4" aria-hidden /> 📂 Moje uložené půdorysy
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void exportFile()} disabled={busy !== null} title="Celý projekt do jednoho souboru – podlaží, podklady, prvky, trasy, řady a barvy, šablony sestav" data-testid="floorplan-export">
        {busy === "export" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />} 💾 Uložit do PC (.eldock)
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => input.current?.click()} disabled={busy !== null} title="Otevře projekt ze souboru .eldock.json jako nový půdorys firmy" data-testid="floorplan-import">
        {busy === "import" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} 📥 Nahrát projekt z PC
      </Button>
      <input ref={input} type="file" accept=".json,application/json" className="hidden" aria-label="Soubor projektu .eldock.json" onChange={(event) => event.target.files?.[0] && void importFile(event.target.files[0])} data-testid="floorplan-import-input" />
      {cloudOpen ? <CloudFloorplans onClose={() => setCloudOpen(false)} currentId={floorplanId} flush={flush} /> : null}
    </>
  );
}

const dateTime = (iso: string) => new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** „📂 Moje uložené půdorysy (cloud)“ – rozpracované zakázky firmy; otevřením se aktuální půdorys nejdřív uloží. */
function CloudFloorplans({ onClose, currentId, flush }: { onClose: () => void; currentId: string | null; flush: () => Promise<boolean> }) {
  const router = useRouter();
  const [rows, setRows] = useState<CloudFloorplanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void listFloorplansAction().then((result) => {
      if (!alive) return;
      if (result.ok) setRows(result.data);
      else setError(result.error);
    });
    return () => {
      alive = false;
    };
  }, []);
  async function open(id: string) {
    setOpening(id);
    await flush();
    onClose();
    router.push(`/panel-builder/floorplan/${id}`);
  }
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" data-testid="cloud-floorplans">
        <DialogHeader>
          <DialogTitle>📂 Moje uložené půdorysy (cloud)</DialogTitle>
          <DialogDescription>Rozpracované zakázky firmy uložené na serveru – otevřením se aktuální půdorys nejdřív uloží.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {!rows && !error ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Načítám půdorysy…
          </p>
        ) : null}
        {rows ? (
          <ul className="flex flex-col gap-1" data-testid="cloud-floorplan-list">
            {rows.map((row) => {
              const current = row.id === currentId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={current || opening !== null}
                    onClick={() => void open(row.id)}
                    className={cn("flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm", current ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}
                    data-testid="cloud-floorplan"
                    data-code={row.code ?? undefined}
                  >
                    <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{row.code ?? "—"}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{row.name}</b>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[row.customerName, row.installationSite ? `📍 ${row.installationSite}` : null, `${row.floorCount} podl. · ${row.elementCount} prvků`, row.project ? `⚡ ${row.project.code}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{current ? "otevřený" : opening === row.id ? "otevírám…" : dateTime(row.updatedAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex justify-between gap-2 text-sm">
          <Link href="/panel-builder/floorplan" className="text-muted-foreground underline-offset-2 hover:underline">
            Všechny půdorysy a koš
          </Link>
          <Link href="/panel-builder/floorplan/novy" className="text-primary underline-offset-2 hover:underline">
            + Nový půdorys
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
