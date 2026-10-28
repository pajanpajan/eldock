import type { DefectSeverity, DefectStatus, InspectionResult } from "@/generated/prisma/enums";

import { daysUntil } from "./inspection";

// Revizní závady (lhůty odstranění podle závažnosti) a vyhodnocení termovize (ΔT).
// Čisté funkce – seed, služby i UI.

/** Lhůta odstranění od data revize: kritická ihned, závažná do 30 dnů, drobná do 90 dnů. */
export const DEFECT_DEADLINE_DAYS: Record<DefectSeverity, number> = { CRITICAL: 0, MAJOR: 30, MINOR: 90 };

export function defectDeadline(inspectionDate: Date, severity: DefectSeverity): Date {
  const deadline = new Date(inspectionDate);
  deadline.setUTCDate(deadline.getUTCDate() + DEFECT_DEADLINE_DAYS[severity]);
  return deadline;
}

/** Výchozí závažnost závady podle posudku revize. */
export const severityForResult = (result: InspectionResult): DefectSeverity => (result === "INCAPABLE" ? "CRITICAL" : "MAJOR");

export type DefectState = "OPEN" | "OVERDUE" | "RESOLVED";

export function defectState(defect: { status: DefectStatus; deadline: Date }, now: Date | number = new Date()): { state: DefectState; daysLeft: number } {
  const daysLeft = daysUntil(defect.deadline, now);
  if (defect.status === "RESOLVED") return { state: "RESOLVED", daysLeft };
  return { state: daysLeft < 0 ? "OVERDUE" : "OPEN", daysLeft };
}

/** Pořadí v přehledech: po lhůtě, pak nejdřív končící, vyřešené na konec. */
export function compareDefects(a: { status: DefectStatus; deadline: Date }, b: { status: DefectStatus; deadline: Date }): number {
  const rank = (defect: { status: DefectStatus }) => (defect.status === "RESOLVED" ? 1 : 0);
  return rank(a) - rank(b) || a.deadline.getTime() - b.deadline.getTime();
}

/** Rozdělí souhrn závad z revizní zprávy na jednotlivé položky (věty / středníky / odrážky). */
export function splitDefects(summary: string | null | undefined): string[] {
  return (summary ?? "")
    .split(/(?:[;\n]|\.\s+)/)
    .map((part) => part.replace(/^[-•\s]+/, "").replace(/\.$/, "").trim())
    .filter((part) => part.length >= 3);
}

// ---------------------------------------------------------------------------
//  Termovize – ΔT vůči okolí (zjednodušené třídy dle běžné praxe termodiagnostiky)
// ---------------------------------------------------------------------------

export type ThermalLevel = "OK" | "WATCH" | "PLAN" | "CRITICAL";

export function thermalLevel(deltaTempC: number): ThermalLevel {
  if (deltaTempC <= 10) return "OK";
  if (deltaTempC <= 20) return "WATCH";
  if (deltaTempC <= 40) return "PLAN";
  return "CRITICAL";
}
