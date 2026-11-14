// Fáze 115: „📋 Revize & Plánovač“ – jediné centrální místo pro revize průmyslového závodu (`/revize` a 4. agenda závodu
// `?faze=4`). Nahoře přehled budov se semaforem revizí (🟢 platné, 🟡 blíží se, 🔴 propadlé), klik na budovu vyfiltruje
// revize budovy; pod tím záložky agendy (Chytrá revize & Plánovač výjezdů, Lhůtník VTZ / rozváděčů / strojů, Hlídač
// revizí spotřebičů, Měsíční TIČR report & Audit). Stav je v adrese (`?tab=`, `?budova=`) – jde sdílet. Čisté funkce.

import type { InspectionState } from "@/lib/inspection";

export type RevisionTab = "chytra" | "lhutnik" | "spotrebice" | "ticr";

export interface RevisionTabInfo {
  id: RevisionTab;
  label: string;
  hint: string;
}

export const REVISION_TABS: readonly RevisionTabInfo[] = [
  { id: "chytra", label: "🧠 Chytrá revize & Plánovač výjezdů", hint: "Optimalizace výjezdu technika „Když už tam jede“, kalendářní plánovač a hromadný zápis revize." },
  { id: "lhutnik", label: "📋 Lhůtník VTZ, Rozváděčů a Strojů", hint: "Kompletní tabulka revizí dle NV 190/2022 Sb., filtry, doplnění dat revizním technikem s pečetí SHA-256 a import z měřáků." },
  { id: "spotrebice", label: "🔌 Hlídač revizí spotřebičů & Kanceláří (ČSN 33 1600)", hint: "Monitory, prodlužovačky, nářadí, AI čtečka výrobních štítků a mobilní Scan & Snap." },
  { id: "ticr", label: "🛡️ Měsíční TIČR report & Audit", hint: "Kontrolní výpis všech revizí pod číslem TIČR a auditní zpráva (Kniha revizí)." },
];

export const REVISION_TAB_PARAM = "tab";
export const REVISION_BUILDING_PARAM = "budova";
export const revisionHubHref = "/revize";

/** `?tab=` → záložka (cokoli jiného = Chytrá revize). */
export function revisionTabOf(value: unknown): RevisionTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return REVISION_TABS.some((tab) => tab.id === raw) ? (raw as RevisionTab) : "chytra";
}

/** Adresa záložky / filtru budovy (základ `/revize` nebo `/plant/…?faze=4`). */
export function revisionHref(base: string, tab: RevisionTab, buildingId: string | null): string {
  const [path, query = ""] = base.split("?");
  const params = new URLSearchParams(query);
  if (tab === "chytra") params.delete(REVISION_TAB_PARAM);
  else params.set(REVISION_TAB_PARAM, tab);
  if (buildingId) params.set(REVISION_BUILDING_PARAM, buildingId);
  else params.delete(REVISION_BUILDING_PARAM);
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

export interface BuildingSemaphore {
  id: string;
  name: string;
  /** 🟢 platná revize. */
  valid: number;
  /** 🟡 končí do 30 dnů. */
  expiring: number;
  /** 🔴 propadlá nebo nevyhovující (neschopné provozu). */
  expired: number;
  /** Bez revize. */
  missing: number;
  /** Nejhorší stav budovy (barva karty). */
  status: "red" | "amber" | "green" | "none";
}

/**
 * Semafor revizí po budovách: zařízení podle stavu rozhodující revize (FAILED = neschopné provozu se počítá jako 🔴).
 * Budovy bez zařízení zůstanou v přehledu s nulami; pořadí podle seznamu budov závodu.
 */
export function buildingSemaphore(items: readonly { buildingId: string; state: InspectionState }[], buildings: readonly { id: string; name: string }[]): BuildingSemaphore[] {
  return buildings.map((building) => {
    const own = items.filter((item) => item.buildingId === building.id);
    const valid = own.filter((item) => item.state === "VALID").length;
    const expiring = own.filter((item) => item.state === "EXPIRING").length;
    const expired = own.filter((item) => item.state === "EXPIRED" || item.state === "FAILED").length;
    const missing = own.filter((item) => item.state === "MISSING").length;
    const status: BuildingSemaphore["status"] = expired ? "red" : expiring ? "amber" : valid ? "green" : "none";
    return { id: building.id, name: building.name, valid, expiring, expired, missing, status };
  });
}
