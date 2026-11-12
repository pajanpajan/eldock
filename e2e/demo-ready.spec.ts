import { expect, test, type Page } from "@playwright/test";
import { rightTab } from "./floorplan-phases";
import { PUBLIC_STATE } from "./auth";

// Fáze 99 / 101: „pre-flight check“ před prezentací (`npm run verify:demo`) – veřejná prezentace /prezentace s 8 věcnými
// slidy a One-Pagerem A4, demo scénáře 2D půdorysu na 1 klik s fázemi 1–5 a přenosem do AI Panel Builderu, vzorový
// rozváděč (oteplení, 6listový PDF elaborát, štítky 1:1) a průmyslový závod (vzorový BIM, mapa Síť / DA / UPS,
// Červenka u stroje, Kniha revizí). Vše bez jediné chyby v konzoli (`pageerror` / `console.error`).
test.describe.configure({ mode: "serial" });

/** Šum vývojového serveru, který na produkci není (React DevTools, HMR / Fast Refresh). */
const DEV_NOISE = [/Download the React DevTools/, /\[HMR\]/, /\[Fast Refresh\]/];

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!DEV_NOISE.some((pattern) => pattern.test(text))) errors.push(`console.error: ${text} (${message.location().url})`);
  });
  return errors;
}

async function open(page: Page, url: string, ready: (page: Page) => Promise<void>) {
  // Fáze 100: průvodce fází i když jiný test téže databáze přepnul firmě kompaktní lištu (volba prohlížeče má přednost)
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
  await expect(async () => {
    await page.goto(url);
    await ready(page);
  }).toPass({ timeout: 240_000 });
}

test.describe("veřejně bez přihlášení", () => {
  test.use({ storageState: PUBLIC_STATE });

  test("📊 /prezentace: 200 OK, 8 věcných slidů na 1366 × 768 i 1920 × 1080, úprava textu / částky a One-Pager A4", async ({ page, request }) => {
    test.setTimeout(240_000);
    expect((await request.get("/prezentace", { maxRedirects: 0 })).status()).toBe(200);
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, "/prezentace", async (current) => {
      await expect(current.getByTestId("pitch-deck")).toBeVisible({ timeout: 15_000 });
    });
    const slides = page.getByTestId("pitch-slide");
    await expect(slides).toHaveCount(8);
    const counter = page.getByTestId("pitch-counter");
    const active = page.locator('[data-testid="pitch-slide"][data-active="true"]');
    await expect(counter).toHaveText("1 / 8");
    await expect(active).toContainText("Propojení návrhu elektroinstalace, výroby rozváděčů a provozní dokumentace do jednoho pracovního postupu");
    await expect(active).toContainText("Správa dokumentace závodů a budov");
    // Klávesnice: → / mezerník / ← / End / Home, tečky dole
    await page.keyboard.press("ArrowRight");
    await expect(counter).toHaveText("2 / 8");
    await page.keyboard.press(" ");
    await expect(counter).toHaveText("3 / 8");
    await page.keyboard.press("ArrowLeft");
    await expect(counter).toHaveText("2 / 8");
    await page.keyboard.press("End");
    await expect(counter).toHaveText("8 / 8");
    await page.keyboard.press("Home");
    await expect(counter).toHaveText("1 / 8");
    // Slide 3: 5 fází průvodce, živý kusovník vzorového RD s MPN / EAN, tlačítko živé ukázky
    await page.getByTestId("pitch-dot-3").click();
    await expect(active).toContainText("Krok za krokem od stěn po kusovník");
    await expect(active.getByTestId("pitch-live-bom")).toContainText(/\d+ okruhů · [\d\s]+ m kabelu/);
    await expect(active.getByTestId("pitch-live-bom").locator("tbody tr").first()).toContainText(/\d{13}/);
    await expect(page.getByTestId("pitch-demo-floorplan")).toHaveAttribute("href", "/panel-builder/floorplan?demo=rd-4kk");
    await page.getByTestId("pitch-dot-4").click();
    await expect(active.getByTestId("pitch-live-sheets").locator("li")).toHaveCount(6);
    await expect(page.getByTestId("pitch-demo-panel")).toHaveAttribute("target", "_blank");
    await page.getByTestId("pitch-dot-5").click();
    await expect(active.getByTestId("pitch-live-bim")).toContainText("84,0 × 42,5 m");
    await expect(page.getByTestId("pitch-demo-plant")).toHaveAttribute("href", "/app");
    // Každý slide se vejde na projektor 1366 × 768 i na 1920 × 1080 – stránka bez posuvníku, slide bez přetečení
    for (const size of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      for (let index = 1; index <= 8; index++) {
        await page.getByTestId(`pitch-dot-${index}`).click();
        const overflow = await active.evaluate((node) => node.scrollHeight - node.clientHeight);
        expect(overflow, `slide ${index} na ${size.width} × ${size.height} přetéká o ${overflow} px`).toBeLessThanOrEqual(1);
        const pageScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
        expect(pageScroll, `stránka na ${size.width} × ${size.height} má svislý posuvník`).toBeLessThanOrEqual(1);
      }
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(active.getByTestId("pitch-author")).toContainText("Pavel Janoušek");
    await expect(active.getByTestId("pitch-author")).toContainText("(ABB, Hilti, PC|SCHEMATIC)");
    await expect(active.getByTestId("pitch-contact")).toContainText("Pavel Janoušek · ELDOCK");
    await expect(active.getByTestId("pitch-amount")).toHaveText("podle domluvy na jednání");
    await page.screenshot({ path: "test-results/demo-pitch-slide8.png" });

    // ✏️ Úprava textu / částky přímo na slidu – uloží se do prohlížeče a vydrží obnovení stránky
    await active.getByTestId("pitch-edit-slide").click();
    const dialog = page.getByTestId("pitch-edit-dialog");
    await dialog.getByTestId("pitch-edit-amount").fill("8 mil. Kč");
    await dialog.getByTestId("pitch-edit-partner").fill("Ukázkový investiční fond");
    await dialog.getByTestId("pitch-edit-fund-0").fill("45");
    await dialog.getByTestId("pitch-edit-plan-1").fill("Napojení objednávek materiálu přes API velkoobchodů.");
    await dialog.getByTestId("pitch-edit-save").click();
    await expect(active.getByTestId("pitch-amount")).toHaveText("8 mil. Kč");
    await expect(active.getByTestId("pitch-partner")).toContainText("Ukázkový investiční fond");
    await expect(active.getByTestId("pitch-plan-2")).toHaveText("Napojení objednávek materiálu přes API velkoobchodů.");
    await page.reload();
    await page.getByTestId("pitch-dot-8").click();
    await expect(page.locator('[data-testid="pitch-slide"][data-active="true"]').getByTestId("pitch-amount")).toHaveText("8 mil. Kč");

    // 📄 One-Pager: A4 (210 mm), QR kód, částka; tisk bez ovládání
    await page.getByTestId("pitch-mode-onepager").click();
    const onePager = page.getByTestId("pitch-onepager");
    await expect(onePager).toBeVisible();
    await expect(onePager.getByTestId("onepager-amount")).toHaveText("8 mil. Kč");
    await expect(onePager.locator("svg").first()).toBeVisible();
    const box = (await onePager.boundingBox())!;
    expect(Math.abs(box.width - (210 / 25.4) * 96)).toBeLessThan(3);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("pitch-print")).toBeHidden();
    const printed = (await onePager.boundingBox())!;
    expect(printed.height, "One-Pager se vejde na 1 stránku A4").toBeLessThanOrEqual((297 / 25.4) * 96 + 2);
    await page.emulateMedia({ media: "screen" });
    await page.screenshot({ path: "test-results/demo-onepager.png", fullPage: true });
    expect(errors).toEqual([]);
  });
});

test("🎯 2D půdorys: 3 demo scénáře na 1 klik, fáze 1–5, kusovník KOPOS a přenos do AI Panel Builderu", async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "/panel-builder/floorplan", async (current) => {
    await expect(current.getByTestId("demo-scenarios")).toBeVisible({ timeout: 15_000 });
  });
  const wizard = page.getByTestId("floorplan-wizard");
  const canvas = page.getByTestId("floorplan-canvas");
  for (const [scenario, minElements] of [
    ["ordinace", 30],
    ["oc-jednotka", 30],
    ["rd-4kk", 70],
  ] as const) {
    await page.getByTestId("demo-scenarios").click();
    const started = Date.now();
    await page.getByTestId(`demo-scenario-${scenario}`).click();
    await expect(page).toHaveURL(/\/panel-builder\/floorplan\/(?!novy)[\w-]+$/, { timeout: 60_000 });
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => canvas.locator("[data-element]").count(), { timeout: 30_000 }).toBeGreaterThan(minElements);
    console.log(`demo ${scenario}: ${Date.now() - started} ms do vykreslení`);
    await expect(wizard).toHaveAttribute("data-step", "1");
    for (const step of [2, 3, 4, 5] as const) {
      await page.getByTestId(`wizard-step-${step}`).click();
      await expect(wizard).toHaveAttribute("data-step", String(step));
    }
    // Fáze 100: fáze 5 otevře záložku ⚡ Kusovník & Rozváděč, soupis okruhů je v záložce 🔌 Okruhy & Trasy
    await expect(page.getByTestId("wizard-generate")).toBeVisible();
    await rightTab(page, "circuits");
    await expect(page.getByTestId("circuit-list")).toBeVisible();
  }
  // Rodinný dům: hluboké krabice KOPOS KPR 68 v kusovníku
  await page.getByTestId("wizard-bom").click();
  await expect(page.getByTestId("wiring-bom-boxes")).toContainText("KPR 68");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/demo-floorplan-rd.png" });

  // ⚡ Vygenerovat rozváděč z tohoto půdorysu → AI Panel Builder (3f rozváděč se vším z půdorysu)
  await rightTab(page, "bom");
  const started = Date.now();
  await page.getByTestId("wizard-generate").click();
  await expect(page).toHaveURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 90_000 });
  console.log(`generování rozváděče: ${Date.now() - started} ms`);
  const panel = page.getByTestId("vector-panel");
  await expect(panel).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByRole("button", { name: /^-Q1 / })).toBeVisible();
  await expect(panel.getByRole("button", { name: /^-FI3 / })).toBeVisible();
  await page.screenshot({ path: "test-results/demo-generated-panel.png" });
  expect(errors).toEqual([]);
});

test("⚡ AI Panel Builder: vzorový rozváděč, výpočet oteplení a 6listový PDF elaborát se štítky 1:1", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "/panel-builder", async (current) => {
    await expect(current.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 15_000 });
  });
  await page.getByRole("link", { name: /PB-001/ }).first().click();
  await expect(page.getByTestId("vector-panel")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("panel-phase-3").click();
  await expect(page.getByTestId("thermal-verdict")).toContainText("VYHOVUJE", { timeout: 60_000 });
  await page.getByTestId("panel-phase-4").click();
  for (let sheet = 1; sheet <= 6; sheet++) await expect(page.getByTestId(`doc-sheet-${sheet}`)).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("panel-page-labels").click();
  await expect(page).toHaveURL(/\/labels$/, { timeout: 60_000 });
  await expect(page.locator(".label-sheet").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("🏭 Průmyslový závod: vzorový BIM (.ifc), mapa Síť / DA / UPS, Červenka u stroje a Kniha revizí", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "/plant/plant-jbc?bim=vzor", async (current) => {
    await expect(current.getByTestId("plant-phase-switcher")).toBeVisible({ timeout: 15_000 });
  });
  // Vzorový BIM model haly se načte sám (demo scénář) – náhled importu v dialogu
  const bim = page.getByRole("dialog");
  await expect(bim).toBeVisible({ timeout: 60_000 });
  await expect(bim).toContainText(/IFC|BIM/);
  await page.keyboard.press("Escape");
  await expect(bim).toHaveCount(0);
  // Mapa areálu s filtrem zálohování napájení
  const filter = page.getByTestId("power-backup-filter");
  for (const tier of ["GRID_STANDARD", "BACKUP_GENERATOR_DA", "CRITICAL_UPS_ZIS", "ALL"]) {
    await filter.getByTestId(`backup-filter-${tier}`).click();
    await expect(filter.getByTestId(`backup-filter-${tier}`)).toHaveAttribute("aria-pressed", "true");
  }
  // 🎯 Demo scénáře v horní liště průmyslového portálu
  await page.getByTestId("plant-demo-scenarios").click();
  await expect(page.getByTestId("plant-demo-menu")).toContainText("Průmyslový závod 4.0");
  await page.getByTestId("plant-demo-legislation").click();
  await expect(page).toHaveURL(/faze=4&stroj=75/, { timeout: 60_000 });
  await expect(page.getByTestId("plant-legislation")).toContainText("Nařízení (EU) 2023/1230");
  await expect(page.getByTestId("plant-simulator").getByTestId("simulator-amps")).toContainText("+120,3 A");
  // Detail stroje s elektronickou Červenkou (zákres změny nad schématem)
  await page.goto("/equipment/eq-r-cnc-04");
  await expect(page.getByText("Zákres technika nad revizí").first()).toBeVisible({ timeout: 60_000 });
  // Kniha revizí
  await page.goto("/inspections/audit-report");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kniha revizí", { timeout: 60_000 });
  expect(errors).toEqual([]);
});
