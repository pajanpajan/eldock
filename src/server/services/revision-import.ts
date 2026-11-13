import type { PrismaClient } from "@/generated/prisma/client";
import { guessDeviceType, type HlidacMode } from "@/lib/hlidac";
import { measurementSummary, type RevisionRecord } from "@/lib/revision-import";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { geminiConfig, visionJson } from "./geminiPanelService";
import { createRoomDevice } from "./hlidac";
import { recordInspection, renderInspectionReport } from "./inspection";

// Fáze 112: import revizních dat do budovy (Hlídač revizí, Revize) – spotřebiče z tabulky staré zprávy nebo exportu
// měřicího přístroje se založí v místnosti (název, S/N, druh podle názvu, lhůta podle ČSN 33 1600 ed. 2) a s výsledkem
// nebo měřením se zapíše převzatá revize (Riso, RPE, přístroj, datum). Fotka tabulky okruhů / spotřebičů přes Gemini.

export const MAX_IMPORT_ROWS = 300;

export interface ApplianceImportInput {
  floorId: string;
  room: string;
  records: readonly RevisionRecord[];
  mode: HlidacMode;
  inspector: { name: string; license: string };
  /** Program / přístroj zdroje („Metrel ES Manager“) do zprávy. */
  source: string | null;
  saveReport: (svg: string) => Promise<string>;
  now?: Date;
}

/** Evidenční číslo z označení řádku („SP-0401“), jinak automaticky další volné v budově. */
const tagFrom = (designation: string) => (/^[A-Za-z]{1,5}-?\d{1,6}$/.test(designation.trim()) ? designation.trim().toUpperCase() : null);

export async function importRevisionAppliances(prisma: PrismaClient, input: ApplianceImportInput) {
  if (!input.records.length) throw new WorkflowError("VALIDATION", "V importu nejsou žádné spotřebiče.");
  const now = input.now ?? new Date();
  const created: { id: string; tag: string; name: string }[] = [];
  const skipped: { line: number; reason: string }[] = [];
  let inspections = 0;
  for (const record of input.records.slice(0, MAX_IMPORT_ROWS)) {
    const label = (record.name || record.designation).trim().slice(0, 120);
    if (!label) {
      skipped.push({ line: record.line, reason: "řádek bez názvu" });
      continue;
    }
    const device = await createRoomDevice(prisma, { floorId: input.floorId, room: input.room, label, ...guessDeviceType(label), mode: input.mode, serialNumber: record.serialNumber || null, tag: tagFrom(record.designation) });
    created.push({ id: device.id, tag: device.tag, name: device.name });
    if (!record.result && record.risoMOhm === null && record.rpeOhm === null) continue;
    const day = (record.date ?? now).toISOString().slice(0, 10);
    const data = {
      equipmentId: device.id,
      type: "PERIODIC" as const,
      inspectionDate: day,
      reportNumber: `IMP-${day.replace(/-/g, "")}-${device.tag}`,
      inspectorName: input.inspector.name,
      inspectorLicense: input.inspector.license,
      result: record.result === "FAIL" ? ("INCAPABLE" as const) : ("CAPABLE" as const),
      defectsSummary: record.result === "FAIL" ? "Nevyhovuje podle převzaté revizní zprávy – ověřit a odstranit závadu." : null,
      measuringInstrument: (record.instrument || input.source || "dle převzaté zprávy").slice(0, 120),
      protectiveConductorResistance: record.rpeOhm,
      insulationResistance: record.risoMOhm,
      documentsUsed: `Převzato importem (${input.source ?? "tabulka"}), řádek ${record.line}${measurementSummary(record) ? `: ${measurementSummary(record)}` : ""}`.slice(0, 500),
    };
    try {
      const url = await input.saveReport(await renderInspectionReport(prisma, data, now));
      await recordInspection(prisma, { ...data, reportUrl: url }, now);
      inspections++;
    } catch (error) {
      skipped.push({ line: record.line, reason: `revize nezapsána – ${error instanceof Error ? error.message : "chyba"}` });
    }
  }
  return { created, inspections, skipped };
}

const TABLE_PROMPT =
  "Na fotce je tabulka z revizní zprávy elektroinstalace (okruhy rozváděče) nebo seznam revidovaných spotřebičů. Přepiš " +
  "tabulku přesně po řádcích: první řádek = hlavička sloupců (např. Označení, Název, Místnost, Jistič, Kabel, Riso, Zs, RPE, tA, " +
  "S/N, Výsledek, Datum), další řádky = hodnoty buněk jako text (desetinná čárka zůstane, jednotky ponech). Nic nedomýšlej, " +
  "nečitelnou buňku nech prázdnou.";

const TABLE_SCHEMA = {
  type: "OBJECT",
  properties: { rows: { type: "ARRAY", items: { type: "ARRAY", items: { type: "STRING" } } } },
  required: ["rows"],
};

/** Fotka tabulky okruhů / spotřebičů → řádky (Gemini). Bez klíče Gemini chyba s návodem. */
export async function readTablePhoto(image: { bytes: Buffer; mimeType: string }, deps: { vision?: typeof visionJson } = {}): Promise<string[][]> {
  if (!deps.vision && !geminiConfig().apiKey) {
    throw new WorkflowError("VALIDATION", "Přepis fotky tabulky vyžaduje AI (Gemini) – nahrajte raději CSV / XLSX / PDF nebo tabulku opište do šablony.");
  }
  const result = await (deps.vision ?? visionJson)<{ rows?: unknown }>(image, TABLE_PROMPT, TABLE_SCHEMA);
  const rows = Array.isArray(result.rows) ? result.rows : [];
  return rows
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((value) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "")).slice(0, 30))
    .slice(0, 500);
}
