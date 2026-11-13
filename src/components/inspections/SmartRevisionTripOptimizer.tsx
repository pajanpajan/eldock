"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Brain, ChevronDown, ChevronUp, Copy, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InspectorProfileView } from "@/lib/revision-signature";
import {
  DEFAULT_TRIP_HORIZON,
  TRIP_HORIZONS,
  daysText,
  formatMinutes,
  isTripHorizon,
  moreItemsText,
  planRevisionTrips,
  tripListText,
  type TripItem,
  type TripRow,
} from "@/lib/revision-trip";
import { cn } from "@/lib/utils";
import { listInspectorProfilesAction } from "@/server/actions/revision-signing";
import { sendTripListAction } from "@/server/actions/revision-trip";

import { RevisionTechnicianFormModal } from "./RevisionTechnicianFormModal";

// Fáze 108: 🧠 Chytrá revize – optimalizace výjezdu revizního technika. Kotva = nejnaléhavější revize závodu
// (po termínu / do 30 dnů); nabídka dalších zařízení do horizontu 30 / 60 / 90 / 180 dnů seřazená stejná budova →
// sousední budovy. Sloučení otevře formulář technika pro vybraná zařízení, seznam jde poslat technikovi.

const HORIZON_KEY = "eldock-trip-horizon";
const VISIBLE_ROWS = 8;
const noopSubscribe = () => () => undefined;

/** Horizont uložený z dřívější návštěvy (jen v prohlížeči; na serveru výchozí). */
function storedHorizon(): number | null {
  try {
    const saved = Number(window.localStorage.getItem(HORIZON_KEY));
    return isTripHorizon(saved) ? saved : null;
  } catch {
    return null;
  }
}

const URGENCY_STYLE: Record<TripRow["urgency"], string> = {
  EXPIRED: "border-red-500/50 bg-red-500/15 text-red-200",
  DUE_SOON: "border-amber-500/50 bg-amber-500/15 text-amber-100",
  UPCOMING: "border-sky-500/40 bg-sky-500/10 text-sky-100",
};

export function SmartRevisionTripOptimizer({
  items,
  today,
  focusBuildingId = null,
  canRecord,
  className,
}: {
  items: readonly TripItem[];
  today: string;
  /** Detail podlaží: kotva přednostně v této budově. */
  focusBuildingId?: string | null;
  /** Právo zápisu revize – sloučení otevře formulář technika. */
  canRecord: boolean;
  className?: string;
}) {
  const stored = useSyncExternalStore(noopSubscribe, storedHorizon, () => null);
  const [picked, setPicked] = useState<number | null>(null);
  const horizon = picked ?? stored ?? DEFAULT_TRIP_HORIZON;
  const [plantIndex, setPlantIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const trips = useMemo(() => planRevisionTrips(items, horizon, { focusBuildingId }), [items, horizon, focusBuildingId]);
  const trip = trips[Math.min(plantIndex, Math.max(0, trips.length - 1))] ?? null;

  function pickHorizon(value: number) {
    setPicked(value);
    setUnchecked(new Set());
    try {
      window.localStorage.setItem(HORIZON_KEY, String(value));
    } catch {
      // bez úložiště
    }
  }

  if (!trip) {
    return (
      <section className={cn("flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground", className)} aria-label="Chytrá revize" data-testid="trip-optimizer" data-state="idle">
        <Brain className="size-4 shrink-0 text-primary" aria-hidden />
        <span>
          <strong className="text-foreground">🧠 Chytrá revize:</strong> v závodě teď není žádná revize po termínu ani do 30 dnů – výjezd revizního technika zatím není potřeba.
        </span>
      </section>
    );
  }

  const selected = trip.rows.filter((row) => !unchecked.has(row.item.id));
  const tripRows = [trip.anchor, ...selected];
  const minutes = tripRows.reduce((sum, row) => sum + row.minutes, 0);
  const visible = expanded ? trip.rows : trip.rows.slice(0, VISIBLE_ROWS);
  const equipment = tripRows.map((row) => ({ id: row.item.id, tag: row.item.tag, name: row.item.name }));
  const anchorText = `${trip.anchor.item.tag} – ${daysText(trip.anchor.item.daysLeft)}`;

  const toggle = (id: string) =>
    setUnchecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section
      className={cn("space-y-3 rounded-xl border-2 border-primary/50 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-lg shadow-primary/5", className)}
      aria-labelledby="trip-optimizer-title"
      data-testid="trip-optimizer"
      data-state="active"
      data-horizon={horizon}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="trip-optimizer-title" className="flex items-center gap-2 text-base font-bold">
            <Brain className="size-5 text-primary" aria-hidden />
            🧠 Chytrá revize – Optimalizace výjezdu revizního technika:
          </h2>
          <p className="text-sm leading-relaxed text-zinc-200" data-testid="trip-summary">
            {trip.rows.length ? (
              <>
                Než revizní technik vyrazí do závodu kvůli 1 neodkladné revizi ({anchorText}), doporučujeme do stejného výjezdu přibalit{" "}
                <strong>{moreItemsText(trip.rows.length)} v téže budově / závodě</strong>, kterým vyprší platnost revize v nejbližších <strong>{trip.horizon} dnech</strong>. Ušetříte tím opakovaný výjezd a dopravu technika.
              </>
            ) : (
              <>
                Revizní technik jede do závodu kvůli 1 neodkladné revizi ({anchorText}). V nejbližších <strong>{trip.horizon} dnech</strong> v závodě žádné další zařízení nekončí – zkuste delší horizont.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div role="radiogroup" aria-label="Horizont Chytré revize" className="flex rounded-lg border border-border bg-background/60 p-0.5">
            {TRIP_HORIZONS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={horizon === value}
                onClick={() => pickHorizon(value)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", horizon === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                data-testid={`trip-horizon-${value}`}
              >
                {value} dní
              </button>
            ))}
          </div>
          {trips.length > 1 ? (
            <select value={plantIndex} onChange={(event) => (setPlantIndex(Number(event.target.value)), setUnchecked(new Set()))} className="h-8 rounded-md border border-input bg-background px-2 text-xs" aria-label="Závod výjezdu">
              {trips.map((entry, index) => (
                <option key={entry.plantId} value={index}>
                  {entry.plantName} ({entry.rows.length + 1})
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background/60" data-testid="trip-list">
        <TripLine row={trip.anchor} checked locked onToggle={() => undefined} anchor />
        {visible.map((row) => (
          <TripLine key={row.item.id} row={row} checked={!unchecked.has(row.item.id)} onToggle={() => toggle(row.item.id)} />
        ))}
      </ul>
      {trip.rows.length > VISIBLE_ROWS ? (
        <button type="button" onClick={() => setExpanded((open) => !open)} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          {expanded ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
          {expanded ? "Zobrazit méně" : `Zobrazit všech ${trip.rows.length + 1} zařízení`}
        </button>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="touch-target h-auto min-h-11 gap-2 whitespace-normal text-left font-semibold"
          onClick={() => setFormOpen(true)}
          disabled={!canRecord}
          title={canRecord ? undefined : "Formulář revize otevře účet s právem zápisu revize (revizní technik, údržba)."}
          data-testid="trip-merge"
        >
          ⚡ Sloučit vybrané ({tripRows.length}) do jednoho revizního výjezdu a otevřít formulář revize
        </Button>
        <Button type="button" variant="outline" className="touch-target h-auto min-h-11 gap-2 whitespace-normal text-left" onClick={() => setSendOpen(true)} data-testid="trip-send">
          📩 Odeslat tento sloučený seznam reviznímu technikovi k přípravě
        </Button>
        <span className="text-xs text-muted-foreground" data-testid="trip-total">
          {tripRows.length} zařízení · {formatMinutes(minutes)} práce na místě (orientační odhad)
        </span>
      </div>

      {formOpen ? <RevisionTechnicianFormModal open={formOpen} onOpenChange={setFormOpen} equipment={equipment} today={today} title="Sloučený revizní výjezd" /> : null}
      {sendOpen ? <SendTripDialog open={sendOpen} onOpenChange={setSendOpen} plantId={trip.plantId} plantName={trip.plantName} horizon={trip.horizon} rows={tripRows} /> : null}
    </section>
  );
}

function TripLine({ row, checked, onToggle, locked = false, anchor = false }: { row: TripRow; checked: boolean; onToggle: () => void; locked?: boolean; anchor?: boolean }) {
  const { item } = row;
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm", anchor && "bg-red-500/5")} data-testid="trip-row" data-equipment={item.tag} data-anchor={anchor ? "true" : undefined}>
      <input type="checkbox" checked={checked} disabled={locked} onChange={onToggle} className="size-4 accent-primary" aria-label={`${anchor ? "Důvod výjezdu" : "Přibalit"} ${item.tag}`} />
      <Link href={`/equipment/${item.id}`} className="font-mono font-semibold hover:underline">
        {item.tag}
      </Link>
      <span className="min-w-0 flex-1 truncate text-zinc-300">{item.name}</span>
      <span className="text-xs text-muted-foreground">
        {item.buildingName} · {item.floorName}
      </span>
      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", URGENCY_STYLE[row.urgency])}>{daysText(item.daysLeft)}</span>
      <span className="w-20 text-right text-xs text-muted-foreground">{formatMinutes(row.minutes)}</span>
      {anchor ? <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-200">Důvod výjezdu</span> : null}
    </li>
  );
}

function SendTripDialog({ open, onOpenChange, plantId, plantName, horizon, rows }: { open: boolean; onOpenChange: (open: boolean) => void; plantId: string; plantName: string; horizon: number; rows: readonly TripRow[] }) {
  const [profiles, setProfiles] = useState<InspectorProfileView[] | null>(null);
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const preview = tripListText({ plantName, horizon }, rows);

  useEffect(() => {
    let alive = true;
    void listInspectorProfilesAction(plantId).then((response) => {
      if (!alive) return;
      const list = response.ok ? response.data.filter((profile) => profile.email) : [];
      setProfiles(list);
      setTarget(list[0]?.id ?? "");
    });
    return () => {
      alive = false;
    };
  }, [plantId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(preview);
      toast.success("Seznam zkopírován do schránky.");
    } catch {
      toast.error("Schránka není dostupná – označte text a zkopírujte ho ručně.");
    }
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const response = await sendTripListAction({ plantId, inspectorProfileId: target || null, equipmentIds: rows.map((row) => row.item.id), horizon, note });
      if (!response.ok) return setError(response.error);
      const { delivery, to, subject, text } = response.data;
      if (delivery === "MAILTO") {
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text.slice(0, 1800))}`;
        return;
      }
      if (delivery === "SENT") toast.success(`Seznam odeslán technikovi (${to}).`);
      else if (delivery === "LOGGED") toast.info("E-mail je zaznamenaný v logu – odesílání (SMTP) není nastavené. Seznam můžete zkopírovat.");
      else toast.error("Odeslání selhalo – seznam zkopírujte a pošlete ručně.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid="trip-send-dialog">
        <DialogHeader>
          <DialogTitle>📩 Sloučený seznam pro revizního technika</DialogTitle>
          <DialogDescription>
            {plantName} · {rows.length} zařízení · horizont {horizon} dní. Technik si podle seznamu připraví přístroje, přístup a odstávky.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="trip-send-target">Příjemce</Label>
            {profiles === null ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Načítám techniky závodu…
              </p>
            ) : (
              <select id="trip-send-target" value={target} onChange={(event) => setTarget(event.target.value)} className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm" data-testid="trip-send-target">
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} · {profile.email}
                  </option>
                ))}
                <option value="">Jiný příjemce – otevřít v mém e-mailovém programu</option>
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-send-note">Poznámka pro technika</Label>
            <Textarea id="trip-send-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} placeholder="např. odstávka haly H2 možná v sobotu 8:00–12:00" />
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-xs" data-testid="trip-send-preview">
            {preview}
          </pre>
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="gap-1.5" onClick={copy}>
            <Copy className="size-4" aria-hidden /> Zkopírovat seznam
          </Button>
          <Button type="button" className="gap-1.5" onClick={send} disabled={pending || profiles === null} data-testid="trip-send-submit">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />} {target ? "Odeslat technikovi" : "Otevřít e-mail"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
