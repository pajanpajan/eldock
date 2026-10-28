// Katalog dílů rozváděče: sdílí ho schéma (popisky) i kusovník (BOM), takže
// obojí je vždy konzistentní. Revize mění díly přes `PartOverrides`.

export interface Part {
  designation: string;
  description: string;
  manufacturer: string;
  partNumber: string;
  quantity: number;
  unit: string;
  note?: string;
}

export type PartOverrides = Record<string, Partial<Omit<Part, "designation">>>;

function ampsOf(ratedCurrent: string | null | undefined): number {
  const match = ratedCurrent?.match(/\d+/);
  return match ? Number(match[0]) : 63;
}

function mainSwitch(amps: number): Pick<Part, "manufacturer" | "partNumber"> {
  if (amps <= 100) return { manufacturer: "Eaton", partNumber: `P3-${amps <= 63 ? 63 : 100}/EA/SVB` };
  if (amps <= 630) return { manufacturer: "Siemens", partNumber: "3VA2463-5HL32-0AA0" };
  return { manufacturer: "Siemens", partNumber: "3WL1116-2BB32-4GA2" };
}

const BRANCH_BREAKERS = ["F2", "F3", "F4", "F5"] as const;
const CONTACTORS = ["K1", "K2", "K3", "K4"] as const;

/** Díly rozváděče (pořadí = pořadí v kusovníku) včetně případných změn v dané revizi. */
export function buildParts(
  ratedCurrent: string | null | undefined,
  overrides: PartOverrides = {},
): Part[] {
  const amps = ampsOf(ratedCurrent);
  const base: Part[] = [
    {
      designation: "Q1",
      description: `Hlavní vypínač 3P ${amps} A`,
      ...mainSwitch(amps),
      quantity: 1,
      unit: "ks",
    },
    {
      designation: "F1",
      description: "Jistič vývodu 3P C63 A, 10 kA",
      manufacturer: "Siemens",
      partNumber: "5SY4363-7",
      quantity: 1,
      unit: "ks",
    },
    ...BRANCH_BREAKERS.map<Part>((designation) => ({
      designation,
      description: "Jistič 3P C16 A, 10 kA",
      manufacturer: "Siemens",
      partNumber: "5SY4316-7",
      quantity: 1,
      unit: "ks",
    })),
    {
      designation: "F6",
      description: "Jistič 1P C2 A, 24 V DC",
      manufacturer: "ABB",
      partNumber: "S201-C2",
      quantity: 1,
      unit: "ks",
    },
    ...CONTACTORS.map<Part>((designation) => ({
      designation,
      description: "Stykač 3P 25 A, cívka 24 V DC",
      manufacturer: "Schneider Electric",
      partNumber: "LC1D25BD",
      quantity: 1,
      unit: "ks",
    })),
    {
      designation: "T1",
      description: "Spínaný zdroj 3× 400 V AC / 24 V DC, 10 A",
      manufacturer: "Phoenix Contact",
      partNumber: "QUINT4-PS/3AC/24DC/10",
      quantity: 1,
      unit: "ks",
    },
    {
      designation: "A1",
      description: "Řídicí jednotka PLC, 16 DI / 16 DO",
      manufacturer: "Siemens",
      partNumber: "6ES7512-1DK01-0AB0",
      quantity: 1,
      unit: "ks",
    },
    {
      designation: "X1",
      description: "Průchozí svorka 2,5 mm² (řídicí obvody)",
      manufacturer: "Phoenix Contact",
      partNumber: "UT 2,5",
      quantity: 14,
      unit: "ks",
    },
    {
      designation: "X2",
      description: "Průchozí svorka 10 mm² (silové vývody)",
      manufacturer: "Weidmüller",
      partNumber: "WDU 10",
      quantity: 12,
      unit: "ks",
    },
  ];
  return base.map((part) => ({ ...part, ...overrides[part.designation] }));
}
