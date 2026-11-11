// Elektro-linter rozváděče (fáze 45): kontrola chyb a norem v reálném čase nad stavem kroku 1 –
// štítek vs. kategorie, popis vs. póly, proudové chrániče (ČSN 33 2000-4-41), rezerva modulů
// (ČSN EN 61439) a společné hřebeny, dimenzování vůči hlavnímu vypínači. Každý nález může nést
// opravu „1 klikem“. Čisté funkce.
// Fáze 93: typ objektu – obchodní centrum (BD4, ČSN 33 2000-7-718): vypínací spoušť CENTRAL STOP a podružný elektroměr MID
// nájemní jednotky (doplnění 1 klikem); zdravotnický prostor Skupiny 1 (ČSN 33 2000-7-710 ed. 2): zásuvky alespoň ze
// 2 obvodů pod 2 nezávislými chrániči ≤ 30 mA typ A / B, chránič typu AC zakázán, IΔn nejvýš 30 mA.

import type { ComponentCategory } from "@/generated/prisma/enums";

import { sameManufacturer } from "./matching";
import { defaultConfig, describeConfig, type ItemConfig } from "./configurator";
import { BD4_FIX_LABEL, CENTRAL_STOP_EXAMPLES, CENTRAL_STOP_LABEL, MEDICAL_CIRCUIT, MID_METER_EXAMPLES, MEDICAL_SPLIT_FIX, MEDICAL_SPLIT_MESSAGE, MID_METER_LABEL, MID_METER_TEXT, SHUNT_TRIP_TEXT, isCommercial, isMedical, isMedicalRoom, midMeterConfig, shuntTripConfig } from "./occupancy";

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
  | { kind: "palette"; config: ItemConfig; label: string }
  /** Fáze 93: doplnění přístrojů na lištu 1 klikem (spoušť CENTRAL STOP, elektroměr MID, okruh B) a úprava stávajících. */
  | { kind: "add-devices"; devices: { config: ItemConfig; label: string }[]; configure?: { itemId: string; config: ItemConfig }[]; label: string };

export interface LintIssue {
  id: string;
  severity: "error" | "warning";
  rule:
    | "label-category"
    | "label-poles"
    | "rcd-missing"
    | "rcd-overload"
    | "reserve"
    | "mixed-busbar"
    | "rating"
    | "rcd-type-ac"
    | "rcd-lighting-mixed"
    | "rcd-type-b"
    | "bd4-central-stop"
    | "bd4-mid-meter"
    | "medical-sockets"
    | "medical-rcd-sensitivity";
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

/** Kontrola rozváděče – chyby (červeně) a varování (oranžově) s opravou 1 klikem; fáze 93 – podle typu objektu. */
export function validateSwitchboardState(state: { devices: readonly LintDevice[]; capacities: readonly number[]; enclosureModules?: number | null; occupancy?: string | null }): LintIssue[] {
  const issues: LintIssue[] = [];
  const { devices } = state;
  const medical = isMedical(state.occupancy);
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
      // Fáze 93: ve zdravotnickém prostoru je typ AC zakázán (chyba), jinak varování dle ČSN 33 2130 ed. 4
      severity: medical ? "error" : "warning",
      rule: "rcd-type-ac",
      itemIds: [rcd.id],
      message: medical
        ? `Chránič ${rcd.designation} je typu AC – ve zdravotnickém prostoru Skupiny 1 je typ AC zakázán (ČSN 33 2000-7-710 ed. 2), použijte typ A nebo B.`
        : `Chránič ${rcd.designation} je typu AC – dle ČSN 33 2130 ed. 4 musí být u koncových obvodů s elektronikou a LED osvětlením použit typ A (příp. B/F).`,
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

  // 3c. Fáze 93 – typ objektu
  if (isCommercial(state.occupancy) && devices.length) issues.push(...commercialIssues(devices));
  if (medical && devices.length) issues.push(...medicalIssues(devices));

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

// ---------------------------------------------------------------------------
//  Fáze 93: obchodní centrum (BD4) a zdravotnický prostor Skupiny 1
// ---------------------------------------------------------------------------

const textOf = (device: LintDevice) => `${device.label} ${device.typeCode ?? ""} ${device.config?.power ?? ""}`;
/** Vypínací spoušť hlavního vypínače (podtyp SHUNT_TRIP nebo štítek / typ). */
export const isShuntTrip = (device: LintDevice) => device.config?.moduleSubtype === "SHUNT_TRIP" || SHUNT_TRIP_TEXT.test(textOf(device));
/** Podružný elektroměr MID (elektroměr s MID ve štítku / typu). */
export const isMidMeter = (device: LintDevice) => MID_METER_TEXT.test(textOf(device)) && (device.config?.moduleSubtype === "METER" || /elektroměr|meter|B23|iEM|7M\./i.test(textOf(device)));

function commercialIssues(devices: readonly LintDevice[]): LintIssue[] {
  const main = devices.find((device) => device.category === "MAIN_SWITCH") ?? null;
  const manufacturer = main?.manufacturer ?? devices.find((device) => device.manufacturer)?.manufacturer ?? null;
  const phases = main && /^2P|1P\+N/i.test(main.poles ?? "") ? 1 : 3;
  const shunt = devices.some(isShuntTrip);
  const meter = devices.some(isMidMeter);
  const missing = [...(shunt ? [] : [{ config: shuntTripConfig(manufacturer), label: CENTRAL_STOP_LABEL }]), ...(meter ? [] : [{ config: midMeterConfig(manufacturer, phases), label: MID_METER_LABEL }])];
  if (!missing.length) return [];
  const fix: LintFix = { kind: "add-devices", devices: missing, label: BD4_FIX_LABEL };
  const issues: LintIssue[] = [];
  if (!shunt) {
    issues.push({
      id: "bd4-central-stop:panel",
      severity: "error",
      rule: "bd4-central-stop",
      itemIds: main ? [main.id] : [],
      message: `Obchodní centrum (BD4, ČSN 33 2000-7-718): hlavní vypínač${main ? ` ${main.designation}` : ""} nájemní jednotky nemá vypínací spoušť CENTRAL STOP / TOTAL STOP (0,5–1 M, např. ${CENTRAL_STOP_EXAMPLES}) – jednotku nejde odpojit z centrálního tlačítka ani z EPS (vyhláška č. 23/2008 Sb.).`,
      fix,
    });
  }
  if (!meter) {
    issues.push({
      id: "bd4-mid-meter:panel",
      severity: "error",
      rule: "bd4-mid-meter",
      itemIds: [],
      message: `Obchodní centrum (BD4): chybí podružný elektroměr MID s komunikací Modbus RTU / M-Bus pro fakturační měření nájemní jednotky (3f 4 M, např. ${MID_METER_EXAMPLES}).`,
      fix,
    });
  }
  return issues;
}

/** Ochrana zásuvkového okruhu: vlastní RCBO, nadřazený chránič ve stromu, jinak chránič vlevo na liště. */
function protectionOf(device: LintDevice, devices: readonly LintDevice[]): LintDevice | null {
  if (device.category === "RCBO") return device;
  const byId = new Map(devices.map((candidate) => [candidate.id, candidate]));
  for (let parent = device.parentItemId ? byId.get(device.parentItemId) : undefined, depth = 0; parent && depth < 10; parent = parent.parentItemId ? byId.get(parent.parentItemId) : undefined, depth++) {
    if (parent.category === "RCD" || parent.category === "RCBO") return parent;
  }
  if (device.parentItemId) return null;
  const left = devices.filter((candidate) => candidate.dinRailIndex === device.dinRailIndex && candidate.positionOnRail < device.positionOnRail).sort((a, b) => b.positionOnRail - a.positionOnRail);
  for (const candidate of left) {
    if (candidate.category === "RCD") return candidate;
    if (candidate.category === "MAIN_SWITCH") return null;
  }
  return null;
}

/** Místnosti ze štítku zásuvkového okruhu („Zásuvky – Ordinace 1 – Okruh A (…)“ → [„Ordinace 1“]). */
const roomsOfLabel = (label: string) =>
  label
    .replace(/^.*?zásuvk\S*\s*[–-]\s*/i, "")
    .replace(/\s*[–-]\s*Okruh [AB].*$/i, "")
    .replace(/\s*\(.*\)\s*$/, "")
    .split(/,\s*/)
    .map((room) => room.trim())
    .filter(Boolean);

function medicalIssues(devices: readonly LintDevice[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const sockets = devices.filter((device) => (device.category === "MCB" || device.category === "RCBO") && SOCKET_LABEL.test(device.label) && !LIGHTING_LABEL.test(device.label));
  const independent = (circuits: readonly LintDevice[]) => {
    const protections = circuits.map((circuit) => protectionOf(circuit, devices));
    const valid = protections.filter((rcd): rcd is LintDevice => rcd !== null && (rcd.config?.rcdType ?? "A") !== "AC" && (rcd.config?.rcdSensitivityMa ?? 30) <= 30);
    return circuits.length >= 2 && new Set(valid.map((rcd) => rcd.id)).size >= 2 && valid.length === circuits.length;
  };
  // Lékařské místnosti podle štítků okruhů; bez nich celý rozváděč jako jedna lékařská místnost
  const rooms = [...new Set(sockets.flatMap((device) => roomsOfLabel(device.label)).filter(isMedicalRoom))];
  const groups = rooms.length ? rooms.map((room) => ({ room, circuits: sockets.filter((device) => roomsOfLabel(device.label).includes(room)) })) : [{ room: null as string | null, circuits: sockets }];
  const failing = groups.filter((group) => group.circuits.length && !independent(group.circuits));
  // Rozváděč bez zásuvkových okruhů (jen světla, technologie) pravidlo zásuvek lůžka / vyšetřovny netýká
  if (sockets.length && failing.length) {
    // Oprava: každý zásuvkový okruh na vlastní RCBO 1P+N B16 30 mA typ A; jediný okruh dostane druhý okruh (Okruh B)
    const target = failing.flatMap((group) => group.circuits);
    const manufacturer = target[0]?.manufacturer ?? devices.find((device) => device.manufacturer)?.manufacturer ?? null;
    const rcbo = (device: LintDevice | null): ItemConfig => ({ ...defaultConfig("RCBO", { manufacturer: device?.manufacturer ?? manufacturer, modules: 2, ratedCurrentA: device?.ratedCurrentA ?? 16, curve: device?.config?.curve ?? "B" }), rcdType: "A", rcdSensitivityMa: 30 });
    const configure = target.filter((device) => device.category !== "RCBO" || (device.config?.rcdType ?? "A") === "AC" || (device.config?.rcdSensitivityMa ?? 30) > 30).map((device) => ({ itemId: device.id, config: rcbo(device) }));
    const lonely = failing.filter((group) => group.circuits.length < 2);
    const added = lonely.flatMap((group) => {
      const where = group.room ? ` – ${group.room}` : "";
      const sides = group.circuits.length ? (["B"] as const) : (["A", "B"] as const);
      return sides.map((side) => ({ config: rcbo(null), label: `Zásuvky${where} – ${MEDICAL_CIRCUIT[side].label} (${MEDICAL_CIRCUIT[side].colors})` }));
    });
    issues.push({
      id: "medical-sockets:panel",
      severity: "error",
      rule: "medical-sockets",
      itemIds: target.map((device) => device.id),
      message: MEDICAL_SPLIT_MESSAGE,
      fix: { kind: "add-devices", devices: added, configure, label: MEDICAL_SPLIT_FIX },
    });
  }
  for (const rcd of devices.filter((device) => (device.category === "RCD" || device.category === "RCBO") && (device.config?.rcdSensitivityMa ?? 30) > 30)) {
    issues.push({
      id: `medical-rcd-sensitivity:${rcd.id}`,
      severity: "error",
      rule: "medical-rcd-sensitivity",
      itemIds: [rcd.id],
      message: `Chránič ${rcd.designation} má IΔn ${rcd.config!.rcdSensitivityMa} mA – ve zdravotnickém prostoru Skupiny 1 nejvýš 30 mA (ČSN 33 2000-7-710 ed. 2).`,
      fix: rcd.config ? { kind: "configure", itemId: rcd.id, config: { ...rcd.config, rcdSensitivityMa: 30 }, label: "Opravit 1 klikem: IΔn 30 mA" } : null,
    });
  }
  return issues;
}
