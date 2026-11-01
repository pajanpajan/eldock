"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CircleAlert, Info, ListOrdered, Loader2, Redo2, ShieldCheck, Sparkles, Undo2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { phaseCount } from "@/lib/panel-builder/catalog";
import { PHASE_OPTIONS, ancestors, groupLoad, isConnected, proposeTree, readingOrder, renumber, validateTree, type IssueSeverity, type TreeIssue, type TreeNode } from "@/lib/panel-builder/tree";
import { cn } from "@/lib/utils";
import { saveTreeAction } from "@/server/actions/panel-builder";

import { DinRails } from "./DinRails";

export interface TreeMeta {
  typeCode: string;
  modulesWidth: number;
}

const SEVERITY: Record<IssueSeverity, { icon: typeof CircleAlert; className: string }> = {
  error: { icon: CircleAlert, className: "text-red-300" },
  warning: { icon: AlertTriangle, className: "text-yellow-300" },
  info: { icon: Info, className: "text-sky-300" },
};

type SaveState = "saved" | "saving" | "error";
const SINGLE = ["L1", "L2", "L3"] as const;
const amps = (value: number) => `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} A`;

/** Skupina = hlavní vypínač (nebo vstup napájení) a každý proudový chránič. */
interface Group {
  id: string | null;
  head: TreeNode | null;
  title: string;
  short: string;
}

/**
 * Krok 2: zapojení po SKUPINÁCH – karta hlavního přívodu (pod -Q1) a karta každého chrániče se
 * svými jističi. Fáze se přepínají tlačítky L1 / L2 / L3, skupina tlačítky „Napájeno z“. Změny se
 * drží v historii (Zpět / Vpřed) a průběžně ukládají; hlídač hlásí jen skutečné chyby.
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
  const [highlight, setHighlight] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const dirty = useRef(false);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const issues = useMemo(() => validateTree(nodes), [nodes]);
  const issuesById = useMemo(() => {
    const map = new Map<string, TreeIssue[]>();
    for (const issue of issues) map.set(issue.itemId, [...(map.get(issue.itemId) ?? []), issue]);
    return map;
  }, [issues]);
  const connected = useMemo(() => new Set(nodes.filter((node) => isConnected(node.id, byId)).map((node) => node.id)), [nodes, byId]);

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

  function proposeAll() {
    const proposal = proposeTree(nodes);
    apply((current) => current.map((node) => ({ ...node, ...proposal.get(node.id) })));
    toast.success("Zapojení navrženo podle DIN lišt: chrániče napájí jističe napravo od sebe, ostatní hlavní vypínač; fáze se střídají.");
  }

  function renumberAll() {
    const designations = renumber(nodes);
    apply((current) => current.map((node) => ({ ...node, designation: designations.get(node.id) ?? node.designation })));
    toast.success("IEC značení přečíslováno v pořadí lišt (-Q, -FI, -FA, -FV, -F …).");
  }

  // Skupiny: hlavní vypínač (jinak vstup napájení) a chrániče v pořadí lišt
  const ordered = readingOrder(nodes);
  const main = ordered.find((node) => node.category === "MAIN_SWITCH") ?? null;
  const rcds = ordered.filter((node) => node.category === "RCD");
  const groups: Group[] = [
    main ? { id: main.id, head: main, title: `⚡ Hlavní přívod a přímé vývody (pod hlavním vypínačem ${main.designation})`, short: `${main.designation} Hlavní` } : { id: null, head: null, title: "⚡ Vstup napájení a přímé vývody", short: "Vstup" },
    ...rcds.map((rcd) => ({
      id: rcd.id,
      head: rcd,
      title: `🛡️ Skupina chrániče ${rcd.designation} (Lišta ${rcd.dinRailIndex}${meta[rcd.id]?.typeCode ? ` – ${meta[rcd.id].typeCode}` : ""})`,
      short: `${rcd.designation} Chránič (Lišta ${rcd.dinRailIndex})`,
    })),
  ];
  const groupIds = new Set(groups.map((group) => group.id));
  const inGroup = (group: Group) =>
    ordered.filter((node) => {
      if (node.id === group.head?.id || node.category === "RCD") return false;
      if (group.id === null) return node.fedFromIncomer && !node.parentItemId;
      return node.parentItemId === group.id;
    });
  // Chrániče se zobrazují jako hlavičky svých karet; mimo skupiny zůstanou jen zvláštní zapojení a nezapojené
  const elsewhere = ordered.filter((node) => node.parentItemId && !groupIds.has(node.parentItemId) && node.category !== "RCD");
  const loose = ordered.filter((node) => !node.parentItemId && !node.fedFromIncomer && node.id !== main?.id && node.category !== "RCD");

  /** Přesun do skupiny (nebo na vstup napájení) – cyklus nedovolí. */
  function moveTo(node: TreeNode, group: Group) {
    if (group.id === null) return update(node.id, { parentItemId: null, fedFromIncomer: true });
    if (group.id === node.id || (ancestors(group.id, byId) ?? []).includes(node.id)) return void toast.error("Prvek nemůže napájet sám sebe.");
    // 1P vývod pod 2P chráničem převezme jeho fázi
    const head = byId.get(group.id);
    const headPhases = head?.phaseAssignment?.split(",").filter((phase) => phase !== "N") ?? [];
    const keepPhase = phaseCount(node.poles ?? "1P") === 3 || headPhases.length !== 1 ? node.phaseAssignment : headPhases[0];
    update(node.id, { parentItemId: group.id, fedFromIncomer: false, phaseAssignment: keepPhase });
  }

  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.severity]++;

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

  function groupSwitch(node: TreeNode) {
    const options = groups.filter((group) => group.id !== node.id);
    return (
      <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" role="group" aria-label={`${node.designation} napájeno z`}>
        Napájeno z:
        {options.map((group) => {
          const active = group.id === null ? node.fedFromIncomer && !node.parentItemId : node.parentItemId === group.id;
          return (
            <button
              key={group.id ?? "incomer"}
              type="button"
              aria-pressed={active}
              aria-label={`${node.designation} napájeno z ${group.short}`}
              onClick={() => moveTo(node, group)}
              className={cn(
                "min-h-8 rounded-md border px-2 font-mono font-semibold transition-colors",
                active ? "border-emerald-400 bg-emerald-500/20 text-emerald-100" : "border-border bg-card hover:border-primary/60",
              )}
            >
              {group.short}
            </button>
          );
        })}
      </span>
    );
  }

  function row(node: TreeNode, options: { head?: boolean } = {}) {
    const nodeIssues = (issuesById.get(node.id) ?? []).filter((issue) => issue.severity !== "info" || !options.head);
    const worst = nodeIssues.find((issue) => issue.severity === "error") ?? nodeIssues.find((issue) => issue.severity === "warning");
    return (
      <li
        key={node.id}
        className={cn(
          "flex flex-col gap-2 border-b border-border px-3 py-2.5 last:border-b-0",
          options.head && "bg-muted/30",
          worst?.severity === "error" && "bg-red-500/10",
          worst?.severity === "warning" && "bg-yellow-500/5",
          highlight === node.id && "ring-2 ring-primary ring-inset",
        )}
        data-testid={`tree-row-${node.designation}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 font-mono font-semibold">{node.designation}</span>
          <span className="w-36 truncate text-xs text-muted-foreground" title={meta[node.id]?.typeCode}>
            {meta[node.id]?.typeCode ?? "?"} · Lišta {node.dinRailIndex}
          </span>
          <Input
            aria-label={`${node.designation} název obvodu`}
            className="h-9 min-w-40 flex-1"
            defaultValue={node.circuitLabel}
            key={`${node.id}:${node.circuitLabel}`}
            placeholder="Funkce obvodu"
            maxLength={80}
            onBlur={(event) => event.target.value !== node.circuitLabel && update(node.id, { circuitLabel: event.target.value })}
          />
          {phaseControl(node)}
        </div>
        {node.id !== main?.id ? groupSwitch(node) : <span className="text-xs text-muted-foreground">Napájeno ze vstupu napájení ({networkSystem})</span>}
        {nodeIssues.map((issue) => {
          const { icon: Icon, className } = SEVERITY[issue.severity];
          return (
            <p key={issue.message} className={cn("flex items-start gap-1.5 text-xs", className)}>
              <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {issue.message}
            </p>
          );
        })}
      </li>
    );
  }

  function loadInfo(group: Group) {
    if (!group.head) return null;
    const load = groupLoad(group.head.id, nodes, simultaneity);
    return (
      <p className="flex items-center gap-1.5 text-xs text-sky-200" data-testid={`group-load-${group.head.designation}`}>
        <Info className="size-3.5 shrink-0" aria-hidden />
        Zatížení skupiny (Ib × SF {simultaneity.toLocaleString("cs-CZ")}): L1 {amps(load.L1)} · L2 {amps(load.L2)} · L3 {amps(load.L3)}
        {group.head.ratedCurrentA ? ` · In ${amps(group.head.ratedCurrentA)}` : ""} – informace, ne chyba
      </p>
    );
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

      <section aria-label="DIN lišty a stav zapojení">
        <DinRails
          items={nodes.map((node) => ({ ...node, label: node.circuitLabel, modulesWidth: meta[node.id]?.modulesWidth ?? 1, caption: meta[node.id]?.typeCode ?? "?" }))}
          rails={rails}
          modulesPerRail={modulesPerRail}
          selectedIds={new Set(highlight ? [highlight] : [])}
          onSelect={(item) => {
            setHighlight(item.id);
            document.querySelector(`[data-testid="tree-row-${item.designation}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
          }}
          tone={(item) => (connected.has(item.id) ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100" : "border-red-500/80 bg-red-500/20 text-red-100")}
          badge={(item) =>
            connected.has(item.id) ? (
              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-black">
                <Check className="size-3" aria-label="zapojeno" />
              </span>
            ) : null
          }
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2" data-testid="tree">
        {groups.map((group) => {
          const members = inGroup(group);
          return (
            <section key={group.id ?? "incomer"} aria-label={group.title} className="rounded-xl border border-border bg-card" data-testid={`group-${group.head?.designation ?? "incomer"}`}>
              <header className="flex flex-col gap-1 border-b border-border px-3 py-2.5">
                <h2 className="flex items-center gap-2 font-semibold">
                  {group.head?.category === "RCD" ? <ShieldCheck className="size-4 text-sky-300" aria-hidden /> : <Zap className="size-4 text-primary" aria-hidden />}
                  {group.title}
                </h2>
                {loadInfo(group)}
              </header>
              <ul>
                {group.head ? row(group.head, { head: true }) : null}
                {members.map((node) => row(node))}
                {!members.length ? <li className="px-3 py-3 text-sm text-muted-foreground">Ve skupině zatím nejsou žádné vývody.</li> : null}
              </ul>
            </section>
          );
        })}
        {elsewhere.length ? (
          <section aria-label="Jiné zapojení" className="rounded-xl border border-border bg-card" data-testid="group-elsewhere">
            <header className="border-b border-border px-3 py-2.5">
              <h2 className="font-semibold">↳ Jiné zapojení (pod jističem / jističochráničem)</h2>
              <p className="text-xs text-muted-foreground">Přesuňte do skupiny tlačítkem „Napájeno z“.</p>
            </header>
            <ul>{elsewhere.map((node) => row(node))}</ul>
          </section>
        ) : null}
        {loose.length ? (
          <section aria-label="Nezapojené prvky" className="rounded-xl border border-red-500/50 bg-red-500/5" data-testid="tree-loose">
            <header className="border-b border-border px-3 py-2.5">
              <h2 className="font-semibold text-red-200">Nezapojené prvky ({loose.length})</h2>
              <p className="text-xs text-muted-foreground">Klikněte na „AI návrh zapojení“, nebo zvolte skupinu u každého prvku.</p>
            </header>
            <ul>{loose.map((node) => row(node))}</ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
