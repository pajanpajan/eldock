// Fáze 105: nastavení cenových nabídek v profilu firmy (`RegisteredCompany.quoteSettingsJson`) – hodinová sazba,
// konstrukce stavby, sazba DPH, oblíbený velkoobchod, kalibrace normohodin a číslování nabídek.

import { DEFAULT_CALIBRATION, parseCalibration, type ConstructionId, type NhCalibration } from "./normohodiny-catalog";
import { DEFAULT_HOURLY_RATE, type VatRate } from "./quote-engine";
import type { WholesalerId } from "./wholesaler-export";

export interface QuoteSettings {
  hourlyRate: number;
  construction: ConstructionId;
  vatRate: VatRate;
  wholesaler: WholesalerId;
  calibration: NhCalibration;
  /** Poslední vydané číslo nabídky v roce `numberYear`. */
  lastNumber: number;
  numberYear: number | null;
}

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = { hourlyRate: DEFAULT_HOURLY_RATE, construction: "aac", vatRate: 12, wholesaler: "sonepar", calibration: DEFAULT_CALIBRATION, lastNumber: 0, numberYear: null };

const CONSTRUCTION_IDS = new Set(["aac", "drywall", "brick", "concrete"]);
const WHOLESALER_IDS = new Set(["sonepar", "elkov", "kv", "dek", "universal"]);

export function parseQuoteSettings(json: string | null | undefined): QuoteSettings {
  if (!json) return DEFAULT_QUOTE_SETTINGS;
  let raw: Partial<QuoteSettings>;
  try {
    raw = JSON.parse(json) as Partial<QuoteSettings>;
  } catch {
    return DEFAULT_QUOTE_SETTINGS;
  }
  if (!raw || typeof raw !== "object") return DEFAULT_QUOTE_SETTINGS;
  return {
    hourlyRate: typeof raw.hourlyRate === "number" && raw.hourlyRate >= 0 && raw.hourlyRate <= 100_000 ? Math.round(raw.hourlyRate) : DEFAULT_QUOTE_SETTINGS.hourlyRate,
    construction: CONSTRUCTION_IDS.has(raw.construction as string) ? (raw.construction as ConstructionId) : "aac",
    vatRate: raw.vatRate === 21 ? 21 : 12,
    wholesaler: WHOLESALER_IDS.has(raw.wholesaler as string) ? (raw.wholesaler as WholesalerId) : "sonepar",
    calibration: parseCalibration(raw.calibration),
    lastNumber: typeof raw.lastNumber === "number" && Number.isInteger(raw.lastNumber) && raw.lastNumber >= 0 ? raw.lastNumber : 0,
    numberYear: typeof raw.numberYear === "number" && Number.isInteger(raw.numberYear) ? raw.numberYear : null,
  };
}

/** Číslo, které dostane příští nabídka firmy (v novém roce znovu od 1). */
export function nextQuoteNumber(settings: Pick<QuoteSettings, "lastNumber" | "numberYear">, year = new Date().getFullYear()): string {
  const sequence = settings.numberYear === year ? settings.lastNumber + 1 : 1;
  return `NAB-${year}-${String(sequence).padStart(4, "0")}`;
}
