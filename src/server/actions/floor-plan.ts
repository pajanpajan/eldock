"use server";

import { prisma } from "@/lib/prisma";
import { layoutOfFloor, frameOfFloor } from "@/lib/studio-layout";
import { gridToPx, parseGridRef } from "@/lib/cad-grid";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertPermission } from "@/server/permissions";
import { assertTenantAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

export interface FloorPlanData {
  svg: string | null;
  viewBoxW: number;
  viewBoxH: number;
  /** Vchody / vrata patra (procenta viewBoxu). */
  gates: { x: number; y: number; label: string }[];
}

/**
 * Fáze 116: půdorys patra pro 📍 minimapu pochůzky revizního technika (načítá se až po rozbalení řádku, ne se
 * seznamem revizí) – SVG půdorysu a vrata / vchody.
 */
export async function getFloorPlanAction(floorId: string): Promise<ActionResult<FloorPlanData>> {
  try {
    await assertPermission("inspections");
    await assertTenantAccess({ floorId });
    const floor = await prisma.floor.findUnique({ where: { id: floorId }, select: { floorplanSvg: true, studioLayoutJson: true, viewBoxW: true, viewBoxH: true } });
    if (!floor) throw new WorkflowError("NOT_FOUND", "Patro nebylo nalezeno.");
    const layout = layoutOfFloor(floor);
    const frame = frameOfFloor(floor);
    const gates = layout.gates.flatMap((gate) => {
      const point = parseGridRef(gate.at, layout.grid);
      if (!point) return [];
      const px = gridToPx(point, frame);
      return [{ x: (px.x / (floor.viewBoxW || 1200)) * 100, y: (px.y / (floor.viewBoxH || 800)) * 100, label: gate.label }];
    });
    return { ok: true, data: { svg: floor.floorplanSvg, viewBoxW: floor.viewBoxW, viewBoxH: floor.viewBoxH, gates } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Půdorys patra se nepodařilo načíst." };
  }
}
