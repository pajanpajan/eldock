import {
  Bot,
  CircuitBoard,
  Cog,
  Factory,
  Fan,
  Gauge,
  Package,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { EquipmentType } from "@/generated/prisma/enums";

/** Ikona podle typu zařízení (piny, karty, tabulky). */
export const EQUIPMENT_TYPE_ICONS: Record<EquipmentType, LucideIcon> = {
  SWITCHBOARD: CircuitBoard,
  CNC_MACHINE: Cog,
  PRODUCTION_LINE: Factory,
  ROBOT_CELL: Bot,
  HVAC_UNIT: Fan,
  COMPRESSOR: Gauge,
  TRANSFORMER: Zap,
  OTHER: Package,
};
