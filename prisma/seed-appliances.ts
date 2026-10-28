// Demo data fáze 14: spotřebiče, ruční nářadí, svářečky a bezpečnostní zařízení
// (lehká karta – bez schématu, kusovníku a 3D). Stavy revizí řídí `SPECIAL` v seed-compliance.
import type { EquipmentSeed, FloorKey } from "./seed-data";

type LightInput = Omit<EquipmentSeed, "pinX" | "pinY" | "status"> & { at: [number, number] };

const pin = (x: number, y: number) => ({ pinX: Math.round((x / 1200) * 1000) / 10, pinY: Math.round((y / 800) * 1000) / 10 });

const KITCHEN = "Kuchyňka – Energetika 1. NP";
const WORKSHOP = "Dílna údržby – Hala A";

const light = (floor: FloorKey, rest: Omit<LightInput, "floor">): LightInput => ({ floor, ...rest });

const inputs: LightInput[] = [
  // Kuchyňka / zázemí (Energetika 1. NP)
  light("e-1np", { tag: "SP-0201", name: "SP-0201 - Rychlovarná konvice Eta", type: "APPLIANCE", at: [820, 640], description: "Rychlovarná konvice 1,7 l v kuchyňce zázemí.", manufacturer: "ETA", model: "Storio 8599", yearInstalled: 2022, ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "9,6 A (2 200 W)", ipRating: "IPX0", usageGroup: "E", protectionClass: "I", inventoryNumber: "INV-SP-0201", assignedZone: KITCHEN }),
  light("e-1np", { tag: "SP-0202", name: "SP-0202 - Mikrovlnná trouba Bosch", type: "APPLIANCE", at: [910, 640], description: "Mikrovlnná trouba 20 l v kuchyňce zázemí.", manufacturer: "Bosch", model: "FFL020MS2", yearInstalled: 2021, ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "5 A (1 270 W)", ipRating: "IPX0", usageGroup: "E", protectionClass: "I", inventoryNumber: "INV-SP-0202", assignedZone: KITCHEN }),
  light("e-1np", { tag: "SP-0204", name: "SP-0204 - Kávovar De'Longhi", type: "APPLIANCE", at: [1060, 700], description: "Automatický kávovar v kuchyňce zázemí.", manufacturer: "De'Longhi", model: "Magnifica S ECAM22.110", yearInstalled: 2023, ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "6,5 A (1 450 W)", ipRating: "IPX0", usageGroup: "E", protectionClass: "I", inventoryNumber: "INV-SP-0204", assignedZone: KITCHEN }),
  light("e-1np", { tag: "SP-0203", name: "SP-0203 - Chladnička Gorenje", type: "APPLIANCE", at: [1000, 640], description: "Chladnička s mrazákem v kuchyňce zázemí.", manufacturer: "Gorenje", model: "RK4182PW4", yearInstalled: 2023, ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "0,6 A (120 W)", ipRating: "IPX0", usageGroup: "E", protectionClass: "I", inventoryNumber: "INV-SP-0203", assignedZone: KITCHEN }),

  // Dílna údržby v Hale A
  light("a-1np", { tag: "NR-0112", name: "NR-0112 - Úhlová bruska Hilti AG 125", type: "POWER_TOOL", at: [850, 520], description: "Úhlová bruska 125 mm, 1 500 W, dvojitá izolace.", manufacturer: "Hilti", model: "AG 125-15DB", yearInstalled: 2023, ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "6,5 A (1 500 W)", ipRating: "IP20", usageGroup: "C", protectionClass: "II", inventoryNumber: "INV-NR-0112", assignedZone: WORKSHOP }),
  light("a-1np", { tag: "NR-0087", name: "NR-0087 - Aku/síťová vrtačka Hilti", type: "POWER_TOOL", at: [940, 520], description: "Vrtací šroubovák s nabíječkou a síťovým adaptérem.", manufacturer: "Hilti", model: "SF 6H-A22 + C 4/36", yearInstalled: 2022, ratedVoltage: "230 V AC / 50 Hz (nabíječka)", ratedCurrent: "1,2 A", ipRating: "IP20", usageGroup: "C", protectionClass: "II", inventoryNumber: "INV-NR-0087", assignedZone: WORKSHOP }),
  light("a-1np", { tag: "PP-0031", name: "PP-0031 - Prodlužovací buben 25 m 400 V", type: "EXTENSION_CORD", at: [850, 630], description: "Kabelový buben H07RN-F 5G2,5, zásuvky 400 V/16 A a 3× 230 V.", manufacturer: "Brennenstuhl", model: "Garant CEE 1 IP44", yearInstalled: 2020, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "16 A", ipRating: "IP44", usageGroup: "C", protectionClass: "I", inventoryNumber: "INV-PP-0031", assignedZone: WORKSHOP }),
  light("a-1np", { tag: "SV-0004", name: "SV-0004 - Invertorová svářečka Fronius TransPocket", type: "WELDER", at: [940, 630], description: "Invertorová svářečka MMA/TIG 180 A pro údržbu.", manufacturer: "Fronius", model: "TransPocket 180", yearInstalled: 2021, ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "16 A", ipRating: "IP23", usageGroup: "C", protectionClass: "I", inventoryNumber: "INV-SV-0004", assignedZone: WORKSHOP }),
  light("a-1np", { tag: "NO-A", name: "NO-A - Okruh nouzového osvětlení Hala A", type: "EMERGENCY_LIGHTING", at: [620, 445], description: "Centrální bateriový systém, 42 svítidel, autonomie 1 h.", manufacturer: "Schneider Electric", model: "Exiway Power Control", yearInstalled: 2019, ratedVoltage: "230 V AC / 216 V DC", ratedCurrent: "–", ipRating: "IP42", assignedZone: "Hala A – únikové cesty" }),

  // Střechy a bezpečnost
  light("a-2np", { tag: "LPS-A", name: "LPS-A - Hromosvod LPS Hala A", type: "LIGHTNING_ROD", at: [650, 640], description: "Vnější ochrana před bleskem LPS III, mřížová jímací soustava, 12 svodů.", manufacturer: "Dehn", model: "LPS III mřížová soustava", yearInstalled: 2018, ratedVoltage: "–", ratedCurrent: "–", ipRating: "–", assignedZone: "Střecha haly A" }),
  light("b-1np", { tag: "LPS-B", name: "LPS-B - Hromosvod LPS Hala B", type: "LIGHTNING_ROD", at: [850, 700], description: "Vnější ochrana před bleskem LPS III, 8 svodů, zemnič typu B.", manufacturer: "Dehn", model: "LPS III", yearInstalled: 2020, ratedVoltage: "–", ratedCurrent: "–", ipRating: "–", assignedZone: "Střecha haly B" }),
  light("b-1np", { tag: "SV-0007", name: "SV-0007 - Svářečka MIG/MAG Kemppi X5", type: "WELDER", at: [480, 600], description: "Svařovací zdroj MIG/MAG 400 A pro opravy přípravků.", manufacturer: "Kemppi", model: "X5 FastMig 400", yearInstalled: 2023, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "25 A", ipRating: "IP23S", usageGroup: "C", protectionClass: "I", inventoryNumber: "INV-SV-0007", assignedZone: "Svařovna – Hala B" }),
  light("e-1pp", { tag: "NO-E", name: "NO-E - Nouzové osvětlení Energetika", type: "EMERGENCY_LIGHTING", at: [600, 495], description: "Autonomní nouzová svítidla rozvoden a kabelové chodby.", manufacturer: "Modus", model: "NOS LED 3 h", yearInstalled: 2019, ratedVoltage: "230 V AC", ratedCurrent: "–", ipRating: "IP65", assignedZone: "Energetika – rozvodny" }),

  // Administrativa
  light("k-1np", { tag: "SP-0310", name: "SP-0310 - PC sestava Dell OptiPlex", type: "APPLIANCE", at: [600, 220], description: "Počítač s monitorem v kanceláři mistrů.", manufacturer: "Dell", model: "OptiPlex 7010 + P2423", yearInstalled: 2024, ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "1,5 A", ipRating: "IP20", usageGroup: "E", protectionClass: "I", inventoryNumber: "INV-SP-0310", assignedZone: "Kanceláře 1. NP" }),
  light("k-1np", { tag: "PP-0044", name: "PP-0044 - Prodlužovací přívod 230 V 5 m", type: "EXTENSION_CORD", at: [760, 300], description: "Prodlužovací přívod se 4 zásuvkami a vypínačem.", manufacturer: "Emos", model: "P1415 4z 5 m", yearInstalled: 2024, ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "10 A", ipRating: "IP20", usageGroup: "E", protectionClass: "I", inventoryNumber: "INV-PP-0044", assignedZone: "Kanceláře 1. NP" }),
  light("k-2np", { tag: "SP-0322", name: "SP-0322 - Laserová tiskárna HP", type: "APPLIANCE", at: [900, 230], description: "Síťová tiskárna v open space projekce.", manufacturer: "HP", model: "LaserJet Pro 4002", yearInstalled: 2023, ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "4 A", ipRating: "IP20", usageGroup: "E", protectionClass: "I", inventoryNumber: "INV-SP-0322", assignedZone: "Open space 2. NP" }),
];

export const LIGHT_EQUIPMENT: EquipmentSeed[] = inputs.map(({ at, ...rest }) => ({ ...rest, ...pin(at[0], at[1]), status: "ACTIVE" }));
