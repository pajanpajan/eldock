// Fáze 114: příslušenství „Svorky / Hřebeny / Příslušenství“ s ověřeným objednacím číslem výrobce – aby kaskáda
// u ABB, OEZ, Hager a Schneider Electric nenabízela jen odhad IEC bez objednacího čísla. Jen oficiální data výrobců:
//  – ABB: produktové stránky new.abb.com (typ, EAN, šířka a Pv ze stránky výrobku, ověřeno 2026-11-14) a ABB ETIM 9.0
//    (ELSB_ETIM-9.0_2026-05 – svorky N/PE a záslepka rozvodnic Mistral),
//  – OEZ: oficiální BMEcat ETIM 8 (OEZ_CZ_etim_8__2026-10-29) – typ, popis a EAN,
//  – Hager: oficiální BMEcat ETIM 10 (BMEcat_CZ_10, 2026-04) – typ, popis, EAN, šířka a Pv,
//  – Schneider Electric: produktové stránky se.com/cz (název výrobku, šířka v roztečích 9 mm, ověřeno 2026-11-14).
// Kusy, které už katalog má (ABB PS, PS-END, E219, M1175, E 91; OEZ PS-LT, LMS, EKC, ZSE, MKA; Eaton a Hager z importu),
// se nezakládají znovu. Nedohledané (ABB podpěťová spoušť S2C-UA, Eaton koncovka a pojistka) zůstávají bez řádku – kaskáda
// u nich dál ukáže odhad IEC místo vymyšleného čísla.

import type { ResearchComponent } from "./seed-catalog-research";

const ABB_PAGE = (id: string) => `https://new.abb.com/products/${id}`;
const SE_PAGE = (ref: string) => `https://www.se.com/cz/cs/product/${ref}/`;
const ABB_SRC = "ABB – produktová stránka new.abb.com (ověřeno 2026-11-14)";
const ABB_ETIM = "ABB ETIM 9.0 (ELSB_ETIM-9.0_2026-05)";
const OEZ_ETIM = "OEZ – BMEcat ETIM 8 (OEZ_CZ_etim_8__2026-10-29)";
const HAGER_ETIM = "Hager – BMEcat ETIM 10 (BMEcat_CZ_10, 2026-04)";
const SE_SRC = "Schneider Electric – produktová stránka se.com/cz (ověřeno 2026-11-14)";

type Row = Omit<ResearchComponent, "category" | "poles" | "ratedCurrentA" | "datasheetUrl"> & Partial<Pick<ResearchComponent, "category" | "poles" | "ratedCurrentA" | "datasheetUrl">>;

const row = (entry: Row): ResearchComponent => ({ category: "OTHER", poles: "1P", ratedCurrentA: 0, datasheetUrl: null, ownCatalog: true, ...entry });

export const ACCESSORY_COMPONENTS: ResearchComponent[] = [
  // ABB
  row({ manufacturer: "ABB", series: "System pro M compact", typeCode: "S2C-H6R", articleNumber: "2CDS200912R0001", ean: "4016779563826", moduleSubtype: "AUX_CONTACT", contactConfig: "1NO+1NC", ratedCurrentA: 6, modulesCount: 0.5, powerLossWatts: 0.5, description: "Pomocný kontakt S2C-H6R – signalizace polohy kontaktů jističů S200, SN201, chráničů F200 a RCBO DS200, šířka 0,5 M", datasheetUrl: ABB_PAGE("2CDS200912R0001"), source: ABB_SRC }),
  row({ manufacturer: "ABB", series: "System pro M compact", typeCode: "S2C-A2", articleNumber: "2CDS200909R0002", ean: "4016779571005", moduleSubtype: "SHUNT_TRIP", modulesCount: 1, powerLossWatts: 0, description: "Vypínací spoušť S2C-A2 – dálkové vypnutí jističů S200 a RCBO přivedením napětí (cívka jen při vypnutí), šířka 17,5 mm", datasheetUrl: ABB_PAGE("2CDS200909R0002"), source: ABB_SRC }),
  row({ manufacturer: "ABB", series: "Mistral", typeCode: "41Z57", articleNumber: "1SPE007715F0731", ean: "8712507123497", category: "TERMINAL", moduleSubtype: "TERMINAL_BLOCK", ratedCurrentA: 100, modulesCount: 3, powerLossWatts: null, description: "Svorkovnice N šroubová NK/S06 – 6 svorek 3× 16 mm² + 3× 6 mm², 100 A (rozvodnice Mistral)", source: ABB_ETIM }),
  row({ manufacturer: "ABB", series: "Mistral", typeCode: "41Z62", articleNumber: "1SPE007715F0741", ean: "8712507123541", category: "TERMINAL", moduleSubtype: "TERMINAL_BLOCK", ratedCurrentA: 100, modulesCount: 3, powerLossWatts: null, description: "Svorkovnice PE šroubová PEK/S06 – 6 svorek 3× 16 mm² + 3× 6 mm², 100 A (rozvodnice Mistral)", source: ABB_ETIM }),
  row({ manufacturer: "ABB", series: "Mistral", typeCode: "41Z23", articleNumber: "1SPE007715F5650", ean: "8712507128171", moduleSubtype: "BLANK_COVER", modulesCount: 12, powerLossWatts: 0, description: "Záslepka – kryt jističů 12M pro rozvodnice Mistral41, plast, bílá", source: ABB_ETIM }),

  // OEZ
  row({ manufacturer: "OEZ", series: "Příslušenství jističů LTN", typeCode: "SV-LT-X400", articleNumber: "OEZ:42313", ean: "8590125423133", moduleSubtype: "SHUNT_TRIP", modulesCount: 1, powerLossWatts: null, description: "Napěťová spoušť SV-LT-X400 – Uc AC 110–415 V / DC 110 V, pro LTE, LTN, LTS, LVN, LFE, LFN, LMF, OLE, OLI, MSN", source: OEZ_ETIM }),
  row({ manufacturer: "OEZ", series: "Příslušenství jističů LTN", typeCode: "SP-LT-A230", articleNumber: "OEZ:42315", ean: "8590125423157", moduleSubtype: "UNDERVOLTAGE_TRIP", modulesCount: 1, powerLossWatts: null, description: "Podpěťová spoušť SP-LT-A230 – Uc AC 230 V, pro LTE, LTN, LTS, LVN, LFE, LFN, LMF, OLE, OLI, MSN", source: OEZ_ETIM }),
  row({ manufacturer: "OEZ", series: "Rozbočovací můstky CS", typeCode: "CS-N12", articleNumber: "OEZ:35902", ean: "8590125359029", category: "TERMINAL", moduleSubtype: "TERMINAL_BLOCK", ratedCurrentA: 63, modulesCount: 2, powerLossWatts: null, description: "Rozbočovací můstek CS-N12 – 12 svorek, průřez 16 mm², 63 A, modrý (N)", source: OEZ_ETIM }),
  row({ manufacturer: "OEZ", series: "Rozvodnice", typeCode: "PD-RA-ZAS-B", articleNumber: "OEZ:40601", ean: "8590125406013", moduleSubtype: "BLANK_COVER", modulesCount: 6, powerLossWatts: 0, description: "Záslepka PD-RA-ZAS-B – šířka 6 modulů, bílá, pro výřez 45 mm", source: OEZ_ETIM }),

  // Hager
  row({ manufacturer: "Hager", series: "Příslušenství MCB / RCD", typeCode: "MZ201", articleNumber: "MZ201", ean: "3250614562013", moduleSubtype: "AUX_CONTACT", contactConfig: "1NO+1NC", ratedCurrentA: 6, modulesCount: 0.5, powerLossWatts: null, description: "Pomocný kontakt MZ201 pro MCB, RCD 10 kA, RCBO – 1S + 1R, 6 A / 240 V AC, montáž zleva, šířka 0,5 M", source: HAGER_ETIM }),
  row({ manufacturer: "Hager", series: "Příslušenství MCB / RCD", typeCode: "MZ203", articleNumber: "MZ203", ean: "3250614562037", moduleSubtype: "SHUNT_TRIP", modulesCount: 1, powerLossWatts: null, description: "Pracovní (vypínací) spoušť MZ203 – 230–415 V AC / 110–130 V DC", source: HAGER_ETIM }),
  row({ manufacturer: "Hager", series: "Příslušenství MCB / RCD", typeCode: "MZ206", articleNumber: "MZ206", ean: "3250614562068", moduleSubtype: "UNDERVOLTAGE_TRIP", modulesCount: 1, powerLossWatts: null, description: "Podpěťová spoušť MZ206 – 230 V AC", source: HAGER_ETIM }),
  row({ manufacturer: "Hager", series: "Pojistky válcové 10 × 38", typeCode: "LF316G", articleNumber: "LF316G", ean: "3250614062438", moduleSubtype: "FUSE_LINK", ratedCurrentA: 16, modulesCount: 1, powerLossWatts: 1.6, description: "Pojistka válcová LF316G – 10 × 38 mm, 16 A gG, 500 V AC", source: HAGER_ETIM }),
  row({ manufacturer: "Hager", series: "Signálky SVN", typeCode: "SVN121", articleNumber: "SVN121", ean: "3250615721600", moduleSubtype: "INDICATOR", modulesCount: 1, powerLossWatts: 0.8, description: "Kontrolka LED zelená SVN121 – 230 V AC, šířka 1 M", source: HAGER_ETIM }),

  // Schneider Electric (Acti9, Linergy, Kaedra)
  row({ manufacturer: "Schneider", series: "Acti9", typeCode: "iOF", articleNumber: "A9A26924", moduleSubtype: "AUX_CONTACT", contactConfig: "1C/O", ratedCurrentA: 6, modulesCount: 0.5, powerLossWatts: null, description: "Signalizační (pomocný) kontakt iOF – 0,1–6 A, svorky zdola, šířka 9 mm", datasheetUrl: SE_PAGE("A9A26924"), source: SE_SRC }),
  row({ manufacturer: "Schneider", series: "Acti9", typeCode: "iMX 110-415VAC", articleNumber: "A9A26476", moduleSubtype: "SHUNT_TRIP", modulesCount: 1, powerLossWatts: null, description: "Napěťová (vypínací) spoušť iMX – 110–415 V AC, šířka 18 mm", datasheetUrl: SE_PAGE("A9A26476"), source: SE_SRC }),
  row({ manufacturer: "Schneider", series: "Acti9", typeCode: "iMN 220-240VAC", articleNumber: "A9A26960", moduleSubtype: "UNDERVOLTAGE_TRIP", modulesCount: 1, powerLossWatts: null, description: "Podpěťová spoušť iMN – 220–240 V AC, šířka 18 mm", datasheetUrl: SE_PAGE("A9A26960"), source: SE_SRC }),
  row({ manufacturer: "Schneider", series: "Acti9", typeCode: "A9XPH312", articleNumber: "A9XPH312", poles: "3P", moduleSubtype: "BUSBAR", ratedCurrentA: 100, modulesCount: 12, powerLossWatts: null, description: "Propojovací (hřebenová) lišta Acti9 – 3P, 12 modulů, 100 A", datasheetUrl: SE_PAGE("A9XPH312"), source: SE_SRC }),
  row({ manufacturer: "Schneider", series: "Acti9", typeCode: "A9XPE110", articleNumber: "A9XPE110", moduleSubtype: "BUSBAR_END_CAP", modulesCount: 0, powerLossWatts: 0, description: "Koncové kryty propojovacích lišt Acti9 1P – sada 10 ks", datasheetUrl: SE_PAGE("A9XPE110"), source: SE_SRC }),
  row({ manufacturer: "Schneider", series: "Acti9", typeCode: "STI 1P 10,3x38", articleNumber: "A9N15636", moduleSubtype: "FUSE_LINK", ratedCurrentA: 25, modulesCount: 1, powerLossWatts: null, description: "Pojistkový odpínač STI 1P pro válcové pojistky 10,3 × 38 mm, 500 V", datasheetUrl: SE_PAGE("A9N15636"), source: SE_SRC }),
  row({ manufacturer: "Schneider", series: "Acti9", typeCode: "iPC 2P+E 16A FR", articleNumber: "A9A15306", moduleSubtype: "DIN_SOCKET", ratedCurrentA: 16, modulesCount: 2.5, powerLossWatts: null, description: "DIN zásuvka iPC – 2P + E, 16 A, 250 V AC, francouzský standard (NF C 15-100), šířka 45 mm", datasheetUrl: SE_PAGE("A9A15306"), source: SE_SRC }),
  row({ manufacturer: "Schneider", series: "Acti9", typeCode: "iIL červená 110-230VAC", articleNumber: "A9E18320", moduleSubtype: "INDICATOR", modulesCount: 1, powerLossWatts: null, description: "Signálka iIL – červená, 110–230 V AC, šířka 18 mm", datasheetUrl: SE_PAGE("A9E18320"), source: SE_SRC }),
  row({ manufacturer: "Schneider", series: "Linergy", typeCode: "LGY412548", articleNumber: "LGY412548", category: "TERMINAL", poles: "4P", moduleSubtype: "TERMINAL_BLOCK", ratedCurrentA: 125, modulesCount: 4, powerLossWatts: null, description: "Šroubová přípojnice (rozbočovací svorkovnice) Linergy – 4P, 125 A, 48 pozic", datasheetUrl: SE_PAGE("LGY412548"), source: SE_SRC }),
  row({ manufacturer: "Schneider", series: "Kaedra", typeCode: "13940", articleNumber: "13940", moduleSubtype: "BLANK_COVER", modulesCount: 5, powerLossWatts: 0, description: "Záslepka Kaedra – sada 10 × 5 modulů", datasheetUrl: SE_PAGE("13940"), source: SE_SRC }),
];
