// Ukázková data fáze 116 pro Závod Jablonec (přírůstkově, jednorázově podle značky `demo.phase116`):
// sklad náhradních dílů podle MPN (souhrnný nákupní report: LC1D25BD skladem 1 ks), upřesnění míst zařízení pro
// pochůzku revizního technika, odpovědné osoby LOTO u hlavního rozváděče a oprava filtrační rohože ventilátoru -FAN1
// (Rittal SK 3238.200 je výstupní filtr, ne rohož – objednací číslo náhradní rohože doplní údržba).
import type { PrismaClient } from "../src/generated/prisma/client";

const PLANT = "plant-jbc";
export const PHASE116_MARKER = "demo.phase116";
export const PHASE116_VERSION = 116;

/** Sklad náhradních dílů (objednací číslo výrobce → kusy). */
const STOCK: { partNumber: string; manufacturer: string; description: string; quantity: number }[] = [
  { partNumber: "LC1D25BD", manufacturer: "Schneider Electric", description: "Stykač 3P 25 A, cívka 24 V DC", quantity: 1 },
  { partNumber: "S201-C2", manufacturer: "ABB", description: "Jistič 1P C2 A", quantity: 2 },
];

/** Upřesnění místa v hale / kanceláři (pochůzka revizního technika). */
const LOCATIONS: Record<string, string> = {
  "LIS-01": "Lisovací linka 1",
  "R-LIS-01": "U lisovací linky 1",
  "CNC-04": "Obráběcí centrum 4",
  "R-CNC-04": "Za obráběcím centrem 4",
  "PP-0031": "Pracovní místo u ponku",
  RM1: "Hlavní rozvodna – pole 1",
};

const LOTO: Record<string, { ooez: { name: string; phone: string | null }; oprpc: { name: string; phone: string | null } }> = {
  RM1: { ooez: { name: "Karel Novotný", phone: null }, oprpc: { name: "Jana Dvořáková", phone: null } },
};

const OLD_FILTER = "SK 3238 + filtrační rohož 3238.200";

export async function seedPhase116(prisma: PrismaClient, options: { force?: boolean } = {}) {
  const result = { skipped: false, stock: 0, locations: 0, loto: 0, filter: 0 };
  const marker = await prisma.tenantSetting.findUnique({ where: { key: PHASE116_MARKER }, select: { value: true } });
  if (!options.force && Number(marker?.value ?? 0) >= PHASE116_VERSION) return { ...result, skipped: true };
  const plant = await prisma.plant.findUnique({ where: { id: PLANT }, select: { id: true } });
  if (plant) {
    for (const item of STOCK) {
      const partKey = item.partNumber.trim().toUpperCase().replace(/\s+/g, "");
      const existing = await prisma.sparePartStock.findUnique({ where: { plantId_partKey: { plantId: plant.id, partKey } } });
      if (existing) continue; // vlastní stav skladu se nepřepisuje
      await prisma.sparePartStock.create({ data: { plantId: plant.id, partKey, partNumber: item.partNumber, manufacturer: item.manufacturer, description: item.description, quantity: item.quantity } });
      result.stock++;
    }
    const equipment = await prisma.equipment.findMany({ where: { tag: { in: [...new Set([...Object.keys(LOCATIONS), ...Object.keys(LOTO)])] }, floor: { building: { plantId: plant.id } } }, select: { id: true, tag: true, locationNote: true, lotoResponsibleJson: true } });
    for (const row of equipment) {
      const note = LOCATIONS[row.tag];
      if (note && !row.locationNote) {
        await prisma.equipment.update({ where: { id: row.id }, data: { locationNote: note } });
        result.locations++;
      }
      const loto = LOTO[row.tag];
      if (loto && !row.lotoResponsibleJson) {
        await prisma.equipment.update({ where: { id: row.id }, data: { lotoResponsibleJson: JSON.stringify(loto) } });
        result.loto++;
      }
    }
    const filters = await prisma.monitoredComponent.updateMany({
      where: { modelNumber: OLD_FILTER, equipment: { floor: { building: { plantId: plant.id } } } },
      data: { modelNumber: null, name: "Filtrační rohož ventilátoru rozváděče (TopTherm SK 3238.100)" },
    });
    result.filter = filters.count;
  }
  await prisma.tenantSetting.upsert({ where: { key: PHASE116_MARKER }, create: { key: PHASE116_MARKER, value: String(PHASE116_VERSION) }, update: { value: String(PHASE116_VERSION) } });
  return result;
}
