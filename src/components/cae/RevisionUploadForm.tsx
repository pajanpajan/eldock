"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, Loader2, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SchematicFormat } from "@/generated/prisma/enums";
import { changedDesignations, emptyBomRow, toBomInput, validateBomDraft, type BomDraftRow, type BomField } from "@/lib/bom-edit";
import { caeTicketHref } from "@/lib/routes";
import { uploadFile } from "@/lib/upload-client";
import { generateSchematicAction, uploadRevisionAction } from "@/server/actions/workflow";

import { BomEditor } from "./BomEditor";

interface SchematicFile {
  url: string;
  fileName: string;
  format: SchematicFormat;
  sizeBytes: number;
  generated: boolean;
}

const ACCEPT = ".svg,.pdf,.png,.jpg,.jpeg";

function formatOf(fileName: string): SchematicFormat {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "svg") return "SVG";
  if (extension === "pdf") return "PDF";
  return "IMAGE";
}

function Step({ number, title, children, hint }: { number: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby={`revision-step-${number}`}>
      <div>
        <h2 id={`revision-step-${number}`} className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary font-mono text-sm text-primary-foreground">{number}</span>
          {title}
        </h2>
        {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Nahrání nové revize: soubor nebo vygenerované schéma, minor/major, shrnutí a kusovník. */
export function RevisionUploadForm({
  changeRequest,
  versions,
  defaultTitle,
  initialBom,
}: {
  changeRequest: { id: string; number: string };
  versions: { current: string | null; minor: string; major: string };
  defaultTitle: string;
  initialBom: BomDraftRow[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const [file, setFile] = useState<SchematicFile | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [bump, setBump] = useState<"minor" | "major">("minor");
  const [title, setTitle] = useState(defaultTitle);
  const [summary, setSummary] = useState("");
  const [rows, setRows] = useState(initialBom);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();
  const [submitting, startSubmitting] = useTransition();

  const version = versions[bump];
  const bomChanges = changedDesignations(rows, initialBom);
  const busy = generating || submitting || progress !== null;

  async function onFile(selected: File | undefined) {
    if (!selected) return;
    setError(null);
    setProgress(0);
    try {
      const result = await uploadFile("revision", selected, setProgress);
      setFile({ url: result.url, fileName: result.fileName, format: formatOf(result.fileName), sizeBytes: result.sizeBytes, generated: false });
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "Nahrání se nepodařilo.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function generate() {
    const bomError = validateBomDraft(rows);
    startGenerating(async () => {
      const result = await generateSchematicAction({
        changeRequestId: changeRequest.id,
        bump,
        summary,
        bom: bomError ? undefined : toBomInput(rows),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFile({ url: result.data.url, fileName: result.data.fileName, format: "SVG", sizeBytes: result.data.sizeBytes, generated: true });
      toast.success(
        result.data.changed.length
          ? `Schéma ${result.data.version} vygenerováno, změny vyznačeny u ${result.data.changed.join(", ")}.`
          : `Schéma ${result.data.version} vygenerováno.`,
      );
    });
  }

  function updateRow(key: string, field: BomField, value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function restoreRow(row: BomDraftRow) {
    const order = new Map(initialBom.map((item, index) => [item.key, index]));
    setRows((current) => {
      const position = order.get(row.key) ?? Infinity;
      const index = current.findIndex((item) => item.originalKey !== null && (order.get(item.originalKey) ?? -1) > position);
      return index === -1 ? [...current, row] : [...current.slice(0, index), row, ...current.slice(index)];
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = !file
      ? "Nahrajte soubor schématu nebo ho vygenerujte."
      : !summary.trim()
        ? "Doplňte technické shrnutí změn."
        : validateBomDraft(rows);
    setError(problem);
    if (problem || !file) return;

    startSubmitting(async () => {
      const result = await uploadRevisionAction({
        changeRequestId: changeRequest.id,
        schematicUrl: file.url,
        schematicFormat: file.format,
        summary,
        bump,
        title,
        bom: toBomInput(rows),
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`Revize ${result.data.version} nahrána – čeká na schválení údržbou.`);
      router.push(caeTicketHref(changeRequest.id));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Step number={1} title="Schéma nové revize" hint="SVG, PDF, PNG nebo JPG (max. 25 MB). Pro demo lze schéma vygenerovat z kusovníku a zákresu technika.">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="Soubor schématu"
          data-testid="revision-file"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="lg" variant="outline" className="touch-target gap-2" onClick={() => inputRef.current?.click()} disabled={busy}>
            <FileUp className="size-4" />
            Vybrat soubor
          </Button>
          <Button type="button" size="lg" variant="secondary" className="touch-target gap-2" onClick={generate} disabled={busy}>
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Vygenerovat upravené schéma
          </Button>
        </div>
        {progress !== null ? <Progress value={progress} aria-label="Průběh nahrávání" /> : null}
        {file ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono">{file.fileName}</span>
              <span className="text-muted-foreground">
                {file.format} · {Math.max(1, Math.round(file.sizeBytes / 1024))} kB{file.generated ? " · vygenerováno" : ""}
              </span>
              <Button type="button" variant="ghost" size="sm" className="ml-auto gap-1" onClick={() => setFile(null)}>
                <X className="size-4" />
                Odebrat
              </Button>
            </div>
            {file.format === "PDF" ? (
              <iframe src={file.url} title="Náhled PDF" className="aspect-[1.414] w-full rounded-lg border border-border bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- soubor z /api/files; SVG přes <img> nespouští skripty
              <img src={file.url} alt={`Náhled schématu ${version}`} className="w-full rounded-lg border border-border bg-white" />
            )}
          </div>
        ) : null}
      </Step>

      <Step number={2} title="Verze a shrnutí">
        <div className="space-y-2">
          <Label id="bump-label">Číslo revize</Label>
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="single"
              value={bump}
              onValueChange={(value) => value && setBump(value as "minor" | "major")}
              variant="outline"
              spacing={0}
              aria-labelledby="bump-label"
              className="border border-border bg-card/60 p-0.5"
            >
              <ToggleGroupItem value="minor" className="touch-target rounded-md border-0! px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Drobná změna (+0.1)
              </ToggleGroupItem>
              <ToggleGroupItem value="major" className="touch-target rounded-md border-0! px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Velká změna (+1.0)
              </ToggleGroupItem>
            </ToggleGroup>
            <span className="flex items-center gap-2 font-mono text-lg" aria-live="polite">
              <span className="text-muted-foreground">{versions.current ?? "–"}</span>
              <ArrowRight className="size-4 text-muted-foreground" aria-label="na" />
              <span className="font-bold text-primary">{version}</span>
            </span>
          </div>
          {file?.generated ? <p className="text-xs text-muted-foreground">Po změně verze schéma vygenerujte znovu, aby razítko odpovídalo.</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="revision-title">Název dokumentu</Label>
          <Input id="revision-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="revision-summary">
            Technické shrnutí změn <span className="text-red-400">*</span>
          </Label>
          <Textarea
            id="revision-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Např. Stykač K4 nahrazen typem Siemens 3RT2026, cívka A2 přepojena na svorku X1:14."
            rows={4}
            maxLength={4000}
            aria-invalid={error === "Doplňte technické shrnutí změn." || undefined}
          />
          <p className="text-xs text-muted-foreground">Shrnutí uvidí údržba při schvalování a zapíše se do historie revizí.</p>
        </div>
      </Step>

      <Step number={3} title="Kusovník (BOM)" hint="Zkopírováno z platné revize. Upravte jen to, co se změnilo.">
        <BomEditor
          rows={rows}
          originals={initialBom}
          onChange={updateRow}
          onAdd={() => setRows((current) => [...current, emptyBomRow(`new-${nextKey.current++}`)])}
          onRemove={(key) => setRows((current) => current.filter((row) => row.key !== key))}
          onRestore={restoreRow}
          onReset={() => setRows(initialBom)}
        />
      </Step>

      <div className="sticky bottom-0 z-10 -mx-3 border-t border-border bg-background/95 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            {error ? (
              <p role="alert" className="text-red-400">
                {error}
              </p>
            ) : (
              <p className="text-muted-foreground">
                Revize <span className="font-mono text-foreground">{version}</span> k ticketu{" "}
                <span className="font-mono text-foreground">{changeRequest.number}</span>
                {bomChanges.length ? ` · změny v kusovníku: ${bomChanges.join(", ")}` : " · kusovník beze změny"}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" className="touch-target gap-2" disabled={busy}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Odeslat ke schválení
          </Button>
        </div>
      </div>
    </form>
  );
}
