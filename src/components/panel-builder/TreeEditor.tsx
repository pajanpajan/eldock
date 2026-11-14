"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CircleAlert, Crosshair, Info, ListOrdered, Loader2, Redo2, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { phaseCount } from "@/lib/panel-builder/catalog";
import {
  PHASE_OPTIONS,
  ancestors,
  assignParent,
  connectRightOf,
  currentRoot,
  dropOnto,
  dropParent,
  groupLoad,
  isConnected,
  proposeTree,
  readingOrder,
  renumber,
  setRoot,
  validateTree,
  type IssueSeverity,
  type TreeIssue,
  type TreeNode,
} from "@/lib/panel-builder/tree";
import { planBusbars } from "@/lib/panel-builder/pe-n-busbars";
import { supplyOf } from "@/lib/panel-builder/supply";
import type { IncomerFrom } from "@/lib/panel-builder/vector-layout";
import type { CombSetting } from "@/lib/panel-builder/comb-busbars";
import type { VectorDevice } from "@/lib/panel-builder/vector-symbols";
import { cn } from "@/lib/utils";
import { saveTreeAction, setIncomerAction } from "@/server/actions/panel-builder";

import { VectorPanel } from "./VectorPanel";

const SEVERITY: Record<IssueSeverity, { icon: typeof CircleAlert; className: string }> = {
  error: { icon: CircleAlert, className: "text-red-300" },
  warning: { icon: AlertTriangle, className: "text-yellow-300" },
  info: { icon: Info, className: "text-sky-300" },
};

type SaveState = "saved" | "saving" | "error";
const SINGLE = ["L1", "L2", "L3"] as const;
const amps = (value: number) => `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} A`;

/**
 * Krok 2: zapojení a hierarchie přímo nad 2D vektorovým rozváděčem. Lišta „Hlavní přívod
 * rozváděče“ (směr shora / zespoda a hlavní vstupní prvek – může to být odpínač, 3P jistič i
 * chránič), drag & drop přístroje na přístroj, ze kterého je napájen (jističe vždy paralelně vedle
 * sebe se střídáním L1/L2/L3), „🔗 Připojit jističe vpravo“ u chráničů a živé modré spojnice.
 * Změny drží historie (Zpět / Vpřed) a průběžně se ukládají.
 */
export function TreeEditor({
  projectId,
  initial,
  devices,
  rails,
  modulesPerRail,
  simultaneity,
  networkSystem,
  supplyPhases = 3,
  incomerFrom,
  combs,
}: {
  projectId: string;
  initial: TreeNode[];
  devices: VectorDevice[];
  rails: number;
  modulesPerRail: number | readonly number[];
  simultaneity: number;
  networkSystem: string;
  /** Fáze 55: počet fází přívodu (1 / 3) – sběrnice PE / N a soustava. */
  supplyPhases?: number;
  incomerFrom: IncomerFrom;
  /** Fáze 115: volba hřebenu lišt (Bez hřebenu = jističe s vodiči i ve stromu zapojení). */
  combs?: Record<number, CombSetting>;
}) {
  const router = useRouter();
  const [nodes, setNodes] = useState(initial);
  const [past, setPast] = useState<TreeNode[][]>([]);
  const [future, setFuture] = useState<TreeNode[][]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [picking, setPicking] = useState(false);
  const [incomer, setIncomer] = useState<IncomerFrom>(incomerFrom);
  // Fáze 55: svorkovnice PE / N0 / N-FIx podle soustavy přívodu a aktuálního stromu
  const busbars = useMemo(() => planBusbars(nodes, supplyOf({ networkSystem, supplyPhases })), [nodes, networkSystem, supplyPhases]);
  const [, startIncomer] = useTransition();
  // Počítadlo úprav: každá změna stromu (i Zpět / Vpřed) spustí průběžné uložení
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState({ revision: 0, error: false });
  const saveState: SaveState = saved.revision === revision ? (saved.error ? "error" : "saved") : "saving";

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const issues = useMemo(() => validateTree(nodes), [nodes]);
  const issuesById = useMemo(() => {
    const map = new Map<string, TreeIssue[]>();
    for (const issue of issues) map.set(issue.itemId, [...(map.get(issue.itemId) ?? []), issue]);
    return map;
  }, [issues]);
  const connected = useMemo(() => new Set(nodes.filter((node) => isConnected(node.id, byId)).map((node) => node.id)), [nodes, byId]);
  const root = currentRoot(nodes);

  const apply = useCallback(
    (change: (current: TreeNode[]) => TreeNode[]) => {
      setPast((history) => [...history.slice(-49), nodes]);
      setFuture([]);
      setNodes(change(nodes));
      setRevision((value) => value + 1);
    },
    [nodes],
  );

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast(past.slice(0, -1));
    setFuture([nodes, ...future]);
    setNodes(previous);
    setRevision((value) => value + 1);
  }, [past, future, nodes]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, nodes]);
    setNodes(next);
    setRevision((value) => value + 1);
  }, [past, future, nodes]);

  // Ctrl+Z / Ctrl+Y (mimo textová pole), Esc zruší výběr a režim určení kořene
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.target as HTMLElement).closest("input, textarea, select")) return;
      if (event.key === "Escape") {
        setPicking(false);
        setSelected(new Set());
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Průběžné ukládání (400 ms po poslední změně)
  useEffect(() => {
    if (!revision) return;
    const timer = setTimeout(async () => {
      const result = await saveTreeAction({
        projectId,
        assignments: nodes.map(({ id, parentItemId, fedFromIncomer, phaseAssignment, circuitLabel, designation }) => ({
          id,
          parentItemId,
          fedFromIncomer,
          phaseAssignment: phaseAssignment as (typeof PHASE_OPTIONS)[number] | null,
          circuitLabel,
          designation,
        })),
      });
      setSaved({ revision, error: !result.ok });
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
    }, 400);
    return () => clearTimeout(timer);
  }, [revision, nodes, projectId, router]);

  const update = (id: string, patch: Partial<TreeNode>) => apply((current) => current.map((node) => (node.id === id ? { ...node, ...patch } : node)));

  function proposeAll() {
    const proposal = proposeTree(nodes, root?.id ?? null);
    const next = nodes.map((node) => ({ ...node, ...proposal.get(node.id) }));
    apply(() => next);
    const head = currentRoot(next);
    toast.success(`Zapojení navrženo: hlavní vstupní prvek ${head?.designation ?? "?"}, chrániče napájí jističe napravo od sebe, fáze se střídají.`);
  }

  function renumberAll() {
    const designations = renumber(nodes);
    apply((current) => current.map((node) => ({ ...node, designation: designations.get(node.id) ?? node.designation })));
    toast.success("IEC značení přečíslováno v pořadí lišt (-Q, -FI, -FA, -FV, -F …).");
  }

  function chooseRootNode(id: string) {
    const node = byId.get(id);
    if (!node) return;
    apply((current) => setRoot(current, id));
    setPicking(false);
    setSelected(new Set([id]));
    toast.success(`Hlavní vstupní prvek: ${node.designation} – přívod ${incomer === "TOP" ? "shora" : "zespoda"}.`);
  }

  function drop(sourceIds: string[], targetId: string) {
    const result = dropOnto(nodes, sourceIds, targetId);
    if (!result.ok) return void toast.error(result.error);
    apply(() => result.nodes);
    const parent = byId.get(result.parentId);
    const moved = sourceIds.filter((id) => id !== targetId).map((id) => byId.get(id)?.designation).filter(Boolean);
    toast.success(`${moved.join(", ")} → napájeno z ${parent?.designation ?? "?"}${moved.length > 1 ? " (paralelně vedle sebe)" : ""}.`);
  }

  function setParent(ids: string[], parentId: string) {
    const result = assignParent(nodes, ids, parentId);
    if (!result.ok) return void toast.error(result.error);
    apply(() => result.nodes);
  }

  function changeIncomer(value: IncomerFrom) {
    if (value === incomer) return;
    setIncomer(value);
    startIncomer(async () => {
      const result = await setIncomerAction(projectId, value);
      if (!result.ok) {
        setIncomer(incomer);
        toast.error(result.error);
      }
    });
  }

  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.severity]++;
  const ordered = readingOrder(nodes);
  const deviceById = new Map(devices.map((device) => [device.id, device]));
  const typeOf = (node: TreeNode) => deviceById.get(node.id)?.typeCode ?? "nerozpoznáno";
  // Hlavním vstupním prvkem může být cokoli; roletka nabízí 3P/4P přístroje (a aktuální kořen)
  const rootCandidates = ordered.filter((node) => node.category !== "SPD" && (phaseCount(node.poles ?? "1P") === 3 || node.id === root?.id));
  const shown = devices.map((device) => {
    const node = byId.get(device.id);
    return node ? { ...device, label: node.circuitLabel, designation: node.designation } : device;
  });
  const focus = selected.size === 1 ? (byId.get([...selected][0]) ?? null) : null;
  const many = selected.size > 1 ? ordered.filter((node) => selected.has(node.id)) : [];

  function phaseControl(node: TreeNode) {
    if (node.category === "SPD") return <span className="text-xs text-muted-foreground">bez fáze (SPD)</span>;
    if (phaseCount(node.poles ?? "1P") === 3) {
      return (
        <span className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs" data-testid={`phase-fixed-${node.designation}`}>
          {(node.phaseAssignment ?? "L1,L2,L3").split(",").join(", ")}
        </span>
      );
    }
    const neutral = node.category === "RCD";
    const current = node.phaseAssignment?.split(",")[0] ?? null;
    return (
      <span className="flex gap-1" role="group" aria-label={`${node.designation} fáze`}>
        {SINGLE.map((phase) => (
          <button
            key={phase}
            type="button"
            aria-pressed={current === phase}
            aria-label={`${node.designation} fáze ${phase}`}
            onClick={() => update(node.id, { phaseAssignment: neutral ? `${phase},N` : phase })}
            className={cn(
              "h-8 min-w-10 rounded-md border px-2 font-mono text-xs font-semibold transition-colors",
              current === phase ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
            )}
          >
            {phase}
          </button>
        ))}
      </span>
    );
  }

  /** Roletka „Napájeno z“ – přístupná alternativa k drag & drop (bez sebe a vlastních potomků). */
  function parentSelect(ids: string[], label: string) {
    const blocked = new Set(ids);
    const options = ordered
      .filter((node) => !blocked.has(node.id) && !ids.some((id) => (ancestors(node.id, byId) ?? []).includes(id)))
      .map((node) => ({ id: node.id, label: `${node.designation} · ${typeOf(node)} (Lišta ${node.dinRailIndex})` }));
    const common = ids.every((id) => byId.get(id)?.parentItemId === byId.get(ids[0])?.parentItemId) ? (byId.get(ids[0])?.parentItemId ?? "") : "";
    return <ParentSelect label={label} value={common} options={options} onPick={(parentId) => setParent(ids, parentId)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button className="touch-target gap-2" onClick={proposeAll}>
          <Sparkles className="size-4" aria-hidden /> AI návrh zapojení na 1 klik
        </Button>
        <Button variant="outline" className="touch-target gap-2" onClick={undo} disabled={!past.length} aria-label="Zpět">
          <Undo2 className="size-4" aria-hidden /> Zpět
        </Button>
        <Button variant="outline" className="touch-target gap-2" onClick={redo} disabled={!future.length} aria-label="Vpřed">
          <Redo2 className="size-4" aria-hidden /> Vpřed
        </Button>
        <Button variant="outline" className="touch-target gap-2" onClick={renumberAll}>
          <ListOrdered className="size-4" aria-hidden /> Přečíslovat IEC značení (-Q, -FI, -F …)
        </Button>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-xs" data-testid="tree-summary">
          <span className={counts.error ? "text-red-300" : "text-muted-foreground"}>Chyby: {counts.error}</span>
          <span className={counts.warning ? "text-yellow-300" : "text-muted-foreground"}>Varování: {counts.warning}</span>
          <span className="text-muted-foreground">
            Zapojeno {connected.size}/{nodes.length}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground" data-testid="tree-save-state">
            {saveState === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : saveState === "saved" ? <Check className="size-3.5 text-emerald-400" aria-hidden /> : <CircleAlert className="size-3.5 text-red-400" aria-hidden />}
            {saveState === "saving" ? "Ukládám…" : saveState === "saved" ? "Uloženo" : "Neuloženo"}
          </span>
        </span>
      </div>

      {/* Hlavní přívod: směr a kořenový prvek (odpínač, 3P jistič i hlavní chránič) */}
      <section aria-label="Hlavní přívod rozváděče" className="flex flex-wrap items-end gap-3 rounded-xl border border-sky-500/40 bg-sky-500/5 p-3" data-testid="incomer-bar">
        <h2 className="w-full text-sm font-semibold text-sky-100">Hlavní přívod rozváděče</h2>
        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Směr přívodu">
          {(
            [
              ["TOP", "⬇ Přívod SHORA"],
              ["BOTTOM", "⬆ Přívod ZESPODA"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={incomer === value}
              onClick={() => changeIncomer(value)}
              className={cn("min-h-9 rounded-md px-3 text-sm font-semibold", incomer === value ? "bg-sky-500 text-white" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <Button variant={picking ? "default" : "outline"} className="touch-target gap-2" aria-pressed={picking} onClick={() => setPicking(!picking)}>
          <Crosshair className="size-4" aria-hidden /> 🎯 Určit hlavní vstupní prvek
        </Button>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Hlavní vstupní prvek
          <select
            aria-label="Hlavní vstupní prvek"
            value={root?.id ?? ""}
            onChange={(event) => event.target.value && chooseRootNode(event.target.value)}
            className="h-9 min-w-56 rounded-md border border-border bg-card px-2 text-sm text-foreground"
          >
            <option value="">— neurčen —</option>
            {rootCandidates.map((node) => (
              <option key={node.id} value={node.id}>
                {node.designation} · {typeOf(node)} ({node.poles ?? "?"})
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground" data-testid="incomer-root">
          {root ? (
            <>
              Přívod {networkSystem} → <b className="font-mono text-sky-200">{root.designation}</b> ({typeOf(root)})
            </>
          ) : (
            "Hlavní vstupní prvek zatím není určen – AI návrh vezme odpínač, jinak první 3P/4P přístroj na 1. liště."
          )}
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-label="Zapojení na vektorovém rozváděči" className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Chyťte přístroj (nebo výběr Ctrl/Shift + klik, „▣ lišta“ = celá lišta) a přetáhněte ho na přístroj, ze kterého je napájen. Jističe přetažené na chránič nebo na jiný jistič jeho skupiny se řadí
            paralelně vedle sebe.
          </p>
          <VectorPanel
            devices={shown}
            rails={rails}
            modulesPerRail={modulesPerRail}
            nodes={nodes}
            incomer={incomer}
            busbars={busbars}
            combs={combs}
            supplyPhases={supplyPhases === 1 ? 1 : 3}
            selectedIds={selected}
            pickHint={picking ? "🎯 Klikněte na přístroj, do kterého vede hlavní přívod (odpínač, 3P jistič nebo hlavní chránič). Esc = zrušit." : null}
            outlineFor={(device) => (device.id === root?.id ? { color: "#38bdf8" } : connected.has(device.id) ? null : { color: "#ef4444", dashed: true })}
            onSelect={(device, { additive }) => {
              if (picking) return chooseRootNode(device.id);
              setSelected((current) => {
                if (!additive) return new Set(current.has(device.id) && current.size === 1 ? [] : [device.id]);
                const next = new Set(current);
                if (next.has(device.id)) next.delete(device.id);
                else next.add(device.id);
                return next;
              });
            }}
            onBackground={() => setSelected(new Set())}
            onDrop={drop}
            dragHint={(ids, target) => {
              const node = byId.get(target.id);
              const parent = node ? byId.get(dropParent(node)) : null;
              return parent && parent.id !== target.id ? `vedle ${target.designation} (pod ${parent.designation})` : `napájet z ${target.designation}`;
            }}
            onLabelEdit={(device, label) => update(device.id, { circuitLabel: label })}
            onSelectRail={(rail) => setSelected(new Set(nodes.filter((node) => node.dinRailIndex === rail && node.id !== root?.id).map((node) => node.id)))}
            deviceAction={(device) =>
              device.category === "RCD"
                ? {
                    label: "🔗 Připojit jističe vpravo na této liště",
                    onClick: () => {
                      const result = connectRightOf(nodes, device.id);
                      if (!result.count) return void toast.info(`Napravo od ${device.designation} na liště ${device.dinRailIndex} nejsou žádné jističe.`);
                      apply(() => result.nodes);
                      toast.success(`${result.count} jističů napravo od ${device.designation} zapojeno pod chránič (L1/L2/L3 střídavě).`);
                    },
                  }
                : null
            }
          />
        </section>

        <aside aria-label="Vybraný prvek" className="flex flex-col gap-3 self-start rounded-xl border border-border bg-card p-4" data-testid="tree-inspector">
          {focus ? (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-mono text-lg font-semibold">{focus.designation}</h2>
                <span className="text-xs text-muted-foreground">
                  {typeOf(focus)} · Lišta {focus.dinRailIndex}
                </span>
                {focus.id === root?.id ? <span className="rounded-full border border-sky-400/60 px-2 text-xs text-sky-200">hlavní vstupní prvek</span> : null}
              </div>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Funkce / název obvodu
                <Input
                  aria-label={`${focus.designation} název obvodu`}
                  className="h-9"
                  defaultValue={focus.circuitLabel}
                  key={`${focus.id}:${focus.circuitLabel}`}
                  placeholder="Funkce obvodu"
                  maxLength={80}
                  onBlur={(event) => event.target.value !== focus.circuitLabel && update(focus.id, { circuitLabel: event.target.value })}
                  onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">Fáze: {phaseControl(focus)}</div>
              {focus.id === root?.id ? (
                <p className="text-xs text-muted-foreground">Napájeno z hlavního přívodu ({networkSystem}).</p>
              ) : (
                parentSelect([focus.id], `${focus.designation} napájeno z`)
              )}
              {nodes.some((node) => node.parentItemId === focus.id) ? (
                <p className="flex items-start gap-1.5 text-xs text-sky-200" data-testid={`group-load-${focus.designation}`}>
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {(() => {
                    const load = groupLoad(focus.id, nodes, simultaneity);
                    return `Napájí ${nodes.filter((node) => node.parentItemId === focus.id).length} prvků · zatížení (Ib × SF ${simultaneity.toLocaleString("cs-CZ")}): L1 ${amps(load.L1)} · L2 ${amps(load.L2)} · L3 ${amps(load.L3)}${focus.ratedCurrentA ? ` · In ${amps(focus.ratedCurrentA)}` : ""} – informace, ne chyba`;
                  })()}
                </p>
              ) : null}
              {(issuesById.get(focus.id) ?? []).map((issue) => {
                const { icon: Icon, className } = SEVERITY[issue.severity];
                return (
                  <p key={issue.message} className={cn("flex items-start gap-1.5 text-xs", className)}>
                    <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {issue.message}
                  </p>
                );
              })}
            </>
          ) : many.length ? (
            <>
              <h2 className="font-semibold">Vybráno {many.length} prvků</h2>
              <p className="font-mono text-xs text-muted-foreground">{many.map((node) => node.designation).join(", ")}</p>
              <p className="text-xs text-muted-foreground">Přetáhněte výběr na napájecí přístroj, nebo zvolte níže – zapojí se paralelně vedle sebe a fáze se rozdělí L1, L2, L3.</p>
              {parentSelect(
                many.filter((node) => node.id !== root?.id).map((node) => node.id),
                "Výběr napájen z",
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <h2 className="font-semibold text-foreground">Zapojení a hierarchie</h2>
              <p>Klikněte na přístroj ve vektorovém rozváděči – zde nastavíte fázi, název obvodu a napájení.</p>
              <ul className="list-disc pl-5 text-xs">
                <li>Modrá čára se šipkou = hlavní přívod do vstupního prvku.</li>
                <li>Silná vodorovná modrá = hřebenová sběrnice skupiny.</li>
                <li>Červeně čárkovaně = prvek zatím není zapojen.</li>
              </ul>
            </div>
          )}

          {issues.some((issue) => issue.severity !== "info") ? (
            <div className="flex flex-col gap-1 border-t border-border pt-3" data-testid="tree-issues">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Hlídač zapojení</h3>
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {issues
                  .filter((issue) => issue.severity !== "info")
                  .map((issue) => {
                    const { icon: Icon, className } = SEVERITY[issue.severity];
                    return (
                      <li key={`${issue.itemId}:${issue.message}`}>
                        <button type="button" onClick={() => setSelected(new Set([issue.itemId]))} className={cn("flex items-start gap-1.5 text-left text-xs hover:underline", className)}>
                          <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {issue.message}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ParentSelect({ label, value, options, onPick }: { label: string; value: string; options: { id: string; label: string }[]; onPick: (parentId: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          if (event.target.value) onPick(event.target.value);
        }}
        className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
      >
        <option value="">— nezapojeno —</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
