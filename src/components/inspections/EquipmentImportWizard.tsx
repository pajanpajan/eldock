"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileUp, Loader2, MapPin, Sparkles, TriangleAlert, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { IMPORT_CATEGORY_LABELS, IMPORT_TEMPLATE_CSV, matchFloor, parseImport, type ImportRow } from "@/lib/equipment-import";
import { formatCount, formatDate } from "@/lib/format";
import { formatQrToken } from "@/lib/qr-label";
import { equipmentHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { importEquipmentAction } from "@/server/actions/equipment-import";
import type { ImportFloor } from "@/server/queries/inspections";

type Step = "source" | "assign" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "source", label: "1. Nahrání dat" },
  { key: "assign", label: "2. Přiřazení lokality" },
  { key: "done", label: "3. Potvrzení a uložení" },
];

const selectClass = "h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";

/** Soubor z Excelu bývá v UTF-8 (CSV UTF-8) nebo ve Windows-1250 (starší „CSV oddělený středníkem“). */
async function readText(file: File) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1250").decode(buffer);
  }
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Průvodce hromadným importem: (1) CSV soubor nebo vložení ze schránky, (2) tabulka s hromadným
 * přiřazením do Závod → Budova → Patro a automatickým spárováním podle lokace, (3) uložení s QR kódy.
 */
export function EquipmentImportWizard({ floors, defaultPlantId }: { floors: ImportFloor[]; defaultPlantId: string | null }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("source");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [assigned, setAssigned] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [plantId, setPlantId] = useState(defaultPlantId ?? floors[0]?.plantId ?? "");
  const [building, setBuilding] = useState("");
  const [floorId, setFloorId] = useState("");
  const [result, setResult] = useState<{ created: { id: string; tag: string; qrToken: string }[]; skipped: { tag: string; reason: string }[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const plants = useMemo(() => [...new Map(floors.map((floor) => [floor.plantId, floor.plantName])).entries()], [floors]);
  const plantFloors = floors.filter((floor) => floor.plantId === plantId);
  const buildings = [...new Set(plantFloors.map((floor) => floor.buildingName))];
  const buildingFloors = plantFloors.filter((floor) => floor.buildingName === building);
  const floorLabel = (id: string) => {
    const floor = floors.find((entry) => entry.id === id);
    return floor ? `${floor.buildingName} › ${floor.floorName}` : "";
  };

  const valid = (row: ImportRow) => row.errors.length === 0 && row.type !== null;
  const ready = rows.filter((row) => valid(row) && assigned[row.line]);
  const unassigned = rows.filter((row) => valid(row) && !assigned[row.line]);
  const invalid = rows.filter((row) => !valid(row));

  function autoMatch(source: ImportRow[], scope: ImportFloor[]) {
    const next: Record<number, string> = {};
    for (const row of source) {
      const match = valid(row) ? matchFloor(row.location, scope) : null;
      if (match) next[row.line] = match;
    }
    return next;
  }

  function load(source: string) {
    const parsed = parseImport(source);
    if (!parsed.length) {
      toast.error("V datech nejsou žádné řádky.");
      return;
    }
    const matched = autoMatch(parsed, plantFloors);
    setRows(parsed);
    setAssigned(matched);
    setSelected(new Set(parsed.filter((row) => valid(row) && !matched[row.line]).map((row) => row.line)));
    setStep("assign");
    toast.success(`Načteno ${formatCount(parsed.length, ["položka", "položky", "položek"])}.`, {
      description: `Automaticky spárováno ${Object.keys(matched).length}, ${parsed.filter((row) => !valid(row)).length} s chybou.`,
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const content = await readText(file);
    setText(content);
    load(content);
    if (fileInput.current) fileInput.current.value = "";
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([IMPORT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "eldock-import-sablona.csv" });
    link.click();
    URL.revokeObjectURL(url);
  }

  function toggle(line: number, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(line);
      else next.delete(line);
      return next;
    });
  }

  function assignSelected() {
    if (!floorId) return;
    setAssigned((current) => ({ ...current, ...Object.fromEntries([...selected].map((line) => [line, floorId])) }));
    toast.success(`${formatCount(selected.size, ["položka přiřazena", "položky přiřazeny", "položek přiřazeno"])} do ${floorLabel(floorId)}.`);
    setSelected(new Set());
  }

  function submit() {
    startTransition(async () => {
      const response = await importEquipmentAction({
        items: ready.map((row) => ({
          tag: row.tag,
          name: row.name,
          type: row.type as "APPLIANCE",
          floorId: assigned[row.line],
          intervalMonths: row.intervalMonths,
          lastInspection: row.lastInspection ? isoDate(row.lastInspection) : null,
          location: row.location,
        })),
      });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      setResult(response.data);
      setStep("done");
      toast.success(`Importováno ${formatCount(response.data.created.length, ["zařízení", "zařízení", "zařízení"])} včetně QR kódů.`);
    });
  }

  const selectable = rows.filter(valid);
  const allSelected = selectable.length > 0 && selectable.every((row) => selected.has(row.line));

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2" aria-label="Kroky importu">
        {STEPS.map(({ key, label }) => (
          <li key={key} aria-current={step === key ? "step" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", step === key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
            {label}
          </li>
        ))}
      </ol>

      {step === "source" ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">Soubor CSV</h2>
            <p className="text-sm text-muted-foreground">
              Sloupce: <span className="text-foreground">Název, Evidenční číslo, Kategorie (VTZ / Spotřebič / Nářadí), Interval revize (měsíce), Poslední revize, Lokace</span>. Oddělovač středník, čárka nebo
              tabulátor; kódování UTF-8 i Windows-1250.
            </p>
            <input ref={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" data-testid="import-file" onChange={(event) => onFile(event.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <Button className="touch-target gap-2" onClick={() => fileInput.current?.click()}>
                <FileUp className="size-4" />
                Nahrát CSV soubor
              </Button>
              <Button variant="outline" className="touch-target gap-2" onClick={downloadTemplate}>
                <Download className="size-4" />
                Stáhnout vzorovou CSV šablonu
              </Button>
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <Label htmlFor="import-paste" className="font-semibold">
              …nebo vložte tabulku z Excelu (Ctrl+V)
            </Label>
            <Textarea
              id="import-paste"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={9}
              placeholder={"Název\tEvidenční číslo\tKategorie\tInterval revize (měsíce)\tPoslední revize\tLokace\nRychlovarná konvice\tSP-0401\tSpotřebič\t24\t12.03.2026\tAdministrativa 2. NP"}
              className="font-mono text-xs"
            />
            <Button className="touch-target gap-2" disabled={!text.trim()} onClick={() => load(text)}>
              <Upload className="size-4" />
              Načíst vložená data
            </Button>
          </div>
        </section>
      ) : null}

      {step === "assign" ? (
        <section className="space-y-4">
          <div className="sticky top-16 z-20 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/95 p-3 backdrop-blur" data-testid="import-bulk">
            <div className="space-y-1">
              <Label htmlFor="bulk-plant" className="text-xs">
                Závod
              </Label>
              <select
                id="bulk-plant"
                className={selectClass}
                value={plantId}
                onChange={(event) => {
                  setPlantId(event.target.value);
                  setBuilding("");
                  setFloorId("");
                }}
              >
                {plants.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-building" className="text-xs">
                Budova
              </Label>
              <select
                id="bulk-building"
                className={selectClass}
                value={building}
                onChange={(event) => {
                  setBuilding(event.target.value);
                  const first = plantFloors.find((floor) => floor.buildingName === event.target.value);
                  setFloorId(first?.id ?? "");
                }}
              >
                <option value="">– vyberte –</option>
                {buildings.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-floor" className="text-xs">
                Patro
              </Label>
              <select id="bulk-floor" className={cn(selectClass, "min-w-40")} value={floorId} disabled={!building} onChange={(event) => setFloorId(event.target.value)}>
                {buildingFloors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.floorName}
                  </option>
                ))}
              </select>
            </div>
            <Button className="touch-target gap-2" disabled={!floorId || !selected.size} onClick={assignSelected}>
              <MapPin className="size-4" />
              Přiřadit vybraným ({selected.size})
            </Button>
            <Button
              variant="outline"
              className="touch-target gap-2"
              onClick={() => {
                const matched = autoMatch(rows, plantFloors);
                setAssigned((current) => ({ ...current, ...matched }));
                toast.success(`Spárováno podle lokace: ${Object.keys(matched).length}.`);
              }}
            >
              <Wand2 className="size-4" />
              Automaticky spárovat podle lokace
            </Button>
            <Button variant="ghost" className="touch-target" onClick={() => setSelected(new Set(unassigned.map((row) => row.line)))}>
              Vybrat nepřiřazené ({unassigned.length})
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary align-middle"
                      checked={allSelected}
                      onChange={(event) => setSelected(event.target.checked ? new Set(selectable.map((row) => row.line)) : new Set())}
                      aria-label="Vybrat všechny platné položky"
                    />
                  </TableHead>
                  <TableHead>Ev. číslo</TableHead>
                  <TableHead>Název</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="hidden md:table-cell">Interval</TableHead>
                  <TableHead className="hidden md:table-cell">Poslední revize</TableHead>
                  <TableHead className="hidden lg:table-cell">Lokace ze souboru</TableHead>
                  <TableHead>Přiřazené patro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const ok = valid(row);
                  return (
                    <TableRow key={row.line} className={cn(!ok && "bg-red-500/5", selected.has(row.line) && "bg-primary/5")} data-testid="import-row">
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-5 accent-primary align-middle"
                          disabled={!ok}
                          checked={selected.has(row.line)}
                          onChange={(event) => toggle(row.line, event.target.checked)}
                          aria-label={`Vybrat ${row.tag || `řádek ${row.line}`}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-semibold">{row.tag || "–"}</TableCell>
                      <TableCell className="max-w-64">
                        <span className="block truncate">{row.name || "–"}</span>
                        {row.errors.length ? (
                          <span className="flex items-start gap-1 text-xs text-red-300">
                            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            Řádek {row.line}: {row.errors.join(" ")}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">{row.category ? IMPORT_CATEGORY_LABELS[row.category] : "–"}</TableCell>
                      <TableCell className="hidden text-sm md:table-cell">{row.intervalMonths ? `${row.intervalMonths} měs.` : "dle normy"}</TableCell>
                      <TableCell className="hidden text-sm md:table-cell">{row.lastInspection ? formatDate(row.lastInspection) : "–"}</TableCell>
                      <TableCell className="hidden max-w-48 truncate text-sm text-muted-foreground lg:table-cell">{row.location || "–"}</TableCell>
                      <TableCell>
                        <select
                          className={cn(selectClass, "w-full min-w-48", ok && !assigned[row.line] && "border-orange-500/60")}
                          value={assigned[row.line] ?? ""}
                          disabled={!ok}
                          aria-label={`Patro pro ${row.tag}`}
                          onChange={(event) => setAssigned((current) => ({ ...current, [row.line]: event.target.value }))}
                        >
                          <option value="">– nepřiřazeno –</option>
                          {plants.map(([id, name]) => (
                            <optgroup key={id} label={name}>
                              {floors
                                .filter((floor) => floor.plantId === id)
                                .map((floor) => (
                                  <option key={floor.id} value={floor.id}>
                                    {floor.buildingName} › {floor.floorName}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
            <p className="flex-1 text-sm">
              <span className="font-semibold text-emerald-300">{formatCount(ready.length, ["připravena", "připraveny", "připraveno"])}</span>
              {unassigned.length ? <span className="text-orange-300"> · {unassigned.length} bez patra</span> : null}
              {invalid.length ? <span className="text-red-300"> · {invalid.length} s chybou (přeskočí se)</span> : null}
            </p>
            <Button variant="outline" className="touch-target" onClick={() => setStep("source")} disabled={pending}>
              Zpět
            </Button>
            <Button size="lg" className="touch-target gap-2" disabled={!ready.length || pending} onClick={submit}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Importovat {ready.length} zařízení a vygenerovat QR kódy
            </Button>
          </div>
        </section>
      ) : null}

      {step === "done" && result ? (
        <section className="space-y-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4" data-testid="import-result">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="size-5 text-emerald-400" aria-hidden />
            Importováno {formatCount(result.created.length, ["zařízení", "zařízení", "zařízení"])}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {result.created.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <Link href={equipmentHref(row.id)} className="font-mono font-semibold text-primary underline-offset-4 hover:underline">
                  {row.tag}
                </Link>
                <span className="font-mono text-xs text-muted-foreground">QR {formatQrToken(row.qrToken)}</span>
                <a href={`${equipmentHref(row.id)}/label`} target="_blank" rel="noopener" className="text-xs underline-offset-4 hover:underline">
                  Štítek
                </a>
              </li>
            ))}
          </ul>
          {result.skipped.length ? (
            <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-200">
              <p className="font-medium">Přeskočeno {result.skipped.length}:</p>
              <ul className="mt-1 list-disc pl-5">
                {result.skipped.map((row, index) => (
                  <li key={`${row.tag}-${index}`}>
                    <span className="font-mono">{row.tag}</span> – {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button
            variant="outline"
            className="touch-target"
            onClick={() => {
              setRows([]);
              setText("");
              setAssigned({});
              setResult(null);
              setStep("source");
            }}
          >
            Importovat další soubor
          </Button>
        </section>
      ) : null}
    </div>
  );
}
