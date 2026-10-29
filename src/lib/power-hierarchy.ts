import type { EquipmentType } from "@/generated/prisma/enums";

import { isLightCard, isPortable } from "./inspection-rules";

// Pravidla hierarchie napájení pro osazování zařízení ve Studiu:
// 1. trafo nebo hlavní rozváděč může být kořenový zdroj (úroveň 0/1),
// 2. podružný rozváděč vyžaduje nadřazený rozváděč (nebo trafo) a pole / jistič,
// 3. výrobní linky a stroje vyžadují rozváděč (přednostně na stejném patře) a vývod,
// 4. drobné vybavení (spotřebiče, nářadí, svářečky, přívody) se váže k místnosti
//    a k zásuvkovému okruhu rozváděče.

export type PowerRole = "SOURCE" | "SUBBOARD" | "LOAD" | "OUTLET";

export interface PowerSource {
  id: string;
  tag: string;
  type: EquipmentType;
  floorId: string;
}

export function powerRole(type: EquipmentType, isRoot = false): PowerRole {
  if (type === "TRANSFORMER") return "SOURCE";
  if (type === "SWITCHBOARD") return isRoot ? "SOURCE" : "SUBBOARD";
  if (isPortable(type)) return "OUTLET";
  return "LOAD";
}

export const POWER_ROLE_HINTS: Record<PowerRole, string> = {
  SOURCE: "Kořenový zdroj – trafostanice nebo hlavní rozváděč (napájení není povinné).",
  SUBBOARD: "Podružný rozváděč – vyberte nadřazený rozváděč a pole / jistič.",
  LOAD: "Stroj / linka – vyberte rozváděč, ze kterého je napájena, a vývod.",
  OUTLET: "Drobné vybavení – vyberte místnost a zásuvkový okruh rozváděče.",
};

/** Kdo může napájet daný typ: rozváděče (a pro rozváděč i trafo); stejné patro první. */
export function allowedParents<T extends PowerSource>(type: EquipmentType, sources: readonly T[], floorId: string, selfId?: string): T[] {
  const kinds: EquipmentType[] = type === "SWITCHBOARD" ? ["TRANSFORMER", "SWITCHBOARD"] : type === "TRANSFORMER" ? [] : ["SWITCHBOARD"];
  return sources
    .filter((source) => source.id !== selfId && kinds.includes(source.type))
    .sort((a, b) => Number(b.floorId === floorId) - Number(a.floorId === floorId) || a.tag.localeCompare(b.tag, "cs"));
}

/** Návrh označení vývodu podle typu a počtu už napájených zařízení z rozváděče. */
export function suggestCircuit(type: EquipmentType, parent: Pick<PowerSource, "type">, siblings: number): string {
  const n = siblings + 1;
  if (parent.type === "TRANSFORMER") return `Vývod nn / Q${n - 1}`;
  if (type === "SWITCHBOARD") return `Pole ${Math.ceil(n / 2)} / QF${n}`;
  if (isPortable(type)) return `Zásuvkový okruh ZS${n}`;
  if (isLightCard(type)) return `Okruh FE${n}`;
  return `Vývod FA${n}`;
}

export interface PlacementInput {
  type: EquipmentType;
  tag: string;
  parentId: string | null;
  circuit: string | null;
  zone: string | null;
  /** Rozváděč bez nadřazeného = hlavní rozváděč (kořen). */
  isRoot?: boolean;
}

/** Ověří osazení podle pravidel hierarchie; vrací české chyby (prázdné = v pořádku). */
export function validatePlacement(input: PlacementInput, sources: readonly PowerSource[]): string[] {
  const errors: string[] = [];
  if (!/^[A-Z0-9][A-Z0-9.-]{0,23}$/i.test(input.tag.trim())) errors.push("Zadejte označení (tag), např. R-ML-02.");
  const role = powerRole(input.type, input.isRoot);
  const parent = input.parentId ? sources.find((source) => source.id === input.parentId) : null;
  if (input.parentId && !parent) errors.push("Nadřazený rozváděč neexistuje.");
  if (role !== "SOURCE" && !input.parentId) {
    errors.push(role === "SUBBOARD" ? "Podružný rozváděč musí mít nadřazený rozváděč." : "Zařízení musí mít napájecí rozváděč.");
  }
  if (parent && !allowedParents(input.type, [parent], "").length) errors.push(`${parent.tag} nemůže napájet tento typ zařízení.`);
  if (input.parentId && !input.circuit?.trim()) errors.push("Doplňte pole / jistič / okruh napájení.");
  if (role === "OUTLET" && !input.zone?.trim()) errors.push("Drobné vybavení musí mít místnost / zónu.");
  if (input.type === "TRANSFORMER" && input.parentId) errors.push("Trafostanice je kořenový zdroj – napájení se nezadává.");
  return errors;
}
