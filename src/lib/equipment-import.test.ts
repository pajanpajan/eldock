import { describe, expect, it } from "vitest";

import { IMPORT_TEMPLATE_CSV, categorize, matchFloor, parseCzechDate, parseDelimited, parseImport, type FloorOption } from "./equipment-import";

const NOW = new Date("2026-10-30T10:00:00Z");

const floor = (id: string, buildingName: string, buildingCode: string, floorName: string, floorCode: string, shortName: string | null = null): FloorOption => ({
  id,
  plantName: "Závod Jablonec",
  buildingName,
  buildingCode,
  buildingShortName: shortName,
  floorName,
  floorCode,
  level: 0,
});

const FLOORS = [
  floor("a1", "Hala A - Lisovna", "A", "1. NP - Hlavní výroba", "1NP", "Lisovna"),
  floor("a2", "Hala A - Lisovna", "A", "2. NP - Vzduchotechnika", "2NP", "Lisovna"),
  floor("b1", "Hala B - Montáž", "B", "1. NP - Montážní linky", "1NP", "Montáž"),
  floor("k1", "Administrativa", "K", "1. NP", "1NP"),
  floor("k2", "Administrativa", "K", "2. NP - Kanceláře", "2NP"),
];

describe("import CSV", () => {
  it("parsuje středníky, tabulátory (Excel) i uvozovky", () => {
    expect(parseDelimited('a;"b; c";"d ""x"""\n1;2;3')).toEqual([
      ["a", "b; c", 'd "x"'],
      ["1", "2", "3"],
    ]);
    expect(parseDelimited("A\tB\r\nx\ty\r\n")).toEqual([
      ["A", "B"],
      ["x", "y"],
    ]);
    expect(parseDelimited("a,b,c\n1,2,3")[1]).toEqual(["1", "2", "3"]);
  });

  it("vzorová šablona se načte bez chyb", () => {
    const rows = parseImport(IMPORT_TEMPLATE_CSV, NOW);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.errors.length === 0)).toBe(true);
    expect(rows.map((row) => row.type)).toEqual(["APPLIANCE", "APPLIANCE", "POWER_TOOL", "EXTENSION_CORD", "SWITCHBOARD"]);
    expect(rows[0].lastInspection?.toISOString().slice(0, 10)).toBe("2026-03-12");
  });

  it("hlásí chybějící údaje, neznámou kategorii a špatné datum", () => {
    const [row] = parseImport("Název;Evidenční číslo;Kategorie;Interval;Poslední revize;Lokace\n;X1;Lampa;0;31.02.2026;", NOW);
    expect(row.errors).toEqual([
      "Chybí název.",
      "Neznámá kategorie „Lampa“ (VTZ / Spotřebič / Nářadí).",
      "Neplatný interval „0“ (1–120 měsíců).",
      "Neplatné datum revize „31.02.2026“.",
    ]);
  });

  it("bez hlavičky platí pořadí sloupců šablony", () => {
    const [row] = parseImport("Vrtačka;nr-9;nářadí;6;1. 9. 2026;Hala A", NOW);
    expect(row).toMatchObject({ name: "Vrtačka", tag: "NR-9", type: "POWER_TOOL", intervalMonths: 6, location: "Hala A" });
  });

  it("kategorie podle názvu rozliší stroj, svářečku a přívod", () => {
    expect(categorize("VTZ", "Pohon vrat M2")?.type).toBe("MACHINE");
    expect(categorize("Nářadí", "Svářečka MIG")?.type).toBe("WELDER");
    expect(categorize("spotřebič", "Prodlužovací buben")?.type).toBe("EXTENSION_CORD");
  });

  it("data v českém i ISO formátu", () => {
    expect(parseCzechDate("2. 9. 2026")?.toISOString().slice(0, 10)).toBe("2026-09-02");
    expect(parseCzechDate("2026-09-02")?.toISOString().slice(0, 10)).toBe("2026-09-02");
    expect(parseCzechDate("9/2/2026")).toBeNull();
  });

  it("spáruje textovou lokaci s budovou a patrem", () => {
    expect(matchFloor("Hala A 1. NP dílna údržby", FLOORS)).toBe("a1");
    expect(matchFloor("Lisovna 2NP", FLOORS)).toBe("a2");
    expect(matchFloor("Administrativa 2. NP kuchyňka", FLOORS)).toBe("k2");
    expect(matchFloor("Montáž", FLOORS)).toBe("b1");
    expect(matchFloor("Hala A", FLOORS)).toBeNull();
    expect(matchFloor("Sklad Liberec", FLOORS)).toBeNull();
  });
});
