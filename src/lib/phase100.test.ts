import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import { BACKGROUND_LOOKS, DARK_CAD_BACKDROP, DARK_CAD_FILTER, DEFAULT_BACKGROUND_LOOK, applyGray, backgroundFilterId, backgroundLookOf, backgroundStyle, drawsOnPaper, filterSteps, isBackgroundLook } from "./panel-builder/background-look";
import { CONTROLS_LABEL, PALETTE_GROUPS, emptyDraft, parseDraft } from "./panel-builder/floorplan-editor";
import { PHASE_TAB, RIGHT_TABS, TAB_OF_SECTION, defaultRightTab, isRightTab, tabSectionVisible, type PanelSectionId } from "./panel-builder/floorplan-phases";
import { frameThrottle } from "./panel-builder/frame-throttle";
import { lookOf } from "./panel-builder/series-look";
import { renderDeviceSvg } from "./panel-builder/series-render";

// Fáze 100: vizuální, UX a výkonnostní audit 2D půdorysu – podklad 🌗, paleta, 4 záložky pravého panelu, 60 FPS.
describe("🌗 podklad – krytí, potlačení kontrastu a tmavý CAD", () => {
  it("výchozí vzhled 60 % (i u starších půdorysů bez údaje), čtyři volby lišty", () => {
    expect(DEFAULT_BACKGROUND_LOOK).toBe("dim60");
    expect(backgroundLookOf(null)).toBe("dim60");
    expect(backgroundLookOf({})).toBe("dim60");
    expect(backgroundLookOf({ look: "nesmysl" })).toBe("dim60");
    expect(backgroundLookOf({ look: "dark" })).toBe("dark");
    expect(BACKGROUND_LOOKS.map((look) => look.label)).toEqual(["100 %", "60 %", "35 %", "🌑 Tmavý CAD"]);
    expect(BACKGROUND_LOOKS.find((look) => look.id === "dim60")?.title).toContain("(Doporučeno)");
    expect(BACKGROUND_LOOKS.find((look) => look.id === "dark")?.title).toContain("Invertovat do tmavého CADu");
    expect(["full", "dim60", "dim35", "dark"].every(isBackgroundLook)).toBe(true);
    expect(isBackgroundLook("60")).toBe(false);
  });

  it("krytí, filtr a kresba nad podkladem (papír tmavě, tmavý CAD světle)", () => {
    expect(backgroundStyle("full")).toEqual({ opacity: 1, filter: null, backdrop: "#ffffff", paper: true });
    expect(backgroundStyle("dim60")).toMatchObject({ opacity: 0.6, filter: "contrast(0.85)", paper: true });
    expect(backgroundStyle("dim35")).toMatchObject({ opacity: 0.35, filter: "contrast(0.85)", paper: true });
    expect(backgroundStyle("dark")).toEqual({ opacity: 1, filter: "invert(0.92) hue-rotate(180deg) contrast(0.85)", backdrop: DARK_CAD_BACKDROP, paper: false });
    expect([backgroundFilterId("full"), backgroundFilterId("dim60"), backgroundFilterId("dim35"), backgroundFilterId("dark")]).toEqual([null, "fp-bg-dim", "fp-bg-dim", "fp-bg-dark"]);
    expect(drawsOnPaper(null)).toBe(false);
    expect(drawsOnPaper({ look: "dim35" })).toBe(true);
    expect(drawsOnPaper({ look: "dark" })).toBe(false);
  });

  it("SVG filtr = CSS filtr tmavého CADu (bílá → tmavě šedá plocha #242424, černá čára → světlá)", () => {
    const steps = filterSteps(DARK_CAD_FILTER);
    expect(steps).toEqual([
      { kind: "table", values: [0.92, 0.08] },
      { kind: "hueRotate", values: [180] },
      { kind: "linear", values: [0.85, 0.075] },
    ]);
    const white = applyGray(steps, 1);
    const black = applyGray(steps, 0);
    expect(white).toBeCloseTo(0.143, 3);
    expect(Math.round(white * 255).toString(16)).toBe(DARK_CAD_BACKDROP.slice(1, 3));
    expect(black).toBeGreaterThan(0.85);
    // 60 %: čáry stavaře zesvětlí (kontrast 0,85 a krytí nad bílou)
    const dim = applyGray(filterSteps("contrast(0.85)"), 0) * 0.6 + 0.4;
    expect(dim).toBeCloseTo(0.445, 3);
  });

  it("vzhled se uloží s podkladem podlaží, neplatný se zahodí", () => {
    const background = { url: "/api/files/photos/podklad.png", widthPx: 3200, heightPx: 2262, rotation: 0, crop: null, pagePt: null };
    expect(parseDraft({ ...emptyDraft(), background: { ...background, look: "dark" } })?.background?.look).toBe("dark");
    expect(parseDraft({ ...emptyDraft(), background: { ...background, look: "neon" } })?.background).not.toHaveProperty("look");
    expect(backgroundLookOf(parseDraft({ ...emptyDraft(), background })?.background)).toBe("dim60");
  });
});

describe("⏱️ 60 FPS – pohyb myši nejvýš jednou za snímek", () => {
  function scheduler() {
    const queue = new Map<number, () => void>();
    let next = 1;
    return {
      schedule: (callback: () => void) => {
        queue.set(next, callback);
        return next++;
      },
      cancel: (handle: number) => void queue.delete(handle),
      frame: () => {
        const callbacks = [...queue.values()];
        queue.clear();
        for (const callback of callbacks) callback();
      },
      size: () => queue.size,
    };
  }

  it("dávka událostí v jednom snímku = jedno zpracování s poslední polohou", () => {
    const clock = scheduler();
    const seen: number[] = [];
    const throttle = frameThrottle<number>((value) => seen.push(value), clock.schedule, clock.cancel);
    for (let x = 1; x <= 40; x++) throttle.push(x);
    expect(clock.size()).toBe(1);
    expect(throttle.pending()).toBe(true);
    clock.frame();
    expect(seen).toEqual([40]);
    expect(throttle.pending()).toBe(false);
    throttle.push(41);
    throttle.push(42);
    clock.frame();
    expect(seen).toEqual([40, 42]);
  });

  it("puštění tlačítka zpracuje čekající polohu hned, odchod z plátna ji zahodí", () => {
    const clock = scheduler();
    const seen: string[] = [];
    const throttle = frameThrottle<string>((value) => seen.push(value), clock.schedule, clock.cancel);
    throttle.push("a");
    throttle.push("b");
    expect(throttle.flush()).toBe(true);
    expect(seen).toEqual(["b"]);
    expect(clock.size()).toBe(0);
    expect(throttle.flush()).toBe(false);
    throttle.push("c");
    throttle.cancel();
    clock.frame();
    expect(seen).toEqual(["b"]);
  });
});

describe("🗂️ pravý panel ve 4 záložkách", () => {
  it("záložky, výchozí záložka podle fáze a záložka každé karty", () => {
    expect(RIGHT_TABS.map((tab) => `${tab.icon} ${tab.label}`)).toEqual(["🎯 Detail", "🔌 Okruhy & Trasy", "🛡️ Normy (Linter)", "⚡ Kusovník & Rozváděč"]);
    expect(PHASE_TAB).toEqual({ 1: "detail", 2: "detail", 3: "circuits", 4: "detail", 5: "bom" });
    expect(defaultRightTab(null)).toBe("detail");
    expect(isRightTab("bom")).toBe(true);
    expect(isRightTab("panely")).toBe(false);
    expect(Object.keys(TAB_OF_SECTION)).toHaveLength(16);
  });

  it("karty záložky ve všech fázích, pomocné karty jen ve své fázi", () => {
    const shown = (phase: 1 | 2 | 3 | 4 | 5 | null, tab: Parameters<typeof tabSectionVisible>[1]) => (Object.keys(TAB_OF_SECTION) as PanelSectionId[]).filter((section) => tabSectionVisible(phase, tab, section));
    expect(shown(1, "detail")).toEqual(["rooms", "detail", "cad"]);
    expect(shown(2, "detail")).toEqual(["site", "detail"]);
    expect(shown(4, "detail")).toEqual(["design", "detail", "smart"]);
    expect(shown(3, "circuits")).toEqual(["circuits", "socket-circuits", "cables", "edited"]);
    expect(shown(1, "norms")).toEqual(["checks"]);
    expect(shown(5, "bom")).toEqual(["generate", "generate-form", "bom", "inventory"]);
    expect(shown(3, "bom")).toEqual(["generate-form", "bom", "inventory"]);
    expect(shown(null, "detail")).toEqual(["detail", "smart", "cad"]);
    // Výřez varování zón nahradila celá kontrola v záložce Normy
    for (const phase of [1, 2, 3, 4, 5, null] as const) expect(tabSectionVisible(phase, "norms", "zone-checks")).toBe(false);
  });
});

describe("🧩 levá paleta – krátké názvy kategorií", () => {
  it("názvy podle auditu (vypínače a sběrnicové ovládání podle úrovně instalace)", () => {
    const label = (id: string) => {
      const group = PALETTE_GROUPS.find((candidate) => candidate.id === id)!;
      return `${group.icon} ${group.label}`;
    };
    expect(["panel", "sockets", "lights", "shading", "appliances", "fixtures", "architecture"].map(label)).toEqual(["⚡ Rozváděče", "🔌 Zásuvky", "💡 Světla", "🪟 Stínění, čidla a topení", "🔥 Samostatné spotřebiče", "🛁 Koupelna (zóny ČSN)", "🛋️ Okna, dveře a nábytek"]);
    expect(`${CONTROLS_LABEL.classic.icon} ${CONTROLS_LABEL.classic.label}`).toBe("🔘 Vypínače 230 V");
    expect(`${CONTROLS_LABEL.bus_loxone.icon} ${CONTROLS_LABEL.bus_loxone.label}`).toBe("🎛️ Sběrnicové ovládání");
    // Krátké názvy (paleta 15rem) – nejdelší kategorie z auditu má 23 znaků
    for (const group of PALETTE_GROUPS.filter((candidate) => candidate.id !== "medical")) expect(group.label.length).toBeLessThanOrEqual(23);
  });
});

describe("🎨 vzhled a rychlost načítání", () => {
  it("katalogové fotky: rok v mezipaměti prohlížeče, komprese zapnutá", async () => {
    expect(nextConfig.compress).toBe(true);
    const rules = await nextConfig.headers!();
    expect(rules).toContainEqual({ source: "/catalog-images/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] });
  });

  it("render řady bez vlastního studia (galerie kreslí studio slate a stín pod přístrojem)", () => {
    const input = { seriesKey: "ABB|Levit", shape: "square" as const, look: lookOf({ swatch: "#ffffff", material: "matte" }, "square"), items: ["switch" as const] };
    expect(renderDeviceSvg(input)).toContain('fill="url(#bg)"');
    expect(renderDeviceSvg({ ...input, studio: false })).not.toContain('fill="url(#bg)"');
  });

  it("globální CSS: tenké tmavé posuvníky", () => {
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/scrollbar-width: thin;\s*scrollbar-color: #3f3f46 transparent;/);
    expect(css).toMatch(/::-webkit-scrollbar \{\s*width: 6px;\s*height: 6px;/);
  });
});
