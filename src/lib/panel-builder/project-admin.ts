// Správa projektů AI Panel Builderu (fáze 48): vzorový projekt, filtr přehledu, kredity a soubory projektu.
// Čisté funkce – bezpečné pro klient i server.

import type { PanelProjectStatus } from "@/generated/prisma/enums";
import { normalizeSearch } from "@/lib/equipment-filter";

import { parseRailPhotos } from "./rails";

/** Vzorový projekt (seed `db:panel-builder`) – chráněný před hromadným smazáním. */
export const SAMPLE_PROJECT_CODE = "PB-001";
export const isSampleProject = (project: { code: string }) => project.code === SAMPLE_PROJECT_CODE;

export const STATUS_FILTERS = [
  { value: "ALL", label: "Vše" },
  { value: "OPEN", label: "Rozpracované" },
  { value: "DONE", label: "Dokončené" },
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

/** Hledání podle kódu, názvu, zákazníka a místa instalace (bez diakritiky) + filtr stavu. */
export function filterProjects<T extends { code: string; name: string; customerName: string | null; installationSite?: string | null; status: PanelProjectStatus }>(projects: readonly T[], query: string, status: StatusFilter): T[] {
  const q = normalizeSearch(query.trim());
  return projects.filter((project) => {
    if (status === "OPEN" && project.status === "COMPLETED") return false;
    if (status === "DONE" && project.status !== "COMPLETED") return false;
    if (!q) return true;
    return [project.code, project.name, project.customerName ?? "", project.installationSite ?? ""].some((text) => normalizeSearch(text).includes(q));
  });
}

/** Smazání nedokončeného projektu (mimo vzorový PB-001) vrací firmě odečtené kredity (fáze 111 – pohyby kreditů). */
export const refundsCredit = (project: { code: string; status: PanelProjectStatus }) => project.status !== "COMPLETED" && !isSampleProject(project);

/**
 * Nahraný soubor, který smí aplikace fyzicky smazat: jen `/api/files/<druh>/<soubor>` bez
 * path traversal a nikdy nic ze složky `seed/` (vzorová data).
 */
export function isDeletableUpload(url: string | null | undefined): url is string {
  if (!url || !url.startsWith("/api/files/")) return false;
  const segments = url.slice("/api/files/".length).split("/");
  return segments.length === 2 && segments.every((segment) => segment && segment !== "." && segment !== ".." && segment !== "seed" && !/[\\\0:]/.test(segment));
}

/** Fotky projektu (celková fotka + detailní fotky lišt), které jde po smazání projektu odstranit. */
export function projectUploads(project: { photoUrl: string | null; railPhotosJson: string | null }): string[] {
  return [...new Set([project.photoUrl, ...Object.values(parseRailPhotos(project.railPhotosJson))].filter(isDeletableUpload))];
}
