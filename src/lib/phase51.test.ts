import { describe, expect, it } from "vitest";

import { BLIND_CABLE, DOUBLE_TWO_WAY_CABLE, THERMOSTAT_CABLE } from "@/engine/cable-routing";
import { BRAND_SLUGS, brandSlug, sanitizeSvg, wordmarkSvg } from "@/lib/panel-builder/brand-logos";
import { isFanOnlyManufacturer, isHiddenManufacturer } from "@/lib/panel-builder/brands";
import {
  analyzeDraft,
  applyAppearance,
  buildPlan,
  deleteRoom,
  emptyDraft,
  moveRoom,
  PALETTE,
  parseDraft,
  resizeRect,
  roomDimensions,
  updateRoom,
  wiringInventory,
  type EditorElement,
  type FloorplanDraft,
} from "@/lib/panel-builder/floorplan-editor";
import { DESIGN_BRANDS, appearanceLabel, dbSeriesFor, designSeriesOf } from "@/lib/panel-builder/wiring-designs";
import { pickWiringDevice, type PickableDevice } from "@/lib/panel-builder/wiring-picker";
import { candidateTimes, keyframeTimes, scaledSize, sharpnessScore } from "@/lib/video-frames";

const el = (id: string, item: string, x: number, y: number, room = "Obývák", patch: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, rotation: 0, scale: null, controls: [], ...patch });

describe("loga výrobců z public/brands", () => {
  it("slug souboru podle značky katalogu – 19 oficiálních značek (fáze 81 + TapHome) + neznámý výrobce", () => {
    expect(Object.values(BRAND_SLUGS)).toHaveLength(19);
    expect(brandSlug("TapHome")).toBe("taphome");
    expect(brandSlug("Schneider Electric")).toBe("schneider");
    expect(brandSlug("ABB")).toBe("abb");
    expect(brandSlug("Phoenix Contact")).toBe("phoenix-contact");
    expect(brandSlug("Weidmüller & Co")).toBe("weidmuller-co");
  });

  it("stažené SVG projde jen bez skriptů, obsluh událostí a externích odkazů", () => {
    const ok = '<?xml version="1.0"?><!-- Inkscape --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="10" height="10"/><use href="#g"/></svg>';
    expect(sanitizeSvg(ok)).toMatch(/^<svg/);
    expect(sanitizeSvg('<svg><script>alert(1)</script></svg>')).toBeNull();
    expect(sanitizeSvg('<svg><rect onload="x()"/></svg>')).toBeNull();
    expect(sanitizeSvg('<svg><image href="https://evil.example/a.png"/></svg>')).toBeNull();
    expect(sanitizeSvg("<html>Not found</html>")).toBeNull();
  });

  it("generovaný wordmark = průhledné SVG v barvě značky, bez bílého obdélníku", () => {
    const svg = wordmarkSvg("noark");
    expect(svg).toContain("NOARK");
    expect(svg).toContain("#d71920");
    expect(svg).not.toMatch(/fill="#ffffff"|fill="#fff"\s*\/>\s*<text/);
    expect(wordmarkSvg("neznamy", "Firma <X>")).toContain("FIRMA &#60;X&#62;");
  });

  it("okrajové značky skryté, výrobci ventilátorů jen v kroku 3", () => {
    for (const name of ["ORNO", "Pollock", "Lovato", "Lovato Electric"]) expect(isHiddenManufacturer(name)).toBe(true);
    expect(isFanOnlyManufacturer("Pfannenberg")).toBe(true);
    expect(isFanOnlyManufacturer("STEGO")).toBe(true);
    expect(isFanOnlyManufacturer("Rittal")).toBe(false);
    expect(isHiddenManufacturer("ABB")).toBe(false);
  });
});

describe("🎥 snímky z videa rozváděče", () => {
  it("6 rovnoměrně rozložených časů uprostřed úseků (bez začátku a konce)", () => {
    expect(keyframeTimes(12)).toEqual([1, 3, 5, 7, 9, 11]);
    expect(keyframeTimes(0)).toEqual([]);
    expect(candidateTimes(0.1, 12)).toEqual([0.1, 0, 0.35]);
    expect(candidateTimes(11.9, 12)).toEqual([11.9, 11.65, 11.95]);
  });

  it("rozměr snímku max. 1920 px se zachovaným poměrem stran", () => {
    expect(scaledSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
    expect(scaledSize(1080, 1920)).toEqual({ width: 1080, height: 1920 });
    expect(scaledSize(1280, 720)).toEqual({ width: 1280, height: 720 });
  });

  it("ostrost: šachovnice (ostré hrany) > rozmazaný přechod > plocha", () => {
    const image = (fn: (x: number, y: number) => number) => {
      const data = new Uint8ClampedArray(16 * 16 * 4);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) data.fill(fn(x, y), (y * 16 + x) * 4, (y * 16 + x) * 4 + 3);
      return data;
    };
    const sharp = sharpnessScore(image((x, y) => ((x + y) % 2 ? 255 : 0)), 16, 16);
    const blurred = sharpnessScore(image((x) => x * 16), 16, 16);
    const flat = sharpnessScore(image(() => 128), 16, 16);
    expect(sharp).toBeGreaterThan(blurred);
    expect(blurred).toBeGreaterThanOrEqual(flat);
    expect(flat).toBe(0);
  });
});

describe("🎨 kaskáda výrobce → řada → barva", () => {
  it("řady výrobců ze zadání a převod na řady katalogu", () => {
    expect(DESIGN_BRANDS.map((brand) => brand.manufacturer)).toEqual(["ABB", "Schneider", "Legrand", "Hager"]);
    // Fáze 55: 14 řad pod omítku + 3 nástěnné (Katalog ABB 2026), Swing a Swing L zvlášť
    expect(DESIGN_BRANDS[0].series).toHaveLength(17);
    // starší klíč nákresu „Swing / Swing L“ se přiřadí k řadě Swing
    expect(dbSeriesFor("ABB|Swing / Swing L")).toEqual({ manufacturer: "ABB", series: ["Swing"] });
    expect(designSeriesOf("ABB|Swing L")?.series.name).toBe("Swing L");
    expect(dbSeriesFor("Neznámý|X")).toEqual({ manufacturer: "Neznámý", series: ["X"] });
    expect(appearanceLabel("Legrand|Valena Life", "black")).toBe("Legrand Valena Life · Černá matná / Antracit");
  });

  it("výběr přístroje: preferovaná barva, kategorie (žaluzie, termostat) a IP44", () => {
    const device = (id: string, category: string, title: string, features: Record<string, unknown>): PickableDevice => ({ id, manufacturer: "ABB", series: "Levit", category, title, frameUnits: null, ipRating: null, featuresJson: JSON.stringify(features) });
    const devices = [
      device("w", "WD_SWITCH", "vypínač č.1 bílá", { wd_switch_no: "1", wd_color_family: "white" }),
      device("b", "WD_SWITCH", "vypínač č.1 onyx", { wd_switch_no: "1", wd_color_family: "black" }),
      device("ip", "WD_SWITCH", "vypínač č.1 IP44 bílá", { wd_switch_no: "1", wd_color_family: "white", wd_ip: "IP44" }),
      device("z", "WD_BLIND", "žaluziový spínač bílá", { wd_color_family: "white" }),
    ];
    expect(pickWiringDevice(devices, { kind: "switch", switchNo: "1" })?.id).toBe("w");
    expect(pickWiringDevice(devices, { kind: "switch", switchNo: "1" }, { colorFamilies: ["black", "anthracite"] })?.id).toBe("b");
    expect(pickWiringDevice(devices, { kind: "switch", switchNo: "1", ip44: true })?.id).toBe("ip");
    expect(pickWiringDevice(devices, { kind: "category", category: "WD_BLIND" })?.id).toBe("z");
    expect(pickWiringDevice(devices, { kind: "category", category: "WD_THERMOSTAT" })).toBeNull();
  });

  it("vzhled na celý půdorys / na místnost a soupis domovní instalace", () => {
    const draft: FloorplanDraft = {
      ...emptyDraft(),
      series: "Schneider|Asfora",
      color: "black",
      elements: [el("rh", "panel", 0, 0), el("a", "socket", 1000, 0, "Obývák"), el("b", "switch-1", 2000, 0, "Kuchyně"), el("c", "ceiling-light", 3000, 0, "Kuchyně")],
    };
    const room = applyAppearance(draft, { room: "Kuchyně" });
    expect(room.elements.find((row) => row.id === "b")).toMatchObject({ series: "Schneider|Asfora", color: "black" });
    expect(room.elements.find((row) => row.id === "a")).toMatchObject({ series: null, color: null });
    expect(room.elements.find((row) => row.id === "c")?.series).toBeNull(); // svítidlo nemá domovní přístroj
    const all = applyAppearance({ ...draft, color: "white" });
    expect(all.elements.filter((row) => row.color === "white")).toHaveLength(2);
    expect(wiringInventory(draft)).toEqual([
      { label: "Jednozásuvka", appearance: "Schneider Electric Asfora · Černá matná / Antracit", seriesKey: "Schneider|Asfora", color: "black", count: 1 },
      { label: "Vypínač č. 1 (jednopólový)", appearance: "Schneider Electric Asfora · Černá matná / Antracit", seriesKey: "Schneider|Asfora", color: "black", count: 1 },
    ]);
    // barva přežije uložení / načtení, neplatná barva se zahodí
    expect(parseDraft(JSON.parse(JSON.stringify({ ...draft, color: "neon" })))?.color).toBe("white");
    expect(parseDraft(JSON.parse(JSON.stringify(room)))?.elements.find((row) => row.id === "b")?.color).toBe("black");
  });
});

describe("💡 paleta světel a vypínačů + kabeláž", () => {
  it("paleta obsahuje všech 13 běžných ovladačů", () => {
    // Fáze 57: ovladače mají vlastní skupinu „Ovládání“ a klasické vypínače platí pro klasiku i retrofit
    const symbols = PALETTE.filter((item) => item.group === "controls" && item.kind === "switch" && (!item.levels || item.levels.includes("classic"))).map((item) => item.symbol);
    // Fáze 52: + přesná katalogová řazení ABB (1So, 1S, 1SSo, 1+1, 6+6/0, 7So, 1/0So)
    expect(symbols).toEqual(["S1", "S5", "S6", "S6+6", "S7", "T1", "T2", "ZAL", "STM", "PIR", "S1S", "S44", "1So", "1S", "1SSo", "1+1", "6+6/0", "7So", "1/0So", "TER"]);
  });

  it("S6+6 = korespondence pro obě větve, ZAL = CYKY-J 5×1,5 k pohonu, TER = kabel k topnému zdroji", () => {
    const draft: FloorplanDraft = {
      ...emptyDraft(),
      elements: [
        el("rh", "panel", 500, 500, "Chodba"),
        el("l1", "ceiling-light", 4000, 3000),
        el("l2", "ceiling-light", 6000, 3000),
        el("s1", "switch-6-6", 2000, 2000, "Obývák", { controls: ["l1", "l2"] }),
        el("s2", "switch-6-6", 7000, 2000, "Obývák", { controls: ["l1", "l2"] }),
        el("z1", "blind", 3000, 500),
        el("t1", "thermostat", 5000, 500),
        el("tc", "heat-pump", 9000, 500, "Technická místnost"),
      ],
    };
    const build = buildPlan(draft);
    expect(build.switchLinks.every((link) => link.cable === DOUBLE_TWO_WAY_CABLE)).toBe(true);
    expect(build.controlRuns).toEqual([
      { id: "z1", kind: "blind", targetId: null },
      { id: "t1", kind: "thermostat", targetId: "tc" },
    ]);
    // termostat má výchozí výšku 1,5 m
    expect(build.routeNodes.find((node) => node.id === "t1")?.heightMm).toBe(1500);
    const { summary } = analyzeDraft(draft);
    const cables = summary.byCable.map((row) => row.cable);
    expect(cables).toEqual(expect.arrayContaining([DOUBLE_TWO_WAY_CABLE, BLIND_CABLE, THERMOSTAT_CABLE]));
    // Fáze 105: dvojitý střídavý 6+6 – korespondence CYKY-O 5×1,5 mezi přepínači a od druhého ke světlům CYKY-J 5×1,5
    const lighting = summary.circuits.find((circuit) => circuit.lightingParts?.length);
    expect(lighting?.lightingParts?.map((part) => `${part.role}:${part.cable}`)).toEqual(expect.arrayContaining([`traveller:${DOUBLE_TWO_WAY_CABLE}`, "switch-leg:CYKY-J 5×1,5"]));
    // žaluzie: (strop 2600 − vypínač 1050 + 1000 do nadpraží) × 1,1 + 2 krabice = 3,1 m → 4 m k nákupu (bez světel, ať se
    // stejný kabel CYKY-J 5×1,5 svodu ke světlům nepřičte)
    const blindOnly = analyzeDraft({ ...draft, elements: draft.elements.filter((element) => !["l1", "l2", "s1", "s2"].includes(element.id)) }).summary;
    expect(blindOnly.byCable.find((row) => row.cable === BLIND_CABLE)?.meters).toBe(4);
  });
});

describe("🏠 místnosti: posun, rozměr, úprava a smazání", () => {
  const draft = (): FloorplanDraft => ({
    ...emptyDraft(),
    rooms: [{ id: "m1", name: "Kuchyně", x: 1000, y: 1000, w: 4000, h: 3000 }],
    elements: [el("a", "socket", 2000, 2000, "Kuchyně"), el("b", "socket", 8000, 8000, "Ložnice")],
  });

  it("posun místnosti posune i prvky uvnitř", () => {
    const moved = moveRoom(draft(), "m1", 500, -200);
    expect(moved.rooms[0]).toMatchObject({ x: 1500, y: 800 });
    expect(moved.elements[0]).toMatchObject({ x: 2500, y: 1800 });
    expect(moved.elements[1]).toMatchObject({ x: 8000, y: 8000 });
  });

  it("změna rozměru za roh / stěny: min. 0,5 m, stěna se nepřeklopí", () => {
    const rect = { x: 1000, y: 1000, w: 4000, h: 3000 };
    expect(resizeRect(rect, "se", { x: 6500, y: 5000 })).toEqual({ x: 1000, y: 1000, w: 5500, h: 4000 });
    expect(resizeRect(rect, "e", { x: 0, y: 0 })).toEqual({ x: 1000, y: 1000, w: 500, h: 3000 });
    expect(resizeRect(rect, "w", { x: 500, y: 0 })).toEqual({ x: 500, y: 1000, w: 4500, h: 3000 });
    expect(resizeRect(rect, "n", { x: 0, y: 9000 })).toEqual({ x: 1000, y: 3500, w: 4000, h: 500 });
  });

  it("přejmenování se propíše do prvků, smazání místnosti prvky zachová", () => {
    const renamed = updateRoom(draft(), "m1", { name: "Ložnice 2", w: 200 });
    expect(renamed.rooms[0]).toMatchObject({ name: "Ložnice 2", w: 500 });
    expect(renamed.elements[0].room).toBe("Ložnice 2");
    const removed = deleteRoom(draft(), "m1");
    expect(removed.rooms).toHaveLength(0);
    expect(removed.elements).toHaveLength(2);
    expect(removed.elements[0].room).toBe("Místnost");
  });

  it("živé kóty: X, Y a plocha", () => {
    expect(roomDimensions(4500, 3000)).toEqual({ x: "4,5 m", y: "3 m", label: "4,5 × 3 m (13,5 m²)" });
  });
});
