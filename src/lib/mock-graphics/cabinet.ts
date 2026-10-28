// Rozložení modulů rozváděče na DIN lišty podle kusovníku (pro CSS 3D náhled).
// Šířky v modulech TE (1 TE = 17,5 mm), lišta pojme `RAIL_CAPACITY` TE.

export const RAIL_CAPACITY = 24;

export type CabinetModuleKind = "switch" | "breaker" | "contactor" | "psu" | "plc" | "terminal" | "other";

export interface CabinetModule {
  designation: string;
  description: string;
  kind: CabinetModuleKind;
  /** Šířka v TE. */
  width: number;
}

export interface BomLike {
  designation: string;
  description: string;
  quantity: number;
}

function classify(item: BomLike): Pick<CabinetModule, "kind" | "width"> {
  const prefix = item.designation.replace(/\d.*$/, "").toUpperCase();
  const threePole = /\b3P\b/.test(item.description);
  switch (prefix) {
    case "Q":
      return { kind: "switch", width: 4 };
    case "F":
      return { kind: "breaker", width: threePole ? 3 : 1 };
    case "K":
      return { kind: "contactor", width: 3 };
    case "T":
      return { kind: "psu", width: 4 };
    case "A":
      return { kind: "plc", width: 7 };
    case "X":
      // Svorky jsou úzké (~ 0,3 TE); celá svorkovnice jako jeden blok.
      return { kind: "terminal", width: Math.max(2, Math.ceil(item.quantity * 0.3)) };
    default:
      return { kind: "other", width: 2 };
  }
}

/** Pořadí lišt shora: napájení a jištění → stykače a zdroj → řízení → svorkovnice. */
const RAIL_ORDER: CabinetModuleKind[][] = [["switch", "breaker"], ["contactor", "psu", "other"], ["plc"], ["terminal"]];

export function layoutCabinet(bom: BomLike[]): CabinetModule[][] {
  const modules = bom.map((item) => ({ designation: item.designation, description: item.description, ...classify(item) }));
  const rails: CabinetModule[][] = [];
  for (const kinds of RAIL_ORDER) {
    let rail: CabinetModule[] = [];
    let used = 0;
    for (const item of modules.filter((m) => kinds.includes(m.kind))) {
      if (used + item.width > RAIL_CAPACITY && rail.length) {
        rails.push(rail);
        rail = [];
        used = 0;
      }
      rail.push(item);
      used += item.width;
    }
    if (rail.length) rails.push(rail);
  }
  return rails;
}
