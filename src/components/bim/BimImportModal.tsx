"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, FileUp, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toPlantPayload } from "@/lib/bim/bim-payload";
import { bimSummary, metres, type BimSummary } from "@/lib/bim/bim-summary";
import { IfcError, parseIfc, type BimModel } from "@/lib/bim/ifc-parser";
import { buildingHref, equipmentHref, floorHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { createBimBoardProjectAction, importBimAction } from "@/server/actions/bim";
import type { BimImportResult } from "@/server/services/bim-import";

/** Vzorový BIM model haly (`npm run bim:sample`). */
export const SAMPLE_IFC_URL = "/samples/eldock-sample-plant.ifc";
/** Server Action přijme nejvýš 1 MB – zmenšený model musí být menší. */
const PAYLOAD_LIMIT = 950_000;

type Loaded = { fileName: string; model: BimModel; summary: BimSummary };

const kw = (value: number | null) => (value === null ? "–" : `${value.toLocaleString("cs-CZ")} kW`);

/**
 * Fáze 95: „🏢 Importovat BIM model závodu (.ifc)“ a „✨ Vyzkoušet na vzorovém BIM souboru haly (.ifc)“ – soubor se přečte
 * v prohlížeči (parser IFC), okno ukáže souhrn stavby a elektro výzbroje, po potvrzení vznikne budova se zařízeními (nebo
 * se aktualizují stávající rozváděče podle kódů) a u rozváděčů je tlačítko do AI Panel Builderu.
 */
export function BimImportButtons({ plantId, canPanelBuilder, compact = false }: { plantId: string; canPanelBuilder: boolean; compact?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<"CREATE" | "UPDATE">("CREATE");
  const [result, setResult] = useState<BimImportResult | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, startSaving] = useTransition();
  const [boardBusy, setBoardBusy] = useState<string | null>(null);

  async function read(fileName: string, text: () => Promise<string>) {
    setReading(true);
    try {
      const content = await text();
      // Parsování velkého modelu blokuje vlákno – spinner se nejdřív vykreslí
      await new Promise((resolve) => setTimeout(resolve, 0));
      const model = parseIfc(content);
      setLoaded({ fileName, model, summary: bimSummary(model) });
      setResult(null);
      setMode("CREATE");
    } catch (error) {
      toast.error(error instanceof IfcError ? `Soubor IFC se nepodařilo přečíst: ${error.message}` : "Soubor IFC se nepodařilo přečíst.");
    } finally {
      setReading(false);
    }
  }

  function pickFile(file: File) {
    if (!/\.ifc$/i.test(file.name)) return void toast.error("Vyberte soubor BIM ve formátu IFC (.ifc) – IFC2x3 nebo IFC4.");
    void read(file.name, () => file.text());
  }

  function sample() {
    void read("eldock-sample-plant.ifc", async () => {
      const response = await fetch(SAMPLE_IFC_URL);
      if (!response.ok) throw new Error("Vzorový soubor se nepodařilo stáhnout.");
      return response.text();
    });
  }

  function confirm() {
    if (!loaded) return;
    const payload = toPlantPayload(loaded.model);
    if (JSON.stringify(payload).length > PAYLOAD_LIMIT) return void toast.error("BIM model je pro import do závodu příliš velký – exportujte z CAD jen jednu budovu nebo elektro část.");
    startSaving(async () => {
      const response = await importBimAction({ plantId, mode, payload });
      if (!response.ok) return void toast.error(response.error);
      setResult(response.data);
      toast.success(mode === "CREATE" ? `🏢 Budova ${response.data.buildingCode} z BIMu založena – ${response.data.equipment.length} zařízení na mapě.` : `Aktualizováno ${response.data.equipment.length} zařízení podle kódů z BIMu.`);
      router.refresh();
    });
  }

  async function openBoard(equipmentId: string) {
    setBoardBusy(equipmentId);
    const response = await createBimBoardProjectAction({ equipmentId });
    setBoardBusy(null);
    if (!response.ok) return void toast.error(response.error, { duration: 10_000 });
    toast.success(`⚡ Návrh rozváděče: ${response.data.devices} přístrojů, ${response.data.circuits} vývodů z BIMu.`);
    router.push(`/panel-builder/${response.data.id}`);
  }

  const boards = result?.equipment.filter((row) => row.type === "SWITCHBOARD") ?? [];
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".ifc,application/x-step,model/ifc"
        className="sr-only"
        aria-label="BIM model závodu (.ifc)"
        data-testid="bim-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) pickFile(file);
        }}
      />
      <Button type="button" size={compact ? "sm" : "lg"} variant="outline" className="touch-target gap-2" onClick={() => input.current?.click()} disabled={reading} data-testid="bim-import-open">
        {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Building2 className="size-4" aria-hidden />} 🏢 Importovat BIM model závodu (.ifc)
      </Button>
      <Button type="button" size={compact ? "sm" : "lg"} variant="outline" className="touch-target gap-2" onClick={sample} disabled={reading} data-testid="bim-import-sample">
        <Sparkles className="size-4" aria-hidden /> ✨ Vyzkoušet na vzorovém BIM souboru haly (.ifc)
      </Button>
      <Dialog open={loaded !== null} onOpenChange={(open) => !open && !saving && setLoaded(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl" data-testid="bim-import-modal">
          {loaded ? (
            <>
              <DialogHeader>
                <DialogTitle>🏢 Import BIM modelu závodu</DialogTitle>
                <DialogDescription>
                  {loaded.fileName} · {loaded.model.schema || "IFC"} · jednotky {loaded.model.lengthUnitLabel} · projekt „{loaded.model.project.name}“{loaded.model.site ? ` · ${loaded.model.site}` : ""}
                </DialogDescription>
              </DialogHeader>
              <section className="grid gap-2 sm:grid-cols-4" aria-label="Stavební struktura" data-testid="bim-structure">
                {[
                  ["Budovy / haly", String(loaded.summary.buildings)],
                  ["Podlaží", String(loaded.summary.storeys)],
                  ["Místnosti (IfcSpace)", `${loaded.summary.spaces} · ${loaded.summary.areaM2.toLocaleString("cs-CZ")} m²`],
                  ["Vnější rozměr", loaded.summary.dimensions],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border p-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold" data-testid={`bim-structure-${label.split(" ")[0].toLowerCase()}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </section>
              <section className="flex flex-col gap-1" data-testid="bim-sources">
                <h3 className="text-sm font-semibold">⚡ Zdroje, trafostanice, DA a UPS</h3>
                {loaded.summary.sources.length ? (
                  <ul className="flex flex-wrap gap-1.5 text-xs">
                    {loaded.summary.sources.map((source) => (
                      <li key={source.tag} className="rounded-full border border-border px-2.5 py-1">
                        <b>{source.tag}</b> {source.kind}
                        {source.kva ? ` ${source.kva.toLocaleString("cs-CZ")} kVA` : ""} · {source.tier}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Model neobsahuje zdroje.</p>
                )}
              </section>
              <section className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">🗄️ Rozváděče (IfcElectricDistributionBoard)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs" data-testid="bim-boards">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-1 pr-2">Kód</th>
                        <th className="py-1 pr-2">Název</th>
                        <th className="py-1 pr-2">Podlaží / místnost</th>
                        <th className="py-1 pr-2 text-right">In [A]</th>
                        <th className="py-1 pr-2 text-right">Příkon [kW]</th>
                        <th className="py-1 pr-2">Krytí</th>
                        <th className="py-1 pr-2">Větev</th>
                        <th className="py-1">Napájeno z</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loaded.summary.boards.map((board) => (
                        <tr key={board.tag} className="border-b border-border/60" data-testid="bim-board-row" data-tag={board.tag}>
                          <td className="py-1 pr-2 font-mono font-semibold">{board.tag}</td>
                          <td className="py-1 pr-2">{board.name}</td>
                          <td className="py-1 pr-2 text-muted-foreground">{board.location}</td>
                          <td className="py-1 pr-2 text-right font-mono">{board.currentA ?? "–"}</td>
                          <td className="py-1 pr-2 text-right font-mono">{board.powerKw ?? "–"}</td>
                          <td className="py-1 pr-2">{board.ip ?? "–"}</td>
                          <td className="py-1 pr-2">{board.tier}</td>
                          <td className="py-1 font-mono">{board.fedFrom ?? "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="flex flex-col gap-1" data-testid="bim-machines">
                  <h3 className="text-sm font-semibold">⚙️ Stroje a technologické spotřebiče: {loaded.summary.machines.length}</h3>
                  <ul className="text-xs">
                    {loaded.summary.machines.map((machine) => (
                      <li key={machine.tag}>
                        <b className="font-mono">{machine.tag}</b> {machine.name} · {kw(machine.powerKw)}
                        {machine.fedFrom ? ` · z ${machine.fedFrom}` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="flex flex-col gap-1" data-testid="bim-routes">
                  <h3 className="text-sm font-semibold">🔌 Kabelové trasy a žlaby (IfcCableCarrierSegment)</h3>
                  <p className="text-xs">
                    {loaded.summary.routes.count} tras · <b>{metres(loaded.summary.routes.meters)} m</b> žlabů a lávek · {loaded.summary.routes.cables} kabelů ({metres(loaded.summary.routes.cableMeters)} m)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Domovní přístroje: {loaded.summary.wiring.outlets} zásuvek, {loaded.summary.wiring.lights} svítidel, {loaded.summary.wiring.switches} ovladačů · {loaded.summary.windows} oken, {loaded.summary.doors} dveří (převezme 2D půdorys).
                  </p>
                </section>
              </div>
              {loaded.model.warnings.length ? (
                <ul className="list-disc rounded-lg border border-amber-500/40 bg-amber-500/5 py-1.5 pl-6 pr-2 text-xs text-amber-200">
                  {loaded.model.warnings.slice(0, 8).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              {!result ? (
                <>
                  <fieldset className="flex flex-col gap-1.5 text-sm" data-testid="bim-mode">
                    <legend className="mb-1 text-xs font-semibold text-muted-foreground">Režim importu</legend>
                    {(
                      [
                        ["CREATE", "[ Vytvořit z BIMu kompletní mapu závodu, rozváděče, trasy i stroje ]"],
                        ["UPDATE", "[ Aktualizovat existující rozváděče podle kódů z BIMu (zachovat stávající PDF schémata a Červenky) ]"],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-2", mode === value ? "border-primary bg-primary/10" : "border-border")}>
                        <input type="radio" name="bim-mode" value={value} checked={mode === value} onChange={() => setMode(value)} data-testid={`bim-mode-${value.toLowerCase()}`} />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setLoaded(null)} disabled={saving}>
                      Zrušit
                    </Button>
                    <Button type="button" className="gap-2" onClick={confirm} disabled={saving} data-testid="bim-import-confirm">
                      {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />} {mode === "CREATE" ? "Importovat do závodu" : "Aktualizovat rozváděče"}
                    </Button>
                  </div>
                </>
              ) : (
                <section className="flex flex-col gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm" data-testid="bim-import-result">
                  <p className="font-semibold">
                    {result.mode === "CREATE"
                      ? `✅ Budova ${result.buildingCode} založena: ${result.equipment.length} zařízení s napájením, zálohováním a QR kódy.`
                      : `✅ Aktualizováno ${result.equipment.length} zařízení podle kódů z BIMu (dokumentace a Červenky zůstaly).`}
                  </p>
                  {result.buildingId ? (
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={result.firstFloorId ? floorHref(result.plantId, result.buildingId, result.firstFloorId) : buildingHref(result.plantId, result.buildingId)} data-testid="bim-open-floor">
                          Otevřít halu na mapě závodu
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                  {boards.length ? (
                    <ul className="flex flex-col gap-1.5" data-testid="bim-result-boards">
                      {boards.map((board) => (
                        <li key={board.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 p-2" data-testid="bim-result-board" data-tag={board.tag}>
                          <Link href={equipmentHref(board.id)} className="font-mono font-semibold underline-offset-2 hover:underline">
                            {board.tag}
                          </Link>
                          <span className="text-xs text-muted-foreground">{board.name} · napájí {board.feeds} zařízení</span>
                          {canPanelBuilder && board.feeds > 0 ? (
                            <Button type="button" size="sm" className="ml-auto gap-1.5" onClick={() => void openBoard(board.id)} disabled={boardBusy !== null} data-testid="bim-board-to-panel-builder">
                              {boardBusy === board.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Zap className="size-3.5" aria-hidden />} ⚡ Otevřít tento BIM rozváděč v AI Panel Builderu a vygenerovat vnitřní osazení
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {result.notFound.length ? <p className="text-xs text-amber-200">Bez shody v závodě: {result.notFound.join(", ")}</p> : null}
                  {result.notes.length ? (
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      {result.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
