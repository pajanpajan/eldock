// Generuje `node scripts/import-etim-universal.mjs` z balíčků ve složce „ETIM data“ (fáze 105) – needitujte ručně.
// Data výrobců ke kusům katalogu AI Panel Builderu podle objednacího čísla: EAN, rozměry, vestavná hloubka, ztrátový
// výkon Pv a ceníková cena – seed je zapíše ke kusům katalogu (`applyEtimComponents`). Jen pro seed (server) – bez
// `server-only`, seed běží v tsx bez podmínky react-server; klientský modul ho importovat nesmí (test fáze 105).

export interface UniversalComponentData {
  ean?: string;
  heightMm?: number;
  widthMm?: number;
  depthMm?: number;
  powerLossWatts?: number;
  listPriceCzk?: number;
  listPriceSource?: string;
  source: string;
}

export const UNIVERSAL_COMPONENTS: Record<string, UniversalComponentData> = {
  "CDA225D": {
    "ean": "3250611610038",
    "depthMm": 70,
    "powerLossWatts": 2.32,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "CDA240D": {
    "ean": "3250611610045",
    "depthMm": 70,
    "powerLossWatts": 6.24,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "CDA425D": {
    "ean": "3250611610069",
    "depthMm": 70,
    "powerLossWatts": 4.5,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "CDA440D": {
    "ean": "3250611610076",
    "depthMm": 70,
    "powerLossWatts": 6.5,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "CDA463D": {
    "ean": "3250611610083",
    "depthMm": 70,
    "powerLossWatts": 18.5,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "ESC225": {
    "ean": "3250612400669",
    "depthMm": 60,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "ESC226": {
    "ean": "3250612400713",
    "depthMm": 60,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "ESC325": {
    "ean": "3250612400850",
    "depthMm": 60,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "ESC440": {
    "ean": "3250612401284",
    "depthMm": 60,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "LFE-25-2-030A": {
    "ean": "8590125463955",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LFE-63-4-030A": {
    "ean": "8590125464013",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-10B-1": {
    "ean": "8590125416388",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-10B-3": {
    "ean": "8590125417705",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-10C-1": {
    "ean": "8590125416555",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-10C-3": {
    "ean": "8590125417873",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-13B-1": {
    "ean": "8590125416395",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-13C-1": {
    "ean": "8590125416562",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-16B-1": {
    "ean": "8590125416401",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-16B-3": {
    "ean": "8590125417729",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-16C-1": {
    "ean": "8590125416579",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-16C-3": {
    "ean": "8590125417897",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-20B-1": {
    "ean": "8590125416418",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-20B-3": {
    "ean": "8590125417736",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-20C-1": {
    "ean": "8590125416586",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-20C-3": {
    "ean": "8590125417903",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-25B-1": {
    "ean": "8590125416425",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-25B-3": {
    "ean": "8590125417743",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-25C-1": {
    "ean": "8590125416593",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-25C-3": {
    "ean": "8590125417910",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-32B-1": {
    "ean": "8590125416432",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-32B-3": {
    "ean": "8590125417750",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-32C-1": {
    "ean": "8590125416609",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-32C-3": {
    "ean": "8590125417927",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-6B-1": {
    "ean": "8590125416364",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "LTN-6C-1": {
    "ean": "8590125416531",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "MBN106": {
    "ean": "3250614310065",
    "depthMm": 70,
    "powerLossWatts": 1.3,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN110": {
    "ean": "3250614310072",
    "depthMm": 70,
    "powerLossWatts": 2.75,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN113": {
    "ean": "3250614310089",
    "depthMm": 70,
    "powerLossWatts": 2.2,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN116": {
    "ean": "3250614310096",
    "depthMm": 70,
    "powerLossWatts": 2.44,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN120": {
    "ean": "3250614310102",
    "depthMm": 70,
    "powerLossWatts": 2.79,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN125": {
    "ean": "3250614310119",
    "depthMm": 70,
    "powerLossWatts": 3,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN132": {
    "ean": "3250614310126",
    "depthMm": 70,
    "powerLossWatts": 4.4,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN310": {
    "ean": "3250614310386",
    "depthMm": 70,
    "powerLossWatts": 5.8,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN316": {
    "ean": "3250614310409",
    "depthMm": 70,
    "powerLossWatts": 6.33,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN320": {
    "ean": "3250614310416",
    "depthMm": 70,
    "powerLossWatts": 8.9,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN325": {
    "ean": "3250614310423",
    "depthMm": 70,
    "powerLossWatts": 10.1,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MBN332": {
    "ean": "3250614310430",
    "depthMm": 70,
    "powerLossWatts": 13,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN106": {
    "ean": "3250614311123",
    "depthMm": 70,
    "powerLossWatts": 1.3,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN110": {
    "ean": "3250614311130",
    "depthMm": 70,
    "powerLossWatts": 1.63,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN113": {
    "ean": "3250614311147",
    "depthMm": 70,
    "powerLossWatts": 2.29,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN116": {
    "ean": "3250614311154",
    "depthMm": 70,
    "powerLossWatts": 2.32,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN120": {
    "ean": "3250614311161",
    "depthMm": 70,
    "powerLossWatts": 2.7,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN125": {
    "ean": "3250614311178",
    "depthMm": 70,
    "powerLossWatts": 3,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN132": {
    "ean": "3250614311185",
    "depthMm": 70,
    "powerLossWatts": 4.4,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN310": {
    "ean": "3250614311437",
    "depthMm": 70,
    "powerLossWatts": 4.58,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN316": {
    "ean": "3250614311451",
    "depthMm": 70,
    "powerLossWatts": 6.99,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN320": {
    "ean": "3250614311468",
    "depthMm": 70,
    "powerLossWatts": 8.9,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN325": {
    "ean": "3250614311475",
    "depthMm": 70,
    "powerLossWatts": 10.1,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MCN332": {
    "ean": "3250614311482",
    "depthMm": 70,
    "powerLossWatts": 13,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "MSN-125-4": {
    "ean": "8590125443056",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "MSN-32-3": {
    "ean": "8590125442981",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "MSN-40-4": {
    "ean": "8590125443032",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "MSN-63-3": {
    "ean": "8590125443001",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "OLI-16B-1N-030A": {
    "ean": "8590125382942",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "OLI-16C-1N-030A": {
    "ean": "8590125383017",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "RSI-20-20-A230": {
    "ean": "8590125366102",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "RSI-25-40-A230": {
    "ean": "8590125366171",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "RSI-40-40-A230": {
    "ean": "8590125366256",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "RSI-63-40-A230": {
    "ean": "8590125366331",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  },
  "SBN363": {
    "ean": "3250615510228",
    "depthMm": 68,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "SBN380": {
    "ean": "3250615510266",
    "depthMm": 68,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "SBN440": {
    "ean": "3250615510198",
    "depthMm": 69,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "SBN463": {
    "ean": "3250615510235",
    "depthMm": 69,
    "source": "Hager – oficiální data BMEcat ETIM 10.0 (Hager-8780)"
  },
  "SJB-25E-3-MZS": {
    "ean": "8590125383574",
    "source": "OEZ – oficiální data BMEcat ETIM 8.0 (OEZ-CZ - 10-2026, fotky v balíčku)"
  }
};
