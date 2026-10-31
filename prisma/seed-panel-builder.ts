// AI Panel Builder: atomický katalog prvků a vzorový rozváděč PB-001. Přírůstkový a idempotentní –
// volá ho `seed.ts` a samostatně `npm run db:panel-builder` (i nad produkční databází): katalog
// doplní / aktualizuje podle objednacího čísla (upsert), projekt PB-001 založí jen pokud chybí.
//
// Prvky referenčního rozváděče (ABB) odpovídají kusovníku public/demo-docs/domovni-rozvadec-rh1.pdf.
// Objednací čísla a ztráty ostatních řad jsou orientační ukázková data – před objednáním ověřit
// v aktuálním katalogu výrobce.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PrismaClient } from "../src/generated/prisma/client";
import type { ComponentCategory, RecognitionStatus } from "../src/generated/prisma/enums";
import { renderPanelPhotoSvg } from "../src/lib/mock-graphics/panel-photo";
import { buildSearchText, iecSymbolFor } from "../src/lib/panel-builder/catalog";
import { slotBoxes } from "../src/lib/panel-builder/layout";

const UPLOADS = fileURLToPath(new URL("../storage/uploads", import.meta.url));

interface SeedComponent {
  manufacturer: string;
  series: string;
  typeCode: string;
  articleNumber: string;
  category: ComponentCategory;
  poles: string;
  ratedCurrentA: number;
  trippingCurve?: string;
  breakingCapacityKa?: number;
  rcdSensitivityMa?: number;
  rcdType?: string;
  modulesCount: number;
  powerLossWatts: number;
  description: string;
  dims?: [number, number, number];
}

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

export const CATALOG: SeedComponent[] = [
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
];

// ---------------------------------------------------------------------------
//  Vzorový projekt PB-001 (referenční domovní / podružný rozváděč)
// ---------------------------------------------------------------------------

export const PB001 = {
  code: "PB-001",
  name: "Domovní / Podružný rozváděč PB-001",
  customerName: "Závod Jablonec – Energetika",
  manufacturerInfo: { name: "ELMONT Plzeň s.r.o.", address: "Pilsner 12", city: "301 00 Plzeň", phone: "+420 666 666 666" },
  enclosureModel: "ABB MISTRAL41W, 36M 3R",
  dims: { widthMm: 292, heightMm: 507, depthMm: 120, dinRailsCount: 3, modulesPerRail: 12 },
  photoFile: "panel-pb-001.svg",
};

interface SeedItem {
  designation: string;
  article: string;
  rail: number;
  label: string;
  status?: RecognitionStatus;
  confidence?: number;
  ocr?: string;
  glare?: boolean;
}

/** 13 přístrojů (-Q1, -F1 až -F12) na 3 lištách; -F6 je pod odleskem (nerozpoznáno), -F9 jen částečně přečten. */
export const PB001_ITEMS: SeedItem[] = [
  { designation: "-Q1", article: "2CDD283101R0040", rail: 1, label: "Odpínač" },
  { designation: "-F1", article: "2CTB803973R1200", rail: 1, label: "Přepěťová ochrana (SPD)" },
  { designation: "-F2", article: "2CSF204102R1400", rail: 1, label: "Proudový chránič (RCD)" },
  { designation: "-F3", article: "2CDS253001R0165", rail: 2, label: "Tepelné čerpadlo" },
  { designation: "-F4", article: "2CDS253001R0165", rail: 2, label: "Sporák" },
  { designation: "-F5", article: "2CDS251001R0105", rail: 2, label: "Světla chodby" },
  { designation: "-F6", article: "2CDS251001R0105", rail: 2, label: "Světla obytné místnosti", status: "UNRECOGNIZED", confidence: 0.18, ocr: "S2?? -B1?", glare: true },
  { designation: "-F7", article: "2CDS251001R0105", rail: 2, label: "Světla koupelny + venkovní" },
  { designation: "-F8", article: "2CDS251001R1165", rail: 2, label: "Zásuvky kuchyně" },
  { designation: "-F9", article: "2CDS251001R1165", rail: 2, label: "Zásuvky obývák", status: "PARTIAL", confidence: 0.64, ocr: "S201-B1б" },
  { designation: "-F10", article: "2CDS251001R1165", rail: 2, label: "Zásuvky obývák + chodba" },
  { designation: "-F11", article: "2CDS251001R1165", rail: 3, label: "Zásuvky ložnice + koupelna" },
  { designation: "-F12", article: "2CDS251001R1165", rail: 3, label: "Zásuvky pokoje + koupelna" },
];

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
  const catalog = new Map((await prisma.catalogComponent.findMany({ where: { articleNumber: { in: PB001_ITEMS.map((item) => item.article) } } })).map((c) => [c.articleNumber, c]));

  const placed = PB001_ITEMS.map((item, index) => {
    const component = catalog.get(item.article);
    if (!component) throw new Error(`Katalog neobsahuje ${item.article}`);
    const positionOnRail = PB001_ITEMS.slice(0, index).filter((other) => other.rail === item.rail).length + 1;
    return { ...item, component, dinRailIndex: item.rail, positionOnRail, modulesWidth: component.modulesCount };
  });
  const boxes = slotBoxes(PB001.dims, placed);

  const svg = renderPanelPhotoSvg(
    PB001.dims,
    placed.map((item) => ({ ...item, category: item.component.category, typeCode: item.component.typeCode, manufacturer: item.component.manufacturer, label: item.label })),
  );
  const dir = path.join(UPLOADS, "photos", "seed");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, PB001.photoFile), svg, "utf8");

  await prisma.panelBoardProject.create({
    data: {
      code: PB001.code,
      name: PB001.name,
      customerName: PB001.customerName,
      manufacturerInfoJson: JSON.stringify(PB001.manufacturerInfo),
      status: "RECOGNIZED",
      enclosureModel: PB001.enclosureModel,
      ...PB001.dims,
      photoUrl: `/api/files/photos/seed/${PB001.photoFile}`,
      analysisMode: "DEMO",
      items: {
        create: placed.map((item, index) => {
          const status = item.status ?? "VERIFIED";
          const detected = { category: item.component.category, poles: item.component.poles, ratedCurrentA: item.component.ratedCurrentA, trippingCurve: item.component.trippingCurve, modules: item.modulesWidth };
          return {
            catalogComponentId: status === "UNRECOGNIZED" ? null : item.component.id,
            dinRailIndex: item.dinRailIndex,
            positionOnRail: item.positionOnRail,
            modulesWidth: item.modulesWidth,
            boundingBoxJson: JSON.stringify(boxes.get(item)),
            recognitionStatus: status,
            confidence: item.confidence ?? 0.9 + ((index * 7) % 9) / 100,
            rawOcrText: item.ocr ?? `${item.component.manufacturer} ${item.component.typeCode}`,
            detectedJson: JSON.stringify(status === "UNRECOGNIZED" ? { category: "MCB", modules: 1 } : detected),
            designation: item.designation,
            circuitLabel: item.label,
            sortOrder: index,
          };
        }),
      },
    },
  });
  return true;
}

export async function seedPanelBuilder(prisma: PrismaClient) {
  const components = await seedCatalog(prisma);
  const project = await seedPanelProject(prisma);
  return { components, project };
}
