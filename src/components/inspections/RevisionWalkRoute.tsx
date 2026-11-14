"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INSPECTOR_SCOPES } from "@/lib/inspector-certificate";
import type { InspectorProfileView } from "@/lib/revision-signature";
import { DEFAULT_TRIP_HORIZON, TRIP_HORIZONS, daysText, isTripHorizon } from "@/lib/revision-trip";
import { locationText, roomCountdown, stopTitle, walkItemsFor, walkProgress, walkStops, type WalkItem, type WalkStop } from "@/lib/revision-walk";
import { cn } from "@/lib/utils";
import { recordWalkInspectionAction } from "@/server/actions/inspection";
import { listInspectorProfilesAction } from "@/server/actions/revision-signing";

import { FloorMiniMap } from "./FloorMiniMap";

const TECH_KEY = "eldock-walk-technician";
const HORIZON_KEY = "eldock-walk-horizon";
const noopSubscribe = () => () => undefined;

function stored<T>(key: string, parse: (value: string) => T | null): () => T | null {
  return () => {
    try {
      const value = window.localStorage.getItem(key);
      return value ? parse(value) : null;
    } catch {
      return null;
    }
  };
}
interface Technician {
  name: string;
  license: string;
  scope: string;
  validUntil: string;
}
const EMPTY_TECH: Technician = { name: "", license: "", scope: "", validUntil: "" };
const storedTech = stored(TECH_KEY, (value) => {
  const parsed = JSON.parse(value) as Partial<Record<keyof Technician, unknown>>;
  const text = (entry: unknown) => (typeof entry === "string" ? entry : "");
  return typeof parsed.name === "string" ? JSON.stringify({ name: text(parsed.name), license: text(parsed.license), scope: text(parsed.scope), validUntil: text(parsed.validUntil) }) : null;
});
const storedHorizon = stored(HORIZON_KEY, (value) => (isTripHorizon(Number(value)) ? Number(value) : null));
const save = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // bez úložiště
  }
};

const URGENCY: Record<string, string> = {
  EXPIRED: "border-red-500/50 bg-red-500/15 text-red-200",
  DUE: "border-amber-500/50 bg-amber-500/15 text-amber-100",
  OK: "border-sky-500/40 bg-sky-500/10 text-sky-100",
};
const urgencyOf = (item: WalkItem) => (item.daysLeft === null || item.daysLeft < 0 ? "EXPIRED" : item.daysLeft <= 30 ? "DUE" : "OK");
const num = (value: string) => {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
};
const cz = (value: number | null, digits = 2) => (value === null ? "" : value.toLocaleString("cs-CZ", { maximumFractionDigits: digits }).replace(/\s/g, ""));

/**
 * Fáze 116: 🚶‍♂️ Pochůzková trasa technika (Budova ➔ Patro ➔ Místnost) – zastávky po místnostech, „📍 kde to najdu“
 * s minimapou patra, kontrolní odpočet místnosti, ⚡ rychlý zápis na 1 klik (hodnoty dle minulé revize) a postup
 * „Hotovo X z Y zařízení v dnešním výjezdu“. Sdílí ho Revize & Plánovač i Hlídač revizí.
 */
export function RevisionWalkRoute({ items, plantId, canRecord, focusBuildingId = null, title = "🚶‍♂️ Pochůzková trasa technika" }: { items: readonly WalkItem[]; plantId: string; canRecord: boolean; focusBuildingId?: string | null; title?: string }) {
  const router = useRouter();
  const savedHorizon = useSyncExternalStore(noopSubscribe, storedHorizon, () => null);
  const [pickedHorizon, setPickedHorizon] = useState<number | null>(null);
  const horizon = pickedHorizon ?? savedHorizon ?? DEFAULT_TRIP_HORIZON;
  const savedTech = useSyncExternalStore(noopSubscribe, storedTech, () => null);
  const [techDraft, setTechDraft] = useState<Technician | null>(null);
  const tech = techDraft ?? (savedTech ? (JSON.parse(savedTech) as Technician) : EMPTY_TECH);
  const [profiles, setProfiles] = useState<InspectorProfileView[]>([]);
  const [map, setMap] = useState<string | null>(null);
  const [quick, setQuick] = useState<string | null>(null);
  const [floorRoute, setFloorRoute] = useState<string | null>(null);

  useEffect(() => {
    if (!canRecord) return;
    let alive = true;
    void listInspectorProfilesAction(plantId).then((response) => {
      if (alive && response.ok) setProfiles(response.data);
    });
    return () => {
      alive = false;
    };
  }, [plantId, canRecord]);

  const walk = walkItemsFor(items, horizon, focusBuildingId);
  const stops = walkStops(walk);
  const progress = walkProgress(walk);
  const setTech = (next: Technician) => {
    setTechDraft(next);
    save(TECH_KEY, JSON.stringify(next));
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-sky-500/40 bg-card p-4" aria-label="Pochůzková trasa technika" data-testid="walk-route">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">Budova ➔ Patro ➔ Místnost – každou místnost projdete jen jednou, na patře od vchodu nejkratší cestou.</p>
        </div>
        <div role="radiogroup" aria-label="Horizont pochůzky" className="flex rounded-lg border border-border bg-background/60 p-0.5">
          {TRIP_HORIZONS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={horizon === value}
              onClick={() => {
                setPickedHorizon(value);
                save(HORIZON_KEY, String(value));
              }}
              className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", horizon === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {value} dní
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1" data-testid="walk-progress" data-done={progress.done} data-total={progress.total}>
        <p className="text-sm font-semibold">
          Hotovo {progress.done} z {progress.total} zařízení v dnešním výjezdu
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
        </div>
      </div>

      {canRecord ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-background/40 p-2 text-xs" data-testid="walk-technician">
          <span className="w-full font-semibold">Revizní technik pro rychlý zápis:</span>
          {profiles.length ? (
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={profiles.find((profile) => profile.name === tech.name)?.id ?? ""}
              onChange={(event) => {
                const profile = profiles.find((entry) => entry.id === event.target.value);
                if (profile) setTech({ name: profile.name, license: profile.certificateNo, scope: profile.certificateScope ?? "", validUntil: profile.certificateValidUntil?.slice(0, 10) ?? "" });
              }}
              aria-label="Uložený revizní technik"
            >
              <option value="">– uložený technik závodu –</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} · {profile.certificateNo}
                </option>
              ))}
            </select>
          ) : null}
          <Input value={tech.name} onChange={(event) => setTech({ ...tech, name: event.target.value })} placeholder="Jméno technika" className="h-9 w-48" aria-label="Jméno revizního technika" data-testid="walk-tech-name" />
          <Input value={tech.license} onChange={(event) => setTech({ ...tech, license: event.target.value })} placeholder="Č. osvědčení" className="h-9 w-40" aria-label="Číslo osvědčení revizního technika" data-testid="walk-tech-license" />
          <select value={tech.scope} onChange={(event) => setTech({ ...tech, scope: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Rozsah osvědčení (revize VTZ)" data-testid="walk-tech-scope">
            <option value="">Rozsah osvědčení (VTZ)</option>
            {INSPECTOR_SCOPES.map((scope) => (
              <option key={scope.value} value={scope.value}>
                {scope.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-muted-foreground">
            platné do
            <Input type="date" value={tech.validUntil} onChange={(event) => setTech({ ...tech, validUntil: event.target.value })} className="h-9 w-40" aria-label="Platnost osvědčení revizního technika" data-testid="walk-tech-valid" />
          </label>
          <span className="w-full text-muted-foreground">Rozsah a platnost osvědčení jsou povinné u revizí VTZ (rozváděče, stroje – zákon 250/2021 Sb., § 11); spotřebiče a nářadí je nepotřebují.</span>
        </div>
      ) : null}

      {stops.length ? (
        <ol className="flex flex-col gap-3" data-testid="walk-stops">
          {stops.map((stop, index) => {
            const firstOnFloor = index === 0 || stops[index - 1].floorId !== stop.floorId;
            const floorItems = stops.filter((entry) => entry.floorId === stop.floorId).flatMap((entry) => entry.items);
            const countdown = roomCountdown(stop);
            return (
              <li key={`${stop.floorId}-${stop.room ?? ""}-${stop.index}`} className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-3" data-testid="walk-stop" data-stop={stop.index} data-floor={stop.floorId} data-room={stop.room ?? ""}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{stopTitle(stop)}</h3>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", countdown.remaining.length ? "border-amber-400/60 text-amber-200" : "border-emerald-500/60 text-emerald-200")} data-testid="walk-countdown">
                    {countdown.remaining.length ? `Zbývá najít ${countdown.remaining.length} z ${countdown.total}: ${countdown.remaining.map((item) => item.tag).join(", ")}` : `✅ Místnost hotová (${countdown.total} z ${countdown.total})`}
                  </span>
                </div>
                {firstOnFloor ? (
                  <div>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setFloorRoute(floorRoute === stop.floorId ? null : stop.floorId)} aria-expanded={floorRoute === stop.floorId} data-testid="walk-floor-route">
                      🗺️ {floorRoute === stop.floorId ? "Skrýt trasu po patře" : `Trasa po patře ${stop.floorName} (${floorItems.length} zastavení)`}
                    </Button>
                    {floorRoute === stop.floorId ? <FloorMiniMap floorId={stop.floorId} route pins={floorItems.map((item, position) => ({ id: item.id, x: item.pinX, y: item.pinY, label: item.tag, number: position + 1, done: item.inspectedToday }))} className="mt-2 max-w-3xl" /> : null}
                  </div>
                ) : null}
                <ul className="divide-y divide-border">
                  {stop.items.map((item) => (
                    <WalkRow key={item.id} item={item} stop={stop} canRecord={canRecord} tech={tech} mapOpen={map === item.id} quickOpen={quick === item.id} onMap={() => setMap(map === item.id ? null : item.id)} onQuick={() => setQuick(quick === item.id ? null : item.id)} onDone={() => (setQuick(null), router.refresh())} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground" data-testid="walk-empty">
          V horizontu {horizon} dní není žádné zařízení k revizi – zkuste delší horizont.
        </p>
      )}
    </section>
  );
}

function WalkRow({ item, stop, canRecord, tech, mapOpen, quickOpen, onMap, onQuick, onDone }: { item: WalkItem; stop: WalkStop; canRecord: boolean; tech: Technician; mapOpen: boolean; quickOpen: boolean; onMap: () => void; onQuick: () => void; onDone: () => void }) {
  const [values, setValues] = useState({ riso: cz(item.last?.riso ?? null), rpe: cz(item.last?.rpe ?? null, 3), zs: cz(item.last?.zs ?? null, 3) });
  const [pending, startTransition] = useTransition();

  function record() {
    if (!tech.name.trim() || !tech.license.trim()) return void toast.error("Vyplňte nahoře jméno a číslo osvědčení revizního technika.");
    startTransition(async () => {
      const result = await recordWalkInspectionAction({ equipmentId: item.id, inspectorName: tech.name, inspectorLicense: tech.license, inspectorScope: tech.scope || null, inspectorValidUntil: tech.validUntil || null, insulationResistance: num(values.riso), protectiveConductorResistance: num(values.rpe), loopImpedanceOhm: num(values.zs) });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${item.tag}: revize zapsána – VYHOVUJE.`);
      onDone();
    });
  }

  return (
    <li className={cn("flex flex-col gap-2 py-2 text-sm", item.inspectedToday && "opacity-70")} data-testid="walk-row" data-equipment={item.tag} data-done={item.inspectedToday ? "true" : "false"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {item.inspectedToday ? <CheckCircle2 className="size-4 text-emerald-400" aria-label="Hotovo dnes" /> : null}
        <Link href={`/equipment/${item.id}`} className="font-mono font-semibold hover:underline">
          {item.tag}
        </Link>
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", item.inspectedToday ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100" : URGENCY[urgencyOf(item)])}>{item.inspectedToday ? "✅ zapsáno dnes" : item.state === "MISSING" ? "bez revize" : daysText(item.daysLeft)}</span>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="walk-location">
        {locationText(item)} · {stop.buildingName} – {stop.floorName}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={onMap} aria-expanded={mapOpen} data-testid="walk-map">
          📍 {mapOpen ? "Skrýt mapu" : "Ukázat místo na mapě patra"}
        </Button>
        {canRecord && !item.inspectedToday ? (
          <Button type="button" size="sm" className="h-8 px-2 text-xs" onClick={onQuick} aria-expanded={quickOpen} data-testid="walk-quick">
            ⚡ Rychlý zápis na 1 klik (hodnoty dle minulé revize)
          </Button>
        ) : null}
      </div>
      {mapOpen ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" data-testid="walk-map-panel">
          <FloorMiniMap floorId={item.floorId} pins={[{ id: item.id, x: item.pinX, y: item.pinY, label: item.tag }]} highlightId={item.id} />
          <div className="flex flex-col gap-2 text-xs">
            <p className="font-semibold">{locationText(item)}</p>
            <div className="flex gap-2">
              {item.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files
                <img src={item.photoUrl} alt={`Fotografie ${item.tag}`} className="size-24 rounded-md border border-border object-cover" />
              ) : (
                <span className="flex size-24 items-center justify-center rounded-md border border-dashed border-border text-center text-muted-foreground">bez fotky zařízení</span>
              )}
              {item.nameplatePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files
                <img src={item.nameplatePhotoUrl} alt={`Výrobní štítek ${item.tag}`} className="size-24 rounded-md border border-border object-cover" />
              ) : (
                <span className="flex size-24 items-center justify-center rounded-md border border-dashed border-border text-center text-muted-foreground">bez fotky štítku</span>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {quickOpen ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2 text-xs" data-testid="walk-quick-form">
          <label className="flex flex-col gap-0.5">
            R<sub>iso</sub> [MΩ]
            <Input value={values.riso} onChange={(event) => setValues({ ...values, riso: event.target.value })} inputMode="decimal" className="h-8 w-24 font-mono" data-testid="walk-riso" />
          </label>
          <label className="flex flex-col gap-0.5">
            R<sub>PE</sub> [Ω]
            <Input value={values.rpe} onChange={(event) => setValues({ ...values, rpe: event.target.value })} inputMode="decimal" className="h-8 w-24 font-mono" data-testid="walk-rpe" />
          </label>
          <label className="flex flex-col gap-0.5">
            Z<sub>s</sub> [Ω]
            <Input value={values.zs} onChange={(event) => setValues({ ...values, zs: event.target.value })} inputMode="decimal" className="h-8 w-24 font-mono" data-testid="walk-zs" />
          </label>
          <Button type="button" size="sm" className="h-8 gap-1.5" onClick={record} disabled={pending} data-testid="walk-quick-save">
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}✅ Potvrdit VYHOVUJE a zapsat
          </Button>
          <span className="text-muted-foreground">{item.last ? `Minulá revize ${new Date(item.last.date).toLocaleDateString("cs-CZ")}${item.last.inspector ? ` (${item.last.inspector})` : ""}` : "Bez hodnot z minulé revize – vyplňte naměřené hodnoty."}</span>
        </div>
      ) : null}
    </li>
  );
}
