// Fáze 71: co aplikace naskenovala (webkamera, čtečka čárových kódů, vložený text) – štítek zařízení
// `…/equipment/<id>?qr=<kód>` (lib/qr-label.ts), párovací odkaz `eldock://pair?server=…&code=…`, jinak text
// k vyhledání podle označení.

import { checkLabel, type LabelCheck } from "@/lib/qr-label";
import { normalizePairingCode } from "@/lib/sync";

import { normalizeServerUrl } from "./api";

export type ScanResult =
  | { kind: "equipment"; equipmentId: string; qrToken: string | null }
  | { kind: "pairing"; server: string; code: string }
  | { kind: "text"; text: string };

const EQUIPMENT_PATH = /\/equipment\/([^/?#]+)\/?$/;

export function parseScan(raw: string): ScanResult {
  const text = raw.trim();
  if (/^eldock:\/\/pair\b/i.test(text)) {
    try {
      const url = new URL(text);
      const server = normalizeServerUrl(url.searchParams.get("server") ?? "");
      const code = normalizePairingCode(url.searchParams.get("code") ?? "");
      if (server && code) return { kind: "pairing", server, code };
    } catch {
      // Neplatný odkaz – hledat jako text
    }
    return { kind: "text", text };
  }
  if (/^https?:\/\//i.test(text) || text.startsWith("/equipment/")) {
    try {
      const url = new URL(text, "https://eldock.invalid");
      const match = EQUIPMENT_PATH.exec(url.pathname);
      if (match) return { kind: "equipment", equipmentId: decodeURIComponent(match[1]), qrToken: url.searchParams.get("qr") };
    } catch {
      // Není adresa – hledat jako text
    }
  }
  return { kind: "text", text };
}

/** Platnost naskenovaného štítku proti kódu v datech (`replaced` = štítek byl přegenerován, starý neplatí). */
export const labelState = (scanned: string | null, current: string | null): LabelCheck => checkLabel(scanned ?? undefined, current);
