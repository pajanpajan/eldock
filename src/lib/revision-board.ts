// Fáze 112: okruhy ze staré revizní zprávy / exportu měřicího přístroje → okruhy generátoru rozváděče (stejná cesta
// jako rozváděč ze soupisu místností): jistič a charakteristika z protokolu, kabel z protokolu nebo podle jištění,
// světla / zásuvky / spotřebiče podle názvu. Proudové chrániče a pojistky z protokolu generátor nepřebírá – skupiny pod
// chrániči navrhne znovu podle ČSN 33 2130 ed. 4 (jističochránič zůstane jističochráničem). Čisté funkce.

import type { Circuit, CircuitKind, CircuitPlan } from "@/engine/floorplan-bridge";

import { parseProtection, type RevisionRecord } from "./revision-import";

const strip = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Průřez z textu kabelu („CYKY-J 3×2,5“, „3x1.5“, „5C4“) [mm²]. */
export function crossSectionOf(cable: string | null | undefined): number | null {
  const match = /(\d)\s*[x×c*]\s*(\d{1,2}(?:[.,]\d)?)/i.exec(cable ?? "");
  if (!match) return null;
  const value = Number(match[2].replace(",", "."));
  return Number.isFinite(value) && value > 0 && value <= 240 ? value : null;
}

const sectionFor = (ratedA: number) => (ratedA <= 10 ? 1.5 : ratedA <= 16 ? 2.5 : ratedA <= 25 ? 4 : ratedA <= 32 ? 6 : 10);
const cableText = (phases: 1 | 3, mm2: number) => `CYKY-J ${phases === 3 ? 5 : 3}x${String(mm2).replace(".", ",")}`;

/** Druh okruhu podle názvu (světla, zásuvky, žaluzie, jinak samostatný spotřebič / 3f spotřebič). */
export function circuitKindOf(label: string, phases: 1 | 3): CircuitKind {
  const text = strip(label);
  if (/svetl|osvetl|lustr|light|led pas/.test(text)) return "lighting";
  if (/zaluz|rolet|stineni|blind/.test(text)) return "blinds";
  if (/zasuv|socket|gniazd/.test(text)) return "sockets";
  return phases === 3 ? "cooktop" : "dedicated";
}

/** Okruhy z revizních záznamů (jen jističe a jističochrániče; chrániče, pojistky a řádky bez jištění se přeskočí). */
export function circuitsFromRevision(records: readonly RevisionRecord[]): Circuit[] {
  const circuits: Circuit[] = [];
  for (const record of records) {
    const protection = parseProtection(record.protection);
    if (protection.device !== "MCB" && protection.device !== "RCBO") continue;
    const phases: 1 | 3 = protection.poles === "3P" ? 3 : 1;
    const ratedA = protection.ratedA ?? 16;
    const curve = protection.curve === "C" || protection.curve === "D" ? "C" : "B";
    const mm2 = crossSectionOf(record.cable) ?? sectionFor(ratedA);
    const label = [record.name || `Okruh ${record.designation}`, record.location && !(record.name ?? "").includes(record.location) ? record.location : null].filter(Boolean).join(" – ").slice(0, 80);
    const kind = circuitKindOf(label, phases);
    const designW = Math.round(ratedA * (phases === 3 ? Math.sqrt(3) * 400 : 230) * 0.5);
    const rcbo = protection.device === "RCBO" && phases === 1;
    circuits.push({
      id: `rev-${record.line}`,
      label,
      kind,
      phases,
      protection: rcbo ? { device: "RCBO", poles: "1P+N", curve, ratedA, rcd: { type: "A", sensitivityMa: protection.sensitivityMa ?? 30 } } : { device: "MCB", poles: phases === 3 ? "3P" : "1P", curve, ratedA },
      cable: record.cable || cableText(phases, mm2),
      crossSectionMm2: mm2,
      rooms: record.location ? [record.location] : [],
      nodeIds: [],
      outlets: kind === "sockets" ? 2 : 1,
      installedW: designW * 2,
      designW,
      lengthMm: 0,
      voltageDropPct: 0,
      rcd: rcbo ? "own" : "A30",
      izA: ratedA,
      loop: { zsOhm: record.zsOhm ?? 0, zsMaxOhm: 0, iaA: 0, ikMinA: 0, ok: true },
    });
  }
  return circuits;
}

/** Plán okruhů pro generátor rozváděče (bez půdorysu – žádné koncové prvky ani ovládání světel). */
export function revisionCircuitPlan(records: readonly RevisionRecord[]): CircuitPlan {
  const circuits = circuitsFromRevision(records);
  const skipped = records.length - circuits.length;
  return {
    circuits,
    bom: [],
    switching: [],
    io: { di: 0, do: 0, impulseRelays: 0, treeDevices: 0 },
    warnings: skipped > 0 ? [`${skipped} řádků bez jističe (chrániče, pojistky, spotřebiče) – chrániče navrhne rozváděč podle ČSN 33 2130 ed. 4.`] : [],
  };
}
