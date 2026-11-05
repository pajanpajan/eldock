// Elektro-linter rozváděče (fáze 45): kontrola chyb a norem v reálném čase nad stavem kroku 1 –
// štítek vs. kategorie, popis vs. póly, proudové chrániče (ČSN 33 2000-4-41), rezerva modulů
// (ČSN EN 61439) a společné hřebeny, dimenzování vůči hlavnímu vypínači. Každý nález může nést
// opravu „1 klikem“. Čisté funkce.

import type { ComponentCategory } from "@/generated/prisma/enums";

import { sameManufacturer } from "./matching";
import { defaultConfig, describeConfig, type ItemConfig } from "./configurator";

export interface LintDevice {
  id: string;
  designation: string;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  category: ComponentCategory | null;
  poles: string | null;
  ratedCurrentA: number | null;
  manufacturer: string | null;
  /** Typ / popis přístroje (ruční typové označení nebo typ z katalogu). */
  typeCode: string | null;
  /** Funkce obvodu (štítek). */
  label: string;
  parentItemId: string | null;
  config: ItemConfig | null;
}

export type LintFix =
  | { kind: "configure"; itemId: string; config: ItemConfig; label: string }
  | { kind: "configure-many"; items: { itemId: string; config: ItemConfig }[]; label: string }
  | { kind: "sync-text"; itemId: string; config: ItemConfig | null; label: string }
  | { kind: "add-rail"; label: string }
  | { kind: "palette"; config: ItemConfig; label: string };

export interface LintIssue {
  id: string;
  severity: "error" | "warning";
  rule: "label-category" | "label-poles" | "rcd-missing" | "rcd-overload" | "reserve" | "mixed-busbar" | "rating" | "rcd-type-ac" | "rcd-lighting-mixed" | "rcd-type-b";
  itemIds: string[];
  message: string;
  fix: LintFix | null;
}

/** Min. volná rezerva modulů (ČSN EN 61439 – doporučení pro rozšíření). */
export const MIN_RESERVE = 0.2;
export const MAX_CIRCUITS_PER_RCD = 6;

/** Okruhy vyžadující doplňkovou ochranu proudovým chráničem 30 mA (ČSN 33 2000-4-41 čl. 411.3.3). */
const RCD_REQUIRED = /zásuv|koupel|kuchy|venek|venk|garáž|dílna|zahrad/i;
const PROTECTIVE: readonly (ComponentCategory | null)[] = ["MCB", "RCD", "RCBO"];
/** Fáze 52 (ČSN 33 2130 ed. 4): světelné a zásuvkové okruhy podle funkce obvodu. */
export const LIGHTING_LABEL = /světl|osvětl|svítid|lustr/i;
export const SOCKET_LABEL = /zásuv/i;
/** Okruhy s výkonovou elektronikou (DC složka) – chránič typ B nebo F. */
export const TYPE_B_LABEL = /wallbox|nabíje|elektromobil|\bEV\b|tepeln\S* čerpadl|\bTČ\b|\bFVE\b|fotovolt|střídač/i;
/** Přístroje propojované společnou hřebenovou lištou (ne SPD, zdroje, stykače, chytré moduly ani odpínač). */
const BUSBARRED: readonly (ComponentCategory | null)[] = ["MCB", "RCD", "RCBO"];

const polesInText = (text: string) => /\b([1-4])\s?P(\+N)?\b/i.exec(text)?.slice(1, 3).join("").toUpperCase().replace("P", "") ?? null;
const normalizePoles = (poles: string | null) => (poles ? poles.toUpperCase().replace(/\s/g, "") : null);

/** Koncové okruhy pod chráničem: podle stromu zapojení, jinak přístroje vpravo na liště do dalšího chrániče / odpínače. */
function rcdChildren(rcd: LintDevice, devices: readonly LintDevice[]): LintDevice[] {
  const byTree = devices.filter((device) => device.parentItemId === rcd.id);
  if (byTree.length) return byTree.filter((device) => device.category === "MCB");
  const rail = devices.filter((device) => device.dinRailIndex === rcd.dinRailIndex && device.positionOnRail > rcd.positionOnRail).sort((a, b) => a.positionOnRail - b.positionOnRail);
  const stop = rail.findIndex((device) => device.category === "RCD" || device.category === "MAIN_SWITCH");
  return (stop < 0 ? rail : rail.slice(0, stop)).filter((device) => device.category === "MCB");
}

/** Kontrola rozváděče – chyby (červeně) a varování (oranžově) s opravou 1 klikem. */
export function validateSwitchboardState(state: { devices: readonly LintDevice[]; capacities: readonly number[]; enclosureModules?: number | null }): LintIssue[] {
  const issues: LintIssue[] = [];
  const { devices } = state;
  const add = (issue: Omit<LintIssue, "id">) => issues.push({ ...issue, id: `${issue.rule}:${issue.itemIds.join(",") || "panel"}` });

  for (const device of devices) {
    const label = device.label.trim();
    // 1. Štítek vs. kategorie
    if (/chráni[čc]/i.test(label) && !/jisti[čc]ochrani/i.test(label) && device.category === "MCB") {
      const config = defaultConfig("RCD", { manufacturer: device.manufacturer, modules: device.modulesWidth >= 4 ? 4 : 2 });
      add({ severity: "error", rule: "label-category", itemIds: [device.id], message: `${device.designation} má štítek „${label}“, ale je to jistič.`, fix: { kind: "configure", itemId: device.id, config, label: "Změnit na chránič" } });
    }
    if (/hlavní vypínač/i.test(label) && device.category !== "MAIN_SWITCH" && (device.category !== "MCB" || normalizePoles(device.poles) === "1P")) {
      const config = defaultConfig("MAIN_SWITCH", { manufacturer: device.manufacturer, modules: 3, ratedCurrentA: device.ratedCurrentA && device.ratedCurrentA >= 25 ? device.ratedCurrentA : 40 });
      add({ severity: "error", rule: "label-category", itemIds: [device.id], message: `${device.designation} má štítek „Hlavní vypínač“, ale je to ${device.category === "MCB" ? "1P jistič" : "jiný přístroj"}.`, fix: { kind: "configure", itemId: device.id, config, label: "Změnit na hlavní vypínač 3P" } });
    }
    // 2. Popis vs. póly
    const textPoles = device.typeCode ? polesInText(device.typeCode) : null;
    const actual = normalizePoles(device.poles);
    if (textPoles && actual && actual !== "2X1P" && textPoles !== actual.replace("P", "")) {
      add({
        severity: "warning",
        rule: "label-poles",
        itemIds: [device.id],
        message: `${device.designation}: popis „${device.typeCode}“ uvádí ${textPoles.replace("+N", "")}P${textPoles.includes("+N") ? "+N" : ""}, ale přístroj má ${actual}.`,
        fix: { kind: "sync-text", itemId: device.id, config: device.config, label: device.config ? `Synchronizovat text („${describeConfig(device.config)}“)` : "Synchronizovat text s parametry" },
      });
    }
  }

  // 3. Proudové chrániče
  const protectedBy = devices.filter((device) => device.category === "RCD" || device.category === "RCBO");
  const needRcd = devices.filter((device) => PROTECTIVE.includes(device.category) && device.category === "MCB" && RCD_REQUIRED.test(device.label));
  if (needRcd.length && !protectedBy.length) {
    add({
      severity: "error",
      rule: "rcd-missing",
      itemIds: needRcd.map((device) => device.id),
      message: `Okruhy ${needRcd.map((device) => device.designation).join(", ")} (zásuvky, koupelna, kuchyně, venek) vyžadují proudový chránič 30 mA (ČSN 33 2000-4-41), v rozváděči žádný není.`,
      fix: { kind: "palette", config: defaultConfig("RCD", { manufacturer: needRcd[0].manufacturer, modules: 4 }), label: "Připravit chránič 4P 30 mA k osazení" },
    });
  }
  for (const rcd of devices.filter((device) => device.category === "RCD")) {
    const children = rcdChildren(rcd, devices);
    if (children.length > MAX_CIRCUITS_PER_RCD) {
      add({ severity: "warning", rule: "rcd-overload", itemIds: [rcd.id], message: `Pod chráničem ${rcd.designation} je ${children.length} koncových okruhů (doporučeno nejvýš ${MAX_CIRCUITS_PER_RCD}) – rozdělte je na další chránič.`, fix: { kind: "palette", config: defaultConfig("RCD", { manufacturer: rcd.manufacturer, modules: 4 }), label: "Připravit další chránič" } });
    }
  }

  // 3b. Fáze 52 – typ chráničů a oddělení světel od zásuvek (ČSN 33 2130 ed. 4)
  for (const rcd of devices.filter((device) => (device.category === "RCD" || device.category === "RCBO") && device.config?.rcdType === "AC")) {
    add({
      severity: "warning",
      rule: "rcd-type-ac",
      itemIds: [rcd.id],
      message: `Chránič ${rcd.designation} je typu AC – dle ČSN 33 2130 ed. 4 musí být u koncových obvodů s elektronikou a LED osvětlením použit typ A (příp. B/F).`,
      fix: { kind: "configure", itemId: rcd.id, config: { ...rcd.config!, rcdType: "A" }, label: "Opravit 1 klikem: Přepnout na Typ A" },
    });
  }
  for (const rcd of devices.filter((device) => device.category === "RCD")) {
    const children = rcdChildren(rcd, devices);
    const lights = children.filter((child) => LIGHTING_LABEL.test(child.label) && !SOCKET_LABEL.test(child.label));
    const sockets = children.filter((child) => SOCKET_LABEL.test(child.label));
    if (lights.length && sockets.length) {
      add({
        severity: "warning",
        rule: "rcd-lighting-mixed",
        itemIds: [rcd.id, ...lights.map((device) => device.id)],
        message: `Pod chráničem ${rcd.designation} jsou společně zapojené světelné i zásuvkové okruhy – dle ČSN 33 2130 ed. 4 nesmí světla viset na společném chrániči se zásuvkami!`,
        fix: {
          kind: "configure-many",
          // Světelný jistič → jističochránič RCBO 1P+N typ A 30 mA stejné šířky a jmenovitého proudu
          items: lights.map((device) => ({
            itemId: device.id,
            config: { ...defaultConfig("RCBO", { manufacturer: device.manufacturer, modules: device.modulesWidth, ratedCurrentA: device.ratedCurrentA ?? 10, curve: device.config?.curve ?? "B" }), rcdType: "A", rcdSensitivityMa: 30 },
          })),
          label: "Opravit 1 klikem: Oddělit světla na RCBO / samostatný chránič",
        },
      });
    }
    const special = children.filter((child) => TYPE_B_LABEL.test(child.label));
    const type = rcd.config?.rcdType ?? "A";
    if (special.length && (type === "A" || type === "AC")) {
      add({
        severity: "warning",
        rule: "rcd-type-b",
        itemIds: [rcd.id, ...special.map((device) => device.id)],
        message: `Okruh Wallbox / TČ / FVE (${special.map((device) => device.designation).join(", ")}) je za chráničem ${rcd.designation} typu ${type} – vyžadován chránič typu B nebo F.`,
        fix: rcd.config ? { kind: "configure", itemId: rcd.id, config: { ...rcd.config, rcdType: "B" }, label: "Přepnout chránič na typ B" } : null,
      });
    }
  }
  for (const rcbo of devices.filter((device) => device.category === "RCBO" && TYPE_B_LABEL.test(device.label) && (device.config?.rcdType ?? "A") !== "B" && device.config?.rcdType !== "F")) {
    add({
      severity: "warning",
      rule: "rcd-type-b",
      itemIds: [rcbo.id],
      message: `Okruh Wallbox / TČ / FVE ${rcbo.designation} je za chráničem typu ${rcbo.config?.rcdType ?? "A"} – vyžadován chránič typu B nebo F.`,
      fix: rcbo.config ? { kind: "configure", itemId: rcbo.id, config: { ...rcbo.config, rcdType: "B" }, label: "Přepnout na typ B" } : null,
    });
  }

  // 4. Rezerva modulů a společné hřebeny
  const used = devices.reduce((sum, device) => sum + device.modulesWidth, 0);
  const total = state.enclosureModules && state.enclosureModules > 0 ? state.enclosureModules : state.capacities.reduce((sum, value) => sum + value, 0);
  if (total > 0 && used > 0 && (total - used) / total < MIN_RESERVE) {
    add({ severity: "warning", rule: "reserve", itemIds: [], message: `Volná rezerva ${Math.max(0, Math.round(((total - used) / total) * 100))} % je pod 20 % (ČSN EN 61439) – obsazeno ${String(used).replace(".", ",")} z ${total} M.`, fix: { kind: "add-rail", label: "Přidat DIN lištu" } });
  }
  for (const rail of [...new Set(devices.map((device) => device.dinRailIndex))].sort((a, b) => a - b)) {
    const onRail = devices.filter((device) => device.dinRailIndex === rail && BUSBARRED.includes(device.category) && device.manufacturer);
    const brands = [...new Set(onRail.map((device) => device.manufacturer!))].filter((brand, index, all) => all.findIndex((other) => sameManufacturer(other, brand)) === index);
    if (brands.length > 1) {
      const counts = brands.map((brand) => ({ brand, count: onRail.filter((device) => sameManufacturer(device.manufacturer, brand)).length }));
      const majority = counts.sort((a, b) => b.count - a.count)[0].brand;
      const minority = onRail.filter((device) => !sameManufacturer(device.manufacturer, majority) && device.config);
      add({
        severity: "warning",
        rule: "mixed-busbar",
        itemIds: onRail.map((device) => device.id),
        message: `Lišta ${rail}: smíchaní výrobci (${brands.join(" + ")}) – společnou hřebenovou lištou je nepropojíte.`,
        fix: minority.length ? { kind: "configure-many", items: minority.map((device) => ({ itemId: device.id, config: { ...device.config!, manufacturer: majority } })), label: `Sjednotit na ${majority}` } : null,
      });
    }
  }

  // 5. Jmenovité proudy vůči hlavnímu vypínači
  const main = devices.find((device) => device.category === "MAIN_SWITCH" && device.ratedCurrentA);
  if (main?.ratedCurrentA) {
    for (const device of devices.filter((candidate) => (candidate.category === "MCB" || candidate.category === "RCD" || candidate.category === "RCBO") && candidate.ratedCurrentA)) {
      if (device.ratedCurrentA! > main.ratedCurrentA) {
        add({
          severity: "warning",
          rule: "rating",
          itemIds: [device.id, main.id],
          message: `${device.designation} (${device.ratedCurrentA} A) má vyšší jmenovitý proud než hlavní vypínač ${main.designation} (${main.ratedCurrentA} A).`,
          fix: device.config ? { kind: "configure", itemId: device.id, config: { ...device.config, ratedCurrentA: main.ratedCurrentA }, label: `Snížit na ${main.ratedCurrentA} A` } : null,
        });
      }
    }
  }
  for (const rcd of devices.filter((device) => device.category === "RCD" && device.ratedCurrentA)) {
    const largest = Math.max(0, ...rcdChildren(rcd, devices).map((child) => child.ratedCurrentA ?? 0));
    if (largest > rcd.ratedCurrentA!) {
      const next = [25, 40, 63, 80, 100].find((value) => value >= largest) ?? 100;
      add({
        severity: "warning",
        rule: "rating",
        itemIds: [rcd.id],
        message: `Chránič ${rcd.designation} (${rcd.ratedCurrentA} A) je slabší než jistič pod ním (${largest} A).`,
        fix: rcd.config ? { kind: "configure", itemId: rcd.id, config: { ...rcd.config, ratedCurrentA: next }, label: `Zvýšit na ${next} A` } : null,
      });
    }
  }
  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
}
