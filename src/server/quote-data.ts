import "server-only";

import { normalizeMpn } from "@/lib/catalog/etim";
import { KOPOS_BOX_DATA, KOPOS_DATA_SOURCE } from "@/lib/panel-builder/brand-etim.generated";
import { cableKey } from "@/lib/quoting/cable-designations";
import { LIST_PRICE_SOURCES, LIST_PRICES } from "@/lib/quoting/list-prices.generated";

// Fáze 105: ceníkové ceny výrobců pro cenovou nabídku – jen na serveru a jen pro položky vlastního kusovníku
// (celé ceníky do prohlížeče nesmí, fáze 104). Kabely a vodiče podle označení (Kč / m), krabice KOPOS podle kódu,
// přístroje podle objednacího čísla (ceník z balíčků ETIM data, jinak `CatalogComponent.listPriceCzk`).

export type PriceKind = "cable" | "box" | "device";

export interface PriceQuery {
  key: string;
  kind: PriceKind;
  /** Objednací číslo / kód krabice (u kabelu nepovinné). */
  code?: string | null;
  /** Označení kabelu nebo název položky. */
  name: string;
}

export interface ListPrice {
  priceCzk: number;
  source: string;
}

const fromTable = (key: string): ListPrice | null => {
  const entry = LIST_PRICES[key];
  return entry ? { priceCzk: entry[0], source: LIST_PRICE_SOURCES[entry[1]] ?? "ceník výrobce" } : null;
};

/** Ceníková cena kabelu podle označení ve výkazu („CYKY-J 3×1,5“, „CAT7 / KNX J-Y(St)Y 2×2×0,8 …“). */
export function cableListPrice(label: string): ListPrice | null {
  const key = cableKey(label);
  return key ? fromTable(`cable:${key}`) : null;
}

/** Ceníková cena krabice KOPOS (ceník výrobce v datech fáze 97). */
export function boxListPrice(code: string): ListPrice | null {
  const price = KOPOS_BOX_DATA[code]?.priceCzk;
  return typeof price === "number" && price > 0 ? { priceCzk: price, source: `KOPOS – ${KOPOS_DATA_SOURCE}` } : null;
}

/** Ceníkové ceny pro položky kusovníku (jen nalezené). */
export async function listPrices(items: readonly PriceQuery[]): Promise<Record<string, ListPrice>> {
  const result: Record<string, ListPrice> = {};
  const devices: PriceQuery[] = [];
  for (const item of items) {
    const price = item.kind === "cable" ? cableListPrice(item.name) : item.kind === "box" && item.code ? boxListPrice(item.code) : item.code ? fromTable(`item:${normalizeMpn(item.code)}`) : null;
    if (price) result[item.key] = price;
    else if (item.kind === "device" && item.code) devices.push(item);
  }
  if (devices.length) {
    // Databáze až při dotazu na přístroje (ceny kabelů a krabic jdou bez ní – i v testech)
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.catalogComponent.findMany({ where: { articleNumber: { in: devices.map((item) => item.code!) }, listPriceCzk: { gt: 0 } }, select: { articleNumber: true, listPriceCzk: true, listPriceSource: true } });
    const byCode = new Map(rows.map((row) => [row.articleNumber, row]));
    for (const item of devices) {
      const row = byCode.get(item.code!);
      if (row?.listPriceCzk) result[item.key] = { priceCzk: row.listPriceCzk, source: row.listPriceSource ?? "ceník výrobce" };
    }
  }
  return result;
}
