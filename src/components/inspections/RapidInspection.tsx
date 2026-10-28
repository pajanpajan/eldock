"use client";

import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, CircleCheck, ListChecks, Loader2, MapPin, Pencil, QrCode, ScanLine, Search, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeSearch } from "@/lib/equipment-filter";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_TYPE_LABELS, formatCount, formatDateShort } from "@/lib/format";
import { compareByUrgency } from "@/lib/inspection";
import { evaluateMeasurements, inspectionRuleFor, measurementLimits } from "@/lib/inspection-rules";
import { equipmentHref, rapidInspectionHref } from "@/lib/routes";
import { INSPECTION_STATE } from "@/lib/status";
import { cn } from "@/lib/utils";
import { recordQuickInspectionAction } from "@/server/actions/inspection";
import type { RapidItem } from "@/server/queries/inspections";

import { useInspectorProfile } from "./inspector-profile";
import { InspectionStatusBadge } from "./InspectionStatusBadge";

const QUICK_DEFECTS = [
  "Poškozená izolace přívodního kabelu",
  "Poškozená vidlice / zásuvka",
  "Prasklý nebo chybějící kryt",
  "Nefunkční vypínač",
  "Chybí štítek / nečitelné údaje",
];

const num = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value).replace(".", ","));
const parse = (value: string) => (value.trim() === "" ? null : Number(value.replace(",", ".")));

/** Fronta místnosti: nejdřív nezrevidované dnes, pak podle naléhavosti. */
function sortQueue(items: RapidItem[]) {
  return [...items].sort(
    (a, b) => Number(a.inspectedToday) - Number(b.inspectedToday) || compareByUrgency(a.summary, b.summary) || a.tag.localeCompare(b.tag),
  );
}

/** Mobilní režim „Rychlá revize pípáním“ pro revizního technika v terénu. */
export function RapidInspection({ items, planIds = [] }: { items: RapidItem[]; planIds?: string[] }) {
  const router = useRouter();
  const [profile, updateProfile] = useInspectorProfile();
  const [editingProfile, setEditingProfile] = useState(false);
  const zones = useMemo(() => [...new Set(items.map((item) => item.zone))].sort((a, b) => a.localeCompare(b, "cs")), [items]);
  const firstZone = sortQueue(items)[0]?.zone ?? zones[0] ?? "";
  const [zone, setZone] = useState(firstZone);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const scanInput = useRef<HTMLInputElement>(null);

  // Dávka z plánovače drží pořadí pochůzky; jinak fronta zvolené místnosti.
  const planned = planIds.map((id) => items.find((item) => item.id === id)).filter((item): item is RapidItem => !!item);
  const fromPlan = planned.length > 0;
  const queue = fromPlan ? planned : sortQueue(items.filter((item) => item.zone === zone));
  const pendingQueue = queue.filter((item) => !item.inspectedToday);
  const current = items.find((item) => item.id === selectedId) ?? pendingQueue[0] ?? null;
  const done = queue.length - pendingQueue.length;

  function selectItem(item: RapidItem) {
    if (!fromPlan || !planned.includes(item)) setZone(item.zone);
    setSelectedId(item.id);
  }

  function onScan(event: FormEvent) {
    event.preventDefault();
    const q = normalizeSearch(code);
    if (!q) return;
    const found =
      items.find((item) => normalizeSearch(item.tag) === q || normalizeSearch(item.inventoryNumber ?? "") === q) ??
      items.find((item) => normalizeSearch(`${item.tag} ${item.inventoryNumber ?? ""} ${item.name}`).includes(q));
    if (!found) {
      toast.error(`Kód „${code}“ nenalezen.`);
      return;
    }
    selectItem(found);
    setCode("");
  }

  /** Simulace QR skeneru: „načte“ štítek dalšího kusu ve frontě. */
  function simulateScan() {
    const next = pendingQueue.find((item) => item.id !== current?.id) ?? pendingQueue[0];
    if (!next) {
      toast.info("Všechny kusy v místnosti jsou dnes zrevidované.");
      return;
    }
    toast(`Načten QR kód ${next.inventoryNumber ?? next.tag}`);
    selectItem(next);
  }

  /** Po uložení: další kus ve frontě (bez právě uloženého). */
  function advance(savedId: string) {
    const next = pendingQueue.find((item) => item.id !== savedId);
    setSelectedId(next?.id ?? null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-8">
      {/* Technik, osvědčení a přístroj – drží se nahoře */}
      <section aria-label="Revizní technik" className="sticky top-16 z-20 rounded-xl border border-primary/40 bg-zinc-900/95 p-3 shadow-lg backdrop-blur">
        {editingProfile ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input aria-label="Revizní technik" value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} className="h-11" />
            <Input aria-label="Číslo osvědčení" value={profile.license} onChange={(event) => updateProfile({ license: event.target.value })} className="h-11 font-mono" />
            <Input aria-label="Měřicí přístroj" value={profile.instrument} onChange={(event) => updateProfile({ instrument: event.target.value })} className="h-11" />
            <Button className="touch-target" onClick={() => setEditingProfile(false)}>
              Hotovo
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 font-semibold">
              <UserRound className="size-4 text-primary" aria-hidden />
              {profile.name || "Doplňte technika"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{profile.license}</span>
            <span className="text-muted-foreground">{profile.instrument}</span>
            <Button variant="ghost" size="sm" className="ml-auto h-10 gap-1.5" onClick={() => setEditingProfile(true)}>
              <Pencil className="size-3.5" aria-hidden />
              Změnit
            </Button>
          </div>
        )}
      </section>

      {/* Skener / hledání */}
      <form onSubmit={onScan} className="flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={scanInput}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Načtěte QR / zadejte tag nebo inv. číslo"
            aria-label="Kód spotřebiče"
            className="h-14 pl-10 text-lg"
            autoComplete="off"
          />
        </div>
        <Button type="button" size="lg" variant="outline" className="h-14 gap-2 px-4" onClick={simulateScan}>
          <QrCode className="size-5" aria-hidden />
          <span className="hidden sm:inline">Simulovat sken</span>
        </Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Fronta místnosti */}
        <section aria-labelledby="rapid-queue" className="space-y-2 lg:order-none">
          {fromPlan ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm" data-testid="plan-batch">
              <span className="flex items-center gap-1.5 font-medium">
                <ListChecks className="size-4 text-primary" aria-hidden />
                Dávka z plánovače · {planned.length} ks
              </span>
              <Link href={rapidInspectionHref} className="text-primary underline-offset-4 hover:underline">
                Zrušit dávku
              </Link>
            </div>
          ) : (
          <div className="space-y-2">
            <Label htmlFor="rapid-zone" className="flex items-center gap-1.5">
              <MapPin className="size-4 text-primary" aria-hidden />
              Místnost
            </Label>
            <select
              id="rapid-zone"
              value={zone}
              onChange={(event) => {
                setZone(event.target.value);
                setSelectedId(null);
              }}
              className="h-12 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {zones.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>
          )}
          <h2 id="rapid-queue" className="flex items-center justify-between pt-1 text-sm font-semibold">
            Fronta k revizi
            <span className="font-mono text-xs text-muted-foreground">
              {done}/{queue.length} hotovo
            </span>
          </h2>
          <ol className="space-y-1.5">
            {queue.map((item) => {
              const Icon = EQUIPMENT_TYPE_ICONS[item.type];
              const active = item.id === current?.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectItem(item)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/50",
                      item.inspectedToday && "opacity-60",
                    )}
                  >
                    <Icon className={cn("size-5 shrink-0", INSPECTION_STATE[item.summary.state].text)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-semibold">{item.tag}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.name.replace(`${item.tag} - `, "")}</span>
                    </span>
                    {item.inspectedToday && item.summary.state === "FAILED" ? (
                      <Ban className={cn("size-5 shrink-0", INSPECTION_STATE.FAILED.text)} aria-label="Dnes vyřazeno z provozu" />
                    ) : item.inspectedToday ? (
                      <CircleCheck className={cn("size-5 shrink-0", INSPECTION_STATE.VALID.text)} aria-label="Dnes zrevidováno" />
                    ) : (
                      <span className={cn("size-2.5 shrink-0 rounded-full", INSPECTION_STATE[item.summary.state].dot)} aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Karta vybraného kusu */}
        <div className="lg:order-none">
          {current ? (
            <RapidCard key={current.id} item={current} profile={profile} onSaved={advance} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-10 text-center">
              <CircleCheck className="size-10 text-emerald-400" aria-hidden />
              <p className="text-lg font-semibold">{fromPlan ? "Dávka je hotová" : "Místnost je hotová"}</p>
              <p className="text-sm text-muted-foreground">
                {fromPlan
                  ? "Všechny kusy z plánovače jsou dnes zrevidované."
                  : `Všechny kusy v místnosti „${zone}“ jsou dnes zrevidované. Vyberte další místnost nebo načtěte kód.`}
              </p>
              <Button variant="outline" className="touch-target gap-2" onClick={() => scanInput.current?.focus()}>
                <ScanLine className="size-4" aria-hidden />
                Načíst další kód
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  item: RapidItem;
  profile: { name: string; license: string; instrument: string };
  onSaved: (id: string) => void;
}

/** Karta kusu: měření s předvyplněnými typickými hodnotami a dvě obří tlačítka. */
function RapidCard({ item, profile, onSaved }: CardProps) {
  const limits = measurementLimits(item.protectionClass);
  const rule = inspectionRuleFor(item);
  const Icon = EQUIPMENT_TYPE_ICONS[item.type];
  const [rpe, setRpe] = useState(num(limits.typical.rpe));
  const [riso, setRiso] = useState(num(limits.typical.riso));
  const [failOpen, setFailOpen] = useState(false);
  const [defects, setDefects] = useState("");
  const [pending, startTransition] = useTransition();

  const check = evaluateMeasurements(item.protectionClass, { rpe: parse(rpe), riso: parse(riso) });
  const profileOk = profile.name.trim() !== "" && profile.license.trim() !== "";

  function save(passed: boolean) {
    startTransition(async () => {
      const response = await recordQuickInspectionAction({
        equipmentId: item.id,
        inspectorName: profile.name,
        inspectorLicense: profile.license,
        measuringInstrument: profile.instrument || null,
        protectiveConductorResistance: limits.rpeMax === null ? null : parse(rpe),
        insulationResistance: parse(riso),
        passed,
        defectsSummary: passed ? null : defects,
      });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      if (passed) toast.success(`${item.tag} VYHOVUJE – platnost do ${formatDateShort(response.data.validUntil)}.`);
      else toast.error(`${item.tag} vyřazen z provozu.`, { description: "Kus je označen červeně, závada je zapsaná v revizní zprávě." });
      setFailOpen(false);
      onSaved(item.id);
    });
  }

  function openFail() {
    setDefects(check.ok ? "" : check.failures.join(" "));
    setFailOpen(true);
  }

  return (
    <article aria-label={`Revize ${item.tag}`} className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-6 text-primary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xl font-bold">{item.tag}</p>
          <h2 className="font-semibold">{item.name.replace(`${item.tag} - `, "")}</h2>
          <p className="text-sm text-muted-foreground">
            {EQUIPMENT_TYPE_LABELS[item.type]} · sk. {item.usageGroup ?? "C"} · tř. {item.protectionClass ?? "I"}
            {item.inventoryNumber ? ` · ${item.inventoryNumber}` : ""}
          </p>
        </div>
        <Link href={equipmentHref(item.id)} className="shrink-0 text-sm text-primary underline-offset-4 hover:underline">
          Karta
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <InspectionStatusBadge summary={item.summary} />
        <span className="text-muted-foreground">
          {rule.standard} · nová lhůta {formatCount(item.inspectionIntervalMonths, ["měsíc", "měsíce", "měsíců"])}
        </span>
        {item.inspectedToday ? <span className="font-medium text-emerald-400">dnes už zrevidováno</span> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rapid-rpe" className="text-base">
            R<sub>PE</sub> [Ω]
          </Label>
          <Input
            id="rapid-rpe"
            inputMode="decimal"
            value={limits.rpeMax === null ? "neměří se" : rpe}
            disabled={limits.rpeMax === null}
            onChange={(event) => setRpe(event.target.value)}
            className="h-16 font-mono text-2xl"
          />
          <p className="text-xs text-muted-foreground">
            {limits.rpeMax === null ? `Třída ${item.protectionClass} – bez ochranného vodiče` : `Mez ≤ ${num(limits.rpeMax)} Ω`}
            {item.last?.rpe !== null && item.last?.rpe !== undefined ? ` · minule ${num(item.last.rpe)}` : ""}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rapid-riso" className="text-base">
            R<sub>iso</sub> [MΩ]
          </Label>
          <Input id="rapid-riso" inputMode="decimal" value={riso} onChange={(event) => setRiso(event.target.value)} className="h-16 font-mono text-2xl" />
          <p className="text-xs text-muted-foreground">
            Mez ≥ {num(limits.risoMin)} MΩ{item.last?.riso !== null && item.last?.riso !== undefined ? ` · minule ${num(item.last.riso)}` : ""}
          </p>
        </div>
      </div>

      {!check.ok ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{check.failures.join(" ")}</p> : null}
      {!profileOk ? <p className="text-sm text-amber-300">Doplňte nahoře jméno technika a číslo osvědčení.</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          className="h-20 gap-3 bg-emerald-500 text-lg font-bold text-emerald-950 hover:bg-emerald-400"
          disabled={pending || !check.ok || !profileOk}
          onClick={() => save(true)}
        >
          {pending ? <Loader2 className="size-6 animate-spin" /> : <CircleCheck className="size-7" aria-hidden />}
          <span className="text-left leading-tight">
            VYHOVUJE
            <span className="block text-sm font-medium">Uložit a další (1-klik)</span>
          </span>
        </Button>
        <Button size="lg" className="h-20 gap-3 bg-red-600 text-lg font-bold text-white hover:bg-red-500" disabled={pending || !profileOk} onClick={openFail}>
          <Ban className="size-7" aria-hidden />
          <span className="text-left leading-tight">
            NEVYHOVUJE
            <span className="block text-sm font-medium">Vyřadit z provozu</span>
          </span>
        </Button>
      </div>

      <Dialog open={failOpen} onOpenChange={setFailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vyřadit {item.tag} z provozu</DialogTitle>
            <DialogDescription>Zapíše se revize s posudkem „Neschopno bezpečného provozu“ a kus se označí červeně.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rapid-defects">
              Závada <span className="text-red-400">*</span>
            </Label>
            <Textarea id="rapid-defects" value={defects} onChange={(event) => setDefects(event.target.value)} rows={3} maxLength={4000} />
            <div className="flex flex-wrap gap-2">
              {QUICK_DEFECTS.map((defect) => (
                <Button key={defect} type="button" variant="outline" size="sm" className="h-10" onClick={() => setDefects((value) => (value.trim() ? `${value.trim()} ${defect}.` : `${defect}.`))}>
                  + {defect}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zpět
              </Button>
            </DialogClose>
            <Button variant="destructive" className="h-12 gap-2 text-base" disabled={pending || defects.trim().length < 3} onClick={() => save(false)}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-5" />}
              Vyřadit z provozu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
