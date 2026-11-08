import type { EquipmentType } from "@/generated/prisma/enums";

import { formatDateShort } from "./format";
import { parseInfluences, requiresCertificate, type InspectionRule } from "./inspection-rules";

// Osvědčení revizního technika VTZ elektrických (fáze 66): vydává TIČR na 5 let (zákon 250/2021 Sb., § 11),
// rozlišovací znaky podle NV 190/2022 Sb., příloha č. 5 (ověřeno na zakonyprolidi.cz 2026-11-08):
//   E1 – NN a VN s uvedením rozsahu napětí (do 35 kV, do 230 kV, bez omezení), vč. ochrany před bleskem a přepětím
//   E2 – NN do 1 kV AC / 1,5 kV DC, vč. ochrany před bleskem a přepětím
//   E3 – jen ochrana před atmosférickou elektřinou, přepětím a statickou elektřinou (LPS)
//   A  – zařízení v prostorech bez nebezpečí výbuchu, B – v prostorech s nebezpečím výbuchu (§ 4 odst. 1 písm. b)
// Revizi smí provést jen technik s osvědčením v rozsahu odpovídajícím revidovanému VTZ (zákon 250/2021 Sb., § 17).
// Výklad: osvědčení s B se přijme i pro zařízení bez nebezpečí výbuchu (držitelé B mají v praxi i A).

export type InspectorScope = "E1A" | "E1B" | "E2A" | "E2B" | "E3A" | "E3B";

export const INSPECTOR_SCOPES: readonly { value: InspectorScope; label: string }[] = [
  { value: "E1A", label: "E1A – NN i VN vč. LPS, bez nebezpečí výbuchu" },
  { value: "E1B", label: "E1B – NN i VN vč. LPS, s nebezpečím výbuchu" },
  { value: "E2A", label: "E2A – NN do 1 kV AC / 1,5 kV DC vč. LPS, bez nebezpečí výbuchu" },
  { value: "E2B", label: "E2B – NN do 1 kV AC / 1,5 kV DC vč. LPS, s nebezpečím výbuchu" },
  { value: "E3A", label: "E3A – jen hromosvody a ochrana před přepětím, bez nebezpečí výbuchu" },
  { value: "E3B", label: "E3B – jen hromosvody a ochrana před přepětím, s nebezpečím výbuchu" },
];

/** Platnost osvědčení revizního technika [roky] (zákon 250/2021 Sb., § 11). */
export const CERTIFICATE_VALIDITY_YEARS = 5;

/** „E2/A“, „e2 a“, „E2A“ → „E2A“; jinak null. */
export function normalizeScope(value: string | null | undefined): InspectorScope | null {
  const match = /^\s*E\s*([123])\s*[/\s-]?\s*([AB])\s*$/i.exec(value ?? "");
  return match ? (`E${match[1]}${match[2].toUpperCase()}` as InspectorScope) : null;
}

/** Rozsah z čísla osvědčení ze starších záznamů („TIČR č. E-0815/2021 (E1A)“). */
export function scopeFromLicense(license: string | null | undefined): InspectorScope | null {
  const match = /\bE\s*([123])\s*\/?\s*([AB])\b/i.exec(license ?? "");
  return match ? (`E${match[1]}${match[2].toUpperCase()}` as InspectorScope) : null;
}

/** Nejvyšší jmenovité napětí z textu štítku [V] a zda jde o stejnosměrné napětí. */
function ratedVolts(text: string | null | undefined): { volts: number; dc: boolean } | null {
  const source = (text ?? "").replace(/\s+/g, " ");
  const values = [...source.matchAll(/(\d+(?:[.,]\d+)?)\s*(kV|V)\b/gi)].map((match) => Number(match[1].replace(",", ".")) * (match[2].toLowerCase() === "kv" ? 1000 : 1));
  if (!values.length) return null;
  return { volts: Math.max(...values), dc: /\bDC\b/i.test(source) };
}

/** Vysoké napětí = nad 1 kV AC / 1,5 kV DC; transformátor bez údaje se považuje za VN. */
export function isHighVoltage(type: EquipmentType, ratedVoltage: string | null | undefined): boolean {
  const rated = ratedVolts(ratedVoltage);
  if (!rated) return type === "TRANSFORMER";
  return rated.volts > (rated.dc ? 1500 : 1000);
}

export interface CertificateCheckInput {
  scope: string | null | undefined;
  /** Platnost osvědčení. */
  validUntil: Date | null | undefined;
  /** Den ukončení revize. */
  inspectionDate: Date;
  rule: Pick<InspectionRule, "kind">;
  equipment: { type: EquipmentType; ratedVoltage?: string | null; externalInfluences?: string | null };
}

/** Nesoulad osvědčení s revidovaným zařízením (prázdné pole = v pořádku). */
export function certificateIssues({ scope, validUntil, inspectionDate, rule, equipment }: CertificateCheckInput): string[] {
  if (!requiresCertificate(rule)) return [];
  const issues: string[] = [];
  const code = normalizeScope(scope);
  if (!code) issues.push("Vyberte rozsah osvědčení revizního technika (E1 / E2 / E3 a A / B podle přílohy č. 5 NV 190/2022 Sb.).");
  if (!validUntil) issues.push("Vyplňte platnost osvědčení revizního technika (zákon 250/2021 Sb., § 11).");
  else if (validUntil.getTime() < inspectionDate.getTime()) {
    issues.push(`Osvědčení revizního technika v den revize neplatilo (platnost do ${formatDateShort(validUntil)}) – zákon 250/2021 Sb., § 11.`);
  }
  if (!code) return issues;
  const level = code.slice(0, 2);
  if (rule.kind !== "LPS" && level === "E3") {
    issues.push("Osvědčení E3 opravňuje jen k revizím ochrany před atmosférickou elektřinou, přepětím a statickou elektřinou (NV 190/2022 Sb., příloha č. 5).");
  }
  if (rule.kind !== "LPS" && level !== "E1" && isHighVoltage(equipment.type, equipment.ratedVoltage)) {
    issues.push("Zařízení vysokého napětí smí revidovat jen technik s osvědčením E1 (NV 190/2022 Sb., příloha č. 5; zákon 250/2021 Sb., § 17).");
  }
  if (parseInfluences(equipment.externalInfluences).has("BE3") && code.endsWith("A")) {
    issues.push("Zařízení v prostoru s nebezpečím výbuchu (BE3) vyžaduje osvědčení s rozlišovacím znakem B (NV 190/2022 Sb., příloha č. 5).");
  }
  return issues;
}
