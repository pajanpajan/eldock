// Fáze 88: modulové přístroje a příslušenství ABB z oficiálního katalogu ABB pro Českou republiku
// (nizke-napeti.cz.abb.com, „Rozvodnice a modulární přístroje“, ověřeno 2026-11-10). České e-shopy s elektromateriálem
// (elfetex.cz, elektromaterial.cz) posloužily jen k výběru běžně prodávaného sortimentu – data z nich nejsou.
//
// Elektrické parametry podle typového označení ABB (S201M-C16, F204 A-40/0,03, DS201 M B16 A30, DS204 A-B16/0,03,
// SD203/40, OVR T2 3N 40-275 P QS, ESB25-40N-06 …), ověřené proti údajům stránky výrobku (In, IΔn, Icn, póly, šířka);
// šířka v modulech, napětí cívky, kontakty, barvy a počty pinů ze stránky. Kde stránka ABB CZ odporuje typovému
// označení, platí označení a rozpor je u kusu v `source` (FH204 A-40 / A-63: „25 A, typ AC“; OVR T2: „Iimp 40 kA,
// Imax 80 kA“). Ztrátový výkon katalog ABB CZ neuvádí → odhad (u kusu, který nahrazuje orientační řádek generovaného
// katalogu, jeho typická hodnota, jinak odhad dle IEC; v katalogu „odhad“). Datasheet = produktový list PDF ABB
// („Tisk produktového listu“, `?mime=pdf`). Vlastní katalog Eldocku (`ownCatalog`) – import externí databáze ho nepřepíše.
// Vynechané: pomocné kontakty S2C a zdroje CP-D (stránka neuvádí šířku), instalační odpínače OT (bez parametrů),
// přepínače / tlačítka / zvonky / motorové pohony S3C (Eldock pro ně nemá kategorii), kryty pro modulové přístroje.

import type { ComponentCategory } from "../src/generated/prisma/enums";
import type { ResearchComponent } from "./seed-catalog-research";

const ABB_CZ = "https://nizke-napeti.cz.abb.com";
export const ABB_CZ_VERIFIED_ON = "2026-11-10";

/** Podkategorie katalogu ABB CZ: adresa kategorie, kategorie a řada Eldocku, společný začátek adresy výrobku (null = adresa v řádku). */
interface Group {
  cat: string;
  c: ComponentCategory;
  s: string;
  prefix: string | null;
  /** [typ, objednací číslo, (adresa výrobku bez kategorie, když prefix = null), …údaje ze stránky]. */
  rows: (string | number)[][];
}

const GROUPS: Group[] = [
  { cat: "jistice-1pol-s201-6ka-charakteristika-b-18318", c: "MCB", s: "System pro M compact S200", prefix: "jistic-1polovy-6ka-charakteristika-b-", rows: [["S201-B2", "2CDS251001R0025"], ["S201-B6", "2CDS251001R0065"], ["S201-B10", "2CDS251001R0105"], ["S201-B13", "2CDS251001R0135"], ["S201-B16", "2CDS251001R1165"], ["S201-B20", "2CDS251001R0205"], ["S201-B25", "2CDS251001R0255"], ["S201-B32", "2CDS251001R0325"], ["S201-B40", "2CDS251001R0405"], ["S201-B50", "2CDS251001R0505"], ["S201-B63", "2CDS251001R0635"]] },
  { cat: "jistice-1pol-s201-6-ka-charakteristika-c-16995", c: "MCB", s: "System pro M compact S200", prefix: "jistic-s200-1fazovy-", rows: [["S201-C1", "2CDS251001R0014"], ["S201-C2", "2CDS251001R0024"], ["S201-C3", "2CDS251001R0034"], ["S201-C4", "2CDS251001R0044"], ["S201-C6", "2CDS251001R0064"], ["S201-C8", "2CDS251001R0084"], ["S201-C10", "2CDS251001R0104"], ["S201-C13", "2CDS251001R0134"], ["S201-C16", "2CDS251001R0164"], ["S201-C20", "2CDS251001R0204"], ["S201-C25", "2CDS251001R0254"], ["S201-C32", "2CDS251001R0324"], ["S201-C40", "2CDS251001R0404"], ["S201-C50", "2CDS251001R0504"], ["S201-C63", "2CDS251001R0634"]] },
  { cat: "jistice-3pol-s203-6ka-charakteristika-b-18342", c: "MCB", s: "System pro M compact S200", prefix: "jistic-3polovy-6ka-charakteristika-b-", rows: [["S203-B6", "2CDS253001R0065"], ["S203-B10", "2CDS253001R0105"], ["S203-B13", "2CDS253001R0135"], ["S203-B16", "2CDS253001R0165"], ["S203-B20", "2CDS253001R0205"], ["S203-B25", "2CDS253001R0255"], ["S203-B32", "2CDS253001R0325"], ["S203-B40", "2CDS253001R0405"], ["S203-B50", "2CDS253001R0505"], ["S203-B63", "2CDS253001R0635"]] },
  { cat: "jistice-3pol-s203-6-ka-charakteristika-c-16997", c: "MCB", s: "System pro M compact S200", prefix: "jistic-s200-3fazovy-", rows: [["S203-C1", "2CDS253001R0014"], ["S203-C2", "2CDS253001R0024"], ["S203-C3", "2CDS253001R0034"], ["S203-C4", "2CDS253001R0044"], ["S203-C6", "2CDS253001R0064"], ["S203-C8", "2CDS253001R0084"], ["S203-C10", "2CDS253001R0104"], ["S203-C13", "2CDS253001R0134"], ["S203-C16", "2CDS253001R0164"], ["S203-C20", "2CDS253001R0204"], ["S203-C25", "2CDS253001R0254"], ["S203-C32", "2CDS253001R0324"], ["S203-C40", "2CDS253001R0404"], ["S203-C50", "2CDS253001R0504"], ["S203-C63", "2CDS253001R0634"]] },
  { cat: "jistice-1pol-s201m-10ka-charakteristika-b-16998", c: "MCB", s: "System pro M compact S200M", prefix: "jistic-s200m-1fazovy-", rows: [["S201M-B6", "2CDS271001R0065"], ["S201M-B10", "2CDS271001R0105"], ["S201M-B13", "2CDS271001R0135"], ["S201M-B16", "2CDS271001R0165"], ["S201M-B20", "2CDS271001R0205"], ["S201M-B25", "2CDS271001R0255"], ["S201M-B32", "2CDS271001R0325"], ["S201M-B40", "2CDS271001R0405"], ["S201M-B50", "2CDS271001R0505"], ["S201M-B63", "2CDS271001R0635"]] },
  { cat: "jistice-1pol-s201m-10ka-charakteristika-c-16999", c: "MCB", s: "System pro M compact S200M", prefix: "jistic-s200m-1fazovy-", rows: [["S201M-C1", "2CDS271001R0014"], ["S201M-C2", "2CDS271001R0024"], ["S201M-C3", "2CDS271001R0034"], ["S201M-C4", "2CDS271001R0044"], ["S201M-C6", "2CDS271001R0064"], ["S201M-C8", "2CDS271001R0084"], ["S201M-C10", "2CDS271001R0104"], ["S201M-C13", "2CDS271001R0134"], ["S201M-C16", "2CDS271001R0164"], ["S201M-C20", "2CDS271001R0204"], ["S201M-C25", "2CDS271001R0254"], ["S201M-C32", "2CDS271001R0324"], ["S201M-C40", "2CDS271001R0404"], ["S201M-C50", "2CDS271001R0504"], ["S201M-C63", "2CDS271001R0634"]] },
  { cat: "jistice-3pol-s203m-10ka-charakteris-b-17000", c: "MCB", s: "System pro M compact S200M", prefix: "jistic-s200m-3fazovy-", rows: [["S203M-B10", "2CDS273001R0105"], ["S203M-B16", "2CDS273001R0165"], ["S203M-B20", "2CDS273001R0205"], ["S203M-B25", "2CDS273001R0255"], ["S203M-B32", "2CDS273001R0325"], ["S203M-B40", "2CDS273001R0405"], ["S203M-B50", "2CDS273001R0505"], ["S203M-B63", "2CDS273001R0635"]] },
  { cat: "jistice-3pol-s203m-10ka-charakteris-c-17001", c: "MCB", s: "System pro M compact S200M", prefix: "jistic-s200m-3fazovy-", rows: [["S203M-C1", "2CDS273001R0014"], ["S203M-C2", "2CDS273001R0024"], ["S203M-C3", "2CDS273001R0034"], ["S203M-C4", "2CDS273001R0044"], ["S203M-C6", "2CDS273001R0064"], ["S203M-C8", "2CDS273001R0084"], ["S203M-C10", "2CDS273001R0104"], ["S203M-C13", "2CDS273001R0134"], ["S203M-C16", "2CDS273001R0164"], ["S203M-C20", "2CDS273001R0204"], ["S203M-C25", "2CDS273001R0254"], ["S203M-C32", "2CDS273001R0324"], ["S203M-C40", "2CDS273001R0404"], ["S203M-C50", "2CDS273001R0504"], ["S203M-C63", "2CDS273001R0634"]] },
  { cat: "fh200-typ-a-6ka-sirka-2-moduly-18574", c: "RCD", s: "FH200 (Compact Home)", prefix: null, rows: [["FH202 A-25/0,03", "2CSF202102R1250", "fh202-a-25/0-03-proudovy-chranic-2csf202102r1250"], ["FH202 A-40/0,03", "2CSF202102R1400", "fh202-a-40/0-03-proudovy-chranic-2csf202102r1400"]] },
  { cat: "fh200-typ-a-6ka-sirka-4-moduly-18578", c: "RCD", s: "FH200 (Compact Home)", prefix: null, rows: [["FH204 A-25/0,03", "2CSF204102R1250", "fh204-a-25/0-03-proudovy-chranic-2csf204102r1250"], ["FH204 A-40/0,03", "2CSF204102R1400", "fh204-a-40/0-03-proudovy-chranic-2csf204102r1400"], ["FH204 A-63/0,03", "2CSF204102R1630", "fh204-a-63/0-03-proudovy-chranic-2csf204102r1630"]] },
  { cat: "f200-typ-a-10ka-sirka-2-moduly-17005", c: "RCD", s: "System pro M compact F200", prefix: null, rows: [["F202 A-25/0,03", "2CSF202101R1250", "f202-a-25/0-03-proudovy-chranic-2csf202101r1250"], ["F202 A-25/0,3", "2CSF202101R3250", "f202-a-25/0-3-proudovy-chranic-2csf202101r3250"], ["F202 A-40/0,03", "2CSF202101R1400", "f202-a-40/0-03-proudovy-chranic-2csf202101r1400"], ["F202 A-40/0,3", "2CSF202101R3400", "f202-a-40/0-3-proudovy-chranic-2csf202101r3400"]] },
  { cat: "f200-typ-f-10ka-sirka-2-moduly-21809", c: "RCD", s: "System pro M compact F200", prefix: null, rows: [["F202 F-25/0,03", "2CSF202325R1250", "f202-f-25/0-03-proudovy-chranic-2csf202325r1250"], ["F202 F-40/0,03", "2CSF202325R1400", "f202-f-40/0-03-proudovy-chranic-2csf202325r1400"]] },
  { cat: "f200-typ-a-s-10ka-sirka-4-moduly-21961", c: "RCD", s: "System pro M compact F200", prefix: null, rows: [["F204 A S-40/0,3", "2CSF204201R3400", "f204-a-s-40/0-3-selektivni-proudovy-chranic-2csf204201r3400"], ["F204 A S-63/0,3", "2CSF204201R3630", "f204-a-s-63/0-3-selektivni-proudovy-chranic-2csf204201r3630"]] },
  { cat: "f200-typ-a-10ka-sirka-4-moduly-17008", c: "RCD", s: "System pro M compact F200", prefix: null, rows: [["F204 A-25/0,03", "2CSF204101R1250", "f204-a-25/0-03-proudovy-chranic-2csf204101r1250"], ["F204 A-25/0,3", "2CSF204101R3250", "f204-a-25/0-3-proudovy-chranic-2csf204101r3250"], ["F204 A-40/0,3", "2CSF204101R3400", "f204-a-40/0-3-proudovy-chranic-2csf204101r3400"], ["F204 A-40/0,03", "2CSF204101R1400", "f204-a-40/0-03-proudovy-chranic-2csf204101r1400"], ["F204 A-63/0,03", "2CSF204101R1630", "f204-a-63/0-03-proudovy-chranic-2csf204101r1630"], ["F204 A-63/0,3", "2CSF204101R3630", "f204-a-63/0-3-proudovy-chranic-2csf204101r3630"]] },
  { cat: "f200-typ-f-10ka-sirka-4-moduly-21810", c: "RCD", s: "System pro M compact F200", prefix: null, rows: [["F204 F-25/0,03", "2CSF204325R1250", "f204-f-25/0-03-proudovy-chranic-2csf204325r1250"], ["F204 F-40/0,03", "2CSF204325R1400", "f204-f-40/0-03-proudovy-chranic-2csf204325r1400"], ["F204 F-63/0,03", "2CSF204325R1630", "f204-f-63/0-03-proudovy-chranic-2csf204325r1630"]] },
  { cat: "ds200-typ-a-6ka-4-polovy-19775", c: "RCBO", s: "DS200", prefix: null, rows: [["DS204 A-B10/0,03", "2CSR254101R1105", "ds204-a-b10/0-03-kombinace-jistic/chranic-2csr254101r1105", 6], ["DS204 A-B16/0,03", "2CSR254101R1165", "ds204-a-b16/0-03-kombinace-jistic/chranic-2csr254101r1165", 6], ["DS204 A-B20/0,03", "2CSR254101R1205", "ds204-a-b20/0-03-kombinace-jistic/chranic-2csr254101r1205", 6], ["DS204 A-C10/0,03", "2CSR254101R1104", "ds204-a-c10/0-03-kombinace-jistic/chranic-2csr254101r1104", 6], ["DS204 A-C16/0,03", "2CSR254101R1164", "ds204-a-c16/0-03-kombinace-jistic/chranic-2csr254101r1164", 6], ["DS204 A-C20/0,03", "2CSR254101R1204", "ds204-a-c20/0-03-kombinace-jistic/chranic-2csr254101r1204", 6]] },
  { cat: "ds200-m-typ-a-10ka-4-polovy-19782", c: "RCBO", s: "DS200 M", prefix: null, rows: [["DS204 M A-B10/0,03", "2CSR274101R1105", "ds204-m-a-b10/0-03-kombinace-jistic/chranic-2csr274101r1105", 6], ["DS204 M A-B16/0,03", "2CSR274101R1165", "ds204-m-a-b16/0-03-kombinace-jistic/chranic-2csr274101r1165", 6], ["DS204 M A-B20/0,03", "2CSR274101R1205", "ds204-m-a-b20/0-03-kombinace-jistic/chranic-2csr274101r1205", 6], ["DS204 M A-C10/0,03", "2CSR274101R1104", "ds204-m-a-c10/0-03-kombinace-jistic/chranic-2csr274101r1104", 6], ["DS204 M A-C16/0,03", "2CSR274101R1164", "ds204-m-a-c16/0-03-kombinace-jistic/chranic-2csr274101r1164", 6], ["DS204 M A-C20/0,03", "2CSR274101R1204", "ds204-m-a-c20/0-03-kombinace-jistic/chranic-2csr274101r1204", 6]] },
  { cat: "ds201-typ-a-6ka-sirka-2-moduly-19760", c: "RCBO", s: "DS201", prefix: null, rows: [["DS201 B6 A30", "2CSR255180R1065", "ds201-b6-a30-kombinace-jistic/chranic-2csr255180r1065"], ["DS201 B10 A30", "2CSR255180R1105", "ds201-b10-a30-kombinace-jistic/chranic-2csr255180r1105"], ["DS201 B16 A30", "2CSR255180R1165", "ds201-b16-a30-kombinace-jistic/chranic-2csr255180r1165"], ["DS201 C6 A30", "2CSR255180R1064", "ds201-c6-a30-kombinace-jistic/chranic-2csr255180r1064"], ["DS201 C10 A30", "2CSR255180R1104", "ds201-c10-a30-kombinace-jistic/chranic-2csr255180r1104"], ["DS201 C16 A30", "2CSR255180R1164", "ds201-c16-a30-kombinace-jistic/chranic-2csr255180r1164"]] },
  { cat: "ds201-m-typ-a-10ka-sirka-2-moduly-19767", c: "RCBO", s: "DS201 M", prefix: null, rows: [["DS201 M B6 A30", "2CSR275180R1065", "ds201-m-b6-a30-kombinace-jistic/chranic-2csr275180r1065"], ["DS201 M B10 A30", "2CSR275180R1105", "ds201-m-b10-a30-kombinace-jistic/chranic-2csr275180r1105"], ["DS201 M B16 A30", "2CSR275180R1165", "ds201-m-b16-a30-kombinace-jistic/chranic-2csr275180r1165"], ["DS201 M C6 A30", "2CSR275180R1064", "ds201-m-c6-a30-kombinace-jistic/chranic-2csr275180r1064"], ["DS201 M C10 A30", "2CSR275180R1104", "ds201-m-c10-a30-kombinace-jistic/chranic-2csr275180r1104"], ["DS201 M C16 A30", "2CSR275180R1164", "ds201-m-c16-a30-kombinace-jistic/chranic-2csr275180r1164"]] },
  { cat: "ds201-m-typ-f-10ka-sirka-2-moduly-21806", c: "RCBO", s: "DS201 M", prefix: null, rows: [["DS201 M B10 F30", "2CSR275580R1105", "ds201-m-b10-f30-kombinace-jistic/chranic-2csr275580r1105"], ["DS201 M B16 F30", "2CSR275580R1165", "ds201-m-b16-f30-kombinace-jistic/chranic-2csr275580r1165"]] },
  { cat: "ds301c-typ-a-6ka-sirka-1-modul-20046", c: "RCBO", s: "DS301C", prefix: null, rows: [["DS301C B6 A30", "2CSR255163R1065", "ds301c-b6-a30-kombinace-jistic/chranic-2csr255163r1065"], ["DS301C B10 A30", "2CSR255163R1105", "ds301c-b10-a30-kombinace-jistic/chranic-2csr255163r1105"], ["DS301C B13 A30", "2CSR255163R1135", "ds301c-b13-a30-kombinace-jistic/chranic-2csr255163r1135"], ["DS301C B16 A30", "2CSR255163R1165", "ds301c-b16-a30-kombinace-jistic/chranic-2csr255163r1165"], ["DS301C B20 A30", "2CSR255163R1205", "ds301c-b20-a30-kombinace-jistic/chranic-2csr255163r1205"], ["DS301C C6 A30", "2CSR255163R1064", "ds301c-c6-a30-kombinace-jistic/chranic-2csr255163r1064"], ["DS301C C10 A30", "2CSR255163R1104", "ds301c-c10-a30-kombinace-jistic/chranic-2csr255163r1104"], ["DS301C C13 A30", "2CSR255163R1134", "ds301c-c13-a30-kombinace-jistic/chranic-2csr255163r1134"], ["DS301C C16 A30", "2CSR255163R1164", "ds301c-c16-a30-kombinace-jistic/chranic-2csr255163r1164"], ["DS301C C20 A30", "2CSR255163R1204", "ds301c-c20-a30-kombinace-jistic/chranic-2csr255163r1204"]] },
  { cat: "ds301c-typ-f-6ka-sirka-1-modul-21773", c: "RCBO", s: "DS301C", prefix: null, rows: [["DS301C B6 F30", "2CSR255563R1065", "ds301c-b6-f30-kombinace-jistic/chranic-2csr255563r1065"], ["DS301C B10 F30", "2CSR255563R1105", "ds301c-b10-f30-kombinace-jistic/chranic-2csr255563r1105"], ["DS301C B13 F30", "2CSR255563R1135", "ds301c-b13-f30-kombinace-jistic/chranic-2csr255563r1135"], ["DS301C B16 F30", "2CSR255563R1165", "ds301c-b16-f30-kombinace-jistic/chranic-2csr255563r1165"], ["DS301C B20 F30", "2CSR255563R1205", "ds301c-b20-f30-kombinace-jistic/chranic-2csr255563r1205"], ["DS301C C6 F30", "2CSR255563R1064", "ds301c-c6-f30-kombinace-jistic/chranic-2csr255563r1064"], ["DS301C C10 F30", "2CSR255563R1104", "ds301c-c10-f30-kombinace-jistic/chranic-2csr255563r1104"], ["DS301C C13 F30", "2CSR255563R1134", "ds301c-c13-f30-kombinace-jistic/chranic-2csr255563r1134"], ["DS301C C16 F30", "2CSR255563R1164", "ds301c-c16-f30-kombinace-jistic/chranic-2csr255563r1164"], ["DS301C C20 F30", "2CSR255563R1204", "ds301c-c20-f30-kombinace-jistic/chranic-2csr255563r1204"]] },
  { cat: "ds301c-m-typ-a-10ka-sirka-1-modul-21967", c: "RCBO", s: "DS301C M", prefix: null, rows: [["DS301C M B10 A30", "2CSR275163R1105", "ds301c-m-b10-a30-kombinace-jistic/chranic-2csr275163r1105"], ["DS301C M B16 A30", "2CSR275163R1165", "ds301c-m-b16-a30-kombinace-jistic/chranic-2csr275163r1165"], ["DS301C M B20 A30", "2CSR275163R1205", "ds301c-m-b20-a30-kombinace-jistic/chranic-2csr275163r1205"], ["DS301C M C10 A30", "2CSR275163R1104", "ds301c-m-c10-a30-kombinace-jistic/chranic-2csr275163r1104"], ["DS301C M C16 A30", "2CSR275163R1164", "ds301c-m-c16-a30-kombinace-jistic/chranic-2csr275163r1164"], ["DS301C M C20 A30", "2CSR275163R1204", "ds301c-m-c20-a30-kombinace-jistic/chranic-2csr275163r1204"]] },
  { cat: "ds301c-m-typ-f-10ka-sirka-1-modul-21966", c: "RCBO", s: "DS301C M", prefix: null, rows: [["DS301C M B10 F30", "2CSR275563R1105", "ds301c-m-b10-f30-kombinace-jistic/chranic-2csr275563r1105"], ["DS301C M B16 F30", "2CSR275563R1165", "ds301c-m-b16-f30-kombinace-jistic/chranic-2csr275563r1165"], ["DS301C M B20 F30", "2CSR275563R1205", "ds301c-m-b20-f30-kombinace-jistic/chranic-2csr275563r1205"], ["DS301C M C10 F30", "2CSR275563R1104", "ds301c-m-c10-f30-kombinace-jistic/chranic-2csr275563r1104"], ["DS301C M C16 F30", "2CSR275563R1164", "ds301c-m-c16-f30-kombinace-jistic/chranic-2csr275563r1164"], ["DS301C M C20 F30", "2CSR275563R1204", "ds301c-m-c20-f30-kombinace-jistic/chranic-2csr275563r1204"]] },
  { cat: "odpinace-rady-sd-1polove-17017", c: "MAIN_SWITCH", s: "SD200", prefix: "odpinac-sd200-1fazovy-", rows: [["SD201/16", "2CDD281101R0016"], ["SD201/25", "2CDD281101R0025"], ["SD201/32", "2CDD281101R0032"], ["SD201/40", "2CDD281101R0040"], ["SD201/50", "2CDD281101R0050"], ["SD201/63", "2CDD281101R0063"]] },
  { cat: "odpinace-rady-sd-3polove-17018", c: "MAIN_SWITCH", s: "SD200", prefix: "odpinac-sd200-3fazovy-", rows: [["SD203/16", "2CDD283101R0016"], ["SD203/25", "2CDD283101R0025"], ["SD203/32", "2CDD283101R0032"], ["SD203/40", "2CDD283101R0040"], ["SD203/50", "2CDD283101R0050"], ["SD203/63", "2CDD283101R0063"]] },
  { cat: "odpinace-rady-shd-1polove-17015", c: "MAIN_SWITCH", s: "SHD200 (Compact Home)", prefix: "odpinac-shd200-1fazovy-", rows: [["SHD201/16", "2CDD271111R0016"], ["SHD201/25", "2CDD271111R0025"], ["SHD201/32", "2CDD271111R0032"], ["SHD201/40", "2CDD271111R0040"], ["SHD201/50", "2CDD271111R0050"], ["SHD201/63", "2CDD271111R0063"]] },
  { cat: "odpinace-rady-shd-3polove-17016", c: "MAIN_SWITCH", s: "SHD200 (Compact Home)", prefix: "odpinac-shd200-3fazovy-", rows: [["SHD203/16", "2CDD273111R0016"], ["SHD203/25", "2CDD273111R0025"], ["SHD203/32", "2CDD273111R0032"], ["SHD203/40", "2CDD273111R0040"], ["SHD203/50", "2CDD273111R0050"], ["SHD203/63", "2CDD273111R0063"]] },
  // OVR: [typ, objednací číslo, (adresa), počet modulů]
  { cat: "ovr-t1-t2-svodice-prepeti-typ-1-2-17012", c: "SPD", s: "OVR", prefix: "svodic-prepeti-ovr-typ-t1-t2-", rows: [["OVR T1-T2 1N 12.5-275s P QS", "2CTB815710R1300", 2], ["OVR T1-T2 3L 12.5-275s P QS", "2CTB815710R1800", 3], ["OVR T1-T2 3N 12.5-275s P QS", "2CTB815710R1900", 4], ["OVR T1-T2 4L 12.5-275s P QS", "2CTB815710R2300", 4], ["OVR T1-T2 12.5-275s P QS", "2CTB815710R1200", 1]] },
  { cat: "ovr-t2-svodice-prepeti-typ-2-17014", c: "SPD", s: "OVR", prefix: null, rows: [["OVR T2 1N 40-275 P QS", "2CTB803972R1100", "svodice-prepeti-ovr-typ-t2-2ctb803972r1100", 2], ["OVR T2 3L 40-275 P QS", "2CTB803873R2400", "svodic-prepeti-ovr-typ-t2-2ctb803873r2400", 3], ["OVR T2 3L 40-275s P QS", "2CTB815704R1800", "svodic-prepeti-ovr-typ-t2-2ctb815704r1800", 3], ["OVR T2 3N 40-275 P QS", "2CTB803973R1100", "svodic-prepeti-ovr-typ-t2-2ctb803973r1100", 4], ["OVR T2 4L 40-275 P QS", "2CTB803873R5600", "svodic-prepeti-ovr-typ-t2-2ctb803873r5600", 4], ["OVR T2 4L 40-275s P QS", "2CTB815704R2300", "svodic-prepeti-ovr-typ-t2-2ctb815704r2300", 4], ["OVR T2 40-275 P QS", "2CTB803871R2300", "svodic-prepeti-ovr-typ-t2-2ctb803871r2300", 1]] },
  // ESB: [typ, objednací číslo, napětí cívky, počet modulů]
  { cat: "instalacni-stykace-230-v-ac-17033", c: "CONTACTOR", s: "ESB", prefix: "stykac-instalacni-", rows: [["ESB16-20N-01", "1SBE111111R0120", "24V AC/DC", 1], ["ESB16-20N-06", "1SBE111111R0620", "230 V AC/DC", 1], ["ESB20-20N-06", "1SBE121111R0620", "230 V AC", 1], ["ESB25-04N-06", "1SAE231111R0604", "230–240 V AC/DC", 2], ["ESB25-13N-06", "1SAE231111R0613", "230–240 V AC/DC", 2], ["ESB25-22N-06", "1SAE231111R0622", "230–240 V AC/DC", 2], ["ESB25-31N-06", "1SAE231111R0631", "230–240 V AC/DC", 2], ["ESB25-40N-06", "1SAE231111R0640", "230–240 V AC/DC", 2]] },
  // Relé a časové spínače: [typ, objednací číslo, (adresa), podtyp, In kontaktů A, kontakty, napájení, počet modulů]
  { cat: "ag-timer-elektromechanicke-casove-spinace-21561", c: "RELAY", s: "AG Timer", prefix: "ad1no-15m-casovy-spinac-", rows: [["AD1NO-15m", "2CSM222471R1000", "TIMER", 16, "1NO", "230 V AC", 1]] },
  { cat: "ct-d-casova-rele-21563", c: "RELAY", s: "CT-D", prefix: null, rows: [["CT-AHD.12", "1SVR500110R0000", "ct-ahd-12-casove-rele-1svr500110r0000", "TIMER", 0, "1CO", "24-240 V AC, 24-48 V DC", 1], ["CT-ERD.12", "1SVR500100R0000", "ct-erd-12-casove-rele-1svr500100r0000", "TIMER", 0, "1CO", "24-240 V AC, 24-48 V DC", 1], ["CT-MFD.12", "1SVR500020R0000", "ct-mfd-12-casove-rele-1svr500020r0000", "TIMER", 0, "1CO", "24-240 V AC, 24-48 V DC", 1], ["CT-MFD.21", "1SVR500020R1100", "ct-mfd-21-casove-rele-1svr500020r1100", "TIMER", 0, "2CO", "12-240 V AC/DC", 1], ["CT-SDD.22", "1SVR500211R0100", "ct-sdd-22-casove-rele-1svr500211r0100", "TIMER", 0, "2NO", "24-240 V AC, 24-48 V DC", 1], ["CT-TGD.12", "1SVR500160R0000", "ct-tgd-12-casove-rele-1svr500160r0000", "TIMER", 0, "1CO", "24-240 V AC, 24-48 V DC", 1]] },
  { cat: "dbt-digitalni-casove-spinace-17036", c: "RELAY", s: "DBT", prefix: null, rows: [["DW1", "2CSM222531R1000", "dw1-casovy-spinac-2csm222531r1000", "TIMER", 16, "1CO", "230 V AC", 2], ["DW2", "2CSM222521R1000", "dw2-casovy-spinac-2csm222521r1000", "TIMER", 16, "2CO", "230 V AC", 2], ["DWA1", "2CSM222511R1000", "dwa1-casovy-spinac-2csm222511r1000", "TIMER", 16, "1CO", "230 V AC", 2], ["DWA2", "2CSM222501R1000", "dwa2-casovy-spinac-2csm222501r1000", "TIMER", 16, "2CO", "230 V AC", 2], ["DWTL1", "2CSM222491R1000", "dwtl1-casovy-spinac-2csm222491r1000", "TIMER", 16, "1CO", "230 V AC", 2], ["DY365", "2CSM221201R1000", "dy365-casovy-spinac-2csm221201r1000", "TIMER", 16, "2CO", "230 V AC", 4]] },
  { cat: "e232-schodistove-casove-spinace-21562", c: "RELAY", s: "E232", prefix: null, rows: [["E232-230", "2CDE110000R0501", "e232-230-schodistovy-spinac-2cde110000r0501", "STAIRCASE", 16, "", "230 V AC", 1], ["E232E-230N", "2CDE110003R0511", "e232e-230n-schodistovy-spinac-2cde110003r0511", "STAIRCASE", 16, "", "230 V AC", 1]] },
  { cat: "e290-impulsni-rele-230-v-ac-17031", c: "RELAY", s: "E290", prefix: null, rows: [["E290-16-10/230", "2TAZ312000R2011", "e290-16-10/230-impulsni-rele-2taz312000r2011", "IMPULSE", 16, "1NO", "230 V AC", 1], ["E290-16-11/230", "2TAZ312000R2013", "e290-16-11/230-impulsni-rele-2taz312000r2013", "IMPULSE", 16, "1NO+1NC", "230 V AC", 1], ["E290-16-20/230", "2TAZ312000R2012", "e290-16-20/230-impulsni-rele-2taz312000r2012", "IMPULSE", 16, "2NO", "230 V AC", 1], ["E290-32-10/230", "2TAZ322000R2011", "e290-32-10/230-impulsni-rele-2taz322000r2011", "IMPULSE", 32, "1NO", "230 V AC", 1], ["E290-32-11/230", "2TAZ322000R2013", "e290-32-11/230-impulsni-rele-2taz322000r2013", "IMPULSE", 32, "1NO+1NC", "230 V AC", 1], ["E290-32-20/230", "2TAZ322000R2012", "e290-32-20/230-impulsni-rele-2taz322000r2012", "IMPULSE", 32, "2NO", "230 V AC", 1]] },
  { cat: "e297-instalacni-rele-230-v-ac-17032", c: "RELAY", s: "E297", prefix: null, rows: [["E297-16-10/230", "2TAZ311000R2011", "e297-16-10/230-instalacni-rele-2taz311000r2011", "AUXILIARY", 16, "1NO", "230 V AC", 1], ["E297-16-20/230", "2TAZ311000R2012", "e297-16-20/230-instalacni-rele-2taz311000r2012", "AUXILIARY", 16, "2NO", "230 V AC", 1]] },
  // Zvonkové transformátory: [typ, objednací číslo, sekundární napětí / výkon, počet modulů (šířka 36 mm)]
  { cat: "zvonkove-transformatory-19826", c: "PSU", s: "TM", prefix: "zvonkove-transformatory-tm-", rows: [["TM10/12", "2CSM228715R0802", "4, 8, 12 V / 10 VA", 2], ["TM10/24", "2CSM228725R0802", "12, 24 V / 10 VA", 2]] },
  // Elektroměry: [typ, objednací číslo, (adresa), póly, max. proud A (0 = nepřímé měření), počet modulů, MID]
  { cat: "b24-neprime-mereni-3-faze-17023", c: "OTHER", s: "B24", prefix: "b24-111-100-trifazovy-elektromer-pro-neprime-mereni-", rows: [["B24 111-100", "2CMA100177R1000", "3P", 0, 4, "ANO"]] },
  { cat: "d11-prime-mereni-do-40a-1-faze-21165", c: "OTHER", s: "D11", prefix: null, rows: [["D11 15 40", "2CMA241655R1000", "d11-15-40-jednofazovy-elektromer-pro-prime-mereni-do-40-a-2cma241655r1000", "1P", 40, 1, "NE"], ["D11 15-M 40", "2CMA241645R1000", "d11-15-m-40-jednofazovy-elektromer-pro-prime-mereni-do-40-a-2cma241645r1000", "1P", 40, 1, "ANO"]] },
  { cat: "d13-prime-mereni-do-65a-3-faze-21166", c: "OTHER", s: "D13", prefix: null, rows: [["D13 15 65", "2CMA241725R1000", "d13-15-65-trojfazovy-elektromer-pro-prime-mereni-do-65-a-2cma241725r1000", "3P", 65, 3, "NE"], ["D13 15-M 65", "2CMA241695R1000", "d13-15-m-65-trojfazovy-elektromer-pro-prime-mereni-do-65-a-2cma241695r1000", "3P", 65, 3, "ANO"]] },
  // Signálky E219 (šířka 9 mm = 0,5 M): [typ, objednací číslo, barva]
  { cat: "signalky-230-v-ac-17030", c: "OTHER", s: "E219", prefix: "signalka-", rows: [["E219-2CD", "2CCA703910R0001", "zelená / červená"], ["E219-3C", "2CCA703900R0001", "3× červená"], ["E219-3CDE", "2CCA703902R0001", "červená / žlutá / zelená"], ["E219-3D", "2CCA703901R0001", "3× zelená"], ["E219-B220DC", "2CCA703405R0001", "bílá"], ["E219-C", "2CCA703401R0001", "červená"], ["E219-C220DC", "2CCA703406R0001", "červená"], ["E219-D", "2CCA703402R0001", "zelená"], ["E219-D220DC", "2CCA703407R0001", "zelená"], ["E219-E", "2CCA703403R0001", "žlutá"], ["E219-E220DC", "2CCA703408R0001", "žlutá"], ["E219-G", "2CCA703404R0001", "modrá"], ["E219-G220DC", "2CCA703409R0001", "modrá"]] },
  // Přídavné hlavní kontakty k impulsnímu relé E290 16 A: [typ, objednací číslo, (adresa), kontakty]
  { cat: "prislusenstvi-pro-impulsni-rele-e290-21157", c: "OTHER", s: "E290", prefix: null, rows: [["E292-16-001", "2CCA704302R0001", "e292-16-001-pridavny-hlavni-kontakt-2cca704302r0001", "1CO"], ["E292-16-11", "2CCA704301R0001", "e292-16-11-pridavny-hlavni-kontakt-2cca704301r0001", "1NO+1NC"], ["E292-16-20", "2CCA704300R0001", "e292-16-20-pridavny-hlavni-kontakt-2cca704300r0001", "2NO"]] },
  // Pojistkové odpínače E90 pro pojistky 10,3 × 38 mm: [typ, objednací číslo, počet modulů]
  { cat: "pojistkove-odpinace-17024", c: "OTHER", s: "E90", prefix: "odpinac-pojistkovy-", rows: [["E 91/50", "2CSM279022R1801", 1], ["E 93/50", "2CSM277962R1801", 3], ["E91/32", "2CSM200923R1801", 1], ["E92/32", "2CSM200883R1801", 2], ["E93/32", "2CSM204753R1801", 3]] },
  // Zásuvky na lištu DIN 16 A, šířka 40 mm (výrobce) → 2,5 M na liště: [typ, objednací číslo]
  { cat: "zasuvky-17034", c: "OTHER", s: "M1170", prefix: "zasuvka-", rows: [["M1174", "2CSM110000R0711"], ["M1175", "2CSM210000R0721"]] },
  // Hřebenové přípojnice PS / PSc (63 A, rozteč pinů 17,6 mm) a koncové krytky: [typ, objednací číslo, (adresa), póly, počet pinů]
  { cat: "pripojnice-krytky-17045", c: "OTHER", s: "PS", prefix: null, rows: [["PS-END", "2CDL200001R0001", "ps-end-koncova-krytka-2cdl200001r0001"], ["PS-END 0", "2CDL200001R0004", "ps-end-0-koncova-krytka-2cdl200001r0004"]] },
  { cat: "pripojnice-1fazove-roztec-pinu-17-6-mm-21820", c: "OTHER", s: "PS", prefix: null, rows: [["PS1/3", "2CDL210001R1003", "ps1/3-pripojnice-2cdl210001r1003", "1P", 3], ["PS1/12", "2CDL210001R1012", "ps1/12-pripojnice-2cdl210001r1012", "1P", 12], ["PS1/60", "2CDL210001R1060", "ps1/60-pripojnice-2cdl210001r1060", "1P", 60]] },
  { cat: "pripojnice-2polove-roztec-pinu-17-6-mm-21822", c: "OTHER", s: "PS", prefix: "ps2/12-pripojnice-", rows: [["PS2/12", "2CDL220001R1012", "2P", 12]] },
  { cat: "pripojnice-3fazove-roztec-pinu-17-6-mm-21821", c: "OTHER", s: "PS", prefix: null, rows: [["PS3/12", "2CDL230001R1012", "ps3/12-pripojnice-2cdl230001r1012", "3P", 12], ["PS3/12FI", "2CDL231002R1012", "ps3/12fi-pripojnice-2cdl231002r1012", "3P", 11], ["PS3/60", "2CDL230001R1060", "ps3/60-pripojnice-2cdl230001r1060", "3P", 60]] },
  { cat: "pripojnice-4polove-roztec-pinu-17-6-mm-21823", c: "OTHER", s: "PS", prefix: "ps4/12na-pripojnice-", rows: [["PS4/12NA", "2CDL240213R1012", "3P+N", 12]] },
  { cat: "pripojnice-psc-pro-ds301c-20067", c: "OTHER", s: "PSc", prefix: null, rows: [["PSc 1/24/10 N", "2CDL210331R1012", "psc-1/24/10-n-pripojnice-2cdl210331r1012", "1P+N", 24], ["PSc 1/114/10 N", "2CDL210331R1060", "psc-1/114/10-n-pripojnice-2cdl210331r1060", "1P+N", 114], ["PSc 3/24/10 N", "2CDL230331R1012", "psc-3/24/10-n-pripojnice-2cdl230331r1012", "3P+N", 24], ["PSc 3/114/10 N", "2CDL230331R1060", "psc-3/114/10-n-pripojnice-2cdl230331r1060", "3P+N", 114]] },
];

// ---------------------------------------------------------------------------
//  Typové označení ABB → parametry (chyba = neznámý tvar označení; data se nevymýšlí)
// ---------------------------------------------------------------------------

const ka = (series: string) => (/M$/.test(series) || series.endsWith(" M") ? 10 : 6);
const mA = (fraction: string) => Math.round(Number(fraction.replace(",", ".")) * 1000);
const fail = (type: string): never => {
  throw new Error(`ABB CZ: neznámé typové označení „${type}“`);
};

/** Zdroj a odkaz na produktový list PDF ABB. */
const pageUrl = (group: Group, row: readonly (string | number)[]) => `${ABB_CZ}/${group.cat}/${group.prefix !== null ? `${group.prefix}${String(row[1]).toLowerCase()}` : String(row[2])}`;
const extras = (group: Group, row: readonly (string | number)[]) => row.slice(group.prefix !== null ? 2 : 3);

type Fields = Omit<ResearchComponent, "manufacturer" | "series" | "typeCode" | "articleNumber" | "category" | "powerLossWatts" | "datasheetUrl" | "source">;

function fieldsOf(group: Group, type: string, extra: readonly (string | number)[]): Fields {
  let m: RegExpExecArray | null;
  switch (group.c) {
    case "MCB": {
      if (!(m = /^S20([13])(M?)-([BC])(\d+)$/.exec(type))) return fail(type);
      const poles = m[1] === "1" ? "1P" : "3P";
      const icn = m[2] ? 10 : 6;
      return { poles, ratedCurrentA: +m[4], trippingCurve: m[3], breakingCapacityKa: icn, modulesCount: +m[1], description: `Jistič ${poles}, ${m[4]} A, char. ${m[3]}, ${icn} kA` };
    }
    case "RCD": {
      if (!(m = /^(F|FH)20([24]) (A S|A|F)-(\d+)\/(0,\d+)$/.exec(type))) return fail(type);
      const poles = m[2] === "2" ? "2P" : "4P";
      const sensitivity = mA(m[5]);
      const icn = m[1] === "FH" ? 6 : 10;
      return { poles, ratedCurrentA: +m[4], rcdSensitivityMa: sensitivity, rcdType: m[3] === "A S" ? "S" : m[3], breakingCapacityKa: icn, modulesCount: +m[2], description: `Proudový chránič ${poles}, ${m[4]} A / ${sensitivity} mA, typ ${m[3] === "A S" ? "A selektivní (S)" : m[3]}, ${icn} kA` };
    }
    case "RCBO": {
      if ((m = /^(DS201|DS201 M|DS301C|DS301C M) ([BC])(\d+) ([AF])(\d+)$/.exec(type))) {
        const modules = m[1].startsWith("DS301C") ? 1 : 2;
        return { poles: "1P+N", ratedCurrentA: +m[3], trippingCurve: m[2], rcdType: m[4], rcdSensitivityMa: +m[5], breakingCapacityKa: ka(m[1]), modulesCount: modules, description: `Jističochránič 1P+N, char. ${m[2]}, ${m[3]} A / ${m[5]} mA, typ ${m[4]}, ${ka(m[1])} kA, ${modules} M` };
      }
      if (!(m = /^DS204( M)? ([AF])-([BC])(\d+)\/(0,\d+)$/.exec(type))) return fail(type);
      const icn = m[1] ? 10 : 6;
      const modules = Number(extra[0]);
      return { poles: "4P", ratedCurrentA: +m[4], trippingCurve: m[3], rcdType: m[2], rcdSensitivityMa: mA(m[5]), breakingCapacityKa: icn, modulesCount: modules, description: `Jističochránič 4P, char. ${m[3]}, ${m[4]} A / ${mA(m[5])} mA, typ ${m[2]}, ${icn} kA, ${modules} M` };
    }
    case "MAIN_SWITCH": {
      if (!(m = /^(SD|SHD)20([13])\/(\d+)$/.exec(type))) return fail(type);
      const poles = m[2] === "1" ? "1P" : "3P";
      return { poles, ratedCurrentA: +m[3], modulesCount: +m[2], description: `Vypínač (odpínač) ${poles}, ${m[3]} A` };
    }
    case "SPD": {
      if (!(m = /^OVR (T1-T2|T2)(?: (1N|3N|3L|4L))? ([\d.]+)-(\d+)s? P (QS|TS)$/.exec(type))) return fail(type);
      const poles = ({ "1N": "1P+N", "3N": "3P+N", "3L": "3P", "4L": "4P" } as Record<string, string>)[m[2] ?? ""] ?? "1P";
      const spdType = m[1] === "T1-T2" ? "T1+T2" : "T2";
      return { poles, ratedCurrentA: 0, spdType, surgeCurrentKa: Number(m[3]), modulesCount: Number(extra[0]), description: `Svodič přepětí ${spdType} ${poles}, ${spdType === "T1+T2" ? "Iimp (10/350)" : "Imax (8/20)"} ${String(m[3]).replace(".", ",")} kA, Uc ${m[4]} V, výměnné moduly, signalizace QS` };
    }
    case "CONTACTOR": {
      if (!(m = /^ESB(\d+)-(\d)(\d)N-(\d+)$/.exec(type))) return fail(type);
      const no = +m[2];
      const nc = +m[3];
      const contacts = [no ? `${no}NO` : "", nc ? `${nc}NC` : ""].filter(Boolean).join("+");
      return { poles: `${no + nc}P`, ratedCurrentA: +m[1], contactConfig: contacts, coilVoltage: String(extra[0]), modulesCount: Number(extra[1]), description: `Instalační stykač ${m[1]} A (AC-1), kontakty ${contacts}, cívka ${extra[0]}` };
    }
    case "RELAY": {
      const [subtype, current, contacts, supply, modules] = extra;
      const noun = subtype === "IMPULSE" ? "Impulsní relé" : subtype === "AUXILIARY" ? "Instalační relé" : subtype === "STAIRCASE" ? "Schodišťový časový spínač" : group.s === "CT-D" ? "Časové relé" : "Časový spínač";
      return {
        poles: "1P",
        ratedCurrentA: Number(current),
        relaySubtype: String(subtype),
        contactConfig: contacts ? String(contacts) : undefined,
        coilVoltage: String(supply),
        modulesCount: Number(modules),
        description: `${noun} ${type}${current ? `, ${current} A` : ""}${contacts ? `, ${contacts}` : ""}, napájení ${supply}`,
      };
    }
    case "PSU":
      return { poles: "1P", ratedCurrentA: 0, moduleSubtype: "BELL_TRANSFORMER", modulesCount: Number(extra[1]), description: `Zvonkový transformátor ${type}, sekundár ${extra[0]}` };
    case "OTHER":
      return otherFields(group, type, extra);
  }
  return fail(type);
}

function otherFields(group: Group, type: string, extra: readonly (string | number)[]): Fields {
  switch (group.s) {
    case "B24":
    case "D11":
    case "D13": {
      const [poles, current, modules, mid] = extra;
      return { poles: String(poles), ratedCurrentA: Number(current), moduleSubtype: "METER", modulesCount: Number(modules), description: `Elektroměr ${poles === "1P" ? "jednofázový" : "třífázový"} ${type}${current ? `, přímé měření do ${current} A` : ", nepřímé měření (přes MTP)"}${mid === "ANO" ? ", ověření MID" : ""}` };
    }
    case "E219":
      return { poles: "1P", ratedCurrentA: 0, moduleSubtype: "INDICATOR", modulesCount: 0.5, description: `Signálka ${type}, ${extra[0]}` };
    case "E290":
      return { poles: "1P", ratedCurrentA: 16, moduleSubtype: "AUX_CONTACT", contactConfig: String(extra[0]), modulesCount: 0.5, description: `Přídavný hlavní kontakt ${extra[0]} k impulsnímu relé E290 16 A` };
    case "E90": {
      const m = /^E ?9([123])\/(\d+)$/.exec(type) ?? fail(type);
      return { poles: `${m[1]}P`, ratedCurrentA: +m[2], moduleSubtype: "FUSE_DISCONNECTOR", modulesCount: Number(extra[0]), description: `Pojistkový odpínač ${m[1]}P, ${m[2]} A, pro pojistky 10,3 × 38 mm` };
    }
    case "M1170":
      return { poles: "1P", ratedCurrentA: 16, moduleSubtype: "DIN_SOCKET", modulesCount: 2.5, description: `Zásuvka na lištu DIN ${type}, 16 A, šířka 40 mm` };
    case "PS":
    case "PSc": {
      if (/^PS-END/.test(type)) return { poles: "1P", ratedCurrentA: 0, moduleSubtype: "BUSBAR_END_CAP", modulesCount: 0, description: `Koncová krytka hřebenové přípojnice ${type}` };
      const [poles, pins] = extra;
      return { poles: String(poles), ratedCurrentA: 63, moduleSubtype: "BUSBAR", modulesCount: 1, description: `Hřebenová propojovací lišta ${type} – ${poles}, ${pins} pinů, 63 A${group.s === "PSc" ? ", pro kompaktní 1M přístroje DS301C" : ""}` };
    }
  }
  return fail(type);
}

/** Rozpory stránky ABB CZ s typovým označením (zapsáno u kusu). */
const PAGE_NOTES: Record<string, string> = {
  "2CSF204102R1400": "stránka ABB CZ v popisu uvádí 25 A a typ AC – platí typové označení FH204 A-40/0,03",
  "2CSF204102R1630": "stránka ABB CZ v popisu uvádí 25 A a typ AC – platí typové označení FH204 A-63/0,03",
};
const T2_NOTE = "stránka ABB CZ u svodičů T2 uvádí Iimp 40 kA a Imax 80 kA – platí typové označení (Imax 40 kA)";

/** Modulové přístroje a příslušenství ABB z katalogu ABB pro ČR (290 kusů). */
export const ABB_CZ_COMPONENTS: ResearchComponent[] = GROUPS.flatMap((group) =>
  group.rows.map((row) => {
    const type = String(row[0]);
    const mpn = String(row[1]);
    const url = pageUrl(group, row);
    const note = PAGE_NOTES[mpn] ?? (group.c === "SPD" && type.startsWith("OVR T2") ? T2_NOTE : null);
    return {
      manufacturer: "ABB",
      series: group.s,
      typeCode: type,
      articleNumber: mpn,
      category: group.c,
      ...fieldsOf(group, type, extras(group, row)),
      powerLossWatts: null,
      ownCatalog: true,
      datasheetUrl: `${url}?mime=pdf`,
      source: `Katalog ABB pro ČR (nizke-napeti.cz.abb.com), ověřeno ${ABB_CZ_VERIFIED_ON}: ${url}${note ? ` – ${note}` : ""}`,
    };
  }),
);

// ---------------------------------------------------------------------------
//  Vazby příslušenství (CatalogRelation) – podle objednacích čísel
// ---------------------------------------------------------------------------

export interface AbbCzRelation {
  parents: readonly string[];
  children: readonly string[];
  relationType: "COMPATIBLE_BUSBAR" | "ACCESSORY" | "SIDE_UNSPECIFIED";
  basis: "catalog" | "derived";
  verified: boolean;
  note: string;
}

const articlesOf = (predicate: (component: ResearchComponent) => boolean) => ABB_CZ_COMPONENTS.filter(predicate).map((component) => component.articleNumber);
const byType = (pattern: RegExp) => articlesOf((component) => pattern.test(component.typeCode));

export const ABB_CZ_RELATIONS: readonly AbbCzRelation[] = [
  { parents: byType(/^DS301C /), children: byType(/^PSc /), relationType: "COMPATIBLE_BUSBAR", basis: "catalog", verified: true, note: "ABB CZ: přípojnice PSc jsou určeny pro kompaktní modulové přístroje DS301C" },
  { parents: byType(/^E290-16-/), children: byType(/^E292-16-/), relationType: "SIDE_UNSPECIFIED", basis: "catalog", verified: true, note: "ABB CZ: modul hlavních kontaktů připojitelný pouze k 16A verzi E290" },
  { parents: byType(/^PS[234]\//), children: byType(/^PS-END$/), relationType: "ACCESSORY", basis: "catalog", verified: true, note: "ABB CZ: koncová krytka PS-END pro 2 a 3fázové přípojnice PS" },
  { parents: byType(/^PS1\//), children: byType(/^PS-END 0$/), relationType: "ACCESSORY", basis: "catalog", verified: true, note: "ABB CZ: přípojnice PS1 – koncové krytky PS-END 0" },
  { parents: byType(/^S201M?-/), children: byType(/^PS1\//), relationType: "COMPATIBLE_BUSBAR", basis: "derived", verified: false, note: "odvozeno: PS pro standardní modulové přístroje (rozteč pinů 17,6 mm), 1 fáze = 1P jistič" },
  { parents: byType(/^S203M?-/), children: byType(/^PS3\/(12|60)$/), relationType: "COMPATIBLE_BUSBAR", basis: "derived", verified: false, note: "odvozeno: PS pro standardní modulové přístroje (rozteč pinů 17,6 mm), 3 fáze = 3P jistič" },
];
