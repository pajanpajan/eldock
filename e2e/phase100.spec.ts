import sharp from "sharp";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { goPhase, rightTab } from "./floorplan-phases";

// Fáze 100: vizuální, UX a výkonnostní audit 2D půdorysu – 🌗 podklad nad bílým výkresem (60 % výchozí, tmavý CAD),
// podkladové štítky popisků, paleta bez ořezaných názvů s dlaždicemi CAD značek, pravý panel ve 4 záložkách, memoizované
// vrstvy plátna (pohyb myši ani tažení nepřekreslují celý výkres), karty výrobců, studio galerie řad a mezipaměť fotek.
test.describe.configure({ mode: "serial" });

/** Bílý stavební výkres stavaře (SVG 1600 × 1000 px): černé stěny, kóta a šrafa – vpravo dole prázdná plocha. */
function whitePlan(): Buffer {
  const hatch = Array.from({ length: 18 }, (_, index) => `<path d="M${100 + index * 40} 80 L${140 + index * 40} 120"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#ffffff"/><g fill="none" stroke="#000" stroke-width="10"><path d="M80 80 H900 V500 H80 Z M500 80 V500"/></g><g stroke="#000" stroke-width="2">${hatch}<path d="M80 540 H900 M80 530 V550 M900 530 V550"/></g><text x="300" y="300" font-family="Arial" font-size="28">OBYVACI POKOJ</text></svg>`;
  return Buffer.from(svg, "utf8");
}

async function openNew(page: Page) {
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.addInitScript(() => {
    window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard");
    (window as unknown as { __eldockLayerRenders: Record<string, number> }).__eldockLayerRenders = {};
  });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

/** Bod plánu [mm] → souřadnice obrazovky. */
async function screen(canvas: Locator, x: number, y: number) {
  await canvas.evaluate((svg) => svg.scrollIntoView({ block: "center", behavior: "instant" }));
  return canvas.evaluate((svg, point) => {
    const at = new DOMPoint(point.x, point.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
    return { x: at.x, y: at.y };
  }, { x, y });
}

async function place(page: Page, label: string, points: [number, number][]) {
  const canvas = page.getByTestId("floorplan-canvas");
  await page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" }).getByRole("button", { name: label, exact: false }).first().click();
  for (const [x, y] of points) {
    const at = await screen(canvas, x, y);
    await page.mouse.click(at.x, at.y);
  }
  await page.getByTestId("mode-done").click();
}

async function room(page: Page) {
  const form = page.getByTestId("room-by-size");
  await form.getByTestId("room-size-name").fill("Obývací pokoj");
  await form.getByTestId("room-size-x").fill("5");
  await form.getByTestId("room-size-y").fill("4");
  await form.getByTestId("room-size-create").click();
}

/** Jas plátna (0–255, medián několika bodů plánu) ze snímku obrazovky. */
async function brightness(page: Page, points: [number, number][]) {
  const canvas = page.getByTestId("floorplan-canvas");
  const box = (await canvas.boundingBox())!;
  const image = sharp(await canvas.screenshot());
  const values: number[] = [];
  for (const [x, y] of points) {
    const at = await canvas.evaluate((svg, point) => {
      const p = new DOMPoint(point.x, point.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
      return { x: p.x, y: p.y };
    }, { x, y });
    const pixel = await image.clone().extract({ left: Math.round(at.x - box.x), top: Math.round(at.y - box.y), width: 1, height: 1 }).raw().toBuffer();
    values.push((pixel[0] + pixel[1] + pixel[2]) / 3);
  }
  return values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

const renders = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __eldockLayerRenders: Record<string, number> }).__eldockLayerRenders }));

test("🌗 Podklad nad bílým výkresem: 60 % po nahrání, 100 % / 35 %, tmavý CAD a podkladové štítky popisků", async ({ page }) => {
  test.setTimeout(360_000);
  await openNew(page);
  const canvas = page.getByTestId("floorplan-canvas");
  await page.getByLabel("Podklad půdorysu").setInputFiles({ name: "pudorys-stavare.svg", mimeType: "image/svg+xml", buffer: whitePlan() });
  const background = page.getByTestId("floorplan-background");
  await expect(background).toHaveAttribute("href", /\/api\/files\/photos\//, { timeout: 60_000 });
  const look = page.getByTestId("background-look");
  await expect(look).toBeVisible();
  await expect(look).toContainText("🌗 Podklad:");
  await expect(page.getByTestId("background-look-dim60")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("background-look-dim60")).toContainText("60 % (Doporučeno)");
  // Výchozí 60 % s jemně potlačeným kontrastem nad bílou plochou
  await expect(background).toHaveAttribute("opacity", "0.6");
  await expect(background).toHaveAttribute("filter", "url(#fp-bg-dim)");
  await expect(background).toHaveAttribute("data-filter", "contrast(0.85)");
  await expect(page.getByTestId("plan-sheet")).toHaveAttribute("fill", "#ffffff");
  await expect(canvas.locator("#fp-bg-dark feComponentTransfer").first().locator("feFuncR")).toHaveAttribute("tableValues", "0.92 0.08");
  // Prázdné místo výkresu (vpravo dole, mimo kresbu stavaře)
  const empty: [number, number][] = [[12_500, 7_200], [13_000, 7_600], [12_000, 7_900], [13_400, 6_900], [11_600, 7_400]];
  expect(await brightness(page, empty)).toBeGreaterThan(200);

  // 100 % = originál, 35 % = jemná orientace
  await page.getByTestId("background-look-full").click();
  await expect(background).toHaveAttribute("opacity", "1");
  await expect(background).not.toHaveAttribute("filter", /.+/);
  await page.getByTestId("background-look-dim35").click();
  await expect(background).toHaveAttribute("opacity", "0.35");
  await expect(look).toHaveAttribute("data-look", "dim35");

  // Invertovat do tmavého CADu: CSS filtr invert(0.92) hue-rotate(180deg) contrast(0.85) → tmavě šedý výkres, světlá kresba
  await page.getByTestId("background-look-dark").click();
  await expect(background).toHaveAttribute("data-filter", "invert(0.92) hue-rotate(180deg) contrast(0.85)");
  await expect(background).toHaveAttribute("filter", "url(#fp-bg-dark)");
  await expect(page.getByTestId("plan-sheet")).toHaveAttribute("fill", "#242424");
  await expect.poll(() => brightness(page, empty), { timeout: 15_000 }).toBeLessThan(70);
  await page.getByTestId("floorplan-canvas-frame").screenshot({ path: "test-results/phase100-dark-cad.png" });

  // Místnost, rozváděč a zásuvky nad tmavým CADem – popisky tras se světlým písmem na tmavém štítku
  await room(page);
  await expect(canvas.getByTestId("room-label").first()).toHaveAttribute("fill", "#d4d4d8");
  await goPhase(page, 2);
  await place(page, "Hlavní domovní / bytový rozváděč", [[600, 3500]]);
  await goPhase(page, 3);
  await place(page, "Jednozásuvka", [[4200, 1150], [4200, 2600]]);
  await goPhase(page, 5);
  await expect(canvas.getByTestId("route-length").first()).toBeAttached({ timeout: 30_000 });
  const lengthStyle = await canvas.getByTestId("route-length").first().evaluate((node) => ({ paint: getComputedStyle(node).paintOrder, stroke: getComputedStyle(node).stroke }));
  expect(lengthStyle.paint).toContain("stroke");
  expect(lengthStyle.stroke).toBe("rgba(15, 23, 42, 0.88)");
  await page.getByTestId("cable-view-cad").click();
  const tag = canvas.getByTestId("cable-tag").first();
  await expect(tag).toHaveAttribute("data-plate", "true");
  await expect(tag).toContainText(/Okr\. -F\d+ · CYKY-J/);
  const tagStyle = await tag.evaluate((node) => ({ paint: getComputedStyle(node).paintOrder, stroke: getComputedStyle(node).stroke, join: getComputedStyle(node).strokeLinejoin, fill: getComputedStyle(node).fill }));
  expect(tagStyle).toMatchObject({ stroke: "rgba(15, 23, 42, 0.88)", join: "round", fill: "rgb(248, 250, 252)" });
  expect(tagStyle.paint).toContain("stroke");
  // Zpět na doporučených 60 % – značky a popisky místností zase tmavě „na papíře“
  await page.getByTestId("background-look-dim60").click();
  await expect(canvas.getByTestId("room-label").first()).toHaveAttribute("fill", "#52525b");
  await page.getByTestId("floorplan-canvas-frame").screenshot({ path: "test-results/phase100-dim60.png" });
});

test("🧩 Levá paleta: krátké názvy kategorií bez ořezu a 2sloupcová mřížka dlaždic s CAD značkou", async ({ page }) => {
  test.setTimeout(240_000);
  await openNew(page);
  const left = page.getByTestId("floorplan-left");
  const labels = async () =>
    left.locator('[data-testid^="palette-label-"]').evaluateAll((nodes) =>
      nodes.map((node) => ({ text: node.textContent?.trim() ?? "", clipped: node.scrollWidth > node.clientWidth + 1 || getComputedStyle(node).textOverflow === "ellipsis" })),
    );
  const seen: string[] = [];
  for (const phase of [2, 3, 4] as const) {
    await goPhase(page, phase);
    for (const label of await labels()) {
      expect(label.clipped, `${label.text} se nesmí ořezat`).toBe(false);
      seen.push(label.text);
    }
  }
  expect(seen).toEqual(expect.arrayContaining(["Rozváděče", "Koupelna (zóny ČSN)", "Okna, dveře a nábytek", "Zásuvky", "Samostatné spotřebiče", "Světla", "Vypínače 230 V", "Stínění, čidla a topení"]));

  // Okna, dveře a nábytek (fáze 2), zásuvky (fáze 3) a světla (fáze 4) jako mřížka 2 sloupců dlaždic
  for (const [phase, group] of [[2, "architecture"], [3, "sockets"], [4, "lights"]] as const) {
    await goPhase(page, phase);
    const grid = left.getByTestId(`palette-grid-${group}`);
    await expect(grid).toBeVisible();
    expect(await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(2);
    const tiles = grid.getByTestId("palette-tile");
    expect(await tiles.count()).toBeGreaterThan(2);
    // Každá dlaždice: vektorová značka (výřez podle kresby), název a rozměr / zkratka
    const glyphs = await grid.getByTestId("palette-glyph").evaluateAll((nodes) => nodes.map((node) => ({ shapes: node.querySelectorAll("path, circle, rect, ellipse").length, box: node.getAttribute("viewBox") ?? "" })));
    expect(glyphs.length).toBe(await tiles.count());
    for (const glyph of glyphs) {
      expect(glyph.shapes).toBeGreaterThan(0);
      expect(glyph.box.split(" ").map(Number).every(Number.isFinite)).toBe(true);
    }
  }
  await goPhase(page, 2);
  const bed = left.locator('[data-entry="arch-bed-double"] [data-testid="palette-tile"]');
  await expect(bed).toContainText("m");
  await left.getByTestId("palette-grid-architecture").screenshot({ path: "test-results/phase100-palette-architecture.png" });
  await goPhase(page, 3);
  await expect(left.locator('[data-entry="socket"] [data-testid="palette-tile"]')).toContainText("Jednozásuvka");
  await left.getByTestId("palette-grid-sockets").screenshot({ path: "test-results/phase100-palette-sockets.png" });
});

test("🗂️ Pravý panel ve 4 záložkách: podle fáze, ručně, klik na plátno = Detail; tenké posuvníky", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  const tabs = page.getByTestId("right-tabs");
  await expect(tabs.getByRole("tab")).toHaveText([/🎯\s*Detail/, /🔌\s*Okruhy & Trasy/, /🛡️\s*Normy \(Linter\)/, /⚡\s*Kusovník & Rozváděč/]);
  const active = (tab: string) => expect(page.getByTestId(`right-tab-${tab}`)).toHaveAttribute("aria-selected", "true");
  await goPhase(page, 1);
  await active("detail");
  await expect(page.getByTestId("rooms-overview")).toBeVisible();
  await room(page);
  await goPhase(page, 2);
  await active("detail");
  await place(page, "Hlavní domovní / bytový rozváděč", [[600, 3500]]);
  await goPhase(page, 3);
  await active("circuits");
  await place(page, "Jednozásuvka", [[4200, 1150], [4200, 2600]]);
  // Vložený prvek je vybraný – vlastnosti sledují výběr (🎯 Detail), zásuvkové okruhy v záložce Okruhy & Trasy
  await active("detail");
  await rightTab(page, "circuits");
  await expect(page.getByTestId("socket-circuits")).toBeVisible();
  await expect(page.getByTestId("right-tab-badge-circuits")).toHaveText(/\d+/);
  // Klik na zásuvku na plátně otevře 🎯 Detail
  await page.getByTestId("floorplan-canvas").locator('[data-element="socket"]').first().click();
  await active("detail");
  await expect(page.getByTestId("right-detail")).toContainText("Jednozásuvka");
  await expect(page.getByTestId("right-tab-badge-detail")).toHaveText("1");
  await page.keyboard.press("Escape");
  await goPhase(page, 4);
  await active("detail");
  await expect(page.getByTestId("design-card")).toBeVisible();
  await goPhase(page, 5);
  await active("bom");
  await expect(page.getByTestId("wizard-generate")).toBeVisible();
  await expect(page.getByTestId("generate-panel")).toBeVisible();
  await expect(page.getByTestId("wiring-bom")).toBeVisible();
  await expect(page.getByTestId("circuit-list")).toHaveCount(0);
  // Ruční přepnutí – Normy s odznakem nálezů (červeně) nebo zeleně ✓, výkaz kabeláže v Okruhy & Trasy
  await rightTab(page, "norms");
  const badge = page.getByTestId("right-tab-badge-norms");
  await expect(badge).toHaveAttribute("data-tone", /danger|ok/);
  if ((await badge.getAttribute("data-tone")) === "ok") await expect(page.getByTestId("plan-checks-ok")).toBeVisible();
  else await expect(page.getByTestId("plan-checks")).toBeVisible();
  await expect(page.getByTestId("live-checklist")).toBeVisible();
  await rightTab(page, "circuits");
  await expect(page.getByTestId("circuit-list")).toBeVisible();
  await expect(page.getByTestId("cable-panel")).toBeVisible();
  await expect(page.getByTestId("wiring-bom")).toHaveCount(0);
  await page.getByTestId("floorplan-right").screenshot({ path: "test-results/phase100-tabs-circuits.png" });
  // Klávesnice: šipka doprava = další záložka
  await page.getByTestId("right-tab-circuits").focus();
  await page.keyboard.press("ArrowRight");
  await active("norms");
  // Přepnutí fáze vrátí výchozí záložku fáze
  await goPhase(page, 4);
  await goPhase(page, 5);
  await active("bom");

  // Tenké tmavé posuvníky (globals.css): 6 px ve WebKitu / Chromiu
  const scrollbar = await page.evaluate(() => {
    for (const sheet of [...document.styleSheets]) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      const stack = [...rules];
      while (stack.length) {
        const rule = stack.shift()!;
        if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) stack.push(...(rule as CSSGroupingRule).cssRules);
        if (rule instanceof CSSStyleRule && rule.selectorText === "::-webkit-scrollbar") return rule.style.width;
      }
    }
    return null;
  });
  expect(scrollbar).toBe("6px");
});

test("⏱️ 60 FPS: pohyb myši ani tažení prvku nepřekreslují podklad, místnosti ani ostatní prvky", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  const canvas = page.getByTestId("floorplan-canvas");
  await room(page);
  await goPhase(page, 2);
  await place(page, "Hlavní domovní / bytový rozváděč", [[600, 3500]]);
  await goPhase(page, 3);
  const points: [number, number][] = [[1000, 600], [2000, 600], [3000, 600], [4200, 1150], [4200, 2600], [2500, 3600]];
  await place(page, "Jednozásuvka", points);
  await goPhase(page, 4);
  await place(page, "Stropní svítidlo", [[2000, 2000], [3200, 2000], [4000, 3200]]);
  await goPhase(page, 5);
  await expect(canvas.locator('[data-element="socket"]')).toHaveCount(points.length);
  await expect(canvas.getByTestId("cable-route").first()).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(1500);

  // Náhled vkládané značky sleduje myš – vrstvy podkladu, místností a prvků se nepřekreslí (stropní svítidlo se
  // nepřichytává ke stěně – náhled je přesně u kurzoru)
  await goPhase(page, 4);
  await page.waitForTimeout(800);
  await page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" }).getByRole("button", { name: "Stropní svítidlo", exact: false }).first().click();
  const start = await screen(canvas, 1500, 1500);
  await page.mouse.move(start.x, start.y);
  await page.waitForTimeout(500);
  const before = await renders(page);
  for (let step = 1; step <= 30; step++) await page.mouse.move(start.x + step * 6, start.y + step * 4);
  const end = await screen(canvas, 1500, 1500);
  await expect(canvas.getByTestId("place-ghost")).toBeAttached();
  // Náhled je v poslední poloze myši (z dávky událostí v jednom snímku platí poslední)
  const ghost = await canvas.getByTestId("place-ghost").evaluate((node) => {
    const box = (node as SVGGraphicsElement).getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  expect(Math.hypot(ghost.x - (end.x + 180), ghost.y - (end.y + 120))).toBeLessThan(60);
  const hover = await renders(page);
  expect(hover.backdrop ?? 0).toBe(before.backdrop ?? 0);
  expect(hover.rooms ?? 0).toBe(before.rooms ?? 0);
  expect(hover.element ?? 0).toBe(before.element ?? 0);
  await page.getByTestId("mode-done").click();

  // Tažení jednoho svítidla: překreslí se jen tažený prvek (ne všech 10), podklad a místnosti vůbec
  await goPhase(page, 5);
  await page.waitForTimeout(800);
  const socket = canvas.locator('[data-element="ceiling-light"]').nth(1);
  const box = (await socket.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const dragStart = await renders(page);
  const steps = 20;
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 70, { steps });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const dragEnd = await renders(page);
  const elements = await canvas.locator("[data-element]").count();
  expect((dragEnd.element ?? 0) - (dragStart.element ?? 0)).toBeLessThan((elements * steps) / 2);
  expect(dragEnd.rooms ?? 0).toBe(dragStart.rooms ?? 0);
  expect(dragEnd.backdrop ?? 0).toBe(dragStart.backdrop ?? 0);
  // Svítidlo skončilo tam, kde se myš pustila (čekající poloha se při puštění zpracuje hned)
  const moved = (await socket.boundingBox())!;
  expect(Math.hypot(moved.x - (box.x + 90), moved.y - (box.y + 70))).toBeLessThan(40);
});

test("🎨 Karty výrobců, studio galerie řad a katalogové fotky (lazy, async, rok v mezipaměti)", async ({ page }) => {
  test.setTimeout(240_000);
  await openNew(page);
  await goPhase(page, 4);
  const card = page.getByTestId("design-card");
  await expect(card.getByTestId("brand-card-ABB")).toHaveClass(/ring-amber-400/);
  await expect(card.getByTestId("brand-card-ABB")).toHaveClass(/rounded-lg/);
  await expect(card.getByTestId("brand-card-Schneider")).not.toHaveClass(/ring-amber-400/);
  await expect(card.getByTestId("smart-brand-Loxone")).toHaveClass(/rounded-lg/);
  // Logo leží přímo na kartě (bez ostrého bílého obdélníku)
  await expect(card.getByTestId("brand-card-ABB").locator("[data-logo]")).not.toHaveClass(/bg-white/);
  await card.getByTestId("series-gallery-open").click();
  const gallery = page.getByTestId("series-gallery");
  await expect(gallery).toBeVisible();
  const studio = gallery.getByTestId("gallery-studio");
  await expect(studio).toHaveCount(3);
  await expect(studio.first()).toHaveClass(/bg-gradient-to-b/);
  await expect(studio.first()).toHaveClass(/from-slate-100/);
  // Bílý přístroj (Zoni) na studiovém pozadí, ne na čistě bílé ploše
  await gallery.getByTestId("gallery-series-Zoni").click();
  const background = await studio.first().evaluate((node) => getComputedStyle(node).backgroundImage);
  expect(background).toContain("gradient");
  for (const image of await gallery.getByTestId("gallery-photo").all()) {
    await expect(image).toHaveAttribute("loading", "lazy");
    await expect(image).toHaveAttribute("decoding", "async");
  }
  await gallery.screenshot({ path: "test-results/phase100-gallery.png" });
  // Statické katalogové fotky: rok v mezipaměti prohlížeče
  const response = await page.request.get("/catalog-images/abb/busch-axcent/abb-axcent-81-frame.webp");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
});
