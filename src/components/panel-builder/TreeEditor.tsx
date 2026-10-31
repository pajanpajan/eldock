"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CircleAlert, Info, ListOrdered, Loader2, Redo2, Sparkles, Undo2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PHASE_OPTIONS, ancestors, flattenTree, isConnected, proposeTree, renumber, validateTree, type IssueSeverity, type TreeIssue, type TreeNode } from "@/lib/panel-builder/tree";
import { cn } from "@/lib/utils";
import { saveTreeAction } from "@/server/actions/panel-builder";

import { DinRails } from "./DinRails";

export interface TreeMeta {
  typeCode: string;
  modulesWidth: number;
}

const INCOMER = "__incomer__";
const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";
const SEVERITY: Record<IssueSeverity, { icon: typeof CircleAlert; className: string }> = {
  error: { icon: CircleAlert, className: "text-red-300" },
  warning: { icon: AlertTriangle, className: "text-yellow-300" },
  info: { icon: Info, className: "text-sky-300" },
};

type SaveState = "saved" | "saving" | "error";

/**
 * Krok 2: DIN lišty se stavem zapojení (vlevo) a hierarchický strom (vpravo). Změny se drží
 * v historii (Zpět / Vpřed) a průběžně ukládají; hlídač vyhodnocuje strom při každé změně.
 */
export function TreeEditor({
  projectId,
  initial,
  meta,
  rails,
  modulesPerRail,
  simultaneity,
  networkSystem,
}: {
  projectId: string;
  initial: TreeNode[];
  meta: Record<string, TreeMeta>;
  rails: number;
  modulesPerRail: number;
  simultaneity: number;
  networkSystem: string;
}) {
  const router = useRouter();
  const [nodes, setNodes] = useState(initial);
  const [past, setPast] = useState<TreeNode[][]>([]);
  const [future, setFuture] = useState<TreeNode[][]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [bulkParent, setBulkParent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const dirty = useRef(false);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const issues = useMemo(() => validateTree(nodes, simultaneity), [nodes, simultaneity]);
  const issuesById = useMemo(() => {
    const map = new Map<string, TreeIssue[]>();
    for (const issue of issues) map.set(issue.itemId, [...(map.get(issue.itemId) ?? []), issue]);
    return map;
  }, [issues]);
  const connected = useMemo(() => new Set(nodes.filter((node) => isConnected(node.id, byId)).map((node) => node.id)), [nodes, byId]);
  const flat = useMemo(() => flattenTree(nodes), [nodes]);
  const loose = nodes.filter((node) => !flat.some((entry) => entry.node.id === node.id));

  const apply = useCallback(
    (change: (current: TreeNode[]) => TreeNode[]) => {
      setPast((history) => [...history.slice(-49), nodes]);
      setFuture([]);
      setNodes(change(nodes));
      dirty.current = true;
    },
    [nodes],
  );

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast(past.slice(0, -1));
    setFuture([nodes, ...future]);
    setNodes(previous);
    dirty.current = true;
  }, [past, future, nodes]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, nodes]);
    setNodes(next);
    dirty.current = true;
  }, [past, future, nodes]);

  // Ctrl+Z / Ctrl+Y (mimo textová pole)
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || (event.target as HTMLElement).closest("input, textarea")) return;
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
    if (!dirty.current) return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      dirty.current = false;
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
      if (!result.ok) {
        setSaveState("error");
        toast.error(result.error);
        return;
      }
      setSaveState("saved");
      router.refresh();
    }, 400);
    return () => clearTimeout(timer);
  }, [nodes, projectId, router]);

  const update = (id: string, patch: Partial<TreeNode>) => apply((current) => current.map((node) => (node.id === id ? { ...node, ...patch } : node)));

  /** Možní rodiče uzlu: ne on sám ani jeho potomci (cyklus). */
  const parentOptions = (nodeId: string | null) =>
    nodes.filter((candidate) => {
      if (candidate.id === nodeId) return false;
      if (!nodeId) return true;
      const chain = ancestors(candidate.id, byId);
      return chain !== null && !chain.includes(nodeId);
    });

  const setParent = (id: string, value: string) => update(id, value === INCOMER ? { parentItemId: null, fedFromIncomer: true } : value ? { parentItemId: value, fedFromIncomer: false } : { parentItemId: null, fedFromIncomer: false });

  function proposeAll() {
    const proposal = proposeTree(nodes);
    apply((current) => current.map((node) => ({ ...node, ...proposal.get(node.id) })));
    setSelected(new Set());
    toast.success("Strom navržen podle kategorií a pozic na DIN lištách, fáze rozvrženy.");
  }

  function renumberAll() {
    const designations = renumber(nodes);
    apply((current) => current.map((node) => ({ ...node, designation: designations.get(node.id) ?? node.designation })));
    toast.success("IEC značení přečíslováno v pořadí lišt.");
  }

  function bulkAssign() {
    if (!bulkParent || !selected.size) return;
    const parent = bulkParent === INCOMER ? null : bulkParent;
    apply((current) => current.map((node) => (selected.has(node.id) && node.id !== parent ? { ...node, parentItemId: parent, fedFromIncomer: parent === null } : node)));
    toast.success(`${selected.size} prvků zapojeno pod ${parent ? byId.get(parent)?.designation : "vstup napájení"}.`);
    setSelected(new Set());
  }

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Hromadné přiřazení: rodič nesmí být mezi vybranými ani pod nimi
  const bulkOptions = nodes.filter((candidate) => !selected.has(candidate.id) && !(ancestors(candidate.id, byId) ?? []).some((id) => selected.has(id)));
  const listed = (onlyUnassigned ? nodes.filter((node) => !connected.has(node.id)) : nodes).slice().sort((a, b) => a.dinRailIndex - b.dinRailIndex || a.positionOnRail - b.positionOnRail);
  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.severity]++;

  function row(node: TreeNode, depth: number) {
    const nodeIssues = issuesById.get(node.id) ?? [];
    const worst = nodeIssues.find((issue) => issue.severity === "error") ?? nodeIssues.find((issue) => issue.severity === "warning");
    return (
      <li key={node.id} className={cn("flex flex-col gap-1 border-b border-border py-2 last:border-b-0", worst?.severity === "error" && "bg-red-500/5", worst?.severity === "warning" && "bg-yellow-500/5")} data-testid={`tree-row-${node.designation}`}>
        <div className="flex flex-wrap items-center gap-2" style={{ paddingLeft: `${Math.max(0, depth - 1) * 20}px` }}>
          <span className="text-muted-foreground" aria-hidden>
            {depth > 1 ? "└" : "●"}
          </span>
          <span className="w-12 font-mono font-semibold">{node.designation}</span>
          <span className="w-36 truncate text-xs text-muted-foreground" title={meta[node.id]?.typeCode}>
            {meta[node.id]?.typeCode ?? "?"}
          </span>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Napájeno z:
            <select
              aria-label={`${node.designation} napájeno z`}
              className={selectClass}
              value={node.parentItemId ?? (node.fedFromIncomer ? INCOMER : "")}
              onChange={(event) => setParent(node.id, event.target.value)}
            >
              <option value="">– nezapojeno –</option>
              <option value={INCOMER}>Vstup napájení</option>
              {parentOptions(node.id).map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.designation} {candidate.circuitLabel ? `· ${candidate.circuitLabel}` : ""}
                </option>
              ))}
            </select>
          </label>
          <select aria-label={`${node.designation} fáze`} className={cn(selectClass, "w-28")} value={node.phaseAssignment ?? ""} onChange={(event) => update(node.id, { phaseAssignment: event.target.value || null })}>
            <option value="">fáze –</option>
            {PHASE_OPTIONS.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
          <Input
            aria-label={`${node.designation} název obvodu`}
            className="h-9 min-w-40 flex-1"
            defaultValue={node.circuitLabel}
            key={`${node.id}:${node.circuitLabel}`}
            placeholder="Název obvodu"
            maxLength={80}
            onBlur={(event) => event.target.value !== node.circuitLabel && update(node.id, { circuitLabel: event.target.value })}
          />
        </div>
        {nodeIssues.map((issue) => {
          const { icon: Icon, className } = SEVERITY[issue.severity];
          return (
            <p key={issue.message} className={cn("flex items-start gap-1.5 text-xs", className)} style={{ paddingLeft: `${Math.max(0, depth - 1) * 20 + 22}px` }}>
              <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {issue.message}
            </p>
          );
        })}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button className="touch-target gap-2" onClick={proposeAll}>
          <Sparkles className="size-4" aria-hidden /> AI návrh stromu na 1 klik
        </Button>
        <Button variant="outline" className="touch-target gap-2" onClick={undo} disabled={!past.length} aria-label="Zpět">
          <Undo2 className="size-4" aria-hidden /> Zpět
        </Button>
        <Button variant="outline" className="touch-target gap-2" onClick={redo} disabled={!future.length} aria-label="Vpřed">
          <Redo2 className="size-4" aria-hidden /> Vpřed
        </Button>
        <Button variant="outline" className="touch-target gap-2" onClick={renumberAll}>
          <ListOrdered className="size-4" aria-hidden /> Automaticky přečíslovat IEC značení (-Q1, -F1, -F2…)
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section aria-label="DIN lišty a stav zapojení" className="flex flex-col gap-3">
          <DinRails
            items={nodes.map((node) => ({ ...node, modulesWidth: meta[node.id]?.modulesWidth ?? 1, caption: meta[node.id]?.typeCode ?? "?" }))}
            rails={rails}
            modulesPerRail={modulesPerRail}
            selectedIds={selected}
            onSelect={(item) => toggle(item.id)}
            tone={(item) => (connected.has(item.id) ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100" : "border-yellow-500/80 bg-yellow-500/25 text-yellow-100")}
            badge={(item) =>
              connected.has(item.id) ? (
                <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-black">
                  <Check className="size-3" aria-label="zapojeno" />
                </span>
              ) : null
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyUnassigned} onChange={(event) => setOnlyUnassigned(event.target.checked)} className="size-4 accent-primary" />
              Jen nepřiřazené
            </label>
            <span className="text-xs text-muted-foreground">Vybráno: {selected.size}</span>
          </div>
          <ul className="max-h-80 overflow-y-auto rounded-lg border border-border" aria-label="Prvky k hromadnému zapojení">
            {listed.map((node) => (
              <li key={node.id} className="border-b border-border last:border-b-0">
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                  <input type="checkbox" className="size-4 accent-primary" checked={selected.has(node.id)} onChange={() => toggle(node.id)} aria-label={`Vybrat ${node.designation}`} />
                  <span className="w-12 font-mono">{node.designation}</span>
                  <span className="flex-1 truncate text-muted-foreground">{node.circuitLabel || meta[node.id]?.typeCode}</span>
                  {connected.has(node.id) ? <Check className="size-4 text-emerald-400" aria-label="zapojeno" /> : <span className="text-xs text-yellow-300">nezapojeno</span>}
                </label>
              </li>
            ))}
            {!listed.length ? <li className="p-3 text-sm text-muted-foreground">Všechny prvky jsou zapojené.</li> : null}
          </ul>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3" data-testid="bulk-assign">
            <span className="text-sm">Zapojit vybrané pod →</span>
            <select aria-label="Hromadně zapojit pod" className={selectClass} value={bulkParent} onChange={(event) => setBulkParent(event.target.value)}>
              <option value="">vyberte nadřazený prvek</option>
              <option value={INCOMER}>Vstup napájení</option>
              {bulkOptions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.designation} {candidate.circuitLabel ? `· ${candidate.circuitLabel}` : ""}
                </option>
              ))}
            </select>
            <Button className="touch-target" onClick={bulkAssign} disabled={!selected.size || !bulkParent}>
              Zapojit ({selected.size})
            </Button>
          </div>
        </section>

        <section aria-label="Hierarchický strom zapojení" className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Zap className="size-4 text-primary" aria-hidden /> Vstup napájení
            <span className="text-xs font-normal text-muted-foreground">{networkSystem}</span>
          </h2>
          <ul data-testid="tree">{flat.map(({ node, depth }) => row(node, depth))}</ul>
          {loose.length ? (
            <>
              <h3 className="mt-4 mb-1 text-xs font-semibold text-yellow-300 uppercase">Nezapojené prvky ({loose.length})</h3>
              <ul data-testid="tree-loose">{loose.map((node) => row(node, 1))}</ul>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
