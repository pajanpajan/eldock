// Výběr konkrétního domovního přístroje z designové řady (fáze 49): zásuvka / dvojzásuvka / IP44,
// vypínač podle řazení, datová zásuvka a rámeček podle počtu míst. Přednost má bílá barva.

export interface PickableDevice {
  id: string;
  manufacturer: string;
  series: string;
  category: string;
  title: string;
  frameUnits: number | null;
  ipRating: string | null;
  featuresJson: string | null;
}

export type WiringNeed =
  | { kind: "socket"; double?: boolean; ip44?: boolean }
  | { kind: "switch"; switchNo: string }
  | { kind: "data" }
  | { kind: "frame"; units: number };

const features = (device: PickableDevice): Record<string, unknown> => {
  try {
    return JSON.parse(device.featuresJson ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
};

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Skóre vhodnosti (vyšší = lepší); záporné = nevyhovuje. */
function score(device: PickableDevice, need: WiringNeed): number {
  const f = features(device);
  const title = fold(device.title);
  const white = f.wd_color_family === "white" ? 2 : 0;
  const plain = /\b(m|studio)\b/i.test(String(f.wd_variant ?? "")) ? -0.5 : 0;
  switch (need.kind) {
    case "socket": {
      if (device.category !== "WD_SOCKET" || /usb|nabijeck|datov|tv|netatmo|vyklop/.test(title)) return -1;
      const isDouble = /dvoj/.test(title);
      if (Boolean(need.double) !== isDouble) return -1;
      const ip44 = /ip4[4-9]|ip5|ip6/.test(`${fold(device.ipRating ?? "")} ${fold(String(f.wd_ip ?? ""))} ${title}`);
      return 1 + white + plain + (need.ip44 ? (ip44 ? 3 : -0.5) : ip44 ? -1 : 0);
    }
    case "switch": {
      if (device.category !== "WD_SWITCH") return -1;
      const no = String(f.wd_switch_no ?? "");
      if (no !== need.switchNo) return -1;
      return 1 + white + plain + (/ip44/.test(title) ? -0.5 : 0) + (/balen/.test(title) ? -1 : 0);
    }
    case "data":
      return device.category === "WD_DATA" && f.wd_cover_kind !== "tv" && /rj45/.test(title) ? 1 + white + plain : -1;
    case "frame":
      return device.category === "WD_FRAME" && (device.frameUnits ?? Number(f.wd_frame_units ?? 0)) === need.units && !/kryt|ip44/.test(title) ? 1 + white + plain : -1;
  }
}

/** Nejvhodnější přístroj řady pro potřebu; žádný vyhovující → null. */
export function pickWiringDevice<T extends PickableDevice>(devices: readonly T[], need: WiringNeed): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const device of devices) {
    const value = score(device, need);
    if (value > bestScore || (value === bestScore && best && value > 0 && device.title.length < best.title.length)) {
      best = value > 0 ? device : best;
      bestScore = Math.max(bestScore, value);
    }
  }
  return best;
}

/** Řada jako klíč „výrobce|řada“ (např. „ABB|Levit“). */
export const seriesKey = (manufacturer: string, series: string) => `${manufacturer}|${series}`;
export const parseSeriesKey = (key: string | null | undefined) => {
  const [manufacturer, series] = (key ?? "").split("|");
  return manufacturer && series ? { manufacturer, series } : null;
};
