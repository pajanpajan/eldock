// Popisky a barvy stavů projektu rozváděče a rozpoznání prvků (Tailwind třídy zapsané doslova).

import type { EnclosureMaterial, EnclosureType, PanelProjectStatus, RecognitionStatus } from "@/generated/prisma/enums";

export const PROJECT_STATUS: Record<PanelProjectStatus, { label: string; badge: string }> = {
  DRAFT: { label: "Rozpracováno", badge: "border-zinc-500/50 bg-zinc-500/15 text-zinc-300" },
  RECOGNIZED: { label: "Prvky rozpoznány", badge: "border-sky-500/50 bg-sky-500/15 text-sky-300" },
  TREE_BUILT: { label: "Strom zapojení hotov", badge: "border-violet-500/50 bg-violet-500/15 text-violet-300" },
  COMPLETED: { label: "Propuštěno do provozu", badge: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" },
};

export const RECOGNITION: Record<RecognitionStatus, { label: string; stroke: string; fill: string; badge: string; text: string }> = {
  VERIFIED: { label: "Ověřeno", stroke: "#22c55e", fill: "rgba(34,197,94,0.14)", badge: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300", text: "text-emerald-300" },
  PARTIAL: { label: "K potvrzení", stroke: "#eab308", fill: "rgba(234,179,8,0.18)", badge: "border-yellow-500/50 bg-yellow-500/15 text-yellow-300", text: "text-yellow-300" },
  UNRECOGNIZED: { label: "Nerozpoznáno", stroke: "#ef4444", fill: "rgba(239,68,68,0.2)", badge: "border-red-500/50 bg-red-500/15 text-red-300", text: "text-red-300" },
};

export const ENCLOSURE_TYPES: Record<EnclosureType, string> = {
  WALL_MOUNTED: "Nástěnný",
  FLUSH_MOUNTED: "Zapuštěný",
  FREE_STANDING: "Volně stojící",
};

export const ENCLOSURE_MATERIALS: Record<EnclosureMaterial, string> = {
  PLASTIC: "Plast",
  PAINTED_STEEL: "Lakovaná ocel",
  STAINLESS_STEEL: "Nerezová ocel",
};

export interface ManufacturerInfo {
  name: string;
  address: string;
  city: string;
  phone: string;
}

export function parseManufacturerInfo(json: string | null | undefined): ManufacturerInfo {
  const empty = { name: "", address: "", city: "", phone: "" };
  try {
    const value = JSON.parse(json ?? "{}") as Partial<ManufacturerInfo>;
    return { name: String(value.name ?? ""), address: String(value.address ?? ""), city: String(value.city ?? ""), phone: String(value.phone ?? "") };
  } catch {
    return empty;
  }
}

/** Další volný kód projektu PB-001, PB-002 … */
export function nextProjectCode(codes: readonly string[]): string {
  const max = codes.reduce((top, code) => Math.max(top, Number(/^PB-(\d+)$/.exec(code)?.[1] ?? 0)), 0);
  return `PB-${String(max + 1).padStart(3, "0")}`;
}
