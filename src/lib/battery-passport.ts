// Digitální pas baterie dle Nařízení (EU) 2023/1542 (fáze 46): UPS a bateriová úložiště (BESS) nad
// 2 kWh. Data v `Equipment.batteryPassportJson`. Čisté funkce.

export interface BatteryPassport {
  capacityKwh: number;
  chemistry: string; // "LiFePO4", "VRLA", "NMC"
  stateOfHealthPct: number;
  nominalVoltageV: number | null;
  cellManufacturer: string | null;
  /** Stav článků / modulů (volný text z BMS). */
  cellStatus: string | null;
  manufacturedYear: number | null;
  passportId: string | null;
}

/** Povinnost pasu: průmyslové baterie a baterie pro elektromobily nad 2 kWh (čl. 77). */
export const PASSPORT_THRESHOLD_KWH = 2;

export function parseBatteryPassport(json: string | null | undefined): BatteryPassport | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Partial<BatteryPassport>;
    if (typeof value.capacityKwh !== "number" || typeof value.chemistry !== "string" || typeof value.stateOfHealthPct !== "number") return null;
    const text = (input: unknown) => (typeof input === "string" && input.trim() ? input.trim() : null);
    const num = (input: unknown) => (typeof input === "number" && Number.isFinite(input) ? input : null);
    return {
      capacityKwh: value.capacityKwh,
      chemistry: value.chemistry,
      stateOfHealthPct: Math.max(0, Math.min(100, value.stateOfHealthPct)),
      nominalVoltageV: num(value.nominalVoltageV),
      cellManufacturer: text(value.cellManufacturer),
      cellStatus: text(value.cellStatus),
      manufacturedYear: num(value.manufacturedYear),
      passportId: text(value.passportId),
    };
  } catch {
    return null;
  }
}

const n = (value: number, digits = 1) => value.toLocaleString("cs-CZ", { maximumFractionDigits: digits });

/** Řádky sekce „Digitální pas baterie“ (karta zařízení i revizní protokol). */
export function batteryPassportRows(passport: BatteryPassport): [string, string][] {
  return [
    ["Kapacita", `${n(passport.capacityKwh)} kWh`],
    ["Chemie článků", passport.chemistry],
    ["Stav zdraví (SoH)", `${n(passport.stateOfHealthPct, 0)} %`],
    ...(passport.nominalVoltageV ? [["Nominální napětí", `${n(passport.nominalVoltageV, 0)} V DC`] as [string, string]] : []),
    ...(passport.cellManufacturer ? [["Výrobce článků", passport.cellManufacturer] as [string, string]] : []),
    ...(passport.cellStatus ? [["Stav článků", passport.cellStatus] as [string, string]] : []),
    ...(passport.manufacturedYear ? [["Rok výroby", String(passport.manufacturedYear)] as [string, string]] : []),
    ...(passport.passportId ? [["ID pasu", passport.passportId] as [string, string]] : []),
  ];
}

/** SoH pod 80 % = konec životnosti pro UPS (doporučení výměny). */
export const sohWarning = (passport: BatteryPassport) => (passport.stateOfHealthPct < 80 ? `SoH ${n(passport.stateOfHealthPct, 0)} % – blíží se konec životnosti baterie, naplánujte výměnu.` : null);

export const passportRequired = (passport: BatteryPassport) => passport.capacityKwh > PASSPORT_THRESHOLD_KWH;
