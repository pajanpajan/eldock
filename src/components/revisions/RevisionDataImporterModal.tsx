"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { reportActionError } from "@/components/credits/paywall";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { loadPdf } from "@/lib/pdf-client";
import {
  REVISION_FIELDS,
  REVISION_TEMPLATE_HEADERS,
  REVISION_TEMPLATE_ROWS,
  measurementSummary,
  parseRevisionRows,
  revisionTemplateCsv,
  rowsFromText,
  type RevisionField,
  type RevisionKind,
  type RevisionMapping,
  type RevisionRecord,
} from "@/lib/revision-import";
import { buildXlsx } from "@/lib/xlsx";
import { cn } from "@/lib/utils";
import { createRevisionPanelProjectAction, importRevisionAppliancesAction, readRevisionFileAction } from "@/server/actions/revision-import";

/**
 * Fáze 112: „[ 📥 Importovat z existující revize nebo měřicího přístroje ]“ – A) CSV / XLSX / XML z měřicích přístrojů
 * a revizních programů (Metrel ES Manager, Sonel, Fluke DMS, Chauvin Arnoux, Illko / PC Revize), B) stará zpráva v PDF /
 * Wordu nebo fotka tabulky, C) šablona ke stažení. Náhled s přiřazením sloupců, pak jedním klikem rozváděč v AI Panel
 * Builderu, nebo spotřebiče do místnosti budovy (Hlídač revizí, Revize) s převzatou revizí.
 */

export type ImporterTarget = { kind: "panel" } | { kind: "floor"; floors: { id: string; label: string; rooms: string[] }[]; floorId?: string | null; room?: string | null; inspectorName?: string | null };

type Tab = "device" | "report" | "template";

const download = (name: string, data: BlobPart, type: string) => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/** Text PDF po řádcích s buňkami oddělenými tabulátorem (útržky na stejné výšce zleva doprava). */
async function pdfRows(file: File): Promise<string[][]> {
  const url = URL.createObjectURL(file);
  try {
    const doc = await loadPdf(url);
    const lines: string[] = [];
    for (let number = 1; number <= Math.min(doc.numPages, 40); number++) {
      const content = await (await doc.getPage(number)).getTextContent();
      const byY = new Map<number, { x: number; text: string }[]>();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        const row = byY.get(y) ?? [];
        row.push({ x: item.transform[4], text: item.str.trim() });
        byY.set(y, row);
      }
      for (const [, parts] of [...byY].sort((a, b) => b[0] - a[0])) lines.push(parts.sort((a, b) => a.x - b.x).map((part) => part.text).join("\t"));
    }
    return rowsFromText(lines.join("\n"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);
const serialize = (records: readonly RevisionRecord[]) => records.map((record) => ({ ...record, date: day(record.date) }));
const number = (value: number | null) => (value === null ? "–" : value.toLocaleString("cs-CZ", { maximumFractionDigits: 3 }));

export function RevisionDataImporterModal({ target, triggerClassName }: { target: ImporterTarget; triggerClassName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("device");
  const [rows, setRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<RevisionMapping | null>(null);
  const [kindOverride, setKindOverride] = useState<RevisionKind | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();
  const [name, setName] = useState("Rozváděč z revizní zprávy");
  const floors = target.kind === "floor" ? target.floors : [];
  const [floorId, setFloorId] = useState<string>(target.kind === "floor" ? (target.floorId ?? floors[0]?.id ?? "") : "");
  const [room, setRoom] = useState<string>(target.kind === "floor" ? (target.room ?? floors.find((floor) => floor.id === (target.floorId ?? floors[0]?.id))?.rooms[0] ?? "") : "");
  const [inspectorName, setInspectorName] = useState(target.kind === "floor" ? (target.inspectorName ?? "") : "");
  const [inspectorLicense, setInspectorLicense] = useState("dle převzaté revizní zprávy");
  const inputA = useRef<HTMLInputElement>(null);
  const inputB = useRef<HTMLInputElement>(null);

  const table = useMemo(() => (rows ? parseRevisionRows(rows, { ...(mapping ? { mapping } : {}), ...(kindOverride ? { kind: kindOverride } : {}) }) : null), [rows, mapping, kindOverride]);
  const kind = table?.kind ?? "appliances";
  const rooms = floors.find((floor) => floor.id === floorId)?.rooms ?? [];

  function reset() {
    setRows(null);
    setMapping(null);
    setKindOverride(null);
    setFileName(null);
  }

  function readFile(file: File) {
    reset();
    setFileName(file.name);
    startReading(async () => {
      try {
        if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
          const parsed = await pdfRows(file);
          if (!parsed.length) return void toast.error("V PDF není rozpoznatelná tabulka – zkuste export CSV / XLSX nebo fotku tabulky.");
          setRows(parsed);
          return;
        }
        const form = new FormData();
        form.set("file", file);
        form.set("context", target.kind === "panel" ? "panel" : "plant");
        const result = await readRevisionFileAction(form);
        if (!result.ok) return void toast.error(result.error);
        setRows(result.data.rows);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Soubor se nepodařilo přečíst.");
      }
    });
  }

  function createPanel() {
    if (!table) return;
    startSaving(async () => {
      const result = await createRevisionPanelProjectAction({ name: name.trim() || "Rozváděč z revizní zprávy", records: serialize(table.records) });
      if (!result.ok) return void reportActionError(result);
      toast.success(`Rozváděč z importu: ${result.data.circuits} okruhů, ${result.data.devices} přístrojů${result.data.enclosure ? ` · skříň ${result.data.enclosure}` : ""}.`);
      for (const warning of result.data.warnings.slice(0, 3)) toast.warning(warning);
      setOpen(false);
      router.push(`/panel-builder/${result.data.id}`);
    });
  }

  function importFloor() {
    if (!table || !floorId || !room) return;
    startSaving(async () => {
      const result = await importRevisionAppliancesAction({ floorId, room, inspectorName: inspectorName.trim() || "Revizní technik", inspectorLicense: inspectorLicense.trim() || "dle převzaté zprávy", source: table.source, records: serialize(table.records) });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Do místnosti ${room} přidáno ${result.data.created} zařízení, převzatých revizí ${result.data.inspections}.`);
      if (result.data.skipped.length) toast.warning(`Přeskočeno ${result.data.skipped.length} řádků (např. řádek ${result.data.skipped[0].line}: ${result.data.skipped[0].reason}).`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={cn("touch-target gap-2", triggerClassName)} data-testid="revision-import-open">
          📥 Importovat z existující revize nebo měřicího přístroje
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl" data-testid="revision-import">
        <DialogHeader>
          <DialogTitle>📥 Import ze staré revize nebo z měřicího přístroje</DialogTitle>
          <DialogDescription>
            {target.kind === "panel"
              ? "Z okruhů staré revizní zprávy nebo exportu přístroje vznikne jedním klikem celý rozváděč (jističe, kabely, chrániče podle ČSN 33 2130 ed. 4, skříň)."
              : "Spotřebiče a zařízení z tabulky se založí do vybrané místnosti i s výrobním číslem a převzatou revizí (Riso, RPE, výsledek)."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Zdroj importu">
          {(
            [
              ["device", "A) Export z přístroje / programu"],
              ["report", "B) Stará zpráva (PDF / Word / fotka)"],
              ["template", "C) Vzorová šablona"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("rounded-md border px-3 py-1.5 text-sm font-semibold", tab === id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground")} data-testid={`revision-tab-${id}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "device" ? (
          <section className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
            <p>CSV / TSV / XLSX / XML z programů a přístrojů <b>Metrel ES Manager</b>, <b>Sonel</b>, <b>Fluke DMS</b>, <b>Chauvin Arnoux</b> a <b>Illko / PC Revize</b> – sloupce (označení, název / místnost, jistič, kabel, Riso, Zs, RPE, tA, S/N) se přiřadí samy.</p>
            <input ref={inputA} type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xml,text/csv,application/xml,text/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} data-testid="revision-file-device" />
            <Button type="button" className="w-fit gap-2" onClick={() => inputA.current?.click()} disabled={reading}>
              {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />} Nahrát export (CSV / XLSX / XML)
            </Button>
          </section>
        ) : null}
        {tab === "report" ? (
          <section className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
            <p>Stará revizní zpráva v <b>PDF</b> nebo <b>Wordu (DOCX)</b> – vytáhne se tabulka okruhů / spotřebičů. <b>Fotka tabulky</b> se přepíše přes AI (Gemini).</p>
            <input ref={inputB} type="file" accept=".pdf,.docx,image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} data-testid="revision-file-report" />
            <Button type="button" className="w-fit gap-2" onClick={() => inputB.current?.click()} disabled={reading}>
              {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />} Nahrát zprávu nebo vyfotit tabulku
            </Button>
          </section>
        ) : null}
        {tab === "template" ? (
          <section className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm" data-testid="revision-template">
            <p>Šablona pro hromadný import: {REVISION_TEMPLATE_HEADERS.join(" · ")}. Řádek s jističem (B16, C10, RCD 30mA) = okruh rozváděče, řádek s S/N = spotřebič.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={() => download("eldock-import-revize.csv", revisionTemplateCsv(), "text/csv;charset=utf-8")} data-testid="revision-template-csv">
                <Download className="size-4" aria-hidden /> Šablona CSV
              </Button>
              <Button type="button" variant="outline" className="gap-2" onClick={() => download("eldock-import-revize.xlsx", buildXlsx("Import revize", [[...REVISION_TEMPLATE_HEADERS], ...REVISION_TEMPLATE_ROWS.map((row) => [...row])]) as BlobPart, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")} data-testid="revision-template-xlsx">
                <Download className="size-4" aria-hidden /> Šablona XLSX
              </Button>
            </div>
          </section>
        ) : null}

        {table ? (
          <section className="flex flex-col gap-3" data-testid="revision-preview" data-kind={kind} data-count={table.records.length}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{fileName}</span>
              <span className="text-muted-foreground">· {table.records.length} řádků{table.source ? ` · rozpoznáno: ${table.source}` : ""}</span>
              <span className="ml-auto flex gap-1" role="radiogroup" aria-label="Obsah tabulky">
                {(
                  [
                    ["circuits", "⚡ Okruhy rozváděče"],
                    ["appliances", "🔌 Spotřebiče"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={kind === id} onClick={() => setKindOverride(id)} className={cn("rounded-md border px-2 py-1 text-xs font-semibold", kind === id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")} data-testid={`revision-kind-${id}`}>
                    {label}
                  </button>
                ))}
              </span>
            </div>
            {table.warnings.map((warning) => (
              <p key={warning} className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                {warning}
              </p>
            ))}
            {table.headers.length ? (
              <details className="rounded-md border border-border p-2 text-xs">
                <summary className="cursor-pointer font-semibold">Přiřazení sloupců ({Object.keys(table.mapping).length} rozpoznáno)</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {REVISION_FIELDS.map((field) => (
                    <label key={field.id} className="flex flex-col gap-0.5 text-muted-foreground">
                      {field.label}
                      <select
                        value={table.mapping[field.id] ?? -1}
                        onChange={(event) => {
                          const next: RevisionMapping = { ...table.mapping };
                          const value = Number(event.target.value);
                          if (value < 0) delete next[field.id as RevisionField];
                          else next[field.id as RevisionField] = value;
                          setMapping(next);
                        }}
                        className="h-8 rounded-md border border-input bg-background px-1 text-foreground"
                        data-testid={`revision-map-${field.id}`}
                      >
                        <option value={-1}>—</option>
                        {table.headers.map((header, index) => (
                          <option key={`${header}-${index}`} value={index}>
                            {header || `Sloupec ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </details>
            ) : null}
            <div className="max-h-72 overflow-auto rounded-md border border-border">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left">
                    {["Označení", "Název", "Místnost", "Jistič", "Kabel", "Riso [MΩ]", "Zs [Ω]", "RPE [Ω]", "tA [ms]", "S/N", "Výsledek"].map((header) => (
                      <th key={header} className="border-b border-border px-2 py-1 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.records.slice(0, 60).map((record) => (
                    <tr key={record.line} className="border-b border-border/50" data-testid="revision-row" title={measurementSummary(record)}>
                      <td className="px-2 py-1 font-mono">{record.designation}</td>
                      <td className="px-2 py-1">{record.name}</td>
                      <td className="px-2 py-1">{record.location}</td>
                      <td className="px-2 py-1 font-mono">{record.protection}</td>
                      <td className="px-2 py-1">{record.cable}</td>
                      <td className="px-2 py-1 font-mono" data-testid="revision-riso">{record.risoAbove ? "> " : ""}{number(record.risoMOhm)}</td>
                      <td className="px-2 py-1 font-mono" data-testid="revision-zs">{number(record.zsOhm)}</td>
                      <td className="px-2 py-1 font-mono">{number(record.rpeOhm)}</td>
                      <td className="px-2 py-1 font-mono">{number(record.taMs)}</td>
                      <td className="px-2 py-1 font-mono" data-testid="revision-serial">{record.serialNumber}</td>
                      <td className="px-2 py-1">{record.result === "PASS" ? "✅" : record.result === "FAIL" ? "❌" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {target.kind === "panel" ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-60 flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
                  Název rozváděče
                  <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} data-testid="revision-panel-name" />
                </label>
                <Button type="button" className="gap-2 bg-yellow-400 font-bold text-zinc-950 hover:bg-yellow-300" disabled={saving || !table.records.length} onClick={createPanel} data-testid="revision-create-panel">
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}⚡ Vytvořit rozváděč v AI Panel Builderu
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  Patro
                  <select
                    value={floorId}
                    onChange={(event) => {
                      setFloorId(event.target.value);
                      setRoom(floors.find((floor) => floor.id === event.target.value)?.rooms[0] ?? "");
                    }}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    data-testid="revision-floor"
                  >
                    {floors.map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        {floor.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  Místnost
                  <select value={room} onChange={(event) => setRoom(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" data-testid="revision-room">
                    {rooms.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  Revizní technik (převzatá zpráva)
                  <Input value={inspectorName} maxLength={120} onChange={(event) => setInspectorName(event.target.value)} data-testid="revision-inspector" />
                </label>
                <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  Ev. č. osvědčení
                  <Input value={inspectorLicense} maxLength={120} onChange={(event) => setInspectorLicense(event.target.value)} />
                </label>
                <Button type="button" className="gap-2 sm:col-span-2" disabled={saving || !table.records.length || !floorId || !room} onClick={importFloor} data-testid="revision-import-floor">
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}🏢 Naplnit budovu: {table.records.length} zařízení do místnosti {room || "…"}
                </Button>
              </div>
            )}
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
