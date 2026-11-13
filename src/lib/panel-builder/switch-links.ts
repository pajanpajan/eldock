// Fáze 112: ovládací vazby vypínač → světlo v 2D půdorysu. Místo šikmých čar přes místnosti čisté pravoúhlé CAD vodicí
// linky (L se zaobleným rohem, u téměř vodorovné / svislé vazby rovná čára), volitelně přímé čáry jako dřív nebo skryté.
// Volba „📐 Vazby vypínačů“ je v horní liště plátna (pamatuje si ji prohlížeč) a platí i pro tisk / PDF výkresu.

export type SwitchLinkMode = "ortho" | "straight" | "hidden";
export const SWITCH_LINK_MODES: readonly { id: SwitchLinkMode; label: string }[] = [
  { id: "ortho", label: "Pravoúhlé CAD" },
  { id: "straight", label: "Přímé" },
  { id: "hidden", label: "Skrýt" },
];
export const SWITCH_LINK_KEY = "eldock-floorplan-switch-links";
export const isSwitchLinkMode = (value: unknown): value is SwitchLinkMode => value === "ortho" || value === "straight" || value === "hidden";
export const DEFAULT_SWITCH_LINKS: SwitchLinkMode = "ortho";

interface Point {
  x: number;
  y: number;
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Pravoúhlá vazba (L): nejdřív podél delší osy, pak kolmo k cíli, roh zaoblený poloměrem `radius` (nejvýš polovina
 * kratšího ramene). Skoro rovná vazba (odchylka do 2 % delší osy) = rovná čára.
 */
export function orthoLinkPath(from: Point, to: Point, radius: number): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 1e-6 && ady < 1e-6) return `M ${round(from.x)} ${round(from.y)}`;
  if (ady <= adx * 0.02 || adx <= ady * 0.02) return `M ${round(from.x)} ${round(from.y)} L ${round(to.x)} ${round(to.y)}`;
  const r = Math.max(0, Math.min(radius, adx / 2, ady / 2));
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  if (adx >= ady) {
    // vodorovně k ose světla, pak svisle (roh v [to.x, from.y])
    return `M ${round(from.x)} ${round(from.y)} H ${round(to.x - sx * r)} Q ${round(to.x)} ${round(from.y)} ${round(to.x)} ${round(from.y + sy * r)} V ${round(to.y)}`;
  }
  // svisle, pak vodorovně (roh v [from.x, to.y])
  return `M ${round(from.x)} ${round(from.y)} V ${round(to.y - sy * r)} Q ${round(from.x)} ${round(to.y)} ${round(from.x + sx * r)} ${round(to.y)} H ${round(to.x)}`;
}

/** Cesta vazby podle volby (null = skrýt). */
export function switchLinkPath(mode: SwitchLinkMode, from: Point, to: Point, radius: number): string | null {
  if (mode === "hidden") return null;
  if (mode === "straight") return `M ${round(from.x)} ${round(from.y)} L ${round(to.x)} ${round(to.y)}`;
  return orthoLinkPath(from, to, radius);
}
