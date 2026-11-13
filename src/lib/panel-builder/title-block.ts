// Fáze 112: projekční rohové razítko výkresu 2D půdorysu podle ČSN EN ISO 7200 (Projektant / Montážní firma z firemního
// razítka, Investor / Objekt, Název výkresu, Stupeň DPS / DSPS, Měřítko, Datum, Číslo verze, QR kód projektu ELDOCK)
// a automatická tabulka vysvětlivek – druhy okruhů s barvou a druhem čáry a typy kabelů, které se ve výkresu vyskytují.
// Čisté funkce (tiskový list PDF a testy).

import type { CircuitLayer, DisplayCircuit } from "./route-display";

export type DrawingStage = "DPS" | "DSPS";
export const DRAWING_STAGES: readonly { id: DrawingStage; label: string }[] = [
  { id: "DPS", label: "DPS – Dokumentace pro provádění stavby" },
  { id: "DSPS", label: "DSPS – Skutečné provedení stavby" },
];
export const isDrawingStage = (value: unknown): value is DrawingStage => value === "DPS" || value === "DSPS";
export const stageLabel = (stage: DrawingStage) => DRAWING_STAGES.find((row) => row.id === stage)!.label;

/** Firemní razítko uživatele (registrovaná firma AI Panel Builderu). */
export interface CompanyStamp {
  name: string;
  ico: string | null;
  address: string | null;
  contact: string | null;
  phone: string | null;
  authorization: string | null;
}

export interface TitleBlockInput {
  stamp: CompanyStamp | null;
  author: string;
  investor: string;
  site: string;
  project: string;
  floorName: string;
  stage: DrawingStage;
  scale: number;
  paper: string;
  date: string;
  version: string;
  number: string;
  projectCode: string | null;
}

export interface TitleBlockRow {
  label: string;
  value: string;
  strong?: boolean;
}

/** Normalizace čísla verze („1“ → „v1.0“, „v1.1“ zůstane). */
export function versionLabel(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "v1.0";
  const match = /^v?(\d{1,3})(?:[.,](\d{1,3}))?$/i.exec(text);
  return match ? `v${match[1]}.${match[2] ?? "0"}` : text.slice(0, 16);
}

/** Řádky razítka (ČSN EN ISO 7200: vlastník / zpracovatel, název, druh a stav dokumentu, datum vydání, revize). */
export function titleBlockRows(input: TitleBlockInput): TitleBlockRow[] {
  const company = input.stamp
    ? [input.stamp.name, input.stamp.ico ? `IČO ${input.stamp.ico}` : null, input.stamp.address].filter(Boolean).join(" · ")
    : input.author;
  const responsible = input.stamp ? [input.stamp.contact, input.stamp.authorization ? `ev. č. ${input.stamp.authorization}` : null, input.stamp.phone].filter(Boolean).join(" · ") : "";
  return [
    { label: "Projektant / Montážní firma", value: company || "—", strong: true },
    { label: "Vypracoval", value: [input.author, responsible].filter((part, index, all) => part && all.indexOf(part) === index).join(" · ") || "—" },
    { label: "Investor / Objekt", value: [input.investor, input.site].filter(Boolean).join(" · ") || "—" },
    { label: "Akce", value: input.project || "—" },
    { label: "Název výkresu", value: `2D Půdorys elektroinstalace – ${input.floorName}`, strong: true },
    { label: "Stupeň", value: stageLabel(input.stage) },
    { label: "Měřítko · formát", value: `1 : ${input.scale} · ${input.paper}` },
    { label: "Datum", value: input.date },
    { label: "Číslo verze · č. výkresu", value: `${versionLabel(input.version)} · ${input.number || "E-01"}${input.projectCode ? ` · ${input.projectCode}` : ""}` },
  ];
}

/** Barvy druhů okruhů ve výkresu (stejné druhy jako vrstvy plátna, tmavší odstíny pro tisk na bílý papír). */
export const LAYER_PRINT_COLORS: Record<CircuitLayer, { color: string; label: string; dashed: boolean }> = {
  sockets: { color: "#ea580c", label: "Zásuvkové okruhy", dashed: false },
  lighting: { color: "#ca8a04", label: "Světelné okruhy", dashed: false },
  appliance: { color: "#9333ea", label: "Samostatné spotřebiče", dashed: false },
  shading: { color: "#16a34a", label: "Žaluziové okruhy (stínění)", dashed: false },
  data: { color: "#2563eb", label: "Datové rozvody (UTP)", dashed: true },
  feeder: { color: "#111827", label: "Přívod podružného rozváděče", dashed: false },
  bus: { color: "#0891b2", label: "Sběrnice 24 V DC / ovládání", dashed: true },
};

export interface LegendCircuitRow {
  layer: CircuitLayer;
  label: string;
  color: string;
  dashed: boolean;
  circuits: number;
}

export interface LegendCableRow {
  cable: string;
  circuits: number;
  meters: number;
}

/** Vysvětlivky okruhů a kabelů – jen to, co je ve výkresu (pořadí druhů podle vrstev plátna). */
export function legendFor(circuits: readonly Pick<DisplayCircuit, "layer" | "cable" | "lengthM" | "inBoard">[], bus: Pick<DisplayCircuit, "cable" | "lengthM"> | null): { layers: LegendCircuitRow[]; cables: LegendCableRow[] } {
  const drawn = circuits.filter((circuit) => !circuit.inBoard);
  const order: CircuitLayer[] = ["sockets", "lighting", "appliance", "shading", "data", "feeder", "bus"];
  const layers = order
    .map((layer) => ({ layer, ...LAYER_PRINT_COLORS[layer], circuits: layer === "bus" ? (bus ? 1 : 0) : drawn.filter((circuit) => circuit.layer === layer).length }))
    .filter((row) => row.circuits > 0);
  const cables = new Map<string, LegendCableRow>();
  for (const circuit of [...drawn, ...(bus ? [bus] : [])]) {
    const row = cables.get(circuit.cable) ?? { cable: circuit.cable, circuits: 0, meters: 0 };
    row.circuits++;
    row.meters = Math.round((row.meters + circuit.lengthM) * 10) / 10;
    cables.set(circuit.cable, row);
  }
  return { layers, cables: [...cables.values()].sort((a, b) => a.cable.localeCompare(b.cable, "cs")) };
}
