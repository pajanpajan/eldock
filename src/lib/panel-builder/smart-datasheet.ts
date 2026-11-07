// Fáze 65: obsah technického listu a štítky karty přístroje chytré domácnosti. Každý údaj nese zdroj: katalog výrobců
// (`smart-device-specs.generated.ts`), výpočet Eldocku (ověřené moduly `smart-home.ts`) nebo parametr systému (napětí
// sběrnice, sběrnicový kabel). Chybějící údaj = null → technický list ukáže „ověřte v datasheetu výrobce“. Čisté funkce.

import type { CatalogProduct } from "./smart-catalog";
import type { DeviceSpec } from "./smart-device-specs";
import { SMART_DEVICE_SPECS } from "./smart-device-specs.generated";
import { specKey } from "./smart-device-specs";
import { smartSystemOf, type SmartModule, type SmartSystemId } from "./smart-home";
import { designSeriesOf, seriesColors } from "./wiring-designs";

/** Barvy náhledu přístroje: rámeček a klapka zvolené řady, u výrobce s vlastními barvami (Loxone) jeho barva. */
export function deviceToneOf(seriesKey: string | null, color: string, own?: readonly { id: string; swatch: string }[]): { frame: string; insert: string } {
  if (own?.length) {
    const pick = own.find((option) => option.id === color) ?? own[0];
    return { frame: pick.swatch, insert: pick.swatch };
  }
  const look = designSeriesOf(seriesKey)?.series.colors?.find((option) => option.id === color);
  const options = seriesColors(seriesKey);
  const swatch = options.find((option) => option.id === color)?.swatch ?? options[0]?.swatch ?? "#f8fafc";
  return { frame: look?.frame ?? swatch, insert: look?.insert ?? swatch };
}

export type DatasheetSource = "katalog" | "výpočet" | "systém";

export interface DatasheetRow {
  id: string;
  label: string;
  value: string | null;
  source: DatasheetSource | null;
}

/** Šířka modulu na DIN liště [mm] (1 M = 18 mm). */
export const MODULE_MM = 18;

const BUS_VOLTAGE: Record<SmartSystemId, string | null> = { abb_freeathome: "24 V DC (sběrnice free@home)", abb_knx: "30 V DC (sběrnice KNX TP)", loxone: "24 V DC (Loxone Tree)", taphome: null };
const BUS_CABLE: Partial<Record<CatalogProduct["wiring"], string>> = { "bus-fah": "J-Y(St)Y 2×2×0,8 (sběrnice free@home)", "bus-knx": "KNX J-Y(St)Y 2×2×0,8", tree: "Loxone Tree kabel (2×2×0,8 – napájení + Tree)" };
const MOUNTING_OF: Record<CatalogProduct["kind"], string> = {
  button: "do přístrojové krabice pod rámeček řady",
  touch: "do přístrojové krabice (bezrámečkově)",
  thermostat: "do přístrojové krabice pod rámeček řady",
  panel: "nástěnná montáž (zapuštěná krabice panelu)",
  inbox: "do přístrojové krabice za tlačítko / vypínač",
  presence: "na strop",
  sensor: "na stěnu / do přístrojové krabice",
  intercom: "nástěnná montáž",
  controller: "nástěnná montáž (na DIN lištu s adaptérem)",
  din: "DIN lišta TH35 v rozváděči",
};

/** Ověřené technické údaje výrobku z katalogu výrobců (null = výrobek nemá záznam). */
export const specOf = (product: Pick<CatalogProduct, "catalog">): DeviceSpec | null => (product.catalog ? (SMART_DEVICE_SPECS[specKey(product.catalog)] ?? null) : null);

/** Modul výpočtu chytré domácnosti výrobku (DIN lišta, systémový modul). */
export const moduleOf = (product: Pick<CatalogProduct, "moduleId">, system: SmartSystemId): SmartModule | null => smartSystemOf(system).modules.find((unit) => unit.id === product.moduleId) ?? null;

const channelText = (count: number) => `${count} ${count === 1 ? "kanál" : count >= 2 && count <= 4 ? "kanály" : "kanálů"}`;
const mains = (product: Pick<CatalogProduct, "wiring">) => product.wiring.startsWith("inbox") || product.wiring === "flextronics";

function ratingOf(dinModule: SmartModule | null, spec: DeviceSpec | null): { value: string; source: DatasheetSource } | null {
  if (dinModule?.ratedA) return { value: `${dinModule.channels}× ${dinModule.ratedA} A (AC-1)`, source: "výpočet" };
  if (dinModule?.maxW) return { value: `${dinModule.channels}× ${dinModule.maxW} W`, source: "výpočet" };
  if (spec?.current) return { value: spec.current, source: "katalog" };
  return null;
}

/** Tabulka parametrů technického listu. */
export function datasheetRows(product: CatalogProduct, system: SmartSystemId): DatasheetRow[] {
  const spec = specOf(product);
  const dinModule = moduleOf(product, system);
  const voltage = spec?.supply ? { value: spec.supply, source: "katalog" as const } : mains(product) ? { value: "230 V AC", source: "systém" as const } : product.wiring === "wireless" ? { value: "bez napájení (energie ze stisku / z baterie)", source: "systém" as const } : BUS_VOLTAGE[system] ? { value: BUS_VOLTAGE[system]!, source: "systém" as const } : null;
  const rating = ratingOf(dinModule, spec);
  const io = dinModule && dinModule.channels && dinModule.role !== "psu" && dinModule.role !== "system" ? { value: dinModule.role === "dali" ? `až ${dinModule.channels} předřadníků DALI` : dinModule.role === "interface" && system === "loxone" ? "2 větve Tree" : channelText(dinModule.channels), source: "výpočet" as const } : spec?.outputs ? { value: `${spec.outputs} výstupů`, source: "katalog" as const } : product.gangs ? { value: product.gangs === 1 ? "1 ovládací plocha" : product.gangs <= 4 ? `${product.gangs} ovládací plochy` : `${product.gangs} ovládacích ploch`, source: "systém" as const } : null;
  const mounting = spec?.mounting ? { value: spec.mounting, source: "katalog" as const } : { value: MOUNTING_OF[product.kind], source: "systém" as const };
  const size = dinModule && dinModule.modules > 0 ? { value: `${dinModule.modules} M (${dinModule.modules * MODULE_MM} mm)`, source: "výpočet" as const } : spec?.mountingDepthMm ? { value: `montážní hloubka ${spec.mountingDepthMm} mm`, source: "katalog" as const } : null;
  const cable = BUS_CABLE[product.wiring];
  const row = (id: string, label: string, entry: { value: string; source: DatasheetSource } | null): DatasheetRow => ({ id, label, value: entry?.value ?? null, source: entry?.source ?? null });
  return [
    row("voltage", "Jmenovité napětí / napájení", voltage),
    row("rating", "Jmenovitý proud / výkon kanálu", rating),
    row("io", "Vstupy / výstupy", io),
    row("loss", "Vlastní spotřeba / ztrátový výkon Pv", spec?.powerLossW ? { value: `${String(spec.powerLossW).replace(".", ",")} W`, source: "katalog" } : spec?.powerW ? { value: `${String(spec.powerW).replace(".", ",")} W`, source: "katalog" } : null),
    row("mounting", "Způsob montáže", mounting),
    row("size", "Šířka na DIN liště / hloubka v krabici", size),
    row("cable", "Připojovací vodiče", cable ? { value: cable, source: "systém" } : null),
    row("temp", "Provozní teplota", spec?.tempC ? { value: `${spec.tempC.min} až +${spec.tempC.max} °C`.replace("+-", "-"), source: "katalog" } : null),
    row("ip", "Stupeň krytí", spec?.ip ? { value: spec.ip.replace(/^IP(\d)/, "IP $1"), source: "katalog" } : null),
    row("dimensions", "Rozměry Š × V × H", spec?.dimensions ? { value: `${spec.dimensions.w} × ${spec.dimensions.h} × ${spec.dimensions.d} mm`, source: "katalog" } : dinModule && dinModule.modules > 0 ? { value: `šířka ${dinModule.modules * MODULE_MM} mm (${dinModule.modules} M)`, source: "výpočet" } : null),
  ];
}

/** Štítky parametrů na kartě (sběrnice, montáž, kanály, krytí, objednací číslo). */
export function productBadges(product: CatalogProduct, system: SmartSystemId): string[] {
  const spec = specOf(product);
  const dinModule = moduleOf(product, system);
  const badges: string[] = [];
  if (product.noBus) badges.push(system === "loxone" ? "Bezdrátově · Loxone Air" : product.wiring === "intercom" ? "Vlastní sběrnice Welcome" : "Bezdrátově · free@home wireless");
  else if (product.wiring === "bus-fah") badges.push("24 V DC sběrnice");
  else if (product.wiring === "bus-knx") badges.push("Sběrnice KNX");
  else if (product.wiring === "tree") badges.push("Loxone Tree");
  else if (product.wiring === "bus-taphome") badges.push("Sběrnice TapHome");
  else if (mains(product)) badges.push("230 V AC");
  if (dinModule) badges.push(dinModule.modules > 0 ? `DIN lišta · ${dinModule.modules} M` : "Nástěnná montáž");
  else if (product.kind === "inbox") badges.push("Do přístrojové krabice");
  else if (product.kind === "presence") badges.push("Na strop");
  if (spec?.mountingDepthMm) badges.push(`Hloubka ${spec.mountingDepthMm} mm`);
  const rating = ratingOf(dinModule, spec);
  if (rating) badges.push(rating.value.replace(" (AC-1)", ""));
  else if (dinModule?.channels && dinModule.role === "blind") badges.push(`${dinModule.channels}× žaluzie`);
  if (spec?.ip) badges.push(spec.ip.replace(/^IP(\d)/, "IP $1"));
  return badges;
}

/** Objednací číslo pro kartu / technický list (ověřené; bez čísla = podle řady a barvy). */
export const mpnOf = (product: Pick<CatalogProduct, "articleNumber" | "catalog">) => product.articleNumber ?? product.catalog?.mpn ?? null;
