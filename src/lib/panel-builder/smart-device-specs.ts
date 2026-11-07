// Fáze 65: technické údaje přístrojů chytré domácnosti pro technický list – jen ověřené údaje z katalogu výrobců Eldocku
// (`prisma/external-catalog/catalog.json`, synchronizovaný z repozitáře ai-panel-builder; ABB podle Katalogu 2026, Loxone
// podle produktových listů). Výtah pro výrobky obrázkového katalogu generuje `npm run catalog:smart-specs` do
// `smart-device-specs.generated.ts`; chybějící údaj technický list ukáže jako „ověřte v datasheetu výrobce“. Čisté funkce.

export interface DeviceSpec {
  typeCode: string;
  name: string;
  /** Š × V × H [mm]. */
  dimensions: { w: number; h: number; d: number } | null;
  ip: string | null;
  tempC: { min: number; max: number } | null;
  /** Napájení / jmenovité napětí („24 V DC“, „19,2 … 30 V DC“). */
  supply: string | null;
  /** Jmenovitý proud kanálu („AC-1 16 A · AC-3 8 A“, „6 A“, „160 mA“). */
  current: string | null;
  outputs: number | null;
  mountingDepthMm: number | null;
  mounting: string | null;
  modules: number | null;
  powerLossW: number | null;
  powerW: number | null;
  protocol: string[];
  /** Technický popis z katalogu (zdrojový text). */
  text: string | null;
}

/** Záznam katalogu výrobců (jen pole, která technický list čte). */
export interface CatalogEntry {
  manufacturer: string;
  mpn: string;
  type_designation?: string;
  name_cs?: string;
  width_mm?: number;
  height_mm?: number;
  depth_mm?: number;
  width_modules?: number;
  p_loss_w?: number;
  mounting?: string[];
  features?: Record<string, unknown>;
}

const LABELS = /(Jmenovit|Stupeň krytí|Pracovní teplota|Rozměry|Počet|Druh zátěže|Výstupní|Systémový|Šířka|Montážní|Staré obj|Napájení síťov|Alternativní)/;
const num = (value: string) => Number(value.replace(",", ".").replace("–", "-").replace("−", "-"));
const positive = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);
const MOUNTING: Record<string, string> = { din_th35: "DIN lišta TH35", flush: "zapuštěná montáž do přístrojové krabice", surface: "nástěnná montáž", ceiling: "na strop" };

/** Záznam katalogu → technické údaje (rozměry, krytí, teplota, napájení, proud, výstupy, montáž). */
export function extractDeviceSpec(entry: CatalogEntry): DeviceSpec {
  const features = entry.features ?? {};
  const text = typeof features.sh_supply === "string" ? features.sh_supply.replace(/\s+/g, " ").trim() : "";
  const dims = /Rozměry[^:]*:\s*(\d+(?:[,.]\d+)?)\s*[×x]\s*(\d+(?:[,.]\d+)?)\s*[×x]\s*(\d+(?:[,.]\d+)?)\s*mm/i.exec(text);
  const w = positive(entry.width_mm);
  const h = positive(entry.height_mm);
  const d = positive(entry.depth_mm);
  // Katalog uvádí rozměry „(v × š × h)“
  const dimensions = w && h && d ? { w, h, d } : dims ? { w: num(dims[2]), h: num(dims[1]), d: num(dims[3]) } : null;
  const ipText = /Stupeň krytí:\s*IP\s*(\d{2})/i.exec(text);
  const ip = typeof features.sh_ip === "string" ? features.sh_ip : typeof features.ip_front === "string" ? features.ip_front : ipText ? `IP${ipText[1]}` : null;
  const tempText = /Pracovní teplota:\s*([–−-]?\d+)\s*°C\s*až\s*\+?(\d+)\s*°C/i.exec(text);
  const min = typeof features.ambient_temp_min_c === "number" ? features.ambient_temp_min_c : tempText ? num(tempText[1]) : null;
  const max = typeof features.ambient_temp_max_c === "number" ? features.ambient_temp_max_c : tempText ? num(tempText[2]) : null;
  const head = text.split(LABELS)[0].trim();
  const supply = head && head.length <= 60 ? head.replace(/(\d)\s*VDC/g, "$1 V DC").replace(/(\d)\.(\d)/g, "$1,$2") : null;
  const ac1 = /AC-1:\s*(\d+(?:[,.]\d+)?)\s*A/.exec(text);
  const ac3 = /AC-3:\s*(\d+(?:[,.]\d+)?)\s*A/.exec(text);
  const plain = /Jmenovitý proud:\s*(\d+(?:[,.]\d+)?\s*m?A)/.exec(text);
  const current = ac1 || ac3 ? [ac1 ? `AC-1 ${ac1[1]} A` : null, ac3 ? `AC-3 ${ac3[1]} A` : null].filter(Boolean).join(" · ") : plain ? plain[1].replace(/(\d)(m?A)/, "$1 $2") : null;
  const outputsText = /Počet výstupů:\s*(\d+)/.exec(text);
  const outputs = typeof features.relay_outputs === "number" ? features.relay_outputs : outputsText ? Number(outputsText[1]) : null;
  const depthText = /Montážní hloubka:\s*(\d+)\s*mm/.exec(text);
  const mountKey = entry.mounting?.[0] ?? (typeof features.sh_mount === "string" ? (features.sh_mount === "din_rail" ? "din_th35" : features.sh_mount) : null);
  const protocol = Array.isArray(features.sh_protocol) ? features.sh_protocol : Array.isArray(features.communication) ? features.communication : [];
  return {
    typeCode: entry.type_designation ?? "",
    name: entry.name_cs ?? "",
    dimensions,
    ip: ip ? ip.replace(/\s+/g, "") : null,
    tempC: min !== null && max !== null ? { min, max } : null,
    supply,
    current,
    outputs,
    mountingDepthMm: depthText ? Number(depthText[1]) : null,
    mounting: mountKey ? (MOUNTING[mountKey] ?? null) : null,
    modules: positive(entry.width_modules),
    powerLossW: positive(entry.p_loss_w),
    powerW: positive(features.sh_power_w),
    protocol: protocol.filter((value): value is string => typeof value === "string"),
    text: text ? text.slice(0, 600) : null,
  };
}

/** Klíč výtahu: „ABB|2CDG510025R0011“, „LOXONE|100335“. */
export const specKey = (link: { manufacturer: string; mpn: string }) => `${link.manufacturer}|${link.mpn}`;

/** Výtah technických údajů pro odkazy výrobků (záznam se hledá podle výrobce i objednacího čísla). */
export function extractSpecs(catalog: readonly CatalogEntry[], links: readonly { manufacturer: string; mpn: string }[]): Record<string, DeviceSpec> {
  const byKey = new Map(catalog.map((entry) => [specKey(entry), entry]));
  const result: Record<string, DeviceSpec> = {};
  for (const link of [...links].sort((a, b) => specKey(a).localeCompare(specKey(b)))) {
    const entry = byKey.get(specKey(link));
    if (entry) result[specKey(link)] = extractDeviceSpec(entry);
  }
  return result;
}
