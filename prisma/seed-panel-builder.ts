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
import { buildSearchText, estimatePowerLoss, iecSymbolFor } from "../src/lib/panel-builder/catalog";
import { ENCLOSURE_FANS, RESEARCH_COMPONENTS } from "./seed-catalog-research";
import { ABB_2026_COMPONENTS } from "./seed-abb-2026";
import { ACCESSORY_COMPONENTS } from "./seed-accessories-2026";
import { ABB_CZ_COMPONENTS, ABB_CZ_RELATIONS } from "./seed-abb-cz";
import { isHiddenManufacturer } from "../src/lib/panel-builder/brands";
import { demoDetections } from "../src/lib/panel-builder/matching";
import { REFERENCE_DEVICES, REFERENCE_DIMS, withPositions } from "../src/lib/panel-builder/reference";
import { applyDetections, applyProposedTree } from "../src/server/services/panel-builder";
import { ROUTINE_TEST_POINTS } from "../src/lib/legislation-2027";
import { applyEnclosureFixes, applyEtimComponents, importExternalCatalog, importWiringDevices, seedStandardEnclosures, seedVerifiedEnclosures } from "../src/server/services/catalog-sync";
import { ensureDefaultLabelSets } from "../src/server/services/operator";
import { readSnapshot, readWiringSnapshot } from "./external-catalog-source";
import { BRAND_ETIM_COMPONENTS } from "../src/lib/panel-builder/brand-etim-components.generated";
import { UNIVERSAL_COMPONENTS } from "../src/lib/panel-builder/etim-universal.generated";
import { TESTER_COMPANY } from "../src/lib/registered-company";
import { hashPassword } from "../src/server/password";

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
  const key = (component: Pick<SeedComponent, "manufacturer" | "typeCode">) => `${component.manufacturer.toLowerCase()}|${component.typeCode.toLowerCase().replace(/\s+/g, "")}`;
  // Rešerše výrobců (fáze 47): Siemens SENTRON a ABB z reálného 144M rozváděče; chybějící Pv = odhad IEC
  // Fáze 61: chytrá domácnost z Katalogu ABB 2026 (free@home), KNX stmívač / DALI / IP rozhraní, Loxone Dimmer Extension
  // Fáze 114: příslušenství s ověřeným objednacím číslem (ABB, OEZ, Hager, Schneider) – kaskáda bez odhadu IEC
  const research: SeedComponent[] = [...ABB_2026_COMPONENTS, ...ACCESSORY_COMPONENTS, ...RESEARCH_COMPONENTS].map((entry) => {
    const { powerLossWatts, source, lossEstimated, ...component } = entry;
    void source; // zdroj rešerše zůstává jen v souboru s daty
    return {
      ...component,
      powerLossWatts: powerLossWatts ?? estimatePowerLoss(component.category, component.poles, component.ratedCurrentA),
      // Fáze 81: orientační Pv (zadání / odvozeno) je v katalogu také „odhad“
      lossEstimated: powerLossWatts === null || lossEstimated === true,
    };
  });
  // Fáze 88: modulové přístroje a příslušenství ABB z katalogu ABB pro ČR – jen kusy, které katalog s tímto objednacím
  // číslem a typem ještě nemá; před generovaným katalogem (jeho orientační řádek téhož typu nahradí), ruční zápis
  // a rešerše vyhrávají. Pv ABB CZ neuvádí: typická hodnota nahrazeného generovaného řádku, jinak odhad IEC („odhad“).
  const curatedArticles = new Set([...EXPLICIT, ...research].map((component) => component.articleNumber));
  const generatedByArticle = new Map(GENERATED_CATALOG.map((component) => [component.articleNumber, component]));
  const generatedByKey = new Map(GENERATED_CATALOG.map((component) => [key(component), component]));
  const abbCz: SeedComponent[] = ABB_CZ_COMPONENTS.filter((entry) => {
    if (curatedArticles.has(entry.articleNumber)) return false;
    const generated = generatedByArticle.get(entry.articleNumber);
    return !(generated && key(generated) === key(entry));
  }).map((entry) => {
    const { powerLossWatts, source, lossEstimated, ...component } = entry;
    void source;
    void lossEstimated;
    const replaced = generatedByArticle.get(entry.articleNumber) ?? generatedByKey.get(key(entry));
    return { ...component, powerLossWatts: powerLossWatts ?? replaced?.powerLossWatts ?? estimatePowerLoss(component.category, component.poles, component.ratedCurrentA), lossEstimated: true };
  });
  return [...EXPLICIT, ...research, ...abbCz, ...GENERATED_CATALOG].filter((component) => {
    // Vyřazení výrobci (fáze 47) se do katalogu už nedoplňují
    if (isHiddenManufacturer(component.manufacturer)) return false;
    const keys = [key(component), `article|${component.articleNumber}`];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
})();

/** Fáze 88: objednací čísla kusů z katalogu ABB pro ČR, které seed katalogu zapisuje (bez kusů, které už katalog měl). */
export const ABB_CZ_IN_CATALOG = new Set(ABB_CZ_COMPONENTS.map((component) => component.articleNumber).filter((article) => CATALOG.some((component) => component.articleNumber === article && component.ownCatalog)));

const typeKey = (value: string) => value.toLowerCase().replace(/\s+/g, "");

/**
 * Fáze 88: kus z katalogu ABB pro ČR, který databáze zatím zná jen jako orientační řádek generovaného katalogu
 * (objednací číslo = typové označení, např. „F204 A-40/0,03“), dostane skutečné objednací číslo – řádek se přeznačí,
 * nic se nemaže a odkazy projektů na kus zůstávají. Vrací počet přeznačených řádků.
 */
export async function adoptVerifiedArticles(prisma: PrismaClient, components: readonly Pick<SeedComponent, "manufacturer" | "typeCode" | "articleNumber">[]) {
  const known = new Set((await prisma.catalogComponent.findMany({ where: { articleNumber: { in: components.map((component) => component.articleNumber) } }, select: { articleNumber: true } })).map((row) => row.articleNumber));
  const missing = components.filter((component) => !known.has(component.articleNumber));
  if (!missing.length) return 0;
  const candidates = await prisma.catalogComponent.findMany({
    where: { manufacturer: { in: [...new Set(missing.map((component) => component.manufacturer))] }, typeCode: { in: missing.map((component) => component.typeCode) } },
    select: { id: true, manufacturer: true, typeCode: true, articleNumber: true },
  });
  const taken = new Set<string>();
  let adopted = 0;
  for (const component of missing) {
    const row = candidates.find((candidate) => !taken.has(candidate.id) && candidate.manufacturer === component.manufacturer && typeKey(candidate.typeCode) === typeKey(component.typeCode) && typeKey(candidate.articleNumber) === typeKey(candidate.typeCode));
    if (!row) continue;
    taken.add(row.id);
    await prisma.catalogComponent.update({ where: { id: row.id }, data: { articleNumber: component.articleNumber } });
    adopted++;
  }
  return adopted;
}

/** Fáze 88: vazby příslušenství ABB (přípojnice, koncové krytky, přídavné kontakty) – doplní chybějící, nic nemaže. Vrací počet vazeb. */
export async function seedAbbRelations(prisma: PrismaClient) {
  const articles = [...new Set(ABB_CZ_RELATIONS.flatMap((relation) => [...relation.parents, ...relation.children]))];
  const ids = new Map((await prisma.catalogComponent.findMany({ where: { articleNumber: { in: articles } }, select: { id: true, articleNumber: true } })).map((row) => [row.articleNumber, row.id]));
  const pairs = ABB_CZ_RELATIONS.flatMap((relation) =>
    relation.parents.flatMap((parent) => relation.children.map((child) => ({ relation, parentId: ids.get(parent), childId: ids.get(child) }))),
  ).filter((pair): pair is typeof pair & { parentId: string; childId: string } => !!pair.parentId && !!pair.childId);
  const existing = new Set(
    (await prisma.catalogRelation.findMany({ where: { parentId: { in: [...new Set(pairs.map((pair) => pair.parentId))] } }, select: { parentId: true, childId: true, relationType: true } })).map(
      (row) => `${row.parentId}>${row.childId}>${row.relationType}`,
    ),
  );
  const missing = pairs.filter((pair) => !existing.has(`${pair.parentId}>${pair.childId}>${pair.relation.relationType}`));
  if (missing.length)
    await prisma.catalogRelation.createMany({
      data: missing.map(({ relation, parentId, childId }) => ({ parentId, childId, relationType: relation.relationType, basis: relation.basis, verified: relation.verified, note: relation.note })),
    });
  return pairs.length;
}

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

/**
 * Upsert katalogu podle objednacího čísla (jedna transakce – rychlý start kontejneru). Vrací počet prvků.
 * Fáze 88: kusy, které databáze ještě nemá, založí jeden `createMany` (čistá databáze testů, E2E a nového serveru
 * se naplní zlomkem času), existující řádky se aktualizují upsertem jako dřív.
 */
export async function seedCatalog(prisma: PrismaClient) {
  // Fáze 88: orientační řádky téhož typu dostanou objednací číslo z katalogu ABB pro ČR dřív, než by upsert založil duplikát
  await adoptVerifiedArticles(prisma, CATALOG.filter((component) => ABB_CZ_IN_CATALOG.has(component.articleNumber)));
  const known = new Set((await prisma.catalogComponent.findMany({ select: { articleNumber: true } })).map((row) => row.articleNumber));
  const rows = CATALOG.map((component) => {
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
      datasheetUrl: component.datasheetUrl ?? null,
      // Fáze 114: EAN z oficiálních dat výrobce (bez údaje se nepřepíše EAN doplněný z ETIM)
      ...(component.ean ? { ean: component.ean } : {}),
      dataSource: component.lossEstimated ? ("IEC_ESTIMATE" as const) : ("SEED_CATALOG" as const),
      searchText: buildSearchText(component),
      // Fáze 81: kusy chytré domácnosti z `smart-home.ts` – import katalogu výrobců je nepřepíše
      ...(component.ownCatalog ? { externalSource: null } : {}),
    };
    return { articleNumber: component.articleNumber, data };
  });
  const missing = rows.filter((row) => !known.has(row.articleNumber));
  await prisma.$transaction([
    ...(missing.length ? [prisma.catalogComponent.createMany({ data: missing.map((row) => ({ articleNumber: row.articleNumber, ...row.data })) })] : []),
    ...rows
      .filter((row) => known.has(row.articleNumber))
      .map((row) => prisma.catalogComponent.upsert({ where: { articleNumber: row.articleNumber }, create: { articleNumber: row.articleNumber, ...row.data }, update: row.data })),
  ]);
  await seedAbbRelations(prisma);
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
  await completeShowcase(prisma, project.id);
  return true;
}

/** Ukázkový protokol o kusové zkoušce PB-001 (List 6 vzorového elaborátu) – všech 8 bodů vyhovuje. */
const SHOWCASE_ROUTINE_TEST = JSON.stringify({
  points: Object.fromEntries(ROUTINE_TEST_POINTS.map((point) => [point.id, "PASS"])),
  insulationMOhm: 500,
  testedBy: "Vzorový projekt – ukázka výstupu",
  testedAt: "2026-11-03",
  note: "Ukázková data vzorového rozváděče PB-001.",
});

/**
 * Fáze 55: vzorový PB-001 má sestavený strom zapojení (List 2 spojnice, List 3 jednopólové schéma bez chyb) a vyplněnou
 * kusovou zkoušku. Strom se navrhne jen u nezapojeného projektu – úpravy firmy Tester se nepřepisují.
 */
async function completeShowcase(prisma: PrismaClient, projectId: string) {
  const items = await prisma.panelBoardItem.findMany({ where: { projectId }, select: { parentItemId: true, fedFromIncomer: true } });
  const pristine = items.length > 0 && items.every((item) => !item.parentItemId && !item.fedFromIncomer);
  if (pristine) await applyProposedTree(prisma, projectId);
  await prisma.panelBoardProject.updateMany({ where: { id: projectId, routineTestJson: null }, data: { routineTestJson: SHOWCASE_ROUTINE_TEST } });
  // Fáze 57: vzorový elaborát má prostředí potvrzené (Interiér – byt / technická místnost)
  await prisma.panelBoardProject.updateMany({ where: { id: projectId, environmentConfirmedAt: null }, data: { environmentConfirmedAt: new Date() } });
  return pristine;
}

/** Oprava existující databáze (produkce): PB-001 založený před fází 55 dostane strom a kusovou zkoušku. */
export async function repairShowcaseProject(prisma: PrismaClient): Promise<boolean> {
  const project = await prisma.panelBoardProject.findUnique({ where: { code: PB001.code }, select: { id: true } });
  return project ? completeShowcase(prisma, project.id) : false;
}

/**
 * Demo firma „Tester“ AI Panel Builderu (fáze 41): předvyplněné přihlášení na /panel-builder/auth, vazba na
 * demo závod Jablonec (propuštění pasportu ke kartě rozváděče). Projekty bez firmy (vzorový PB-001 a projekty
 * založené před fází 41) se jí přiřadí, aby nezmizely. Existující firmu nemění (heslo ani kredity).
 */
export async function seedTesterCompany(prisma: PrismaClient) {
  const exists = await prisma.registeredCompany.findUnique({ where: { id: TESTER_COMPANY.id }, select: { id: true } });
  if (!exists) {
    const plant = await prisma.plant.findUnique({ where: { id: "plant-jbc" }, select: { id: true } });
    await prisma.registeredCompany.create({
      data: {
        id: TESTER_COMPANY.id,
        productScope: "PANEL_BUILDER",
        ico: "12345679",
        dic: "CZ12345679",
        companyName: "Elektro Tester s.r.o.",
        street: "Průmyslová 1280/7",
        city: "Jablonec nad Nisou",
        zip: "466 01",
        contactName: "Ing. Tomáš Tester",
        email: TESTER_COMPANY.email,
        phone: "+420 777 123 456",
        passwordHash: await hashPassword(TESTER_COMPANY.password),
        authorizationNumber: "E-0815/2021",
        termsAcceptedAt: new Date("2026-11-03T08:00:00Z"),
        creditsRemaining: 50,
        // Fáze 113: ⭐ neomezený přístup pro prezentace a testování (přepíná velín)
        unlimitedAccess: true,
        plantId: plant?.id ?? null,
      },
    });
  }
  const { count } = await prisma.panelBoardProject.updateMany({ where: { companyId: null }, data: { companyId: TESTER_COMPANY.id } });
  return { created: !exists, attached: count };
}

/**
 * Fáze 54: každý krok běží samostatně – selhání jednoho (např. importu externí databáze) nezastaví ostatní,
 * hlavně vzorový projekt PB-001 pro veřejnou `/ukazka-elaboratu`. Chyby vrací ve `failures` (skript pak skončí kódem 1).
 * `demo: false` (ELDOCK_SEED_DEMO=0) vynechá demo firmu Tester; katalog a PB-001 jsou součást produktu.
 */
export async function seedPanelBuilder(prisma: PrismaClient, options: { external?: boolean; demo?: boolean } = {}) {
  const failures: string[] = [];
  const step = async <T,>(name: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  };
  const components = await step("katalog prvků", () => seedCatalog(prisma), 0);
  const project = await step("vzorový projekt PB-001", () => seedPanelProject(prisma), false);
  // Fáze 55: PB-001 z dřívějších verzí bez stromu zapojení a kusové zkoušky (List 2 a 3 vzorového elaborátu)
  await step("strom vzorového PB-001", () => repairShowcaseProject(prisma), false);
  const tester = options.demo === false ? { created: false, attached: 0 } : await step("demo firma Tester", () => seedTesterCompany(prisma), { created: false, attached: 0 });
  // Fáze 43: matice standardních rozvodnic a externí databáze prvků z exportu v Gitu (jen při změně otisku)
  const enclosures = await step("standardní rozvodnice", () => seedStandardEnclosures(prisma), 0);
  // Fáze 86: ověřené rozvodnice z katalogů výrobců (ABB ComfortLine CA vč. CA35R z fáze 47, Hager vector II a univers FWU,
  // Schrack TOPO) – před importem externí databáze, který je pak nepřepíše
  const verifiedEnclosures = await step("ověřené rozvodnice výrobců", () => seedVerifiedEnclosures(prisma), 0);
  // Fáze 47: ventilátory rozváděčů z rešerší výrobců
  const fans = await step("ventilátory rozváděčů", () => seedFans(prisma), 0);
  const snapshot = options.external === false ? null : readSnapshot();
  const external = snapshot ? await step("externí databáze prvků", () => importExternalCatalog(prisma, snapshot), null) : null;
  const wiringRows = options.external === false ? null : readWiringSnapshot();
  if (wiringRows) await step("domovní přístroje", () => importWiringDevices(prisma, wiringRows), null);
  // Fáze 94: oficiální data ABB ETIM 9.0 (EAN, Pv, vestavná hloubka, technický list) až po importu externí databáze
  const etim = await step("data ABB ETIM 9.0", () => applyEtimComponents(prisma), 0);
  // Fáze 97: data výrobců Hager (BMEcat ETIM 10) a OEZ (stránky výrobků) – EAN, Pv, hloubka, technický list
  const brandEtim = await step("data výrobců Hager / OEZ", () => applyEtimComponents(prisma, BRAND_ETIM_COMPONENTS), 0);
  // Fáze 105: balíčky ze složky „ETIM data“ (OEZ ETIM 8, Hager ETIM 10) – EAN, Pv, hloubka a ceníková cena
  const universalEtim = await step("balíčky ETIM data (OEZ ETIM 8, Hager ETIM 10)", () => applyEtimComponents(prisma, UNIVERSAL_COMPONENTS), 0);
  // Fáze 97: řady × moduly rozvodnic podle dat výrobce (ETIM potvrzený popisem) – po importu externí databáze
  const enclosureFixes = await step("rozvodnice podle dat výrobce", () => applyEnclosureFixes(prisma), 0);
  // Fáze 114: prázdný seznam sad QR štítků → 5 výchozích prodejních sad (objednávání hned po nasazení)
  const labelSets = await step("sady QR štítků", () => ensureDefaultLabelSets(prisma), false);
  return { components, project, tester, enclosures, verifiedEnclosures, external, fans, etim, brandEtim, universalEtim, enclosureFixes, labelSets, failures };
}

/** Filtrační ventilátory rozváděčů – upsert podle objednacího čísla. Vrací počet ventilátorů. */
export async function seedFans(prisma: PrismaClient) {
  await prisma.$transaction(ENCLOSURE_FANS.map((fan) => prisma.enclosureFan.upsert({ where: { articleNumber: fan.articleNumber }, create: fan, update: fan })));
  return ENCLOSURE_FANS.length;
}
