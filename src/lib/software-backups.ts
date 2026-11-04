// Verzované zálohy řídicího SW a parametrů (fáze 46): PLC, HMI, roboty, frekvenční měniče. Verze
// v{major}.{minor} zvlášť pro každý řídicí uzel stroje (`targetUnit`), právě jedna ACTIVE.
// Bezpečnostní programy (Safety PLC / F-CPU) nesou kontrolní součet dle Nařízení (EU) 2023/1230.

import type { EquipmentType, SoftwareBackupStatus } from "@/generated/prisma/enums";

export type VersionBump = "minor" | "major";

export interface VersionLike {
  major: number;
  minor: number;
}

export const formatSoftwareVersion = (version: VersionLike) => `v${version.major}.${version.minor}`;

/** Další verze uzlu: Minor +0.1 (parametry, časovače) nebo Major +1.0 (nová revize programu). První záloha = v1.0. */
export function nextSoftwareVersion(existing: readonly VersionLike[], bump: VersionBump): VersionLike {
  if (!existing.length) return { major: 1, minor: 0 };
  const latest = [...existing].sort((a, b) => b.major - a.major || b.minor - a.minor)[0];
  return bump === "major" ? { major: latest.major + 1, minor: 0 } : { major: latest.major, minor: latest.minor + 1 };
}

export const compareVersions = (a: VersionLike, b: VersionLike) => b.major - a.major || b.minor - a.minor;

/** Kontrolní součet bezpečnostního programu: „CRC: 0x8F4A-2C91“, „0x8F4A2C91“, F-Signature (hex). */
export const SAFETY_CHECKSUM_PATTERN = /^(CRC:\s*)?(0x)?[0-9A-F]{4}(-?[0-9A-F]{4}){0,3}$|^F-Signature:\s*[0-9A-F-]{4,40}$/i;

/** Normalizace zápisu CRC („0x8f4a2c91“ → „CRC: 0x8F4A-2C91“); jiný formát vrátí ořezaný. */
export function normalizeChecksum(value: string): string {
  const trimmed = value.trim();
  const hex = /^(?:CRC:\s*)?(?:0x)?([0-9a-f]{4})-?([0-9a-f]{4})$/i.exec(trimmed);
  return hex ? `CRC: 0x${hex[1].toUpperCase()}-${hex[2].toUpperCase()}` : trimmed;
}

export interface BackupLike extends VersionLike {
  id: string;
  targetUnit: string;
  status: SoftwareBackupStatus;
  createdAt: Date | string;
}

export interface UnitGroup<T extends BackupLike> {
  unit: string;
  active: T | null;
  /** Starší verze (od nejnovější), včetně případných ARCHIVED novějších než aktivní po rollbacku. */
  history: T[];
}

/** Seskupení záloh podle řídicích uzlů stroje (uzly abecedně, verze od nejnovější). */
export function groupBackupsByUnit<T extends BackupLike>(backups: readonly T[]): UnitGroup<T>[] {
  const units = [...new Set(backups.map((backup) => backup.targetUnit))].sort((a, b) => a.localeCompare(b, "cs"));
  return units.map((unit) => {
    const versions = backups.filter((backup) => backup.targetUnit === unit).sort(compareVersions);
    const active = versions.find((backup) => backup.status === "ACTIVE") ?? null;
    return { unit, active, history: versions.filter((backup) => backup !== active) };
  });
}

/** Typové platformy (našeptávač v dialogu). */
export const SOFTWARE_PLATFORMS = ["TIA Portal V19", "TIA Portal V18", "Step7 V5.7", "Codesys V3.5", "Rockwell Studio 5000", "Loxone Config", "Parametry měniče VFD", "KUKA KRC4", "ABB RobotStudio", "WinCC Unified"] as const;

/** Záložka „Software & Zálohy PLC“ jen u pevných zařízení s řízením (ne spotřebiče, nářadí, hromosvody). */
const WITH_SOFTWARE: readonly EquipmentType[] = ["SWITCHBOARD", "PRODUCTION_LINE", "MACHINE", "CNC_MACHINE", "ROBOT_CELL", "HVAC_UNIT", "COMPRESSOR"];
export const hasSoftwareTab = (type: EquipmentType) => WITH_SOFTWARE.includes(type);

export const BACKUP_STATUS_LABELS: Record<SoftwareBackupStatus, string> = {
  ACTIVE: "Aktuálně ve stroji",
  ARCHIVED: "Archiv (rollback)",
};
