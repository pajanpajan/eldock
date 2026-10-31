// AI Panel Builder: atomický katalog prvků a vzorový rozváděč PB-001. Přírůstkový a idempotentní –
// volá ho `seed.ts` a samostatně `npm run db:panel-builder` (i nad produkční databází): katalog
// doplní / aktualizuje podle objednacího čísla (upsert), projekt PB-001 založí jen pokud chybí.
//
// Prvky referenčního rozváděče (ABB) odpovídají kusovníku public/demo-docs/domovni-rozvadec-rh1.pdf.
// Objednací čísla a ztráty ostatních řad (Eaton, OEZ, Schneider, Hager, Saltek, Finder) jsou orientační ukázková data – před objednáním ověřit
// v aktuálním katalogu výrobce.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PrismaClient } from "../src/generated/prisma/client";
import { renderPanelPhotoSvg } from "../src/lib/mock-graphics/panel-photo";
import { GENERATED_CATALOG, type SeedComponent } from "./seed-catalog-generated";
import { buildSearchText, iecSymbolFor } from "../src/lib/panel-builder/catalog";
import { demoDetections } from "../src/lib/panel-builder/matching";
import { REFERENCE_DEVICES, REFERENCE_DIMS, withPositions } from "../src/lib/panel-builder/reference";
import { applyDetections } from "../src/server/services/panel-builder";

const UPLOADS = fileURLToPath(new URL("../storage/uploads", import.meta.url));


const S200 = "System pro M compact S200";
const mcb = (manufacturer: string, series: string, typeCode: string, articleNumber: string, poles: string, curve: string, current: number, ka: number, loss: number): SeedComponent => ({
  manufacturer,
  series,
  typeCode,
  articleNumber,
  category: "MCB",
  poles,
  ratedCurrentA: current,
  trippingCurve: curve,
  breakingCapacityKa: ka,
  modulesCount: poles === "3P" ? 3 : poles === "1P+N" ? 2 : 1,
  powerLossWatts: loss,
  description: `Jistič ${poles}, ${current} A, char. ${curve}, ${ka} kA`,
});

const EXPLICIT: SeedComponent[] = [
  // --- ABB – referenční rozváděč PB-001 ---
  { manufacturer: "ABB", series: "SD200", typeCode: "SD203/40", articleNumber: "2CDD283101R0040", category: "MAIN_SWITCH", poles: "3P", ratedCurrentA: 40, modulesCount: 3, powerLossWatts: 6.81, description: "Vypínač 3P, 40 A" },
  {
    manufacturer: "ABB",
    series: "OVR",
    typeCode: "OVR T2-T3 3N 20-275 P QS",
    articleNumber: "2CTB803973R1200",
    category: "SPD",
    poles: "3P+N",
    ratedCurrentA: 40,
    modulesCount: 4,
    powerLossWatts: 0.03,
    description: "Přepěťová ochrana SPD T2+T3, 3P+N, Uc 275 V, In 20 kA, výměnné moduly",
  },
  {
    manufacturer: "ABB",
    series: "System pro M compact F200",
    typeCode: "FH204 A-40/0,03",
    articleNumber: "2CSF204102R1400",
    category: "RCD",
    poles: "4P",
    ratedCurrentA: 40,
    rcdSensitivityMa: 30,
    rcdType: "A",
    modulesCount: 4,
    powerLossWatts: 3.2,
    description: "Proudový chránič RCCB 4P, 40 A / 30 mA, typ A",
  },
  mcb("ABB", S200, "S203-B16", "2CDS253001R0165", "3P", "B", 16, 6, 2.5),
  mcb("ABB", S200, "S201-B10", "2CDS251001R0105", "1P", "B", 10, 6, 2.1),
  mcb("ABB", S200, "S201-B16", "2CDS251001R1165", "1P", "B", 16, 6, 2.5),
  {
    manufacturer: "ABB",
    series: "MISTRAL41W",
    typeCode: "RES12x320",
    articleNumber: "1SPE007717F0620",
    category: "ENCLOSURE",
    poles: "-",
    ratedCurrentA: 0,
    modulesCount: 0,
    powerLossWatts: 0,
    description: "Skříň rozváděče MISTRAL41W, 36M 3R, transparentní dvířka, 507 × 292 × 120 mm, IP41",
    dims: [292, 507, 120],
  },
  // --- ABB – další běžné velikosti ---
  mcb("ABB", S200, "S201-B6", "2CDS251001R0065", "1P", "B", 6, 6, 1.6),
  mcb("ABB", S200, "S201-B13", "2CDS251001R0135", "1P", "B", 13, 6, 2.3),
  mcb("ABB", S200, "S201-B20", "2CDS251001R0205", "1P", "B", 20, 6, 2.9),
  mcb("ABB", S200, "S201-B25", "2CDS251001R0255", "1P", "B", 25, 6, 3.1),
  mcb("ABB", S200, "S201-B32", "2CDS251001R0325", "1P", "B", 32, 6, 3.6),
  mcb("ABB", S200, "S201-C10", "2CDS251001R0104", "1P", "C", 10, 6, 2.1),
  mcb("ABB", S200, "S201-C16", "2CDS251001R0164", "1P", "C", 16, 6, 2.5),
  mcb("ABB", S200, "S203-B20", "2CDS253001R0205", "3P", "B", 20, 6, 2.9),
  mcb("ABB", S200, "S203-B25", "2CDS253001R0255", "3P", "B", 25, 6, 3.1),
  mcb("ABB", S200, "S203-B32", "2CDS253001R0325", "3P", "B", 32, 6, 3.6),
  mcb("ABB", S200, "S203-C16", "2CDS253001R0164", "3P", "C", 16, 6, 2.5),
  { manufacturer: "ABB", series: "SD200", typeCode: "SD203/63", articleNumber: "2CDD283101R0063", category: "MAIN_SWITCH", poles: "3P", ratedCurrentA: 63, modulesCount: 3, powerLossWatts: 10.7, description: "Vypínač 3P, 63 A" },
  {
    manufacturer: "ABB",
    series: "System pro M compact F200",
    typeCode: "FH204 A-25/0,03",
    articleNumber: "2CSF204102R1250",
    category: "RCD",
    poles: "4P",
    ratedCurrentA: 25,
    rcdSensitivityMa: 30,
    rcdType: "A",
    modulesCount: 4,
    powerLossWatts: 1.25,
    description: "Proudový chránič RCCB 4P, 25 A / 30 mA, typ A",
  },
  {
    manufacturer: "ABB",
    series: "System pro M compact F200",
    typeCode: "FH202 A-25/0,03",
    articleNumber: "2CSF202102R1250",
    category: "RCD",
    poles: "2P",
    ratedCurrentA: 25,
    rcdSensitivityMa: 30,
    rcdType: "A",
    modulesCount: 2,
    powerLossWatts: 1.25,
    description: "Proudový chránič RCCB 2P, 25 A / 30 mA, typ A",
  },
  {
    manufacturer: "ABB",
    series: "DS201",
    typeCode: "DS201 B16 A30",
    articleNumber: "2CSR255140R1165",
    category: "RCBO",
    poles: "1P+N",
    ratedCurrentA: 16,
    trippingCurve: "B",
    breakingCapacityKa: 6,
    rcdSensitivityMa: 30,
    rcdType: "A",
    modulesCount: 2,
    powerLossWatts: 3.1,
    description: "Jističochránič RCBO 1P+N, 16 A, char. B, 30 mA, typ A",
  },
  { manufacturer: "ABB", series: "ESB", typeCode: "ESB25-40N-06", articleNumber: "1SAE231111R0640", category: "CONTACTOR", poles: "4P", ratedCurrentA: 25, modulesCount: 1, powerLossWatts: 3, description: "Instalační stykač 25 A, 4 NO, cívka 230 V AC" },
  // --- Eaton xPole ---
  mcb("Eaton", "xPole PL7", "PL7-B10/1", "262704", "1P", "B", 10, 10, 2.0),
  mcb("Eaton", "xPole PL7", "PL7-B16/1", "262706", "1P", "B", 16, 10, 2.6),
  mcb("Eaton", "xPole PL7", "PL7-C16/1", "262722", "1P", "C", 16, 10, 2.6),
  mcb("Eaton", "xPole PL7", "PL7-B16/3", "263386", "3P", "B", 16, 10, 2.6),
  { manufacturer: "Eaton", series: "xPole PF7", typeCode: "PF7-40/4/003-A", articleNumber: "263584", category: "RCD", poles: "4P", ratedCurrentA: 40, rcdSensitivityMa: 30, rcdType: "A", modulesCount: 4, powerLossWatts: 3.4, description: "Proudový chránič 4P, 40 A / 30 mA, typ A" },
  { manufacturer: "Eaton", series: "xPole PF7", typeCode: "PF7-25/2/003", articleNumber: "263418", category: "RCD", poles: "2P", ratedCurrentA: 25, rcdSensitivityMa: 30, rcdType: "AC", modulesCount: 2, powerLossWatts: 1.4, description: "Proudový chránič 2P, 25 A / 30 mA, typ AC" },
  {
    manufacturer: "Eaton",
    series: "CKN6",
    typeCode: "CKN6-16/1N/B/003-A",
    articleNumber: "113950",
    category: "RCBO",
    poles: "1P+N",
    ratedCurrentA: 16,
    trippingCurve: "B",
    breakingCapacityKa: 6,
    rcdSensitivityMa: 30,
    rcdType: "A",
    modulesCount: 2,
    powerLossWatts: 3,
    description: "Jističochránič 1P+N, 16 A, char. B, 30 mA, typ A",
  },
  { manufacturer: "Eaton", series: "Z-SCH", typeCode: "Z-SCH230/25-40", articleNumber: "248848", category: "CONTACTOR", poles: "4P", ratedCurrentA: 25, modulesCount: 1, powerLossWatts: 2.8, description: "Instalační stykač 25 A, 4 NO, cívka 230 V" },
  // --- OEZ Minia ---
  mcb("OEZ", "Minia LTN", "LTN-10B-1", "41566", "1P", "B", 10, 10, 2.1),
  mcb("OEZ", "Minia LTN", "LTN-16B-1", "41567", "1P", "B", 16, 10, 2.5),
  mcb("OEZ", "Minia LTN", "LTN-16C-1", "41578", "1P", "C", 16, 10, 2.5),
  mcb("OEZ", "Minia LTN", "LTN-16B-3", "41613", "3P", "B", 16, 10, 2.5),
  mcb("OEZ", "Minia LTN", "LTN-25B-3", "41615", "3P", "B", 25, 10, 3.1),
  { manufacturer: "OEZ", series: "Minia LFE", typeCode: "LFE-40-4-030A", articleNumber: "39608", category: "RCD", poles: "4P", ratedCurrentA: 40, rcdSensitivityMa: 30, rcdType: "A", modulesCount: 4, powerLossWatts: 3.3, description: "Proudový chránič 4P, 40 A / 30 mA, typ A" },
  {
    manufacturer: "OEZ",
    series: "Minia OLE",
    typeCode: "OLE-16B-1N-030AC",
    articleNumber: "41767",
    category: "RCBO",
    poles: "1P+N",
    ratedCurrentA: 16,
    trippingCurve: "B",
    breakingCapacityKa: 10,
    rcdSensitivityMa: 30,
    rcdType: "AC",
    modulesCount: 2,
    powerLossWatts: 3.2,
    description: "Jističochránič 1P+N, 16 A, char. B, 30 mA, typ AC",
  },
  { manufacturer: "OEZ", series: "Minia MSO", typeCode: "MSO-40-3", articleNumber: "43345", category: "MAIN_SWITCH", poles: "3P", ratedCurrentA: 40, modulesCount: 3, powerLossWatts: 6.5, description: "Vypínač 3P, 40 A" },
  // --- Schneider Electric Acti9 ---
  mcb("Schneider", "Acti9 iC60N", "iC60N 1P B10", "A9F03110", "1P", "B", 10, 6, 2.1),
  mcb("Schneider", "Acti9 iC60N", "iC60N 1P B16", "A9F03116", "1P", "B", 16, 6, 2.6),
  mcb("Schneider", "Acti9 iC60N", "iC60N 1P C16", "A9F04116", "1P", "C", 16, 6, 2.6),
  mcb("Schneider", "Acti9 iC60N", "iC60N 3P B16", "A9F03316", "3P", "B", 16, 6, 2.6),
  mcb("Schneider", "Acti9 iC60N", "iC60N 3P C32", "A9F04332", "3P", "C", 32, 6, 3.8),
  { manufacturer: "Schneider", series: "Acti9 iID", typeCode: "iID 4P 40A 30mA A", articleNumber: "A9R21440", category: "RCD", poles: "4P", ratedCurrentA: 40, rcdSensitivityMa: 30, rcdType: "A", modulesCount: 4, powerLossWatts: 3.3, description: "Proudový chránič 4P, 40 A / 30 mA, typ A" },
  { manufacturer: "Schneider", series: "Acti9 iSW", typeCode: "iSW 3P 40A", articleNumber: "A9S60340", category: "MAIN_SWITCH", poles: "3P", ratedCurrentA: 40, modulesCount: 2, powerLossWatts: 6.2, description: "Vypínač 3P, 40 A" },
  { manufacturer: "Schneider", series: "Acti9 iPRD", typeCode: "iPRD40r 3P+N", articleNumber: "A9L40601", category: "SPD", poles: "3P+N", ratedCurrentA: 40, modulesCount: 4, powerLossWatts: 0.05, description: "Přepěťová ochrana T2, 3P+N, Imax 40 kA, výměnné moduly" },
  { manufacturer: "Schneider", series: "Acti9 iCT", typeCode: "iCT 25A 2NO", articleNumber: "A9C20732", category: "CONTACTOR", poles: "2P", ratedCurrentA: 25, modulesCount: 1, powerLossWatts: 2.4, description: "Instalační stykač 25 A, 2 NO, cívka 230 V" },
  // --- Hager (objednací číslo = typ) ---
  mcb("Hager", "MBN", "MBN110", "MBN110", "1P", "B", 10, 6, 2.1),
  mcb("Hager", "MBN", "MBN116", "MBN116", "1P", "B", 16, 6, 2.2),
  mcb("Hager", "MBN", "MBN316", "MBN316", "3P", "B", 16, 6, 2.2),
  { manufacturer: "Hager", series: "CDA", typeCode: "CDA440D", articleNumber: "CDA440D", category: "RCD", poles: "4P", ratedCurrentA: 40, rcdSensitivityMa: 30, rcdType: "A", modulesCount: 4, powerLossWatts: 3.3, description: "Proudový chránič 4P, 40 A / 30 mA, typ A" },
  { manufacturer: "Hager", series: "SBN", typeCode: "SBN340", articleNumber: "SBN340", category: "MAIN_SWITCH", poles: "3P", ratedCurrentA: 40, modulesCount: 3, powerLossWatts: 6.5, description: "Vypínač 3P, 40 A" },
  // --- Saltek (přepěťové ochrany) ---
  { manufacturer: "Saltek", series: "SLP", typeCode: "SLP-275 V/3+1", articleNumber: "SLP-275-V-3+1", category: "SPD", poles: "3P+N", ratedCurrentA: 40, modulesCount: 4, powerLossWatts: 0.04, description: "Přepěťová ochrana T2, 3+1, Uc 275 V, Imax 40 kA" },
  { manufacturer: "Saltek", series: "FLP", typeCode: "FLP-B+C MAXI V/3+1", articleNumber: "FLP-BC-MAXI-V-3+1", category: "SPD", poles: "3P+N", ratedCurrentA: 63, modulesCount: 4, powerLossWatts: 0.05, description: "Svodič bleskových proudů a přepětí T1+T2, 3+1" },
  // --- Finder (modulární stykače a relé) ---
  { manufacturer: "Finder", series: "22.32", typeCode: "22.32.0.230.4340", articleNumber: "223202304340", category: "CONTACTOR", poles: "2P", ratedCurrentA: 25, modulesCount: 1, powerLossWatts: 2.2, description: "Modulární stykač 25 A, 2 NO, cívka 230 V AC" },
  { manufacturer: "Finder", series: "40.52", typeCode: "40.52.8.230.0000", articleNumber: "405282300000", category: "RELAY", poles: "2P", ratedCurrentA: 8, modulesCount: 1, powerLossWatts: 0.6, description: "Relé 2 přepínací kontakty 8 A, cívka 230 V AC" },
];

/**
 * Celý seed katalog: ručně zapsané prvky (referenční rozváděč a dřívější ukázky) + generovaný
 * průmyslový katalog. Duplicity (stejný výrobce a typ nebo stejné objednací číslo) vyhrává ruční zápis.
 */
export const CATALOG: SeedComponent[] = (() => {
  const seen = new Set<string>();
  const key = (component: SeedComponent) => `${component.manufacturer.toLowerCase()}|${component.typeCode.toLowerCase().replace(/s+/g, "")}`;
  return [...EXPLICIT, ...GENERATED_CATALOG].filter((component) => {
    const keys = [key(component), `article|${component.articleNumber}`];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
})();

// ---------------------------------------------------------------------------
//  Vzorový projekt PB-001 (referenční domovní / podružný rozváděč)
// ---------------------------------------------------------------------------

export const PB001 = {
  code: "PB-001",
  name: "Domovní / Podružný rozváděč PB-001",
  customerName: "Závod Jablonec – Energetika",
  manufacturerInfo: { name: "ELMONT Plzeň s.r.o.", address: "Pilsner 12", city: "301 00 Plzeň", phone: "+420 666 666 666" },
  enclosureModel: "ABB MISTRAL41W, 36M 3R",
  dims: REFERENCE_DIMS,
  photoFile: "panel-pb-001.svg",
};

/** Upsert katalogu podle objednacího čísla. Vrací počet prvků v seed katalogu. */
export async function seedCatalog(prisma: PrismaClient) {
  for (const component of CATALOG) {
    const [widthMm, heightMm, depthMm] = component.dims ?? [component.modulesCount * 17.5 || null, component.modulesCount ? 85 : null, component.modulesCount ? 69 : null];
    const data = {
      manufacturer: component.manufacturer,
      series: component.series,
      typeCode: component.typeCode,
      category: component.category,
      poles: component.poles,
      ratedCurrentA: component.ratedCurrentA,
      trippingCurve: component.trippingCurve ?? null,
      breakingCapacityKa: component.breakingCapacityKa ?? (component.category === "RCD" ? 10 : null),
      rcdSensitivityMa: component.rcdSensitivityMa ?? null,
      rcdType: component.rcdType ?? null,
      spdType: component.spdType ?? (component.category === "SPD" ? "T2" : null),
      surgeCurrentKa: component.surgeCurrentKa ?? null,
      contactConfig: component.contactConfig ?? null,
      coilVoltage: component.coilVoltage ?? (component.category === "CONTACTOR" ? "230V AC" : null),
      relaySubtype: component.relaySubtype ?? null,
      moduleSubtype: component.moduleSubtype ?? null,
      modulesCount: component.modulesCount,
      widthMm,
      heightMm,
      depthMm,
      powerLossWatts: component.powerLossWatts,
      iecSymbol: iecSymbolFor(component.category, component.poles),
      description: component.description,
      dataSource: "SEED_CATALOG" as const,
      searchText: buildSearchText(component),
    };
    await prisma.catalogComponent.upsert({ where: { articleNumber: component.articleNumber }, create: { articleNumber: component.articleNumber, ...data }, update: data });
  }
  return CATALOG.length;
}

/** Vzorový projekt PB-001 – jen pokud ještě neexistuje (uživatelské úpravy se nepřepisují). */
export async function seedPanelProject(prisma: PrismaClient): Promise<boolean> {
  if (await prisma.panelBoardProject.findUnique({ where: { code: PB001.code }, select: { id: true } })) return false;

  // „Fotka“ rozváděče v geometrii DIN lišt – rámečky demo detekce na ni přesně lícují.
  const devices = withPositions(REFERENCE_DEVICES).map((device) => ({ ...device, modulesWidth: device.modules }));
  const dir = path.join(UPLOADS, "photos", "seed");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, PB001.photoFile), renderPanelPhotoSvg(PB001.dims, devices), "utf8");

  const project = await prisma.panelBoardProject.create({
    data: {
      code: PB001.code,
      name: PB001.name,
      customerName: PB001.customerName,
      manufacturerInfoJson: JSON.stringify(PB001.manufacturerInfo),
      enclosureModel: PB001.enclosureModel,
      ...PB001.dims,
      photoUrl: `/api/files/photos/seed/${PB001.photoFile}`,
    },
  });
  await applyDetections(prisma, project.id, demoDetections(PB001.dims), "DEMO", "ABB");
  return true;
}

export async function seedPanelBuilder(prisma: PrismaClient) {
  const components = await seedCatalog(prisma);
  const project = await seedPanelProject(prisma);
  return { components, project };
}
