// Data výstupní dokumentace rozváděče: obsah listů, kusovník podle objednacích čísel, seznam
// komponent podle značení, technická data a kontrola připravenosti k propuštění do provozu.

import type { ComponentCategory } from "@/generated/prisma/enums";
import type { ThermalResult } from "@/lib/thermalCalculation";

import { flattenTree, type TreeNode } from "./tree";

export const DOCUMENT_SHEETS = [
  "Titulní strana a obsah",
  "Výkres osazení rozváděče a výpis funkcí přístrojů",
  "Jednopólové schéma (Single Line Diagram)",
  "Kusovník a seznam komponent",
  "Výpočet oteplení a technická data",
  "ES prohlášení o shodě a výrobní štítek CE",
] as const;

export interface DocComponent {
  articleNumber: string;
  typeCode: string;
  manufacturer: string;
  description: string;
  category: ComponentCategory;
}

export interface DocItem extends Pick<TreeNode, "id" | "designation" | "circuitLabel" | "dinRailIndex" | "positionOnRail" | "parentItemId" | "fedFromIncomer"> {
  component: DocComponent | null;
}

export interface PartsRow {
  articleNumber: string;
  typeCode: string;
  manufacturer: string;
  description: string;
  quantity: number;
}

/** Kusovník: součet kusů podle objednacího čísla (skříň -A1 první), nerozpoznané zvlášť. */
export function partsList(items: readonly DocItem[], enclosure: DocComponent | null): PartsRow[] {
  const rows = new Map<string, PartsRow>();
  const add = (component: DocComponent | null) => {
    const key = component?.articleNumber ?? "?";
    const row = rows.get(key) ?? {
      articleNumber: component?.articleNumber ?? "–",
      typeCode: component?.typeCode ?? "nerozpoznaný přístroj",
      manufacturer: component?.manufacturer ?? "–",
      description: component?.description ?? "doplnit v kroku 1",
      quantity: 0,
    };
    row.quantity++;
    rows.set(key, row);
  };
  if (enclosure) add(enclosure);
  for (const item of items) add(item.component);
  const list = [...rows.values()];
  const enclosureRow = enclosure ? list.shift() : undefined;
  list.sort((a, b) => a.articleNumber.localeCompare(b.articleNumber));
  return enclosureRow ? [enclosureRow, ...list] : list;
}

export interface ComponentRow {
  designation: string;
  articleNumber: string;
  typeCode: string;
  manufacturer: string;
  description: string;
  /** Pozice ve schématu: list 3, sloupec (pořadí ve stromu). */
  position: string;
  function: string;
}

/** Seznam komponent podle referenčního značení (-A1, -Q1, -F1 …) s pozicí v 1P schématu. */
export function componentsList(items: readonly DocItem[], enclosure: DocComponent | null): ComponentRow[] {
  const order = new Map(flattenTree(items).map(({ node }, index) => [node.id, index + 1]));
  const rows: ComponentRow[] = items.map((item) => ({
    designation: item.designation,
    articleNumber: item.component?.articleNumber ?? "–",
    typeCode: item.component?.typeCode ?? "nerozpoznáno",
    manufacturer: item.component?.manufacturer ?? "–",
    description: item.component?.description ?? "",
    position: order.has(item.id) ? `/3.${order.get(item.id)}` : "–",
    function: item.circuitLabel,
  }));
  const natural = (a: string, b: string) => a.localeCompare(b, "cs", { numeric: true });
  rows.sort((a, b) => natural(a.designation, b.designation));
  return enclosure
    ? [{ designation: "-A1", articleNumber: enclosure.articleNumber, typeCode: enclosure.typeCode, manufacturer: enclosure.manufacturer, description: enclosure.description, position: "/2", function: "Skříň rozváděče" }, ...rows]
    : rows;
}

export interface TechnicalProject {
  code: string;
  norm: string;
  heightMm: number;
  widthMm: number;
  depthMm: number;
  ipRating: string;
  networkSystem: string;
  shortCircuitKa: number;
  ambientTempC: number;
  simultaneityFactor: number;
}

const n = (value: number, digits = 2) => value.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Technická data rozváděče (list 5 a výrobní štítek). */
export function technicalData(project: TechnicalProject, thermal: ThermalResult, mainBreakerA: number | null): [string, string][] {
  return [
    ["Označení", project.code],
    ["Norma", project.norm],
    ["Vnitřní uspořádání", "Form 1"],
    ["Stupeň znečištění", "2"],
    ["Prostředí EMC", "A (průmyslové) / B (obytné) – dle použitých přístrojů"],
    ["Rozměry (V × Š × H)", `${project.heightMm} × ${project.widthMm} × ${project.depthMm} mm`],
    ["Stupeň krytí", project.ipRating],
    ["Jmenovité izolační napětí Ui", "400 V"],
    ["Jmenovité impulzní výdržné napětí Uimp", "6 kV"],
    ["Síť a jmenovité napětí", project.networkSystem],
    ["Provozní proud", `${n(thermal.operatingCurrentA)} A`],
    ["Jmenovitý proud hlavního přístroje", mainBreakerA ? `${n(mainBreakerA, 0)} A` : "–"],
    ["Koeficient soudobosti (SF)", n(project.simultaneityFactor)],
    ["Zatížení fází L1 / L2 / L3 / N", `${n(thermal.phaseLoads.L1)} / ${n(thermal.phaseLoads.L2)} / ${n(thermal.phaseLoads.L3)} / ${n(thermal.phaseLoads.N)} A`],
    ["Teplota okolí", `${n(project.ambientTempC, 0)} °C`],
    ["Vnitřní teplota (0,5 h / 1,0 h)", `${n(thermal.internalTempC, 1)} / ${n(thermal.topTempC, 1)} °C`],
    ["Celkový ztrátový výkon", `${n(thermal.totalLossW)} W`],
    ["Max. zkratový proud (Icc)", `${n(project.shortCircuitKa, 0)} kA`],
    ["Ochrana před nebezpečným dotykem", "Rozváděč: úplná izolace · Vývody: automatické odpojení od zdroje"],
  ];
}

/** Co brání propuštění dokumentace do provozu (prázdné = lze propustit). */
export function releaseBlockers(input: { items: readonly (DocItem & { recognitionStatus: string })[]; connected: boolean; thermalOk: boolean }): string[] {
  const blockers: string[] = [];
  const unresolved = input.items.filter((item) => item.recognitionStatus !== "VERIFIED" || !item.component);
  if (!input.items.length) blockers.push("Rozváděč nemá žádné přístroje.");
  if (unresolved.length) blockers.push(`Nepotvrzené přístroje (krok 1): ${unresolved.map((item) => item.designation).join(", ")}.`);
  if (!input.connected) blockers.push("Strom zapojení není kompletní (krok 2).");
  if (!input.thermalOk) blockers.push("Výpočet oteplení nevyhovuje (krok 3).");
  return blockers;
}
