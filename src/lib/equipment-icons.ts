import {
  Bot,
  Cable,
  CircuitBoard,
  CloudLightning,
  Cog,
  CookingPot,
  Drill,
  Factory,
  Fan,
  Flame,
  Gauge,
  LampCeiling,
  Package,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { EquipmentType } from "@/generated/prisma/enums";

/** Ikona podle typu zařízení (piny, karty, tabulky). */
export const EQUIPMENT_TYPE_ICONS: Record<EquipmentType, LucideIcon> = {
  SWITCHBOARD: CircuitBoard,
  MACHINE: Wrench,
  CNC_MACHINE: Cog,
  PRODUCTION_LINE: Factory,
  ROBOT_CELL: Bot,
  HVAC_UNIT: Fan,
  COMPRESSOR: Gauge,
  TRANSFORMER: Zap,
  POWER_TOOL: Drill,
  APPLIANCE: CookingPot,
  EXTENSION_CORD: Cable,
  WELDER: Flame,
  LIGHTNING_ROD: CloudLightning,
  EMERGENCY_LIGHTING: LampCeiling,
  OTHER: Package,
};
