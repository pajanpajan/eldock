// Fáze 61: přístroje chytré domácnosti do databáze prvků (přírůstkově přes `seedCatalog` / `db:panel-builder`,
// upsert podle objednacího čísla – nic se nemaže). ABB-free@home podle „Katalog: Domovní elektroinstalační materiál
// 2026“ (ABB s.r.o., únor 2026, str. 271–277), ABB i-bus KNX stmívač a DALI brána podle knx.org, Loxone Dimmer
// Extension podle produktového listu 100029. Ztrátový výkon výrobce v katalogu neuvádí → odhad dle IEC (označeno).
//
// Fáze 81: šířka, kategorie, Pv a datasheet kusů chytré domácnosti na DIN lištu jen ze `smart-home.ts`
// (`smartDinComponents`) – ruční popisy a zdroje z Katalogu ABB 2026 zůstávají, chybějící kusy (TapHome, Loxone
// Extensions, alternativy KNX, SysAP s adaptérem) přibudou. Řádky jsou vlastní katalog (import katalogu výrobců je
// nepřepíše).

import { smartDinComponents } from "../src/lib/panel-builder/smart-din-catalog";
import type { ResearchComponent } from "./seed-catalog-research";

const KATALOG = "Katalog ABB 2026 – Domovní elektroinstalační materiál (nizke-napeti.cz.abb.com, dokument 20641, únor 2026)";

const din = (series: string, typeCode: string, articleNumber: string, modulesCount: number, description: string, source: string, extra: Partial<ResearchComponent> = {}): ResearchComponent => ({
  manufacturer: "ABB",
  series,
  typeCode,
  articleNumber,
  category: "PLC",
  poles: "1P",
  ratedCurrentA: 0,
  moduleSubtype: "PLC",
  modulesCount,
  powerLossWatts: null,
  description,
  datasheetUrl: null,
  source,
  ...extra,
});

const HAND_ROWS: ResearchComponent[] = [
  // ABB-free@home – systémové přístroje a akční členy na DIN lištu (str. 271–277)
  din("free@home", "PS-M-64.1.1", "2CDG510001R0011", 4, "Zdroj napájecí sběrnicový ABB-free@home 640 mA s tlumivkou, 30 V DC, šířka 4 M", `${KATALOG}, str. 273`, { category: "PSU", moduleSubtype: "PSU_DC", ratedCurrentA: 0.64 }),
  din("free@home", "SA-M-4.16.2.2", "2CDG510025R0011", 4, "Člen akční spínací 4násobný řadový, AC-1 16 A / AC-3 8 A, ruční ovládání, šířka 4 M", `${KATALOG}, str. 274`, { ratedCurrentA: 16 }),
  din("free@home", "SA-M-8.16.2.2", "2CDG510026R0011", 8, "Člen akční spínací 8násobný řadový, AC-1 16 A / AC-3 8 A, šířka 8 M", `${KATALOG}, str. 274`, { ratedCurrentA: 16 }),
  din("free@home", "SA-M-12.16.2.2", "2CDG510027R0011", 12, "Člen akční spínací 12násobný řadový, AC-1 16 A / AC-3 8 A, šířka 12 M", `${KATALOG}, str. 274`, { ratedCurrentA: 16 }),
  din("free@home", "SA-M-8.8.1", "2CDG510007R0011", 8, "Člen akční spínací / snímač 8/8násobný řadový – 8 binárních vstupů a 8 relé 6 A, šířka 8 M", `${KATALOG}, str. 277`, { ratedCurrentA: 6 }),
  din("free@home", "DA/M.4.210.2.1", "2CKA006220A0729", 6, "Člen akční stmívací 4násobný řadový, 4× 210 W (LED na sestupné hraně, 4× 80 W na náběžné), 1× 600 W paralelně, šířka 6 M", `${KATALOG}, str. 275`),
  din("free@home", "DA/M.6.210.2.1", "2CKA006220A0731", 8, "Člen akční stmívací 6násobný řadový, 6× 210 W (LED na sestupné hraně, 6× 80 W na náběžné), 1× 800 W paralelně, šířka 8 M", `${KATALOG}, str. 275`),
  din("free@home", "DG-M-1.16.1", "2CDG510012R0011", 4, "Rozhraní DALI / free@home řadové, výstup DALI pro max. 16 účastníků", `${KATALOG}, str. 275`),
  din("free@home", "BA-M-4.230.1.1", "2CDG510028R0011", 4, "Člen akční žaluziový 4násobný řadový, AC-3 6 A, výstupy nepřímo blokované, šířka 4 M", `${KATALOG}, str. 276`, { ratedCurrentA: 6 }),
  din("free@home", "BA-M-8.230.1.1", "2CDG510029R0011", 8, "Člen akční žaluziový 8násobný řadový, AC-3 6 A, šířka 8 M", `${KATALOG}, str. 276`, { ratedCurrentA: 6 }),
  din("free@home", "HA-M-0.6.1", "2CDG510008R0011", 4, "Člen akční topení 6násobný řadový pro termoelektrické hlavice 24–230 V AC, 160 mA (v roce 2026 produktová obměna), šířka 4 M", `${KATALOG}, str. 276`),
  din("free@home", "HA-M-0.12.1", "2CDG510009R0011", 8, "Člen akční topení 12násobný řadový pro termoelektrické hlavice 24–230 V AC, 160 mA (v roce 2026 produktová obměna), šířka 8 M", `${KATALOG}, str. 276`),
  din("free@home", "FCA-M-2.3.1", "2CDG510010R0011", 6, "Člen akční FanCoil řadový – 3 stupně ventilátoru, 2 ventily, 2 binární vstupy, šířka 6 M", `${KATALOG}, str. 277`, { ratedCurrentA: 6 }),
  din("free@home", "BI-M-4.230.1.1", "2CDG510016R0011", 2, "Modul binárních vstupů 4násobný 10–230 V AC/DC řadový, šířka 2 M", `${KATALOG}, str. 277`),
  din("free@home", "BI-M-4.20.1.1", "2CDG510014R0011", 2, "Modul binárních vstupů 4násobný s testovacím napětím (bezpotenciálové kontakty), šířka 2 M", `${KATALOG}, str. 277`),
  din("free@home", "USB-M-1.1", "2CDG510013R0011", 2, "Rozhraní USB řadové pro centrální meteostanici (více systémových modulů)", `${KATALOG}, str. 273`),
  // ABB i-bus KNX – stmívač, DALI brána a IP rozhraní (KNX.org / distributor)
  din("ABB i-bus KNX", "UD/S 4.210.2.1", "2CKA006197A0047", 4, "Univerzální stmívací akční člen KNX 4× 210 W pro stmívatelné LED a žárovky, ruční ovládání bez napětí sběrnice", "knx.org – UD/S4.210.2.1 LED Dimmer 4x210W (šířku ověřte v datasheetu)"),
  din("ABB i-bus KNX", "DG/S 1.64.1.1", "2CDG110198R0011", 4, "DALI brána KNX Basic, 1 výstup DALI, max. 64 účastníků", "knx.org – DG/S1.64.1.1 DALI Gateway, Basic, 1f, MDRC"),
  din("ABB i-bus KNX", "IPS/S 3.5.1", "2CDG110204R0011", 2, "IP rozhraní KNX Secure řadové (programování ETS, vizualizace) – objednací číslo ověřte v katalogu ABB KNX", "distributor (Rexel) – ověřte"),
  // Loxone – stmívač 230 V na DIN lištu
  { manufacturer: "Loxone", series: "Loxone Extensions", typeCode: "Dimmer Extension", articleNumber: "LOXONE:100029", category: "PLC", poles: "1P", ratedCurrentA: 0, moduleSubtype: "PLC", modulesCount: 9, powerLossWatts: null, description: "Dimmer Extension – 4 stmívací výstupy 230 V a 8 digitálních vstupů, montáž na DIN lištu, 9 TE (zatížení kanálu ověřte v datasheetu)", datasheetUrl: "https://www.loxone.com/wp-content/uploads/datasheets/Datasheet_DimmerExtension.pdf", source: "Loxone – produktový list 100029" },
];

/** Fáze 81: kusy na DIN lištu všech čtyř systémů chytré domácnosti (jeden zdroj `smart-home.ts`). */
export const SMART_DIN_ROWS: ResearchComponent[] = smartDinComponents().map((row) => ({
  manufacturer: row.manufacturer,
  series: row.series,
  typeCode: row.typeCode,
  articleNumber: row.articleNumber,
  category: row.category,
  poles: row.poles,
  ratedCurrentA: row.ratedCurrentA,
  moduleSubtype: row.moduleSubtype,
  modulesCount: row.modulesCount,
  powerLossWatts: row.powerLossWatts,
  lossEstimated: row.lossEstimated,
  description: row.description,
  datasheetUrl: row.datasheetUrl,
  source: row.source,
  ...(row.ean ? { ean: row.ean } : {}),
  ownCatalog: true,
}));

/** Ruční řádek Katalogu ABB 2026 + data výpočtu se stejným objednacím číslem; kusy bez ručního řádku se připojí. */
export function mergeSmartRows(hand: readonly ResearchComponent[], smart: readonly ResearchComponent[]): ResearchComponent[] {
  const byArticle = new Map(smart.map((row) => [row.articleNumber, row]));
  const merged = hand.map((row) => {
    const own = byArticle.get(row.articleNumber);
    if (!own) return row;
    byArticle.delete(row.articleNumber);
    return {
      ...row,
      series: own.series,
      category: own.category,
      moduleSubtype: own.moduleSubtype,
      modulesCount: own.modulesCount,
      ratedCurrentA: row.ratedCurrentA || own.ratedCurrentA,
      powerLossWatts: own.powerLossWatts ?? row.powerLossWatts,
      lossEstimated: own.lossEstimated,
      datasheetUrl: own.datasheetUrl ?? row.datasheetUrl,
      ...(own.ean ?? row.ean ? { ean: own.ean ?? row.ean } : {}),
      ownCatalog: true,
    };
  });
  return [...merged, ...byArticle.values()];
}

export const ABB_2026_COMPONENTS: ResearchComponent[] = mergeSmartRows(HAND_ROWS, SMART_DIN_ROWS);
