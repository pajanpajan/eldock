// Demo data fáze 16: dočasná provizoria (aktivní, vrácené 1:1, převedené na požadavek na změnu).
import type { TemporaryModStatus } from "../src/generated/prisma/enums";
import { tempModExpiry } from "../src/lib/temporary-mod";

import { daysAgo } from "./seed-data";

export interface TemporaryModSeed {
  /** Tag zařízení (seed ho převede na id). */
  equipmentId: string;
  number: string;
  title: string;
  description: string;
  createdByName: string;
  createdByRole: string;
  createdAt: Date;
  expiresAt: Date;
  photoUrl: string | null;
  status: TemporaryModStatus;
  resolvedAt: Date | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
  spawnedChangeRequestId: string | null;
}

const yearOf = (date: Date) => date.getUTCFullYear();

/** `spawned` = uzavřený požadavek ZM-2025-0007 (R-CNC-04, větší jistič F3), který vznikl z provizoria. */
export function TEMPORARY_MODS(spawned: { id: string; submittedAt: Date }): TemporaryModSeed[] {
  const activeAt = daysAgo(8, 7);
  const restoredAt = daysAgo(55, 13);
  const convertedAt = new Date(spawned.submittedAt.getTime() - 5 * 24 * 3600 * 1000);
  return [
    {
      equipmentId: "R-LIS-01",
      number: `PROV-${yearOf(activeAt)}-0007`,
      title: "Provizorní náhrada stykače K2 – čeká se na originální díl Siemens",
      description:
        "Vadný stykač K2 (Siemens 3RT2026, 25 A) dočasně nahrazen stykačem Schneider LC1D25BD ze skladu údržby. Cívka 24 V DC, zapojení silových i pomocných kontaktů beze změny. Kryt IP2X osazen, dveře rozváděče označeny výstražnou cedulkou „PROVIZORIUM“. Originál objednán, dodání do 14 dnů.",
      createdByName: "Miroslav Beneš",
      createdByRole: "Revizní technik",
      createdAt: activeAt,
      expiresAt: tempModExpiry(activeAt, 14),
      photoUrl: "/api/files/photos/seed/R-LIS-01-provizorium.svg",
      status: "ACTIVE",
      resolvedAt: null,
      resolvedByName: null,
      resolutionNote: null,
      spawnedChangeRequestId: null,
    },
    {
      equipmentId: "R-VZT-01",
      number: `PROV-${yearOf(restoredAt)}-0004`,
      title: "Přemostění havarijního termostatu ohřívače VZT",
      description: "Vadný havarijní termostat přemostěn propojkou na svorkách X2:14–15, obsluha VZT kontroluje teplotu ohřívače ručně 2× za směnu.",
      createdByName: "Jana Dvořáková",
      createdByRole: "Údržba",
      createdAt: restoredAt,
      expiresAt: tempModExpiry(restoredAt, 7),
      photoUrl: null,
      status: "RESTORED_1_TO_1",
      resolvedAt: daysAgo(50, 10),
      resolvedByName: "Petr Novák",
      resolutionNote: "Osazen nový termostat stejného typu (Danfoss KP 81), propojka odstraněna – zapojení 1:1 dle schématu.",
      spawnedChangeRequestId: null,
    },
    {
      equipmentId: "R-CNC-04",
      number: `PROV-${yearOf(convertedAt)}-0002`,
      title: "Provizorní jistič C16 A místo F3 po výměně vřeteníku",
      description: "Jistič F3 C10 A po výměně vřeteníku vybavoval, dočasně osazen C16 A ze skladu do dodání správného jističe.",
      createdByName: "Petr Novák",
      createdByRole: "Údržba",
      createdAt: convertedAt,
      expiresAt: tempModExpiry(convertedAt, 7),
      photoUrl: null,
      status: "CONVERTED_TO_CR",
      resolvedAt: spawned.submittedAt,
      resolvedByName: "Petr Novák",
      resolutionNote: "Finálně osazen jistič C20 A (jiná hodnota než ve schématu) – předáno CAE k zakreslení.",
      spawnedChangeRequestId: spawned.id,
    },
  ];
}
