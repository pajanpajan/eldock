// Fáze 111: 📷 AI čtečka výrobního štítku – přečtení údajů z fotky (Gemini, bez klíče deterministický demo režim
// z přepsaného textu), trvalé uložení fotky štítku jako druhé fotky zařízení, potvrzení údajů do karty zařízení
// a lhůta příští revize podle třídy ochrany a skupiny používání (ČSN 33 1600 ed. 2). Záměrně bez `server-only` (testy).

import type { PrismaClient } from "@/generated/prisma/client";
import { inspectionRuleFor, ruleInputFrom, RULE_FIELDS, BUILDING_RULE_FIELDS } from "@/lib/inspection-rules";
import { EMPTY_READING, normalizeReading, parseNameplateText, readingToEquipment, type NameplateReading } from "@/lib/nameplate";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { geminiConfig, visionJson, type AiMode } from "./geminiPanelService";

export const NAMEPLATE_PROMPT = [
  "Jsi čtečka výrobních štítků elektrických spotřebičů, ručního nářadí, IT techniky, strojů a rozváděčů pro revize podle ČSN 33 1600 ed. 2.",
  "Na fotografii je výrobní (typový) štítek. Přečti přesně, co je na štítku napsané – nic nedomýšlej a nevymýšlej.",
  "Vrať: rawText (celý přečtený text štítku po řádcích), name (název a druh zařízení česky, např. „Monitor Dell UltraSharp 27″“, „Prodlužovací přívod 5 zásuvek 3 m“, „Úhlová bruska“),",
  "manufacturer (výrobce / značka), model (typové označení), serialNumber (výrobní číslo S/N přesně podle štítku), voltage (napětí a kmitočet, např. „230 V AC / 50 Hz“),",
  "powerW (příkon ve W), currentA (proud v A), ipRating (krytí, např. IP20), protectionClass (I = ochranný vodič / symbol uzemnění, II = dvojitá izolace / symbol dvojitého čtverce, III = SELV), year (rok výroby).",
  "Údaj, který na štítku není nebo není čitelný, vynech (prázdný řetězec / 0).",
].join(" ");

export const NAMEPLATE_SCHEMA = {
  type: "OBJECT",
  properties: {
    rawText: { type: "STRING" },
    name: { type: "STRING" },
    manufacturer: { type: "STRING" },
    model: { type: "STRING" },
    serialNumber: { type: "STRING" },
    voltage: { type: "STRING" },
    powerW: { type: "NUMBER" },
    currentA: { type: "NUMBER" },
    ipRating: { type: "STRING" },
    protectionClass: { type: "STRING", enum: ["I", "II", "III", ""] },
    year: { type: "NUMBER" },
  },
  required: ["rawText"],
};

export interface NameplateResult {
  mode: AiMode;
  reading: NameplateReading;
  rawText: string;
  warning?: string;
}

const merge = (primary: NameplateReading, fallback: NameplateReading): NameplateReading =>
  Object.fromEntries((Object.keys(EMPTY_READING) as (keyof NameplateReading)[]).map((key) => [key, primary[key] ?? fallback[key]])) as unknown as NameplateReading;

/**
 * Údaje z fotky štítku: Gemini (je-li GEMINI_API_KEY), doplněné extraktorem z textu, který uživatel přepsal / zkopíroval
 * (např. „Live Text“ z mobilu). Bez klíče nebo při chybě AI demo režim – jen text, služba nikdy nespadne.
 */
export async function readNameplate(input: { image: { bytes: Buffer; mimeType: string } | null; text?: string | null }, deps: { vision?: typeof visionJson } = {}): Promise<NameplateResult> {
  const text = (input.text ?? "").trim().slice(0, 4000);
  const hint = text ? parseNameplateText(text) : { ...EMPTY_READING };
  const vision = deps.vision ?? visionJson;
  const ai = deps.vision ? true : Boolean(geminiConfig().apiKey);
  if (ai && input.image) {
    try {
      const raw = await vision<Record<string, unknown>>(input.image, NAMEPLATE_PROMPT, NAMEPLATE_SCHEMA);
      const reading = merge(normalizeReading(raw), hint);
      return { mode: "GEMINI", reading, rawText: typeof raw.rawText === "string" ? raw.rawText.slice(0, 4000) : text };
    } catch (error) {
      console.warn("[nameplate] Gemini štítek nepřečetl", error);
      return { mode: "DEMO", reading: hint, rawText: text, warning: "AI čtečka teď neodpověděla – fotka štítku je uložená, údaje zkontrolujte a doplňte ručně." };
    }
  }
  return { mode: "DEMO", reading: hint, rawText: text, warning: text ? undefined : "Demo AI režim (bez Gemini) – fotka štítku je uložená, údaje opište ze štítku nebo vložte jeho text." };
}

/** Fotka výrobního štítku trvale ke kartě zařízení (druhá fotka) s přečtenými údaji. */
export async function saveNameplatePhoto(prisma: PrismaClient, equipmentId: string, input: { photoUrl: string; result: NameplateResult }, now = new Date()) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { id: true } });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  return prisma.equipment.update({
    where: { id: equipmentId },
    data: { nameplatePhotoUrl: input.photoUrl, nameplateDataJson: JSON.stringify({ ...input.result.reading, rawText: input.result.rawText, mode: input.result.mode }), nameplateReadAt: now },
    select: { id: true, nameplatePhotoUrl: true, nameplateReadAt: true },
  });
}

export interface NameplateConfirm extends NameplateReading {
  /** Nový název zařízení (bez tagu) – prázdný = beze změny. */
  title?: string | null;
  /** Spotřebič držený v ruce (nářadí, prodlužovací přívody). */
  handHeld?: boolean | null;
}

/**
 * Potvrzené údaje ze štítku do karty zařízení (výrobce, model, S/N, napětí, proud / příkon, krytí, třída ochrany,
 * skupina používání, rok) a nová lhůta revize podle pravidla zařízení (ČSN 33 1600 ed. 2 u spotřebičů a nářadí).
 */
export async function applyNameplate(prisma: PrismaClient, equipmentId: string, input: NameplateConfirm) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { id: true, tag: true, name: true, ...RULE_FIELDS, floor: { select: { building: { select: BUILDING_RULE_FIELDS } } } } });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  const data = readingToEquipment(input);
  const handHeld = typeof input.handHeld === "boolean" ? input.handHeld : equipment.handHeld;
  const rule = inspectionRuleFor(ruleInputFrom({ ...equipment, ...data, handHeld }, equipment.floor.building));
  const title = input.title?.trim();
  return prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      ...data,
      handHeld,
      inspectionIntervalMonths: rule.months,
      ...(title ? { name: `${equipment.tag} - ${title}`.slice(0, 160) } : {}),
    },
    select: { id: true, tag: true, name: true, manufacturer: true, model: true, serialNumber: true, protectionClass: true, usageGroup: true, inspectionIntervalMonths: true },
  });
}
