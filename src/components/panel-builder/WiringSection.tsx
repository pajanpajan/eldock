"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { addItemWiringAction, searchWiringAction, setItemWiringQuantityAction } from "@/server/actions/panel-design";
import type { WiringHit } from "@/server/services/panel-wiring";

export interface ItemWiring {
  id: string;
  quantity: number;
  room: string | null;
  title: string;
  articleNumber: string;
  categoryLabel: string;
}

/**
 * Fáze 47: „🔌 Domovní instalace obvodu“ – vypínače, zásuvky a rámečky z katalogu ABB / Schneider /
 * Legrand přiřazené k vybranému jističi (místnost a počet kusů). Seznam jde do dokumentace.
 */
export function WiringSection({ itemId, wiring }: { itemId: string; wiring: readonly ItemWiring[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [room, setRoom] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [hits, setHits] = useState<WiringHit[] | null>(null);
  const [searching, startSearch] = useTransition();
  const [pending, startTransition] = useTransition();

  // Našeptávač s prodlevou (výsledek ze Server Action, žádný setState přímo v těle efektu)
  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      startSearch(async () => {
        const result = await searchWiringAction(query);
        setHits(result.ok ? result.data : []);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const shown = query.trim().length >= 2 ? hits : null;

  function add(hit: WiringHit) {
    startTransition(async () => {
      const result = await addItemWiringAction(itemId, { wiringDeviceId: hit.id, quantity, room: room.trim() || null });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${quantity}× ${hit.title} přiřazeno k obvodu.`);
      setQuery("");
      setHits(null);
      router.refresh();
    });
  }

  function change(row: ItemWiring, next: number) {
    startTransition(async () => {
      const result = await setItemWiringQuantityAction(itemId, row.id, next);
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <section aria-label="Domovní instalace obvodu" className="flex flex-col gap-2 rounded-lg border border-lime-500/30 bg-lime-500/5 p-3" data-testid="wiring-section">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        🔌 Domovní instalace obvodu
        {pending ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Ukládám" /> : null}
      </h3>
      {wiring.length ? (
        <ul className="flex flex-col gap-1 text-xs" data-testid="wiring-list">
          {wiring.map((row) => (
            <li key={row.id} className="flex items-center gap-2 rounded border border-border bg-background/50 px-2 py-1">
              <span className="min-w-0 flex-1">
                <b className="text-foreground">{row.quantity}×</b> {row.title}
                <span className="block font-mono text-[10px] text-muted-foreground">
                  {row.articleNumber} · {row.categoryLabel}
                  {row.room ? ` · ${row.room}` : ""}
                </span>
              </span>
              <button type="button" className="rounded p-1 hover:bg-muted disabled:opacity-40" disabled={pending} aria-label={`Ubrat kus: ${row.title}`} onClick={() => change(row, row.quantity - 1)}>
                <Minus className="size-3" aria-hidden />
              </button>
              <button type="button" className="rounded p-1 hover:bg-muted disabled:opacity-40" disabled={pending} aria-label={`Přidat kus: ${row.title}`} onClick={() => change(row, row.quantity + 1)}>
                <Plus className="size-3" aria-hidden />
              </button>
              <button type="button" className="rounded p-1 text-red-300 hover:bg-red-500/15 disabled:opacity-40" disabled={pending} aria-label={`Odebrat: ${row.title}`} onClick={() => change(row, 0)}>
                <Trash2 className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">K obvodu zatím nejsou přiřazené žádné vypínače ani zásuvky.</p>
      )}
      <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_8rem_4.5rem]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat: Tango zásuvka bílá, Levit rámeček 2…" className="h-10" aria-label="Hledat vypínač nebo zásuvku" />
        <Input value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Místnost" maxLength={80} className="h-10" aria-label="Místnost" />
        <Input type="number" min={1} max={200} value={quantity} onChange={(event) => setQuantity(Math.min(200, Math.max(1, Number(event.target.value) || 1)))} className="h-10" aria-label="Počet kusů" />
      </div>
      {shown ? (
        <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded border border-border bg-background/60 p-1 text-xs" data-testid="wiring-hits">
          {searching && !shown.length ? <li className="px-2 py-1 text-muted-foreground">Hledám…</li> : null}
          {!searching && !shown.length ? <li className="px-2 py-1 text-muted-foreground">Nic nenalezeno.</li> : null}
          {shown.map((hit) => (
            <li key={hit.id}>
              <button type="button" disabled={pending} onClick={() => add(hit)} className="flex w-full flex-col rounded px-2 py-1 text-left hover:bg-muted disabled:opacity-50">
                <span>{hit.title}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {hit.articleNumber.replace(/^[A-Z]+:/, "")} · {hit.series} · {hit.categoryLabel}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
