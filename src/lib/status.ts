import {
  Archive,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  Clock,
  FileClock,
  Hourglass,
  Inbox,
  MessageSquare,
  Timer,
  TimerOff,
  Upload,
  UserCheck,
  OctagonAlert,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type {
  ChangeRequestEventType,
  ChangeRequestPriority,
  ChangeRequestStatus,
  EquipmentStatus,
  InspectionResult,
  RevisionStatus,
} from "@/generated/prisma/enums";
import { formatCount, formatDateShort, plural } from "@/lib/format";
import { INSPECTION_WARNING_DAYS, type InspectionState } from "@/lib/inspection";

// Jediný zdroj pravdy pro barvy a popisky stavů. Třídy Tailwindu jsou zapsané
// doslova, aby je kompilátor našel; `hex` slouží SVG vrstvám (piny, mapa).

export interface StatusStyle {
  label: string;
  /** Delší vysvětlení pro tooltip a legendu. */
  description: string;
  icon: LucideIcon;
  /** Barva pro SVG a canvas. */
  hex: string;
  /** Vyplněný badge (text + jemné pozadí + rámeček). */
  badge: string;
  /** Plná tečka. */
  dot: string;
  /** Text v barvě stavu. */
  text: string;
  /** Jemné pozadí s rámečkem (bannery, karty). */
  soft: string;
}

const EMERALD = {
  hex: "#10b981",
  badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  dot: "bg-emerald-500",
  text: "text-emerald-400",
  soft: "border-emerald-500/40 bg-emerald-500/10",
};
const ORANGE = {
  hex: "#f97316",
  badge: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  dot: "bg-orange-500",
  text: "text-orange-400",
  soft: "border-orange-500/40 bg-orange-500/10",
};
const AMBER = {
  hex: "#f59e0b",
  badge: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  dot: "bg-amber-500",
  text: "text-amber-400",
  soft: "border-amber-500/40 bg-amber-500/10",
};
const SKY = {
  hex: "#0ea5e9",
  badge: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  dot: "bg-sky-500",
  text: "text-sky-400",
  soft: "border-sky-500/40 bg-sky-500/10",
};
const RED = {
  hex: "#ef4444",
  badge: "border-red-500/40 bg-red-500/15 text-red-300",
  dot: "bg-red-500",
  text: "text-red-400",
  soft: "border-red-500/40 bg-red-500/10",
};
const ZINC = {
  hex: "#a1a1aa",
  badge: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
  dot: "bg-zinc-400",
  text: "text-zinc-400",
  soft: "border-zinc-500/40 bg-zinc-500/10",
};

export const EQUIPMENT_STATUS: Record<EquipmentStatus, StatusStyle> = {
  ACTIVE: {
    ...EMERALD,
    label: "Aktuální",
    description: "Dokumentace je 100% aktuální.",
    icon: CircleCheck,
  },
  PENDING_UPDATE: {
    ...ORANGE,
    label: "Čeká na aktualizaci",
    description: "Z haly byla nahlášena změna, CAE projektant na ní pracuje.",
    icon: TriangleAlert,
  },
  WAITING_APPROVAL: {
    ...SKY,
    label: "Čeká na schválení",
    description: "CAE nahrál novou revizi, čeká na potvrzení údržbou.",
    icon: Hourglass,
  },
};

export const CHANGE_REQUEST_STATUS: Record<ChangeRequestStatus, StatusStyle> = {
  SUBMITTED: {
    ...ORANGE,
    label: "Nová",
    description: "Technik změnu odeslal, čeká na převzetí projektantem.",
    icon: Inbox,
  },
  IN_PROGRESS: {
    ...AMBER,
    label: "V řešení",
    description: "Projektant změnu převzal a zpracovává novou revizi.",
    icon: Wrench,
  },
  WAITING_APPROVAL: {
    ...SKY,
    label: "Čeká na schválení",
    description: "Nová revize je nahraná, čeká na potvrzení údržbou.",
    icon: Hourglass,
  },
  APPROVED: {
    ...EMERALD,
    label: "Uzavřená",
    description: "Revize byla potvrzena a propsána do systému.",
    icon: CircleCheck,
  },
  CANCELLED: {
    ...ZINC,
    label: "Stornovaná",
    description: "Požadavek byl stornován.",
    icon: CircleSlash,
  },
};

export const REVISION_STATUS: Record<RevisionStatus, StatusStyle> = {
  PENDING_APPROVAL: {
    ...SKY,
    label: "Čeká na schválení",
    description: "Nová revize čeká na potvrzení údržbou.",
    icon: FileClock,
  },
  ACTIVE: {
    ...EMERALD,
    label: "Platná",
    description: "Aktuálně platná revize dokumentace.",
    icon: CircleCheck,
  },
  ARCHIVED: {
    ...ZINC,
    label: "Archiv",
    description: "Nahrazená novější revizí.",
    icon: Archive,
  },
  REJECTED: {
    ...RED,
    label: "Vrácená",
    description: "Revize byla vrácena k přepracování.",
    icon: CircleX,
  },
};

export const CHANGE_REQUEST_PRIORITY: Record<ChangeRequestPriority, StatusStyle> = {
  LOW: {
    ...ZINC,
    label: "Nízká",
    description: "Změna bez časového tlaku.",
    icon: CircleDashed,
  },
  NORMAL: {
    ...SKY,
    label: "Normální",
    description: "Běžná změna dokumentace.",
    icon: Clock,
  },
  HIGH: {
    ...ORANGE,
    label: "Vysoká",
    description: "Změna, která ovlivňuje provoz.",
    icon: TriangleAlert,
  },
  CRITICAL: {
    ...RED,
    label: "Kritická (bezpečnost)",
    description: "Bezpečnostně relevantní změna.",
    icon: OctagonAlert,
  },
};

/** Stáří otevřeného ticketu vůči SLA podle priority (CAE dashboard). */
export type SlaLevel = "OK" | "WARNING" | "OVERDUE";

export const SLA_LEVEL: Record<SlaLevel, StatusStyle> = {
  OK: { ...EMERALD, label: "V termínu", description: "Ticket je v rámci lhůty pro svou prioritu.", icon: Timer },
  WARNING: { ...AMBER, label: "Blíží se termín", description: "Ticket čeká déle, než je u jeho priority obvyklé.", icon: Timer },
  OVERDUE: { ...RED, label: "Po termínu", description: "Ticket překročil lhůtu pro svou prioritu.", icon: TimerOff },
};

/** Události v timeline ticketu. */
export const CHANGE_REQUEST_EVENT: Record<ChangeRequestEventType, StatusStyle> = {
  SUBMITTED: { ...ORANGE, label: "Změna nahlášena", description: "Technik odeslal požadavek na změnu.", icon: Inbox },
  ASSIGNED: { ...AMBER, label: "Převzato", description: "Projektant požadavek převzal.", icon: UserCheck },
  REVISION_UPLOADED: { ...SKY, label: "Nahrána nová revize", description: "Projektant nahrál revizi ke schválení.", icon: Upload },
  APPROVED: { ...EMERALD, label: "Schváleno a propsáno", description: "Údržba potvrdila novou revizi.", icon: CircleCheck },
  REJECTED: { ...RED, label: "Vráceno k přepracování", description: "Údržba revizi vrátila.", icon: CircleX },
  COMMENT: { ...ZINC, label: "Komentář", description: "Komentář nebo doplněné fotky.", icon: MessageSquare },
  CANCELLED: { ...ZINC, label: "Stornováno", description: "Požadavek byl stornován.", icon: CircleSlash },
};

/** Pořadí „horší = vyšší“ pro souhrnný stav budovy nebo patra. */
export const EQUIPMENT_STATUS_SEVERITY: Record<EquipmentStatus, number> = {
  ACTIVE: 0,
  WAITING_APPROVAL: 1,
  PENDING_UPDATE: 2,
};

export function worstEquipmentStatus(statuses: Iterable<EquipmentStatus>): EquipmentStatus {
  let worst: EquipmentStatus = "ACTIVE";
  for (const status of statuses) {
    if (EQUIPMENT_STATUS_SEVERITY[status] > EQUIPMENT_STATUS_SEVERITY[worst]) worst = status;
  }
  return worst;
}

/** Stav elektrorevize (lhůtník ČSN 33 1500) – semafor, odznak v hlavičce a hlídač termínů. */
export const INSPECTION_STATE: Record<InspectionState, StatusStyle> = {
  VALID: { ...EMERALD, label: "Revize platná", description: "Pravidelná revize je v platnosti.", icon: ShieldCheck },
  EXPIRING: {
    ...AMBER,
    label: "Blíží se konec platnosti revize!",
    description: `Platnost revize končí do ${INSPECTION_WARNING_DAYS} dnů – objednejte revizního technika.`,
    icon: ShieldAlert,
  },
  EXPIRED: {
    ...RED,
    label: "Revize propadlá",
    description: "Platnost revize uplynula – zařízení nemá platnou revizní zprávu.",
    icon: ShieldX,
  },
  MISSING: { ...ZINC, label: "Bez revize", description: "K zařízení není zapsaná výchozí ani pravidelná revize.", icon: ShieldQuestion },
};

/** Text odznaku: „Revize platná do 28.12.2027“ / „Revize končí za 18 dní“ / „REVIZE PROPADLÁ před 14 dny“. */
export function inspectionBadgeLabel(state: InspectionState, validUntil: Date | null, daysLeft: number | null): string {
  if (state === "MISSING" || !validUntil || daysLeft === null) return "Bez záznamu o revizi";
  if (state === "VALID") return `Revize platná do ${formatDateShort(validUntil)}`;
  if (state === "EXPIRING") {
    return daysLeft === 0 ? "Revize končí dnes" : `Revize končí za ${formatCount(daysLeft, ["den", "dny", "dní"])}`;
  }
  const ago = -daysLeft;
  return `REVIZE PROPADLÁ před ${ago} ${plural(ago, ["dnem", "dny", "dny"])}`;
}

/** Posudek revizní zprávy. */
export const INSPECTION_RESULT: Record<InspectionResult, StatusStyle> = {
  CAPABLE: { ...EMERALD, label: "Schopno bezpečného provozu", description: "Zařízení je schopné bezpečného provozu.", icon: CircleCheck },
  CAPABLE_WITH_DEFECTS: {
    ...AMBER,
    label: "Schopno s výhradou",
    description: "Schopno bezpečného provozu za podmínky odstranění zjištěných závad.",
    icon: TriangleAlert,
  },
  INCAPABLE: { ...RED, label: "Neschopno provozu", description: "Zařízení není schopné bezpečného provozu.", icon: OctagonAlert },
};
