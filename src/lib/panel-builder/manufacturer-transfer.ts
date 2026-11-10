// Fáze 60: jeden výrobce celého rozváděče a převod hotového rozváděče na jiného výrobce se zachováním všech hodnot
// (kategorie, póly, In, charakteristika, typ a citlivost chrániče, typ SPD, kontakty), značení, popisů obvodů,
// stromu zapojení i pořadí na lištách. Čisté funkce (výběr kusů z katalogu, přerozdělení přeplněných lišt).

import { catalogCategory, describeConfig, matchConfig, type CatalogLike, type ItemConfig } from "./configurator";
import { sameManufacturer } from "./matching";
import { SMART_SYSTEMS } from "./smart-home";
import { isCatalogModule, smartCatalogArticle } from "./smart-din-catalog";

/** exact = stejný přístroj výrobce i šířka, width = jiná šířka, estimate = výrobce kus nemá (parametry zůstanou, Pv odhad), keep = systémový prvek / bez konfigurace. */
export type TransferStatus = "exact" | "width" | "estimate" | "keep";

export const TRANSFER_LABEL: Record<TransferStatus, string> = {
  exact: "shodný přístroj",
  width: "jiná šířka",
  estimate: "není v katalogu – odhad",
  keep: "zůstává",
};

export interface TransferItem {
  id: string;
  designation: string;
  circuitLabel: string;
  modulesWidth: number;
  config: ItemConfig | null;
  component: (Pick<CatalogLike, "manufacturer" | "typeCode"> & { articleNumber?: string | null }) | null;
}

export interface TransferRow {
  itemId: string;
  designation: string;
  label: string;
  from: string;
  to: string;
  status: TransferStatus;
  modulesFrom: number;
  modulesTo: number;
  /** Kus katalogu cílového výrobce (null = odhad / zůstává). */
  componentId: string | null;
  /** Konfigurace s cílovým výrobcem (null = beze změny). */
  config: ItemConfig | null;
}

/**
 * Systémové prvky chytré instalace a řídicí moduly (KNX, free@home, Loxone, PLC) jsou vázané na systém – při převodu
 * jističů na jiného výrobce zůstávají (jinak by vznikl nesmyslný „Eaton Miniserver“).
 */
const SYSTEM_SUBTYPES = new Set(["PLC", "SMART_ACTUATOR", "BUS_PSU", "SYSTEM_MODULE"]);
export const isSystemDevice = (config: ItemConfig | null) =>
  Boolean(config && (config.category === "SMART_HOME" || ((config.category === "OTHER" || config.category === "ACCESSORY") && config.moduleSubtype && SYSTEM_SUBTYPES.has(config.moduleSubtype))));

/** Fáze 61: objednací čísla přístrojů systémů chytré domácnosti (i sběrnicové zdroje free@home / KNX s podtypem „zdroj DC“). */
// Fáze 81: i klíče kusů v katalogu prvků (Loxone „LOXONE:100335“, TapHome „TAPHOME:6DO“) a kategorie Chytrá domácnost
const SMART_ARTICLES = new Set(SMART_SYSTEMS.flatMap((system) => system.modules.flatMap((unit) => [unit.articleNumber, isCatalogModule(unit) ? smartCatalogArticle(system.id, unit) : null]).filter((number): number is string => Boolean(number))));
export const isSmartArticle = (articleNumber: string | null | undefined) => Boolean(articleNumber && SMART_ARTICLES.has(articleNumber));

/** Převodní tabulka: pro každý prvek nejbližší kus cílového výrobce se stejnými určujícími parametry. */
export function planTransfer(items: readonly TransferItem[], catalog: readonly CatalogLike[], manufacturer: string): TransferRow[] {
  return items.map((item): TransferRow => {
    const from = item.component ? `${item.component.manufacturer} ${item.component.typeCode}` : item.config ? describeConfig(item.config) : "neurčený modul";
    const keep = (): TransferRow => ({ itemId: item.id, designation: item.designation, label: item.circuitLabel, from, to: from, status: "keep", modulesFrom: item.modulesWidth, modulesTo: item.modulesWidth, componentId: null, config: null });
    if (!item.config || isSystemDevice(item.config) || isSmartArticle(item.component?.articleNumber)) return keep();
    if (item.component && sameManufacturer(item.component.manufacturer, manufacturer)) return keep();
    const target: ItemConfig = { ...item.config, manufacturer };
    const candidates = catalog.filter((component) => component.category === catalogCategory(target) && sameManufacturer(component.manufacturer, manufacturer));
    const found = matchConfig(candidates, target);
    if (!found) return { itemId: item.id, designation: item.designation, label: item.circuitLabel, from, to: `${manufacturer} ${describeConfig(target)}`, status: "estimate", modulesFrom: item.modulesWidth, modulesTo: item.modulesWidth, componentId: null, config: target };
    const modules = found.modulesCount || item.modulesWidth;
    return {
      itemId: item.id,
      designation: item.designation,
      label: item.circuitLabel,
      from,
      to: `${found.manufacturer} ${found.typeCode}`,
      status: modules === item.modulesWidth ? "exact" : "width",
      modulesFrom: item.modulesWidth,
      modulesTo: modules,
      componentId: found.id,
      config: { ...target, modules },
    };
  });
}

/** Souhrn převodu („12 shodných, 2 jiná šířka, 1 odhad“). */
export function transferSummary(rows: readonly TransferRow[]) {
  const count = (status: TransferStatus) => rows.filter((row) => row.status === status).length;
  return { exact: count("exact"), width: count("width"), estimate: count("estimate"), keep: count("keep"), changed: rows.filter((row) => row.status !== "keep").length };
}

export interface RailSlot {
  id: string;
  rail: number;
  position: number;
  width: number;
}

/**
 * Přerozdělení po změně šířek: pořadí přístrojů zůstává, jen konec přeplněné lišty se přesune na začátek další lišty
 * (případně na novou lištu stejné šířky). Volné místo na lištách se nezaplňuje – rozvržení se mění co nejméně.
 */
export function reflowRails(capacities: readonly number[], slots: readonly RailSlot[]): { capacities: number[]; slots: RailSlot[]; moved: number } {
  const rails = capacities.map((_, index) => slots.filter((slot) => slot.rail === index + 1).sort((a, b) => a.position - b.position));
  const caps = [...capacities];
  let moved = 0;
  for (let r = 0; r < rails.length; r++) {
    let used = rails[r].reduce((sum, slot) => sum + slot.width, 0);
    while (used > caps[r] + 1e-9 && rails[r].length > 1) {
      const tail = rails[r].pop()!;
      used -= tail.width;
      if (r + 1 >= rails.length) {
        rails.push([]);
        caps.push(caps[r]);
      }
      rails[r + 1].unshift(tail);
      moved++;
    }
  }
  return { capacities: caps, slots: rails.flatMap((rail, r) => rail.map((slot, index) => ({ ...slot, rail: r + 1, position: index + 1 }))), moved };
}
