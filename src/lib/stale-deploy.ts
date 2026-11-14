// Fáze 113: otevřená stránka ze starší verze aplikace po nasazení nové – Server Actions mají v každém sestavení nová
// ID, takže volání ze staré stránky server odmítne („Failed to find Server Action … from an older or newer
// deployment“). Rozpracovaný stav se zazálohuje v prohlížeči a stránka se načte znovu (nejvýš jednou za minutu).

import { unstable_isUnrecognizedActionError } from "next/navigation";

const RELOAD_KEY = "eldock-new-version-reload";
export const RELOAD_INTERVAL_MS = 60_000;
export const NEW_VERSION_MESSAGE = "Je k dispozici nová verze ELDOCK – stránka se načte znovu, rozpracované změny zůstávají v prohlížeči.";

/** Volání Server Action ze starší / novější verze aplikace (po nasazení) – pomůže jen znovunačtení stránky. */
export function isStaleDeployment(error: unknown): boolean {
  if (unstable_isUnrecognizedActionError(error)) return true;
  return error instanceof Error && /Server Action ".*" was not found on the server|Failed to find Server Action/i.test(error.message);
}

/** Smí se stránka teď znovu načíst? (žádná smyčka: nejvýš jednou za `RELOAD_INTERVAL_MS`) */
export function mayReload(lastReloadAt: number | null, now: number): boolean {
  return !lastReloadAt || now - lastReloadAt >= RELOAD_INTERVAL_MS;
}

/** Znovu načte stránku kvůli nové verzi; false = načítala se před chvílí (zobrazit tlačítko místo dalšího pokusu). */
export function reloadForNewVersion(now = Date.now()): boolean {
  let last: number | null = null;
  try {
    last = Number(window.sessionStorage.getItem(RELOAD_KEY)) || null;
    if (!mayReload(last, now)) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // bez sessionStorage (soukromé okno) – načíst znovu
  }
  window.location.reload();
  return true;
}
