"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AttachmentCategory } from "@/generated/prisma/enums";
import { ATTACHMENT_CATEGORIES, categoryLabel, formatFileSize, previewKind } from "@/lib/equipment-documents";
import { formatDate } from "@/lib/format";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { addEquipmentDocumentAction, deleteEquipmentDocumentAction } from "@/server/actions/equipment-knowledge";

import { PdfViewer, downloadHref } from "./PdfViewer";

export interface LibraryDocument {
  id: string;
  category: AttachmentCategory;
  title: string;
  componentTag: string | null;
  manufacturer: string | null;
  modelNumber: string | null;
  version: string;
  language: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  createdAt: string;
  uploadedBy: string | null;
}

const selectClass = "h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.svg,.docx,.xlsx,.csv,.txt";

/** Náhled dokumentu v modalu: PDF v iframu, obrázek přes <img>. */
export function DocumentPreview({ document, onClose }: { document: Pick<LibraryDocument, "title" | "fileUrl" | "fileName"> | null; onClose: () => void }) {
  const kind = document ? previewKind(document.fileName) : null;
  return (
    <Dialog open={!!document} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{document?.title}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{document?.fileName}</DialogDescription>
        </DialogHeader>
        {document && kind === "pdf" ? <PdfViewer url={document.fileUrl} title={document.title} compact className="h-[70vh]" /> : null}
        {document && kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- dokument z /api/files (i SVG)
          <img src={document.fileUrl} alt={document.title} className="mx-auto max-h-[70vh] w-auto rounded-lg bg-white" data-testid="doc-preview-image" />
        ) : null}
        {document && !kind ? <p className="text-sm text-muted-foreground">Tento formát nejde zobrazit v prohlížeči – stáhněte ho.</p> : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * „📚 Návody & Datasheety“: filtr podle kategorie, karty dokumentů (komponenta ve schématu, výrobce,
 * verze, velikost), náhled PDF v modalu, stažení a nahrání nového dokumentu.
 */
export function DocumentLibrary({ equipmentId, documents, canUpload, canDelete }: { equipmentId: string; documents: LibraryDocument[]; canUpload: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<AttachmentCategory | "ALL">("ALL");
  const [preview, setPreview] = useState<LibraryDocument | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, startDelete] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const shown = filter === "ALL" ? documents : documents.filter((document) => document.category === filter);

  async function submit(form: FormData) {
    if (!file) return void toast.error("Vyberte soubor.");
    setBusy(true);
    try {
      const uploaded = await uploadFile("attachment", file);
      const result = await addEquipmentDocumentAction({
        equipmentId,
        category: String(form.get("category")) as AttachmentCategory,
        title: title.trim() || file.name,
        componentTag: String(form.get("componentTag") ?? "") || null,
        manufacturer: String(form.get("manufacturer") ?? "") || null,
        modelNumber: String(form.get("modelNumber") ?? "") || null,
        version: String(form.get("version") ?? "") || null,
        fileUrl: uploaded.url,
        fileName: file.name,
        fileSizeBytes: file.size,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Dokument nahrán do knihovny zařízení.");
      setOpen(false);
      setFile(null);
      setTitle("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Soubor se nepodařilo nahrát.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Návody a datasheety" className="space-y-4" data-testid="doc-library">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtr kategorie">
          {[{ value: "ALL" as const, filter: "Vše" }, ...ATTACHMENT_CATEGORIES].map((category) => {
            const count = category.value === "ALL" ? documents.length : documents.filter((document) => document.category === category.value).length;
            if (category.value !== "ALL" && !count) return null;
            return (
              <button
                key={category.value}
                type="button"
                aria-pressed={filter === category.value}
                onClick={() => setFilter(category.value)}
                className={cn("min-h-9 rounded-full border px-3 text-sm", filter === category.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}
              >
                {category.filter} ({count})
              </button>
            );
          })}
        </div>
        {canUpload ? (
          <Button className="touch-target ml-auto gap-2" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> Nahrát návod / datasheet
          </Button>
        ) : null}
      </div>

      {shown.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((document) => {
            const category = ATTACHMENT_CATEGORIES.find((entry) => entry.value === document.category);
            return (
              <li key={document.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" data-testid="doc-card">
                <div className="flex items-start gap-2">
                  <span className="text-2xl" aria-hidden>
                    {category?.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{document.title}</p>
                    <p className="text-xs text-muted-foreground">{categoryLabel(document.category)}</p>
                  </div>
                  {document.componentTag ? (
                    <span className="rounded-md border border-sky-500/50 bg-sky-500/10 px-1.5 font-mono text-xs font-semibold text-sky-200" title="Prvek ve schématu" data-testid="doc-component">
                      {document.componentTag}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[document.manufacturer, document.modelNumber].filter(Boolean).join(" ") || "Výrobce neuveden"} · verze {document.version} · {document.language.toUpperCase()} · {formatFileSize(document.fileSizeBytes)}
                  <br />
                  Nahráno {formatDate(document.createdAt)}
                  {document.uploadedBy ? ` · ${document.uploadedBy}` : ""}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {previewKind(document.fileName) ? (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPreview(document)}>
                      <Eye className="size-3.5" aria-hidden /> Náhled
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" className="gap-1.5" asChild>
                    <a href={downloadHref(document.fileUrl)} download={document.fileName}>
                      <Download className="size-3.5" aria-hidden /> Stáhnout
                    </a>
                  </Button>
                  {canDelete ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto gap-1.5 text-red-300"
                      disabled={deleting}
                      onClick={() => {
                        if (!window.confirm(`Smazat dokument „${document.title}“?`)) return;
                        startDelete(async () => {
                          const result = await deleteEquipmentDocumentAction(document.id);
                          if (!result.ok) return void toast.error(result.error);
                          router.refresh();
                        });
                      }}
                      aria-label={`Smazat ${document.title}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Zatím žádné návody ani datasheety. Nahrajte návod k obsluze nebo katalogový list komponenty.</p>
      )}

      <DocumentPreview document={preview} onClose={() => setPreview(null)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nahrát návod / datasheet</DialogTitle>
            <DialogDescription>PDF, obrázek, DOCX, XLSX, CSV nebo TXT do 30 MB. Označení komponenty propojí dokument s prvkem ve schématu.</DialogDescription>
          </DialogHeader>
          <form action={submit} className="flex flex-col gap-3">
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Soubor dokumentu"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                setFile(picked);
                if (picked && !title) setTitle(picked.name.replace(/\.[^.]+$/, ""));
              }}
            />
            <Button type="button" variant="outline" className="h-12 gap-2" onClick={() => input.current?.click()}>
              <Upload className="size-4" aria-hidden /> {file ? `${file.name} (${formatFileSize(file.size)})` : "Vybrat soubor"}
            </Button>
            <div className="grid gap-1.5">
              <Label htmlFor="doc-category">Kategorie</Label>
              <select id="doc-category" name="category" className={selectClass} defaultValue="MANUAL">
                {ATTACHMENT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="doc-title">Název</Label>
              <Input id="doc-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="doc-tag">Komponenta ve schématu</Label>
                <Input id="doc-tag" name="componentTag" maxLength={20} placeholder="např. -U1, -K4" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="doc-version">Verze</Label>
                <Input id="doc-version" name="version" maxLength={20} placeholder="1.0" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="doc-manufacturer">Výrobce</Label>
                <Input id="doc-manufacturer" name="manufacturer" maxLength={80} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="doc-model">Typ / model</Label>
                <Input id="doc-model" name="modelNumber" maxLength={80} />
              </div>
            </div>
            <Button type="submit" className="touch-target gap-2" disabled={busy || !file}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} Nahrát do knihovny
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
