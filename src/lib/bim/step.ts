// Fáze 95: čtení souboru IFC ve formátu STEP Physical File (ISO 10303-21) – čistý TypeScript bez nativních / WASM
// knihoven, v prohlížeči i na serveru. Entity se rozdělí jedním průchodem (řetězce s ';' a ')' uvnitř se respektují),
// argumenty se rozparsují až při prvním čtení entity (velké exporty z Revitu tak nedrží v paměti celý strom hodnot).

/** Hodnota argumentu entity STEP. */
export type StepValue =
  | null // $
  | "*" // odvozená hodnota
  | number
  | string
  | boolean
  | StepRef
  | StepEnum
  | StepTyped
  | StepValue[];

export interface StepRef {
  ref: number;
}

export interface StepEnum {
  enum: string;
}

/** Typovaná hodnota („IFCPOWERMEASURE(45000.)“, „IFCLABEL('RH1')“). */
export interface StepTyped {
  type: string;
  value: StepValue;
}

export interface StepEntity {
  id: number;
  /** Typ velkými písmeny („IFCWALL“). */
  type: string;
  args: StepValue[];
}

export interface StepFile {
  /** Schéma z hlavičky FILE_SCHEMA („IFC4“, „IFC2X3“, „IFC4X3_ADD2“). */
  schema: string;
  /** Typ entity podle id (bez rozparsování argumentů). */
  typeOf(id: number): string | undefined;
  /** Entita s rozparsovanými argumenty (memoizováno). */
  get(id: number): StepEntity | undefined;
  /** Id všech entit daného typu (typ velkými písmeny). */
  idsOf(type: string): readonly number[];
  /** Počet entit v souboru. */
  size: number;
}

export class StepError extends Error {}

export const isRef = (value: StepValue | undefined): value is StepRef => typeof value === "object" && value !== null && !Array.isArray(value) && "ref" in value;
export const isEnum = (value: StepValue | undefined): value is StepEnum => typeof value === "object" && value !== null && !Array.isArray(value) && "enum" in value;
export const isTyped = (value: StepValue | undefined): value is StepTyped => typeof value === "object" && value !== null && !Array.isArray(value) && "type" in value;

/**
 * Dekódování řetězce STEP: zdvojený apostrof, `\X2\…\X0\` (UTF-16 hex – česká diakritika z Revitu / ArchiCADu),
 * `\X4\…\X0\` (UTF-32), `\X\HH` (ISO 8859-1), `\S\c` (horní polovina ISO 8859-1) a `\\`.
 */
export function decodeStepString(raw: string): string {
  let out = "";
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];
    if (char === "'" && raw[index + 1] === "'") {
      out += "'";
      index++;
      continue;
    }
    if (char !== "\\") {
      out += char;
      continue;
    }
    const rest = raw.slice(index);
    let match = /^\\X2\\([0-9A-Fa-f]*)\\X0\\/.exec(rest);
    if (match) {
      for (let at = 0; at + 4 <= match[1].length; at += 4) out += String.fromCharCode(parseInt(match[1].slice(at, at + 4), 16));
      index += match[0].length - 1;
      continue;
    }
    match = /^\\X4\\([0-9A-Fa-f]*)\\X0\\/.exec(rest);
    if (match) {
      for (let at = 0; at + 8 <= match[1].length; at += 8) out += String.fromCodePoint(parseInt(match[1].slice(at, at + 8), 16));
      index += match[0].length - 1;
      continue;
    }
    match = /^\\X\\([0-9A-Fa-f]{2})/.exec(rest);
    if (match) {
      out += String.fromCharCode(parseInt(match[1], 16));
      index += match[0].length - 1;
      continue;
    }
    match = /^\\S\\(.)/.exec(rest);
    if (match) {
      out += String.fromCharCode(match[1].charCodeAt(0) + 128);
      index += match[0].length - 1;
      continue;
    }
    if (rest.startsWith("\\\\")) {
      out += "\\";
      index++;
      continue;
    }
    // Neznámá direktiva (\P…\ kódová stránka) – přeskočit
    match = /^\\P.\\/.exec(rest);
    if (match) {
      index += match[0].length - 1;
      continue;
    }
    out += char;
  }
  return out;
}

/** Rozparsuje seznam argumentů „(…)“ od pozice `start` (na „(“); vrací hodnoty a pozici za „)“. */
function parseList(text: string, start: number): { values: StepValue[]; end: number } {
  const values: StepValue[] = [];
  let index = start + 1;
  const skip = () => {
    while (index < text.length && /\s/.test(text[index])) index++;
  };
  skip();
  if (text[index] === ")") return { values, end: index + 1 };
  for (;;) {
    skip();
    const { value, end } = parseValue(text, index);
    values.push(value);
    index = end;
    skip();
    if (text[index] === ",") {
      index++;
      continue;
    }
    if (text[index] === ")") return { values, end: index + 1 };
    throw new StepError(`Neočekávaný znak „${text[index] ?? "konec"}“ v seznamu argumentů.`);
  }
}

function parseValue(text: string, start: number): { value: StepValue; end: number } {
  const char = text[start];
  if (char === "$") return { value: null, end: start + 1 };
  if (char === "*") return { value: "*", end: start + 1 };
  if (char === "'") {
    let index = start + 1;
    while (index < text.length) {
      if (text[index] === "'") {
        if (text[index + 1] === "'") {
          index += 2;
          continue;
        }
        break;
      }
      index++;
    }
    return { value: decodeStepString(text.slice(start + 1, index)), end: index + 1 };
  }
  if (char === "#") {
    const match = /^#(\d+)/.exec(text.slice(start, start + 24));
    if (!match) throw new StepError("Neplatný odkaz na entitu.");
    return { value: { ref: Number(match[1]) }, end: start + match[0].length };
  }
  if (char === ".") {
    const close = text.indexOf(".", start + 1);
    const name = text.slice(start + 1, close).toUpperCase();
    if (name === "T" || name === "TRUE") return { value: true, end: close + 1 };
    if (name === "F" || name === "FALSE") return { value: false, end: close + 1 };
    if (name === "U" || name === "UNKNOWN") return { value: null, end: close + 1 };
    return { value: { enum: name }, end: close + 1 };
  }
  if (char === "(") {
    const { values, end } = parseList(text, start);
    return { value: values, end };
  }
  if (char === '"') {
    // Binární hodnota – nepotřebujeme, přeskočit
    const close = text.indexOf('"', start + 1);
    return { value: null, end: close + 1 };
  }
  const number = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(text.slice(start, start + 40));
  if (number && number[0].length) return { value: Number(number[0].endsWith(".") ? number[0].slice(0, -1) : number[0]), end: start + number[0].length };
  const typed = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(text.slice(start, start + 80));
  if (typed) {
    const open = start + typed[0].length - 1;
    const { values, end } = parseList(text, open);
    return { value: { type: typed[1].toUpperCase(), value: values.length === 1 ? values[0] : values }, end };
  }
  throw new StepError(`Neznámá hodnota „${text.slice(start, start + 16)}“.`);
}

/**
 * Soubor IFC (STEP): rozdělí sekci DATA na entity „#id=TYP(…);“ (řetězce a komentáře se respektují); argumenty se
 * parsují líně. Vyhodí `StepError`, když text není STEP / IFC.
 */
export function readStep(text: string): StepFile {
  if (!/ISO-10303-21/.test(text.slice(0, 4096))) throw new StepError("Soubor není IFC (chybí hlavička ISO-10303-21).");
  const schemaMatch = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i.exec(text.slice(0, 20_000));
  const schema = (schemaMatch?.[1] ?? "").toUpperCase();
  const dataStart = text.search(/\bDATA\s*;/);
  if (dataStart < 0) throw new StepError("Soubor IFC nemá sekci DATA.");
  const raw = new Map<number, { type: string; from: number; to: number }>();
  const byType = new Map<string, number[]>();
  let index = text.indexOf(";", dataStart) + 1;
  const length = text.length;
  while (index < length) {
    // Najít „#“ začátku entity (přeskočit mezery, komentáře /* */ a ENDSEC)
    const code = text.charCodeAt(index);
    if (code === 35 /* # */) {
      let at = index + 1;
      while (at < length && text.charCodeAt(at) >= 48 && text.charCodeAt(at) <= 57) at++;
      const id = Number(text.slice(index + 1, at));
      while (at < length && text[at] !== "=") at++;
      at++;
      while (at < length && /\s/.test(text[at])) at++;
      const typeStart = at;
      while (at < length && /[A-Za-z0-9_]/.test(text[at])) at++;
      const type = text.slice(typeStart, at).toUpperCase();
      while (at < length && text[at] !== "(") at++;
      const from = at;
      // Konec entity: „;“ mimo řetězec
      let inString = false;
      for (; at < length; at++) {
        const c = text[at];
        if (inString) {
          if (c === "'") {
            if (text[at + 1] === "'") at++;
            else inString = false;
          }
        } else if (c === "'") inString = true;
        else if (c === ";") break;
      }
      raw.set(id, { type, from, to: at });
      const list = byType.get(type);
      if (list) list.push(id);
      else byType.set(type, [id]);
      index = at + 1;
      continue;
    }
    if (code === 47 /* / */ && text[index + 1] === "*") {
      const close = text.indexOf("*/", index + 2);
      index = close < 0 ? length : close + 2;
      continue;
    }
    if (text.startsWith("ENDSEC", index)) break;
    index++;
  }
  if (!raw.size) throw new StepError("Soubor IFC neobsahuje žádné entity.");
  const parsed = new Map<number, StepEntity>();
  return {
    schema,
    size: raw.size,
    typeOf: (id) => raw.get(id)?.type,
    idsOf: (type) => byType.get(type.toUpperCase()) ?? [],
    get(id) {
      const cached = parsed.get(id);
      if (cached) return cached;
      const entry = raw.get(id);
      if (!entry) return undefined;
      let args: StepValue[] = [];
      try {
        args = parseList(text, entry.from).values;
      } catch {
        args = [];
      }
      const entity = { id, type: entry.type, args };
      parsed.set(id, entity);
      return entity;
    },
  };
}
