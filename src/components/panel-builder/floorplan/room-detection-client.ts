"use client";

import type { EditorRoom } from "@/lib/panel-builder/floorplan-editor";
import { imagePointToPlan, visibleRect, type FloorplanBackground } from "@/lib/panel-builder/floorplan-pdf";
import { buildBarrier, detectWithBarrier, roomAt, roomTags, type Barrier, type DetectedRoom, type DetectResult, type RoomTag } from "@/lib/panel-builder/pdf-room-detector";
import { pointInRoom, polygonBounds } from "@/lib/panel-builder/room-geometry";

// Fáze 113: podklad podlaží (otočení + ořez) → rastr pro rozpoznání místností v prohlížeči. Masky stěn se počítají
// jednou pro podklad a měřítko (🔍 automaticky i každý 🪄 klik je pak okamžitý); výsledek je v mm půdorysu.

/**
 * Delší strana pracovního rastru [px] – fáze 114: v plném rozlišení podkladu (2400 px), tenké 1–2px kóty se tak nerozmažou
 * do šedé a filtr tloušťky čar je spolehlivě odliší od zdiva; vrstvy masek se počítají líně (klik ~0,4 s).
 */
const WORK_MAX_SIDE = 2400;

export interface RoomRaster {
  barrier: Barrier;
  tags: RoomTag[];
  /** mm půdorysu na 1 px rastru. */
  mmPerWorkPx: number;
}

let cache: { key: string; value: Promise<RoomRaster> } | null = null;

const cacheKey = (background: FloorplanBackground, mmPerPx: number) => JSON.stringify([background.url, background.rotation, background.crop, background.labels?.length ?? 0, Math.round(mmPerPx * 1000)]);

/** Rastr a masky stěn podkladu (mezipaměť podle podkladu a měřítka). */
export function roomRaster(background: FloorplanBackground, mmPerPx: number): Promise<RoomRaster> {
  const key = cacheKey(background, mmPerPx);
  if (cache?.key === key) return cache.value;
  const value = build(background, mmPerPx);
  cache = { key, value };
  value.catch(() => {
    if (cache?.key === key) cache = null;
  });
  return value;
}

async function build(background: FloorplanBackground, mmPerPx: number): Promise<RoomRaster> {
  const image = new Image();
  image.src = background.url;
  await image.decode();
  const rect = visibleRect(background);
  const f = Math.min(1, WORK_MAX_SIDE / Math.max(rect.w, rect.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.w * f));
  canvas.height = Math.max(1, Math.round(rect.h * f));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Plátno není k dispozici.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Stejná transformace jako podklad na plátně (`backgroundTransform`): měřítko → posun o ořez → otočení obrázku
  ctx.setTransform(f, 0, 0, f, -rect.x * f, -rect.y * f);
  const { widthPx: w, heightPx: h } = background;
  if (background.rotation === 90) {
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
  } else if (background.rotation === 180) {
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
  } else if (background.rotation === 270) {
    ctx.translate(0, w);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(image, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mmPerWorkPx = mmPerPx / f;
  const tags = roomTags(
    (background.labels ?? []).map((label) => {
      const at = imagePointToPlan(background, mmPerPx, label);
      return { text: label.text, x: at.x / mmPerWorkPx, y: at.y / mmPerWorkPx, h: label.h * f };
    }),
  );
  const barrier = buildBarrier({ width: canvas.width, height: canvas.height, data: pixels.data, channels: 4 }, tags, { mmPerPx: mmPerWorkPx });
  return { barrier, tags, mmPerWorkPx };
}

const round10 = (value: number) => Math.round(value / 10) * 10;

/** Rozpoznaná místnost (px rastru) → místnost editoru v mm (obdélník, nebo polygon do 40 rohů). */
export function editorRoomOf(room: DetectedRoom, mmPerWorkPx: number, id: string, name: string): EditorRoom {
  const points = room.points.map((point) => ({ x: round10(point.x * mmPerWorkPx), y: round10(point.y * mmPerWorkPx) }));
  if (room.rect) {
    const bounds = polygonBounds(points);
    return { id, name, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
  }
  return { id, name, ...polygonBounds(points), points };
}

/** 🔍 Automaticky: místnosti podlaží z PDF; místnosti, jejichž střed už leží v nakreslené místnosti, se přeskočí. */
export async function detectFloorRooms(background: FloorplanBackground, mmPerPx: number, existing: readonly EditorRoom[]): Promise<{ result: DetectResult; fresh: DetectedRoom[]; mmPerWorkPx: number }> {
  const raster = await roomRaster(background, mmPerPx);
  const result = detectWithBarrier(raster.barrier, raster.tags);
  const fresh = result.rooms.filter((room) => !existing.some((current) => pointInRoom(current, room.seed.x * raster.mmPerWorkPx, room.seed.y * raster.mmPerWorkPx)));
  return { result, fresh, mmPerWorkPx: raster.mmPerWorkPx };
}

/** 🪄 Klik do místnosti (bod v mm půdorysu). */
export async function detectRoomAt(background: FloorplanBackground, mmPerPx: number, point: { x: number; y: number }): Promise<{ room: DetectedRoom; mmPerWorkPx: number } | { error: string }> {
  const raster = await roomRaster(background, mmPerPx);
  const found = roomAt(raster.barrier, { x: point.x / raster.mmPerWorkPx, y: point.y / raster.mmPerWorkPx }, raster.tags);
  return "error" in found ? found : { room: found, mmPerWorkPx: raster.mmPerWorkPx };
}
