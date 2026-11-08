import type { EquipmentType, InspectionResult, InspectionType } from "@/generated/prisma/enums";

import { EQUIPMENT_TYPE_LABELS, formatDateShort } from "./format";
import type { RuleKind } from "./inspection-rules";

// Náležitosti zprávy o revizi VTZ (NV 190/2022 Sb., § 10 odst. 1 písm. a–o, ověřeno 2026-11-08 – fáze 66).
// Výchozí texty pro dialog zápisu revize a doplnění na serveru (hromadná revize, starší klienti). Čisté funkce.

/** Záznamy, ke kterým patří náležitosti zprávy podle § 10 (ne termovize a vizuální kontrola LPS). */
export const REPORT_TYPES: readonly InspectionType[] = ["INITIAL", "PERIODIC", "EXTRAORDINARY"];

export const isReportType = (type: InspectionType) => REPORT_TYPES.includes(type);

export interface PreviousInspection {
  reportNumber: string;
  inspectionDate: Date;
  result: InspectionResult;
  defects?: readonly { description: string; status: "OPEN" | "RESOLVED" }[];
}

export interface ReportContext {
  equipment: { tag: string; name: string; type: EquipmentType };
  /** „Hala A › 1. NP“ */
  location: string;
  kind: RuleKind;
  type: InspectionType;
  previous?: PreviousInspection | null;
  /** Platná revize dokumentace skutečného provedení v Eldocku. */
  activeRevision?: { version: string; approvedAt?: Date | null; createdAt: Date } | null;
  /** Protokol o určení vnějších vlivů (ComplianceDocument EXTERNAL_INFLUENCES). */
  influencesProtocol?: { documentNumber: string; issuedAt: Date } | null;
  /** Aktivní provizoria na zařízení (záznamy z provozu a údržby). */
  activeTemporaryMods?: number | null;
}

export interface ReportDefaults {
  /** c) vymezení rozsahu revize */
  scopeNote: string;
  /** i) soupis provedených úkonů */
  actsPerformed: string;
  /** h) podklady (bez vyhodnocení – to doplní revizní technik) */
  documentsUsed: string;
  /** m) vyhodnocení záznamů z předchozí revize, provozu a údržby */
  previousEvaluation: string;
}

const shortName = (equipment: ReportContext["equipment"]) => equipment.name.replace(`${equipment.tag} - `, "");

export function defaultScopeNote({ equipment, location, kind }: Pick<ReportContext, "equipment" | "location" | "kind">): string {
  const name = `${equipment.tag} – ${shortName(equipment)}`;
  switch (kind) {
    case "VTZ":
      return `Elektrické zařízení ${name} (${EQUIPMENT_TYPE_LABELS[equipment.type].toLowerCase()}), ${location}, včetně vývodů po připojovací svorky napájených zařízení.`;
    case "LPS":
      return `Ochrana před bleskem ${name}, ${location}: jímací soustava, svody, zkušební svorky, uzemnění a ekvipotenciální pospojování.`;
    case "MACHINE":
      return `Elektrické zařízení stroje ${name}, ${location}, od hlavního vypínače stroje.`;
    case "EMERGENCY":
      return `Nouzové osvětlení ${name}, ${location}: svítidla, zdroj a funkce v nouzovém režimu.`;
    case "WELDER":
    case "APPLIANCE":
      return `${EQUIPMENT_TYPE_LABELS[equipment.type]} ${name}.`;
  }
}

const ACTS: Record<RuleKind, string> = {
  VTZ: "Prohlídka, zkoušení a měření podle ČSN 33 2000-6 ed. 2: spojitost ochranných a pospojovacích vodičů, izolační odpor zkušebním napětím 500 V DC, ochrana samočinným odpojením – impedance smyčky Zsm ≤ ⅔ · Zs,max a zkoušky proudových chráničů podle ČSN EN 61557-6 ed. 2 (0,5 · IΔn, tΔ při 1 · IΔn, IΔ), funkční zkoušky; vyhodnocení.",
  LPS: "Prohlídka jímací soustavy, svodů, spojů a zkušebních svorek, měření přechodových odporů a odporu uzemnění, kontrola ochrany před přepětím (ČSN EN 62305-3); vyhodnocení.",
  MACHINE: "Prohlídka a zkoušky elektrického zařízení stroje podle ČSN EN 60204-1: spojitost ochranného obvodu, izolační odpor, funkční zkoušky ovládání a nouzového zastavení; vyhodnocení.",
  APPLIANCE: "Prohlídka, měření odporu ochranného vodiče, izolačního odporu a unikajícího proudu, funkční zkouška (ČSN 33 1600 ed. 2); vyhodnocení.",
  WELDER: "Prohlídka, měření ochranného vodiče, izolačního odporu, napětí naprázdno a unikajícího proudu, funkční zkouška (ČSN EN 60974-4); vyhodnocení.",
  EMERGENCY: "Zkouška funkce v nouzovém režimu a zkouška plné doby funkce svítidel a zdroje (ČSN EN 50172); vyhodnocení.",
};

export const defaultActs = (kind: RuleKind) => ACTS[kind];

const RESULT_TEXT: Record<InspectionResult, string> = {
  CAPABLE: "zařízení schopno bezpečného provozu",
  CAPABLE_WITH_DEFECTS: "schopno bezpečného provozu s výhradou",
  INCAPABLE: "neschopno bezpečného provozu",
};

/** h) Seznam podkladů z Eldocku; `evaluation` připojí návrh vyhodnocení pro revizního technika (jen v dialogu). */
export function documentsUsedText(context: Pick<ReportContext, "activeRevision" | "influencesProtocol" | "previous">, evaluation = false): string {
  const lines: string[] = [];
  if (context.activeRevision) {
    lines.push(`Dokumentace skutečného provedení – revize ${context.activeRevision.version} ze dne ${formatDateShort(context.activeRevision.approvedAt ?? context.activeRevision.createdAt)} (Eldock).`);
  }
  if (context.influencesProtocol) lines.push(`Protokol o určení vnějších vlivů ${context.influencesProtocol.documentNumber} ze dne ${formatDateShort(context.influencesProtocol.issuedAt)}.`);
  if (context.previous) lines.push(`Předchozí zpráva o revizi ${context.previous.reportNumber} ze dne ${formatDateShort(context.previous.inspectionDate)}.`);
  if (!lines.length) lines.push("Dokumentace skutečného provedení není v Eldocku k dispozici.");
  if (evaluation) lines.push("Vyhodnocení: podklady jsou úplné a odpovídají skutečnému provedení zařízení.");
  return lines.join("\n");
}

/** m) Vyhodnocení předchozí revize (posudek, odstranění závad) a záznamů z provozu (provizoria). */
export function previousEvaluationText(context: Pick<ReportContext, "previous" | "type" | "activeTemporaryMods">): string {
  const { previous } = context;
  const parts: string[] = [];
  if (!previous) {
    parts.push(context.type === "INITIAL" ? "Výchozí revize – předchozí záznamy o revizích nejsou." : "Předchozí zpráva o revizi není v Eldocku k dispozici.");
  } else {
    const defects = previous.defects ?? [];
    const open = defects.filter((defect) => defect.status === "OPEN");
    const defectText = !defects.length ? "bez závad" : open.length ? `neodstraněné závady: ${open.map((defect) => defect.description).join("; ")}` : `zjištěné závady (${defects.length}) jsou odstraněny`;
    parts.push(`Předchozí revize ${previous.reportNumber} ze dne ${formatDateShort(previous.inspectionDate)}: ${RESULT_TEXT[previous.result]}, ${defectText}.`);
  }
  if (typeof context.activeTemporaryMods === "number") {
    parts.push(context.activeTemporaryMods ? `Provoz a údržba: aktivní provizoria v Eldocku: ${context.activeTemporaryMods}.` : "Provoz a údržba: bez aktivních provizorií v Eldocku.");
  }
  return parts.join(" ");
}

/** Výchozí náležitosti zprávy podle § 10 odst. 1 písm. c, h, i, m. */
export function reportDefaults(context: ReportContext, options: { evaluation?: boolean } = {}): ReportDefaults {
  return {
    scopeNote: defaultScopeNote(context),
    actsPerformed: defaultActs(context.kind),
    documentsUsed: documentsUsedText(context, options.evaluation),
    previousEvaluation: previousEvaluationText(context),
  };
}
