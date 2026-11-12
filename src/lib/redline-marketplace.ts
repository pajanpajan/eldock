import { z } from "zod";

// Fáze 103: předání Červenky (zákresu změny z haly) k čistému překreslení – cesta A firemní (interní nebo smluvní)
// projektant závodu, cesta B ELDOCK Pool externích projektantů (burza úkolů „kdo první přijme“). Čisté funkce.

export const REDLINE_MODES = ["INTERNAL_DESIGNER", "POOL"] as const;
export type RedlineMode = (typeof REDLINE_MODES)[number];

export const REDLINE_STATUSES = ["OPEN", "CLAIMED", "SUBMITTED", "DONE", "CANCELLED"] as const;
export type RedlineStatus = (typeof REDLINE_STATUSES)[number];

/** Stav úkolu podle cesty (firemní projektant má vlastní popisky průběhu). */
export function redlineStatusLabel(mode: string, status: string, claimedBy?: string | null): string {
  if (mode === "INTERNAL_DESIGNER") {
    return status === "OPEN" ? "Čeká na překreslení" : status === "CLAIMED" ? "Překresluje se" : status === "SUBMITTED" ? "Nahrána nová verze – čeká na schválení údržbou" : status === "DONE" ? "Hotovo – nahrána nová verze schématu" : "Zrušeno";
  }
  return status === "OPEN" ? "🟢 VOLNÝ ÚKOL K PŘIJETÍ" : status === "CLAIMED" ? `🔒 Přijato projektantem ${claimedBy ?? ""}`.trim() : status === "SUBMITTED" ? "Odevzdáno – čeká na schválení údržbou" : status === "DONE" ? "✅ Zapracováno do dokumentace" : "Zrušeno";
}

export const CAD_FORMATS = [
  { id: "PDF", label: "PDF (překreslení do čistého PDF)" },
  { id: "PC_SCHEMATIC", label: "PC|SCHEMATIC" },
  { id: "EPLAN", label: "EPLAN Electric P8" },
  { id: "DWG", label: "AutoCAD DWG / DXF" },
] as const;
export type CadFormat = (typeof CAD_FORMATS)[number]["id"];
export const cadFormatLabel = (id: string) => CAD_FORMATS.find((format) => format.id === id)?.label ?? id;

/** Orientační odměna za úkol podle rozsahu (Kč bez DPH) – údržbář ji může upravit. */
export const REWARD_PRESETS = [
  { sheets: 1, label: "Překreslení 1 listu schématu", rewardCzk: 800 },
  { sheets: 2, label: "Překreslení 2–3 listů", rewardCzk: 1500 },
  { sheets: 4, label: "Rozsáhlejší změna (4+ listů)", rewardCzk: 3000 },
] as const;

export const routeSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("INTERNAL_DESIGNER"),
    changeRequestId: z.string().min(1).max(64),
    description: z.string().trim().max(1000).optional(),
    dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({
    mode: z.literal("POOL"),
    changeRequestId: z.string().min(1).max(64),
    format: z.enum(["PDF", "PC_SCHEMATIC", "EPLAN", "DWG"]),
    sheets: z.coerce.number().int().min(1).max(100),
    rewardCzk: z.coerce.number().int().min(100).max(100_000),
    description: z.string().trim().max(1000).optional(),
    dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
]);
export type RouteInput = z.input<typeof routeSchema>;

/**
 * Název úkolu v poolu: nepřihlášeným (a u úkolu přijatého jiným projektantem) jen druh zařízení a označení, přihlášenému
 * schválenému projektantovi i název zařízení a firma závodu.
 */
export function anonymizedTitle(input: { equipmentType: string; equipmentName: string; tag: string; company?: string | null }, revealed: boolean): string {
  if (revealed) return `${input.tag} · ${input.equipmentName}${input.company ? ` – ${input.company}` : ""}`;
  const kind = input.equipmentType === "SWITCHBOARD" ? "Rozváděč" : input.equipmentType === "MACHINE" ? "Stroj" : "Zařízení";
  return `${kind} ${input.tag} (firma po přihlášení projektanta)`;
}

/** Přístupový kód projektanta do portálu (12 znaků bez zaměnitelných znaků). */
export function accessCode(random: (size: number) => Uint8Array): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...random(12)].map((byte) => alphabet[byte % alphabet.length]).join("").replace(/(.{4})(?=.)/g, "$1-");
}

/**
 * Vrstva Červenky jako samostatné SVG do balíčku podkladů: tahy pera / zvýrazňovače nad listem (souřadnice 0–1 vůči
 * listu schématu, list A3 na šířku), s rámečkem listu a popiskem – projektant ji položí přes původní schéma.
 */
export function markupSvg(markup: { sheet: number; strokes: { tool: string; color: string; width: number; points: [number, number, number][] }[] }, caption: string): string {
  const width = 1414;
  const height = 1000;
  const paths = markup.strokes
    .map((stroke) => {
      const points = stroke.points.map(([x, y]) => `${(x * width).toFixed(1)},${(y * height).toFixed(1)}`).join(" ");
      const strokeWidth = Math.max(1, stroke.width * width).toFixed(1);
      const color = /^#[0-9a-fA-F]{3,8}$/.test(stroke.color) ? stroke.color : "#dc2626";
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${stroke.tool === "highlighter" ? ' stroke-opacity="0.35"' : ""}/>`;
    })
    .join("");
  const label = caption.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="#9ca3af" stroke-dasharray="8 6"/><text x="16" y="${height - 16}" font-family="Arial, sans-serif" font-size="18" fill="#6b7280">Červenka – list ${markup.sheet} · ${label} (vrstva zákresu údržby, souřadnice vůči listu schématu)</text>${paths}</svg>`;
}
