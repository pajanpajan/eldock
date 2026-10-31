// „Fotka“ otevřeného domovního / podružného rozváděče pro AI Panel Builder – SVG generované kódem.
// Přístroje sedí přesně v geometrii `photoGeometry`, takže rámečky rozpoznání na ně lícují.

import type { ComponentCategory } from "@/generated/prisma/enums";
import { PHOTO, photoGeometry, slotOffsets, slotRect, type EnclosureDims } from "@/lib/panel-builder/layout";

import { esc } from "./svg";

export interface PhotoDevice {
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  category: ComponentCategory;
  typeCode: string;
  manufacturer: string;
  /** Odlesk na čele přístroje (prvek, který AI nepřečte). */
  glare?: boolean;
  label?: string;
}

const DEFS = `<defs>
  <linearGradient id="pbWall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b2f35"/><stop offset="1" stop-color="#16181c"/></linearGradient>
  <linearGradient id="pbBox" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9dcd8"/><stop offset=".5" stop-color="#eceeea"/><stop offset="1" stop-color="#c6c9c5"/></linearGradient>
  <linearGradient id="pbInner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2c6c4"/><stop offset="1" stop-color="#a9adab"/></linearGradient>
  <linearGradient id="pbDevice" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9ebe8"/><stop offset=".5" stop-color="#fbfbfa"/><stop offset="1" stop-color="#dcdfdb"/></linearGradient>
  <linearGradient id="pbRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7dbe0"/><stop offset=".5" stop-color="#8d939b"/><stop offset="1" stop-color="#c3c8ce"/></linearGradient>
  <linearGradient id="pbGlare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".95"/><stop offset=".6" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="pbDoor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fb4c8" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#9fb4c8" stop-opacity=".14"/></linearGradient>
</defs>`;

function device(x: number, y: number, w: number, h: number, item: PhotoDevice) {
  const cx = x + w / 2;
  const lever = (lx: number) =>
    `<rect x="${lx - 5}" y="${y + h * 0.36}" width="10" height="${h * 0.2}" rx="2" fill="#2f3237"/><rect x="${lx - 5}" y="${y + h * 0.36}" width="10" height="${h * 0.08}" rx="2" fill="#4b4f56"/>`;
  const moduleCount = Math.max(1, Math.round(w / (h * 0.24)));
  const step = w / moduleCount;
  const levers =
    item.category === "SPD"
      ? Array.from({ length: moduleCount }, (_, i) => `<rect x="${x + i * step + 6}" y="${y + h * 0.3}" width="${step - 12}" height="${h * 0.32}" rx="3" fill="#6b7078"/><rect x="${x + i * step + step / 2 - 4}" y="${y + h * 0.4}" width="8" height="10" fill="#22c55e"/>`).join("")
      : item.category === "RCD" || item.category === "RCBO"
        ? `${lever(x + step / 2)}<circle cx="${x + w - step / 2}" cy="${y + h * 0.66}" r="6" fill="#facc15" stroke="#a16207"/><text x="${x + w - step / 2}" y="${y + h * 0.66 + 3}" font-size="8" text-anchor="middle" font-family="Arial" font-weight="700">T</text>`
        : item.category === "MAIN_SWITCH"
          ? `<rect x="${x + 6}" y="${y + h * 0.36}" width="${w - 12}" height="${h * 0.2}" rx="3" fill="#b91c1c"/><rect x="${x + 6}" y="${y + h * 0.36}" width="${w - 12}" height="${h * 0.07}" rx="3" fill="#dc2626"/>`
          : Array.from({ length: moduleCount }, (_, i) => lever(x + i * step + step / 2)).join("");
  const brand = item.manufacturer.toUpperCase().slice(0, 9);
  return `<g>
  <rect x="${x + 1}" y="${y}" width="${w - 2}" height="${h}" rx="4" fill="url(#pbDevice)" stroke="#9ca3a8" stroke-width="1.2"/>
  <rect x="${x + 3}" y="${y + h * 0.18}" width="${w - 6}" height="${h * 0.6}" rx="3" fill="#f4f5f3" stroke="#d0d4d2"/>
  <text x="${cx}" y="${y + h * 0.13}" font-family="Arial, sans-serif" font-size="${Math.min(11, w / 4)}" font-weight="900" fill="#e2001a" text-anchor="middle">${esc(brand)}</text>
  ${levers}
  <text x="${cx}" y="${y + h * 0.29}" font-family="Arial, sans-serif" font-size="${Math.min(10, w / 5.2)}" font-weight="700" fill="#1f2328" text-anchor="middle">${esc(item.typeCode.length > 14 ? item.typeCode.slice(0, 14) : item.typeCode)}</text>
  <text x="${cx}" y="${y + h * 0.9}" font-family="Arial, sans-serif" font-size="9" fill="#5b6168" text-anchor="middle">I-ON</text>
  ${item.glare ? `<rect x="${x - 4}" y="${y + 4}" width="${w + 8}" height="${h * 0.62}" rx="6" fill="url(#pbGlare)"/>` : ""}
</g>`;
}

/** SVG „fotky“ rozváděče s osazenými přístroji a ručně psanými popisky pod lištami. */
export function renderPanelPhotoSvg(dims: EnclosureDims, devices: readonly PhotoDevice[], title = ""): string {
  const geometry = photoGeometry(dims);
  const { x, y, w, h } = geometry.enclosure;
  const offsets = slotOffsets(devices);
  const rails = geometry.rails
    .map(
      (rail) => `<rect x="${rail.x0 - 14}" y="${rail.y - geometry.deviceH / 2 - 18}" width="${rail.x1 - rail.x0 + 28}" height="${geometry.deviceH + 36}" fill="#9aa09d" opacity=".55"/>
<rect x="${rail.x0 - 10}" y="${rail.y - 9}" width="${rail.x1 - rail.x0 + 20}" height="18" fill="url(#pbRail)"/>`,
    )
    .join("\n");
  const items = devices
    .map((item) => {
      const rect = slotRect(geometry, item.dinRailIndex, offsets.get(item) ?? 0, item.modulesWidth);
      // Ručně psaný štítek pod přístrojem; u úzkých modulů svisle, aby se nepřekrýval.
      const narrow = rect.w < 70;
      const text = esc(item.label && item.label.length > 12 ? `${item.label.slice(0, 11)}…` : (item.label ?? ""));
      const font = `font-family="'Segoe Print', 'Comic Sans MS', cursive" fill="#1e3a8a"`;
      const label = !item.label
        ? ""
        : narrow
          ? `<text transform="translate(${rect.x + rect.w / 2 - 4} ${rect.y + rect.h + 8}) rotate(90)" ${font} font-size="10">${text}</text>`
          : `<text x="${rect.x + rect.w / 2}" y="${rect.y + rect.h + 22}" ${font} font-size="12" text-anchor="middle">${text}</text>`;
      return device(rect.x, rect.y, rect.w, rect.h, item) + label;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PHOTO.width} ${PHOTO.height}" width="${PHOTO.width}" height="${PHOTO.height}">${DEFS}
<rect width="${PHOTO.width}" height="${PHOTO.height}" fill="url(#pbWall)"/>
<rect x="${x - 26}" y="${y - 26}" width="${w + 52}" height="${h + 52}" rx="18" fill="#000" opacity=".35"/>
<rect x="${x - 18}" y="${y - 18}" width="${w + 36}" height="${h + 36}" rx="14" fill="url(#pbBox)" stroke="#8b8f8b" stroke-width="2"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="url(#pbInner)"/>
${rails}
${items}
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="url(#pbDoor)"/>
${title ? `<text x="${x + 10}" y="${y + h - 12}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#374151" opacity=".7">${esc(title)}</text>` : ""}
</svg>`;
}
