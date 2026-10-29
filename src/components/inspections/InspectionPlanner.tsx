"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Lightbulb, MicOff, Plus, Search, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND_PRINT_LINE } from "@/lib/brand";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_TYPE_LABELS, formatCount, formatDateShort } from "@/lib/format";
import {
  MEASURING_GROUP_LABELS,
  PLAN_BUCKETS,
  compareRoute,
  groupForRoute,
  measuringGroup,
  planInspections,
  summarize,
  type PlanBucket,
  type PlannerItem,
} from "@/lib/inspection-planner";
import {
  normalizeCz,
  parsePlanQuery,
  removeChip,
  setBuilding,
  setTimeframe,
  type InspectionPlanQuery,
  type TimeframeKind,
} from "@/lib/inspection-voice-parser";
import { equipmentHref, rapidInspectionHref } from "@/lib/routes";
import { INSPECTION_STATE, PLAN_BUCKET, inspectionBadgeLabel } from "@/lib/status";
import { cn } from "@/lib/utils";

import { InspectionStatusBadge } from "./InspectionStatusBadge";
import { useSpeechRecognition } from "./use-speech-recognition";

export const SAMPLE_COMMANDS = [
  "Propadlé a tento měsíc v celém závodě",
  "Nářadí a prodlužováky v Hale A do 30 dnů",
  "Rozváděče a stroje do konce roku",
  "Spotřebiče v kuchyňkách a administrativě",
];

const BUCKET_TIMEFRAME: Record<PlanBucket, TimeframeKind> = {
  OVERDUE: "EXPIRED_ONLY",
  THIS_MONTH: "THIS_MONTH",
  NEXT_MONTH: "NEXT_MONTH",
  LATER: "LATER",
};

const PIECES = ["kus", "kusy", "kusů"] as const;
const noopSubscribe = () => () => {};

/** Chytrý plánovač revizí: hlasový / textový dispečer, měsíční přehled, tip a pochůzka. */
export function InspectionPlanner({
  items,
  nowIso,
  plantName,
  scopeLabel = null,
  canRapid = true,
}: {
  items: PlannerItem[];
  nowIso: string;
  plantName: string;
  /** Výřez dat účtu („Revizní technik VTZ: …“); `null` = celý závod. */
  scopeLabel?: string | null;
  /** Spuštění rychlé revize dávky (technik spotřebičů, vedení údržby). */
  canRapid?: boolean;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [text, setText] = useState(SAMPLE_COMMANDS[0]);
  const [query, setQuery] = useState<InspectionPlanQuery>(() => parsePlanQuery(SAMPLE_COMMANDS[0], new Date(nowIso)));
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  function apply(next: InspectionPlanQuery) {
    setQuery(next);
    setAdded(new Set());
    setExcluded(new Set());
  }

  function command(value: string) {
    setText(value);
    apply(parsePlanQuery(value, now));
  }

  const speech = useSpeechRecognition((transcript, final) => {
    setText(transcript);
    if (final) apply(parsePlanQuery(transcript, now));
  });

  const plan = planInspections(items, query, now);
  const byId = new Map(items.map((item) => [item.id, item]));
  const listed = [...plan.selected, ...[...added].map((id) => byId.get(id)).filter((item): item is PlannerItem => !!item && !plan.selected.includes(item))].sort(compareRoute);
  const batch = listed.filter((item) => !excluded.has(item.id));
  const suggestions = plan.suggestions.filter((item) => !added.has(item.id));
  const summary = summarize(batch);
  const portableIds = batch.filter((item) => measuringGroup(item.type) === "PORTABLE").map((item) => item.id);
  const buildings = [...new Set(items.map((item) => item.buildingName))];
  const activeBuilding = query.buildingQuery.length === 1 ? query.buildingQuery[0].match : "";

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    command(text);
  }

  const toggleExcluded = (id: string) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6 print:hidden">
      {scopeLabel ? (
        <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-200" data-testid="account-scope">
          Výřez účtu – {scopeLabel}
        </p>
      ) : null}
      {/* Hlasový dispečer */}
      <section aria-labelledby="dispatcher" className="space-y-3 rounded-2xl border border-primary/40 bg-card p-4 sm:p-5">
        <h2 id="dispatcher" className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-5 text-primary" aria-hidden />
          Co chcete revidovat?
          <span className="text-sm font-normal text-muted-foreground">Nadiktujte nebo napište česky – rozpoznání běží offline v prohlížeči.</span>
        </h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                apply(parsePlanQuery(event.target.value, now));
              }}
              placeholder="Např. Nářadí a prodlužováky v Hale A do 30 dnů"
              aria-label="Požadavek na plán revizí"
              className="h-14 pl-10 text-lg"
            />
          </div>
          <Button
            type="button"
            size="lg"
            onClick={speech.listening ? speech.stop : speech.start}
            disabled={mounted && !speech.supported}
            aria-pressed={speech.listening}
            title={mounted && !speech.supported ? "Prohlížeč nepodporuje rozpoznávání řeči – napište požadavek nebo zvolte ukázkový povel." : undefined}
            className={cn("relative h-14 gap-2 px-5 text-base", speech.listening && "bg-red-600 text-white hover:bg-red-500")}
          >
            {speech.listening ? (
              <>
                <span className="absolute inset-0 animate-pulse rounded-md ring-4 ring-red-500/50" aria-hidden />
                <MicOff className="size-5" aria-hidden />
                Poslouchám… (zastavit)
              </>
            ) : (
              <>
                🎙️ Nadiktovat požadavek hlasem
              </>
            )}
          </Button>
        </form>
        {speech.error ? <p className="text-sm text-amber-300">{speech.error}</p> : null}
        {mounted && !speech.supported ? (
          <p className="text-xs text-muted-foreground">Tento prohlížeč neumí rozpoznávat řeč – požadavek napište nebo zvolte ukázkový povel.</p>
        ) : null}

        <div className="flex flex-wrap gap-2" aria-label="Ukázkové povely">
          {SAMPLE_COMMANDS.map((sample) => (
            <Button key={sample} type="button" variant="outline" size="sm" className="h-10" onClick={() => command(sample)}>
              „{sample}“
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Rozpoznané filtry">
          {query.recognizedChips.length ? (
            query.recognizedChips.map((chip) => (
              <span key={chip.key} className="inline-flex h-9 items-center gap-1 rounded-full border border-primary/50 bg-primary/10 pr-1 pl-3 text-sm text-primary">
                {chip.label}
                <button
                  type="button"
                  onClick={() => apply(removeChip(query, chip.key, now))}
                  className="flex size-7 items-center justify-center rounded-full outline-none hover:bg-primary/20 focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label={`Odebrat filtr ${chip.label}`}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Bez filtrů – celý závod, příštích 6 měsíců včetně propadlých.</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="planner-building" className="text-sm text-muted-foreground">
            Budova
          </label>
          <select
            id="planner-building"
            value={activeBuilding}
            onChange={(event) => {
              const name = buildings.find((entry) => normalizeCz(entry) === event.target.value);
              apply(setBuilding(query, name ? { label: name, match: normalizeCz(name) } : null));
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">{plantName} – všechny budovy</option>
            {buildings.map((name) => (
              <option key={name} value={normalizeCz(name)}>
                {name}
              </option>
            ))}
            {activeBuilding && !buildings.some((name) => normalizeCz(name) === activeBuilding) ? (
              <option value={activeBuilding}>{query.buildingQuery[0].label}</option>
            ) : null}
          </select>
        </div>
      </section>

      {/* Měsíční přehled – klik = přepnout období */}
      <section aria-label="Měsíční přehled" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PLAN_BUCKETS.map((bucket) => {
          const style = PLAN_BUCKET[bucket];
          const Icon = style.icon;
          const active = query.timeframe.kind === BUCKET_TIMEFRAME[bucket];
          return (
            <button
              key={bucket}
              type="button"
              aria-pressed={active}
              onClick={() => apply(setTimeframe(query, BUCKET_TIMEFRAME[bucket], now))}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? style.soft : "border-border bg-card hover:bg-muted/40",
              )}
            >
              <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                {style.label}
                <Icon className={cn("size-4", style.text)} aria-hidden />
              </span>
              <span className={cn("mt-2 block font-mono text-3xl font-semibold tabular-nums", style.text)}>{plan.buckets[bucket]}</span>
              <span className="text-xs text-muted-foreground">{style.description}</span>
            </button>
          );
        })}
      </section>

      {/* Souhrn dávky */}
      <section aria-label="Souhrn dávky" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Dávka celkem</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums" data-testid="batch-total">
            {summary.total}
          </p>
          <p className="text-xs text-muted-foreground">{query.timeframe.label.replace("Období: ", "")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{MEASURING_GROUP_LABELS.FIXED}</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{summary.fixed}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{MEASURING_GROUP_LABELS.PORTABLE}</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{summary.portable}</p>
        </div>
      </section>

      {/* Tip „Přiberte při jedné cestě“ */}
      {suggestions.length ? (
        <section aria-labelledby="look-ahead" className="space-y-3 rounded-xl border border-sky-500/40 bg-sky-500/10 p-4">
          <h2 id="look-ahead" className="flex items-start gap-2 text-sm">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-sky-300" aria-hidden />
            <span>
              <span className="font-semibold text-sky-200">💡 Tip pro optimalizaci výjezdu:</span> V těchto místnostech končí do 45 dnů revize{" "}
              {suggestions.length === 1 ? "dalšímu 1 zařízení" : `dalším ${suggestions.length} zařízením`}. Přidejte je do dnešní dávky jedním klikem a ušetřete další výjezd.
            </span>
          </h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {suggestions.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="font-mono font-semibold">{item.tag}</span>{" "}
                  <span className="text-sm">{item.name.replace(`${item.tag} - `, "")}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.zone ?? item.floorName} · končí {item.validUntil ? formatDateShort(item.validUntil) : "–"}
                  </span>
                </span>
                <Button size="sm" variant="outline" className="h-10 gap-1.5" onClick={() => setAdded((current) => new Set([...current, item.id]))}>
                  <Plus className="size-4" aria-hidden />
                  Přidat do plánu
                </Button>
              </li>
            ))}
          </ul>
          {suggestions.length > 1 ? (
            <Button size="sm" className="h-10 gap-1.5" onClick={() => setAdded((current) => new Set([...current, ...suggestions.map((item) => item.id)]))}>
              <Plus className="size-4" aria-hidden />
              Přidat všech {suggestions.length}
            </Button>
          ) : null}
        </section>
      ) : null}

      {/* Akce */}
      <div className="flex flex-wrap gap-2">
        {canRapid ? (
          <Button asChild size="lg" className={cn("h-14 gap-2 text-base font-semibold", portableIds.length === 0 && "pointer-events-none opacity-50")} aria-disabled={portableIds.length === 0}>
            <Link href={`${rapidInspectionHref}?ids=${portableIds.join(",")}`}>
              🚀 Spustit rychlou revizi této dávky ({portableIds.length} ks)
            </Link>
          </Button>
        ) : null}
        <Button size="lg" variant="outline" className="h-14 gap-2 text-base" onClick={() => window.print()} disabled={batch.length === 0}>
          🖨️ Vytisknout pochůzkový list
        </Button>
        {summary.fixed ? (
          <p className="self-center text-xs text-muted-foreground">
            Rychlá revize měří přenosné kusy; {formatCount(summary.fixed, ["pevné zařízení", "pevná zařízení", "pevných zařízení"])} zapište v přehledu revizí.
          </p>
        ) : null}
      </div>

      {/* Pochůzka */}
      <section aria-labelledby="route" className="space-y-3">
        <h2 id="route" className="text-lg font-semibold">
          Pochůzka <span className="font-mono text-sm text-muted-foreground">{formatCount(batch.length, PIECES)}</span>
        </h2>
        {listed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Požadavku neodpovídá žádné zařízení. Zkuste odebrat některý filtr.</p>
        ) : (
          groupForRoute(listed).map((building) => (
            <div key={building.building} className="overflow-hidden rounded-xl border border-border bg-card">
              <h3 className="border-b border-border bg-muted/40 px-4 py-2 font-semibold">{building.building}</h3>
              {building.places.map((place) => (
                <div key={place.place}>
                  <p className="px-4 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{place.place}</p>
                  <ul className="divide-y divide-border">
                    {place.items.map((item) => {
                      const Icon = EQUIPMENT_TYPE_ICONS[item.type];
                      const included = !excluded.has(item.id);
                      return (
                        <li key={item.id} className={cn("flex items-center gap-3 px-4 py-2.5", !included && "opacity-50")}>
                          <input
                            type="checkbox"
                            className="size-5 accent-primary"
                            checked={included}
                            onChange={() => toggleExcluded(item.id)}
                            aria-label={`Zahrnout ${item.tag} do dávky`}
                          />
                          <Icon className={cn("size-5 shrink-0", INSPECTION_STATE[item.state].text)} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <Link href={equipmentHref(item.id)} className="font-mono font-semibold text-primary underline-offset-4 hover:underline">
                              {item.tag}
                            </Link>{" "}
                            <span className="text-sm">{item.name.replace(`${item.tag} - `, "")}</span>
                            <span className="block text-xs text-muted-foreground">
                              {EQUIPMENT_TYPE_LABELS[item.type]} · {measuringGroup(item.type) === "PORTABLE" ? "přenosné" : "pevné"}
                              {added.has(item.id) ? " · přidáno z tipu" : ""}
                            </span>
                          </span>
                          <InspectionStatusBadge summary={{ state: item.state, validUntil: item.validUntil, daysLeft: item.daysLeft, result: null }} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))
        )}
      </section>

      {mounted ? createPortal(<RouteSheet items={batch} title={query.text.trim() || "Plán revizí"} timeframe={query.timeframe.label} plantName={plantName} now={now} />, document.body) : null}
    </div>
  );
}

/** Pochůzkový list pro tisk (`.print-route` v globals.css) – na obrazovce skrytý. */
function RouteSheet({ items, title, timeframe, plantName, now }: { items: PlannerItem[]; title: string; timeframe: string; plantName: string; now: Date }) {
  return (
    <section className="print-route" aria-hidden>
      <p className="route-brand">{BRAND_PRINT_LINE}</p>
      <h1>Pochůzkový list revizí – {plantName}</h1>
      <p>
        Požadavek: „{title}“ · {timeframe} · vytištěno {formatDateShort(now)} · {formatCount(items.length, PIECES)}
      </p>
      {groupForRoute(items).map((building) => (
        <div key={building.building} className="route-building">
          <h2>{building.building}</h2>
          {building.places.map((place) => (
            <table key={place.place}>
              <caption>{place.place}</caption>
              <thead>
                <tr>
                  <th>✓</th>
                  <th>Tag</th>
                  <th>Zařízení</th>
                  <th>Skupina</th>
                  <th>Stav revize</th>
                  <th>R_PE [Ω]</th>
                  <th>R_iso [MΩ]</th>
                  <th>Poznámka</th>
                </tr>
              </thead>
              <tbody>
                {place.items.map((item) => (
                  <tr key={item.id}>
                    <td>☐</td>
                    <td>{item.tag}</td>
                    <td>{item.name.replace(`${item.tag} - `, "")}</td>
                    <td>{measuringGroup(item.type) === "PORTABLE" ? "přenosné" : "pevné"}</td>
                    <td>{inspectionBadgeLabel(item.state, item.validUntil, item.daysLeft)}</td>
                    <td />
                    <td />
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      ))}
      <p className="route-sign">Revizní technik: ____________________ · Ev. č. osvědčení: ____________ · Podpis: ____________</p>
    </section>
  );
}
