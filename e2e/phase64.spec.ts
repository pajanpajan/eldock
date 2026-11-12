import { expect, test, type Locator, type Page } from "@playwright/test";
import { goPhase, phaseForPalette } from "./floorplan-phases";

// Fáze 64: 2D půdorys uložený na serveru – nový půdorys vznikne při první změně, Zpět / Znovu (tažení = jeden krok),
// průběžné ukládání a reload, údaje půdorysu, historie verzí s obnovením, seznam s kopií a košem, souběh dvou oken
// a převzetí rozpracovaného nákresu z prohlížeče (do fáze 63 jediný slot `eldock.pb.floorplan`).
test.describe.configure({ mode: "serial" });

const SAVED_URL = /\/panel-builder\/floorplan\/(?!novy)[\w-]+$/;

async function openNew(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

/** Bod půdorysu v mm → souřadnice obrazovky (přes matici SVG plátna). */
async function screen(canvas: Locator, x: number, y: number) {
  return canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const at = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: at.x, y: at.y };
  }, { x, y });
}

function editor(page: Page) {
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  const status = page.getByTestId("floorplan-save-status");
  const clickAt = async (x: number, y: number) => {
    await canvas.evaluate((svg) => svg.scrollIntoView({ block: "center", behavior: "instant" }));
    const at = await screen(canvas, x, y);
    await page.mouse.click(at.x, at.y);
  };
  return {
    canvas,
    status,
    sockets: canvas.locator('[data-element="socket"]'),
    lights: canvas.locator('[data-element="ceiling-light"]'),
    /** Místnost tažením obdélníku. */
    room: async (x1: number, y1: number, x2: number, y2: number) => {
      await goPhase(page, 1);
      await page.getByRole("button", { name: "Kreslit místnost (obdélník)" }).click();
      await canvas.evaluate((svg) => svg.scrollIntoView({ block: "center", behavior: "instant" }));
      const from = await screen(canvas, x1, y1);
      const to = await screen(canvas, x2, y2);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await page.mouse.up();
      await page.keyboard.press("Escape");
    },
    /**
     * Značka z palety; Esc ukončí vkládání (bez náhledu u kurzoru), druhé Esc zruší výběr – plovoucí lišta vybraného
     * prvku (smazat, otočit …) by jinak u plochy 20 × 16 m (fáze 83) překryla místo dalšího kliknutí.
     */
    place: async (label: string, x: number, y: number) => {
      await phaseForPalette(page, label);
      await palette.getByRole("button", { name: label }).first().click();
      await clickAt(x, y);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
    },
    /** Po změně: stav „Neuložené změny“ → „☁️ Uloženo v cloudu (HH:MM:SS)“ (fáze 78). */
    waitSaved: async () => {
      await expect(status).not.toHaveAttribute("data-state", "saved");
      await expect(status).toHaveAttribute("data-state", "saved", { timeout: 30_000 });
      await expect(status).toContainText(/Uloženo v cloudu \(\d{1,2}:\d{2}:\d{2}\)/);
    },
  };
}

test("📐 Půdorys na serveru: vznik při první změně, Zpět / Znovu, reload, údaje, historie verzí s obnovením, seznam, kopie a koš", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await openNew(page);
  const fp = editor(page);
  await expect(fp.status).toContainText("Nový půdorys – uloží se po první změně");
  await expect(page.getByTestId("floorplan-versions")).toBeDisabled();
  await expect(page.getByTestId("floorplan-undo")).toBeDisabled();

  // První změna (místnost) → půdorys vznikne na serveru a adresa se přepne bez přenačtení editoru
  await fp.room(1000, 1000, 7000, 5000);
  await fp.waitSaved();
  await expect(page).toHaveURL(SAVED_URL);
  const url = page.url();
  await expect(page.getByTestId("floorplan-versions")).toBeEnabled();

  // Zpět (Ctrl+Z) odebere zásuvku, Znovu (tlačítko) ji vrátí
  await fp.place("Jednozásuvka", 3000, 3000);
  await expect(fp.sockets).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(fp.sockets).toHaveCount(0);
  await page.getByTestId("floorplan-redo").click();
  await expect(fp.sockets).toHaveCount(1);

  // Celé tažení = jeden krok: Ctrl+Z vrátí zásuvku na původní místo, Ctrl+Y tažení zopakuje
  const original = await fp.sockets.first().getAttribute("transform");
  // Stisk přímo na bodu značky („translate(x y)“ v mm) – střed obálky skupiny leží mimo kresbu značky
  const [ox, oy] = (original ?? "").replace(/translate\(|\)/g, "").trim().split(/\s+/).map(Number);
  // Klik na „Znovu“ posunul stránku k liště – plátno zpět do zobrazení
  await fp.canvas.scrollIntoViewIfNeeded();
  const start = await screen(fp.canvas, ox, oy);
  const target = await screen(fp.canvas, 5000, 3500);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
  const moved = await fp.sockets.first().getAttribute("transform");
  expect(moved).not.toBe(original);
  await page.keyboard.press("Control+z");
  await expect(fp.sockets.first()).toHaveAttribute("transform", original!);
  await page.keyboard.press("Control+y");
  await expect(fp.sockets.first()).toHaveAttribute("transform", moved!);
  await fp.waitSaved();

  // Reload: nákres ze serveru
  await page.reload();
  await expect(fp.canvas).toBeVisible({ timeout: 60_000 });
  await expect(fp.sockets).toHaveCount(1);
  await expect(fp.sockets.first()).toHaveAttribute("transform", moved!);
  await expect(fp.canvas.locator("[data-room]")).toHaveCount(1);
  await expect(fp.status).toContainText("Uloženo");

  // Údaje půdorysu; zákazník a místo se předvyplní ve formuláři rozváděče
  await page.getByRole("button", { name: "Upravit název a údaje půdorysu" }).click();
  const meta = page.getByTestId("floorplan-meta-dialog");
  await meta.getByLabel("Název půdorysu").fill("RD Novák – přízemí");
  await meta.getByLabel("Zákazník").fill("Jan Novák");
  await meta.getByLabel("Místo stavby").fill("Liberec");
  await meta.getByRole("button", { name: "Uložit údaje" }).click();
  await expect(page.getByTestId("floorplan-name")).toContainText("RD Novák – přízemí");
  // Fáze 98: formulář rozváděče je v kartě kabeláže fáze 5
  await goPhase(page, 5);
  await expect(page.locator("#fp-customer")).toHaveValue("Jan Novák");
  await expect(page.locator("#fp-site")).toHaveValue("Liberec");

  // Historie verzí: uložená verze s popisem, další zásuvka, obnovení uložené verze (jde vrátit – stav před obnovením je v historii)
  const versions = page.getByTestId("floorplan-versions-dialog");
  await page.getByTestId("floorplan-versions").click();
  await expect(versions.getByTestId("floorplan-version").first()).toBeVisible();
  await versions.getByLabel("Popis verze").fill("Před úpravou kuchyně");
  await versions.getByRole("button", { name: /Uložit aktuální stav jako verzi/ }).click();
  await expect(versions.getByTestId("floorplan-version").first()).toContainText("Před úpravou kuchyně");
  await page.keyboard.press("Escape");
  await expect(versions).toHaveCount(0);
  await fp.place("Jednozásuvka", 5000, 4500);
  await expect(fp.sockets).toHaveCount(2);
  await fp.waitSaved();
  await page.getByTestId("floorplan-versions").click();
  await versions.getByTestId("floorplan-version").filter({ hasText: "Před úpravou kuchyně" }).getByRole("button", { name: /Obnovit verzi/ }).click();
  await expect(versions).toHaveCount(0);
  await expect(fp.sockets).toHaveCount(1);
  await expect(fp.status).toHaveAttribute("data-state", "saved");
  await page.getByTestId("floorplan-versions").click();
  await expect(versions.getByTestId("floorplan-version").first()).toContainText("Před obnovením");
  await page.keyboard.press("Escape");

  // Seznam půdorysů: údaje a souhrn, kopie, koš s obnovením, otevření z karty
  await page.goto("/panel-builder/floorplan");
  const list = page.getByTestId("floorplan-list");
  const card = list.getByTestId("floorplan-card").filter({ hasText: /📐 RD Novák – přízemí/ });
  await expect(card).toContainText("Jan Novák");
  await expect(card).toContainText("📍 Liberec");
  await expect(card).toContainText("1 podlaží · 1 místnost · 1 prvek");
  await card.getByRole("button", { name: "Kopie půdorysu RD Novák – přízemí" }).click();
  const copy = list.getByTestId("floorplan-card").filter({ hasText: "Kopie – RD Novák – přízemí" });
  await expect(copy).toBeVisible();
  await copy.getByRole("button", { name: "Smazat půdorys Kopie – RD Novák – přízemí" }).click();
  await expect(copy).toHaveCount(0);
  await page.getByTestId("floorplan-trash-toggle").click();
  await page.getByTestId("floorplan-trash-row").filter({ hasText: "Kopie – RD Novák – přízemí" }).getByRole("button", { name: "Obnovit" }).click();
  await expect(copy).toBeVisible();
  await card.getByRole("link", { name: /RD Novák – přízemí/ }).click();
  await expect(page).toHaveURL(url);
  await expect(fp.sockets).toHaveCount(1, { timeout: 60_000 });
});

test("📐 Souběh dvou oken: „Načíst aktuální verzi“ a „Ponechat mou verzi“, odmítnuté i přepsané změny v historii", async ({ page, context }) => {
  test.setTimeout(360_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await openNew(page);
  const a = editor(page);
  await a.room(1000, 1000, 7000, 5000);
  await a.waitSaved();
  await expect(page).toHaveURL(SAVED_URL);

  const second = await context.newPage();
  second.on("dialog", (dialog) => void dialog.accept());
  await second.setViewportSize({ width: 1600, height: 1100 });
  await second.goto(page.url());
  const b = editor(second);
  await expect(b.canvas).toBeVisible({ timeout: 60_000 });
  await expect(b.status).toContainText("Uloženo");

  // Okno A uloží zásuvku; okno B (stále na starší verzi) přidá svítidlo → souběh
  await a.place("Jednozásuvka", 3000, 3000);
  await a.waitSaved();
  await b.place("Stropní svítidlo", 4000, 2500);
  const conflictB = second.getByTestId("floorplan-conflict");
  await expect(conflictB).toBeVisible({ timeout: 30_000 });
  await expect(b.status).toHaveAttribute("data-state", "conflict");
  await conflictB.getByRole("button", { name: "Načíst aktuální verzi" }).click();
  await expect(conflictB).toHaveCount(0);
  await expect(b.sockets).toHaveCount(1);
  await expect(b.lights).toHaveCount(0);
  await second.getByTestId("floorplan-versions").click();
  await expect(second.getByTestId("floorplan-versions-dialog").getByTestId("floorplan-version").first()).toContainText("Neuložené změny z jiného okna");
  await second.keyboard.press("Escape");

  // Okno B uloží další zásuvku; okno A (teď na starší verzi) přidá svítidlo a ponechá svou verzi
  await b.place("Jednozásuvka", 5000, 4500);
  await b.waitSaved();
  await a.place("Stropní svítidlo", 4000, 2500);
  const conflictA = page.getByTestId("floorplan-conflict");
  await expect(conflictA).toBeVisible({ timeout: 30_000 });
  await conflictA.getByRole("button", { name: "Ponechat mou verzi" }).click();
  await expect(conflictA).toHaveCount(0);
  await expect(a.status).toHaveAttribute("data-state", "saved", { timeout: 30_000 });
  await second.reload();
  await expect(b.canvas).toBeVisible({ timeout: 60_000 });
  await expect(b.lights).toHaveCount(1);
  await expect(b.sockets).toHaveCount(1);
  await second.getByTestId("floorplan-versions").click();
  await expect(second.getByTestId("floorplan-versions-dialog").getByTestId("floorplan-version").filter({ hasText: "Přepsaná verze" })).toHaveCount(1);
  await second.close();
});

test("📐 Rozpracovaný nákres z prohlížeče (do fáze 63) se při otevření seznamu převezme na server", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan");
    await expect(page.getByTestId("floorplan-list")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 180_000 });
  const legacy = {
    version: 1,
    rooms: [{ id: "m-obyvak", name: "Obývák", x: 1000, y: 1000, w: 5000, h: 4000 }],
    elements: [{ id: "z-legacy", item: "socket", x: 1000, y: 3000, room: "Obývák", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null }],
  };
  await page.evaluate((draft) => window.localStorage.setItem("eldock.pb.floorplan", JSON.stringify(draft)), legacy);
  await page.reload();
  // Potvrzení je jen krátká hláška (v dev režimu může zmizet dřív, než doběhne načtení stránky) – ověřujeme výsledek
  const card = page.getByTestId("floorplan-card").filter({ hasText: "Půdorys z prohlížeče" });
  await expect(card).toContainText("1 místnost · 1 prvek", { timeout: 30_000 });
  // Převzetí přerušené obnovením stránky v dev režimu dokončí další otevření seznamu (stejný nákres se nezdvojí) –
  // karta pak může být vidět dřív, než prohlížeč koncept smaže
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("eldock.pb.floorplan")), { timeout: 30_000 }).toBeNull();
  // Další otevření seznamu nic nezdvojí
  await page.reload();
  await expect(page.getByTestId("floorplan-list")).toBeVisible();
  await expect(card).toHaveCount(1);
  await card.getByRole("link").first().click();
  await expect(page).toHaveURL(SAVED_URL);
  await expect(page.getByTestId("floorplan-canvas").locator('[data-element="socket"]')).toHaveCount(1, { timeout: 60_000 });
  await expect(page.getByTestId("floorplan-canvas").locator('[data-room="Obývák"]')).toHaveCount(1);
});
