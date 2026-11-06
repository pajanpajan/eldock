import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { FloorSymbol } from "@/components/panel-builder/floorplan/FloorSymbol";
import { SYMBOLS, SYMBOL_KINDS, symbolPreviewSvg, type SymbolKind } from "@/lib/panel-builder/iec-symbols";
import { PALETTE, SYMBOL_MM } from "@/lib/panel-builder/floorplan-editor";

export const metadata: Metadata = { title: "Knihovna značek ČSN EN 60617" };

const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Z čeho v katalogu značka vzniká (kategorie a podtyp prvku). */
const SOURCE: Record<SymbolKind, string> = {
  MCB: "kategorie Jistič",
  RCD: "kategorie Proudový chránič",
  RCBO: "kategorie Jističochránič",
  SWITCH_DISCONNECTOR: "Hlavní vypínač / odpínač (výchozí u hlavních vypínačů)",
  DISCONNECTOR: "Hlavní vypínač s popisem „odpojovač“",
  FUSE_DISCONNECTOR: "podtyp Pojistkový odpojovač",
  SPD: "kategorie Přepěťová ochrana",
  CONTACTOR: "kategorie Stykač",
  RELAY: "Relé – pomocné / bez podtypu",
  RELAY_IMPULSE: "Relé – podtyp impulzní",
  RELAY_TIMER: "Relé – podtyp časové",
  RELAY_STAIRCASE: "Relé – podtyp schodišťový automat",
  RELAY_MONITORING: "Relé – podtyp hlídací",
  RELAY_LEVEL: "Relé – podtyp hladinové",
  RELAY_THERMOSTAT: "Relé – podtyp termostat",
  PSU: "kategorie Zdroj",
  TRANSFORMER: "podtyp Zvonkový transformátor",
  METER: "podtyp Elektroměr",
  TERMINAL: "kategorie Svorky / hlavní svorka",
  PLC: "kategorie PLC",
  GENERIC: "jiný / neurčený prvek",
};

// Fáze 58: knihovna značek – jednopólové schéma (ČSN EN 60617-2 až -8) a 2D půdorys (ČSN EN 60617-11) na jednom místě.
export default async function SymbolLibraryPage() {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const floorItems = PALETTE.filter((item) => item.kind !== "panel");
  return (
    <PageTransition>
      <PageHeader
        breadcrumb={
          <Link href="/panel-builder/catalog" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Katalog prvků
          </Link>
        }
        title="Knihovna značek ČSN EN 60617"
        description="Značky, kterými Eldock kreslí jednopólové schéma rozváděče a 2D půdorys. Značka přístroje se odvozuje z kategorie a podtypu katalogového prvku – u každého přístroje v dokumentaci najdete i náhled datasheetu."
      />
      <section className="flex flex-col gap-3" aria-labelledby="sld-title" data-testid="library-sld">
        <h2 id="sld-title" className="text-lg font-semibold">
          Jednopólové schéma – modulární přístroje
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SYMBOL_KINDS.map((kind) => (
            <li key={kind} className="flex gap-3 rounded-xl border border-border bg-card p-3" data-testid={`library-symbol-${kind}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- vlastní vektorová značka */}
              <img src={svgUri(symbolPreviewSvg(kind, 88))} alt={SYMBOLS[kind].label} className="h-20 w-22 shrink-0 rounded-lg bg-white p-1" />
              <div className="flex min-w-0 flex-col gap-1 text-sm">
                <p className="font-semibold">{SYMBOLS[kind].label}</p>
                <p className="text-xs text-muted-foreground">{SYMBOLS[kind].description}</p>
                <p className="mt-auto text-[11px] text-muted-foreground">
                  {SYMBOLS[kind].norm} · z katalogu: {SOURCE[kind]}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8 flex flex-col gap-3" aria-labelledby="floor-title" data-testid="library-floorplan">
        <h2 id="floor-title" className="text-lg font-semibold">
          2D půdorys – instalační plán (ČSN EN 60617-11)
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
          {floorItems.map((item) => (
            <li key={item.id} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-2 text-center text-[11px]">
              <svg viewBox={`${-SYMBOL_MM} ${-SYMBOL_MM} ${SYMBOL_MM * 2.4} ${SYMBOL_MM * 2.2}`} className="h-16 w-20 rounded bg-white" aria-hidden>
                <FloorSymbol item={item} size={SYMBOL_MM} active={false} onPaper level={item.bus ? "bus_loxone" : "classic"} />
              </svg>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </PageTransition>
  );
}
