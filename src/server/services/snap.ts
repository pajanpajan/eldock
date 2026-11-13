import type { PrismaClient } from "@/generated/prisma/client";
import { guessDeviceType, type HlidacMode } from "@/lib/hlidac";
import type { NameplateReading } from "@/lib/nameplate";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { visionJson } from "./geminiPanelService";
import { createRoomDevice } from "./hlidac";
import { recordQuickInspection, renderQuickReport } from "./inspection";
import { applyNameplate, readNameplate, saveNameplatePhoto } from "./nameplate";
import { bindEquipmentLabel, ensureEquipmentLabel } from "./qr-labels";

// Fáze 112: ⚡ Rychlý sekvenční sběr v místnosti (Scan & Snap Loop) – jeden cyklus = jeden spotřebič: založení v místnosti,
// naskenovaný QR štítek EL-xxxxxx (nebo další v pořadí z registru), fotka výrobního štítku s AI čtením (název, výrobce,
// model, S/N, třída) a výsledek měření jedním klikem (rychlá revize). Odeslání z offline fronty je idempotentní – stejné
// id klienta vrátí uložený výsledek a nic se nezaloží podruhé.

export interface SnapInput {
  /** Id klienta z offline fronty. */
  id: string;
  accountId: string | null;
  floorId: string;
  room: string;
  mode: HlidacMode;
  labelCode: string | null;
  passed: boolean;
  rpeOhm: number | null;
  risoMOhm: number | null;
  inspectorName: string;
  inspectorLicense: string;
  /** Text štítku (bez Gemini), fotka štítku (uložená URL + obsah pro AI). */
  text: string | null;
  photo: { url: string; bytes: Buffer; mimeType: string } | null;
}

export interface SnapResult {
  equipmentId: string;
  tag: string;
  name: string;
  label: string;
  reading: NameplateReading | null;
  inspection: "CAPABLE" | "INCAPABLE" | null;
  warning: string | null;
}

export async function processSnap(prisma: PrismaClient, input: SnapInput, deps: { saveReport: (svg: string) => Promise<string>; vision?: typeof visionJson; now?: Date }): Promise<{ result: SnapResult; duplicate: boolean }> {
  const done = await prisma.offlineSubmission.findUnique({ where: { id: input.id } });
  if (done?.resultJson) return { result: JSON.parse(done.resultJson) as SnapResult, duplicate: true };
  if (!/^[\w-]{8,64}$/.test(input.id)) throw new WorkflowError("VALIDATION", "Neplatné id záznamu.");

  // 1) Výrobní štítek: AI (Gemini) nebo text štítku – název a druh spotřebiče pro založení
  const nameplate = input.photo || input.text ? await readNameplate({ image: input.photo ? { bytes: input.photo.bytes, mimeType: input.photo.mimeType } : null, text: input.text }, deps.vision ? { vision: deps.vision } : {}) : null;
  const reading = nameplate?.reading ?? null;
  const label = [reading?.name, !reading?.name && reading?.manufacturer ? `${reading.manufacturer} ${reading.model ?? ""}`.trim() : null].find(Boolean) ?? "Spotřebič (doplnit název ze štítku)";
  const guess = guessDeviceType(label);
  const device = await createRoomDevice(prisma, {
    floorId: input.floorId,
    room: input.room,
    label: label.slice(0, 120),
    ...guess,
    protectionClass: reading?.protectionClass ?? guess.protectionClass,
    mode: input.mode,
    serialNumber: reading?.serialNumber ?? null,
  });

  // 2) QR štítek: naskenovaný EL-xxxxxx, jinak další v pořadí z registru
  let warning = nameplate?.warning ?? null;
  let serial: string;
  try {
    serial = input.labelCode ? await bindEquipmentLabel(prisma, input.labelCode, device.id) : await ensureEquipmentLabel(prisma, device.id);
  } catch (error) {
    if (!(error instanceof WorkflowError)) throw error;
    warning = `${error.message} Zařízení dostalo nový štítek z registru.`;
    serial = await ensureEquipmentLabel(prisma, device.id);
  }

  // 3) Fotka štítku jako druhá fotka zařízení + potvrzené údaje (výrobce, model, S/N, třída, lhůta)
  if (nameplate && input.photo) await saveNameplatePhoto(prisma, device.id, { photoUrl: input.photo.url, result: nameplate }, deps.now);
  if (reading) await applyNameplate(prisma, device.id, { ...reading, title: reading.name ?? null });

  // 4) Výsledek měření jedním klikem (rychlá revize – VYHOVUJE / NEVYHOVUJE)
  let inspection: SnapResult["inspection"] = null;
  const quick = { equipmentId: device.id, inspectorName: input.inspectorName, inspectorLicense: input.inspectorLicense, passed: input.passed, protectiveConductorResistance: input.rpeOhm, insulationResistance: input.risoMOhm, measuringInstrument: "Sekvenční sběr ELDOCK (Scan & Snap)", defectsSummary: input.passed ? null : "Nevyhovuje při sekvenčním sběru – vyřadit z provozu a označit." };
  try {
    const url = await deps.saveReport(await renderQuickReport(prisma, quick, deps.now));
    await recordQuickInspection(prisma, { ...quick, reportUrl: url }, deps.now);
    inspection = input.passed ? "CAPABLE" : "INCAPABLE";
  } catch (error) {
    if (!(error instanceof WorkflowError)) throw error;
    warning = [warning, `Revize nezapsána: ${error.message}`].filter(Boolean).join(" ");
  }

  const fresh = await prisma.equipment.findUnique({ where: { id: device.id }, select: { name: true } });
  const result: SnapResult = { equipmentId: device.id, tag: device.tag, name: fresh?.name ?? device.name, label: serial, reading, inspection, warning };
  await prisma.offlineSubmission.create({ data: { id: input.id, accountId: input.accountId, kind: "snap", resultJson: JSON.stringify(result) } }).catch(() => undefined);
  return { result, duplicate: false };
}
