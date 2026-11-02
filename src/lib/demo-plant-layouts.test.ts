import { describe, expect, it } from "vitest";

import { EQUIPMENT, FLOORS } from "../../prisma/seed-data";
import { LIGHT_EQUIPMENT } from "../../prisma/seed-appliances";
import { DEMO_DOC_EQUIPMENT } from "../../prisma/seed-demo-docs";
import { DEMO_FLOOR_LAYOUTS, DEMO_NEW_TAGS, DEMO_RENAMES, demoGates, demoGrid, demoNewEquipment, demoPositions, demoZones } from "../../prisma/seed-demo-plant";
import { gateToFloorplan, insideFrame, planFrame, zoneAt, zoneFits } from "./cad-grid";
import { deviceBaseName, roomInventoryGroups } from "./equipment-categories";

// Vzorové závody (fáze 40): rozvržení pater v metrech pokrývá celou plochu, vrata leží na obvodu,
// každé zařízení má polohu a počty vybavení odpovídají zadání.

const SEED_TAGS = new Map<string, { name: string; type: string }>([
  ...[...EQUIPMENT, ...LIGHT_EQUIPMENT].map((item) => [item.tag, { name: DEMO_RENAMES[item.tag]?.to ?? item.name, type: item.type }] as const),
  ...DEMO_DOC_EQUIPMENT.map((item) => [item.tag, { name: item.name, type: item.type }] as const),
  ["PP-0050", { name: DEMO_RENAMES["PP-0050"].to, type: "EXTENSION_CORD" }],
  ["SP-0330", { name: DEMO_RENAMES["SP-0330"].to, type: "APPLIANCE" }],
]);
const deviceOf = (tag: string) => {
  const seeded = SEED_TAGS.get(tag);
  if (seeded) return { name: deviceBaseName(seeded.name, tag), type: seeded.type };
  const def = demoNewEquipment(tag);
  return def ? { name: def.name, type: def.type } : null;
};

/** Počty kusů na patrech podle obecného názvu přístroje. */
function counts(floorIds: string[]) {
  const result: Record<string, number> = {};
  for (const layout of DEMO_FLOOR_LAYOUTS.filter((entry) => floorIds.includes(entry.floorId))) {
    for (const tags of Object.values(layout.rooms)) for (const tag of tags) result[deviceOf(tag)!.name] = (result[deviceOf(tag)!.name] ?? 0) + 1;
  }
  return result;
}

describe("vzorové závody v metrové architektuře Studia", () => {
  it("každé patro seedu má rozvržení; místnosti bez překryvů pokrývají celou plochu patra", () => {
    expect(DEMO_FLOOR_LAYOUTS.map((layout) => layout.floorId).sort()).toEqual(FLOORS.map((floor) => floor.id).sort());
    for (const layout of DEMO_FLOOR_LAYOUTS) {
      const frame = planFrame(demoGrid(layout));
      expect(frame.widthM, layout.floorId).toBe(layout.widthM);
      const zones = demoZones(layout);
      for (const zone of zones) expect(zoneFits(zone, frame), `${layout.floorId}: ${zone.name}`).toBe(true);
      const area = zones.reduce((sum, zone) => sum + zone.w * zone.h, 0);
      expect(area, `${layout.floorId}: plocha místností`).toBe(layout.widthM * layout.depthM);
      // bez překryvů: každý metr čtvereční patří právě jedné místnosti
      for (let x = 0.5; x < layout.widthM; x += 1) {
        for (let y = 0.5; y < layout.depthM; y += 1) {
          expect(zones.filter((zone) => x > zone.x && x < zone.x + zone.w && y > zone.y && y < zone.y + zone.h).length, `${layout.floorId} @ ${x},${y}`).toBe(1);
        }
      }
      expect(new Set(zones.map((zone) => zone.key)).size).toBe(zones.length);
      for (const gate of demoGates(layout)) expect(gateToFloorplan(gate, frame), `${layout.floorId}: ${gate.label}`).not.toBeNull();
    }
    expect(new Set(DEMO_FLOOR_LAYOUTS.flatMap((layout) => demoZones(layout).map((zone) => zone.kind))).size).toBe(7);
  });

  it("každé zařízení má polohu uvnitř patra, spotřebiče leží ve své místnosti a pevné body se neopakují", () => {
    const placed = new Map<string, string>();
    for (const layout of DEMO_FLOOR_LAYOUTS) {
      const frame = planFrame(demoGrid(layout));
      const zones = demoZones(layout);
      const spots = new Set<string>();
      for (const [tag, { pos, room }] of demoPositions(layout)) {
        expect(placed.has(tag), `${tag} je na dvou místech`).toBe(false);
        placed.set(tag, layout.floorId);
        expect(insideFrame(frame, pos), `${tag}`).toBe(true);
        expect(deviceOf(tag), `${tag}: neznámé zařízení`).not.toBeNull();
        if (room) expect(zoneAt(zones, pos)?.name, tag).toBe(room);
        else {
          const spot = `${pos.x}:${pos.y}`;
          expect(spots.has(spot), `${tag}: obsazený bod`).toBe(false);
          spots.add(spot);
        }
      }
      // pevná zařízení seedu na patře mají všechna polohu
      const floorKey = FLOORS.find((floor) => floor.id === layout.floorId)!.key;
      for (const item of [...EQUIPMENT, ...LIGHT_EQUIPMENT].filter((entry) => entry.floor === floorKey)) expect(placed.get(item.tag), item.tag).toBe(layout.floorId);
    }
    for (const tag of DEMO_NEW_TAGS) expect(placed.has(tag), `${tag} bez polohy`).toBe(true);
  });

  it("vybavení odpovídá zadání (Energetika, Hala A, Hala B, Sklad, Administrativa)", () => {
    expect(counts(["floor-jbc-e-1np"])).toMatchObject({ Kávovar: 2, Chladnička: 1, "Mikrovlnná trouba": 1, "PC sestava": 3, "Prodlužovací přívod": 4 });
    expect(counts(["floor-jbc-a-1np"])).toMatchObject({ "Úhlová bruska": 4, Vrtačka: 3, Svářečka: 2, "Průmyslový vysavač": 2, "Prodlužovací buben": 6, "PC sestava": 2 });
    expect(counts(["floor-jbc-b-1np"])).toMatchObject({ "Elektrický šroubovák": 5, "Horkovzdušná pistole": 2, "Prodlužovací přívod": 4, "Průmyslový vysavač": 1 });
    expect(counts(["floor-jbc-s-1np"])).toMatchObject({ "PC sestava": 3, "Horkovzdušná pistole": 2, "Prodlužovací přívod": 4 });
    expect(counts(["floor-jbc-k-1np", "floor-jbc-k-2np"])).toMatchObject({ "PC sestava": 12, Tiskárna: 3, Kávovar: 2, "Rychlovarná konvice": 2, Chladnička: 2, "Prodlužovací přívod": 10 });
    const halaA = DEMO_FLOOR_LAYOUTS.find((layout) => layout.floorId === "floor-jbc-a-1np")!;
    expect(Object.keys(halaA.grid)).toEqual(expect.arrayContaining(["R-LIS-01", "R-CNC-04", "LIS-01", "LIS-02", "CNC-01", "CNC-02", "CNC-03", "CNC-04", "ROB-01", "ROB-02", "ROB-03", "NO-A"]));
    // seskupené štítky: obecné názvy → „☕ 2× Kávovar“ v kuchyňce Energetiky
    const kitchen = DEMO_FLOOR_LAYOUTS.find((layout) => layout.floorId === "floor-jbc-e-1np")!.rooms.Kuchyňka.map((tag) => ({ tag, ...deviceOf(tag)! })) as { tag: string; name: string; type: "APPLIANCE" }[];
    expect(roomInventoryGroups(kitchen).map((group) => `${group.emoji} ${group.count}× ${group.label}`)).toEqual(
      expect.arrayContaining(["☕ 2× Kávovar", "🧊 1× Chladnička", "🍲 1× Mikrovlnná trouba", "🫖 1× Rychlovarná konvice", "🔌 2× Prodlužovací přívod"]),
    );
  });
});
