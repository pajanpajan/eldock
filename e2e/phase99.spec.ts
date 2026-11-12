import { expect, test, type Locator, type Page } from "@playwright/test";

// Fáze 99: kontrola rozlišení pro projektor a notebooky – 1366 × 768 a 1920 × 1080 při 125% škálování Windows
// (1536 × 864 CSS px): stránky bez vodorovného přetečení, dialogy (Designové řady a barvy, Kusovník, BIM import)
// celé na obrazovce, fázová lišta bez posuvníku a dost velké kreslicí plátno 2D půdorysu.
test.describe.configure({ mode: "serial" });

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
] as const;

async function noHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: vodorovné přetečení stránky ${overflow} px`).toBeLessThanOrEqual(1);
}

async function inViewport(page: Page, locator: Locator, label: string) {
  const box = (await locator.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x, `${label}: vlevo mimo obrazovku`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${label}: vpravo mimo obrazovku`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y, `${label}: nahoře mimo obrazovku`).toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height, `${label}: dole mimo obrazovku`).toBeLessThanOrEqual(viewport.height + 1);
}

async function open(page: Page, url: string, ready: Locator) {
  await expect(async () => {
    await page.goto(url);
    await expect(ready).toBeVisible({ timeout: 15_000 });
  }).toPass({ timeout: 240_000 });
}

for (const viewport of VIEWPORTS) {
  const size = `${viewport.width} × ${viewport.height}`;

  test(`🖥️ ${size}: úvod, AI Panel Builder a Studio bez přetečení`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(viewport);
    await open(page, "/", page.getByRole("heading", { level: 1 }));
    await noHorizontalOverflow(page, "/");
    await open(page, "/panel-builder", page.getByTestId("panel-builder-header"));
    await noHorizontalOverflow(page, "/panel-builder");
    await inViewport(page, page.getByTestId("demo-scenarios"), "tlačítko Demo scénáře");
    await open(page, "/studio", page.getByRole("heading", { level: 1 }));
    await noHorizontalOverflow(page, "/studio");
    await open(page, "/prezentace", page.getByTestId("pitch-deck"));
    await noHorizontalOverflow(page, "/prezentace");
    await inViewport(page, page.getByTestId("pitch-print"), "tlačítko Tisk prezentace");
  });

  test(`📐 ${size}: 2D půdorys – fázová lišta, dost velké plátno, Designové řady a Kusovník na obrazovce`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(viewport);
    await open(page, "/panel-builder/floorplan", page.getByTestId("demo-scenarios"));
    await page.getByTestId("demo-scenarios").click();
    await inViewport(page, page.getByTestId("demo-scenarios-menu"), "nabídka Demo scénáře");
    await page.getByTestId("demo-scenario-rd-4kk").click();
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 60_000 });
    await noHorizontalOverflow(page, "editor půdorysu");
    const stepper = page.getByTestId("wizard-stepper");
    expect(await stepper.evaluate((nav) => nav.scrollWidth - nav.clientWidth), "posuvník fázové lišty").toBeLessThanOrEqual(1);
    for (const step of [1, 2, 3, 4, 5] as const) {
      await page.getByTestId(`wizard-step-${step}`).click();
      await noHorizontalOverflow(page, `fáze ${step}`);
      // Pracovní plocha (paleta, plátno, pravý panel) se po posunu pod pevnou hlavičku vejde na obrazovku celá
      await page.evaluate(() => {
        const workspace = document.querySelector('[data-testid="floorplan-workspace"]')!;
        const header = document.querySelector('[data-testid="panel-builder-header"]')?.getBoundingClientRect().height ?? 0;
        window.scrollTo({ top: workspace.getBoundingClientRect().top + window.scrollY - header - 6, behavior: "instant" });
      });
      const frame = (await page.getByTestId("floorplan-canvas-frame").boundingBox())!;
      const header = (await page.getByTestId("panel-builder-header").boundingBox())!;
      expect(frame.y, `fáze ${step}: plátno pod pevnou hlavičkou`).toBeGreaterThanOrEqual(header.y + header.height - 1);
      expect(frame.width, `fáze ${step}: šířka plátna`).toBeGreaterThanOrEqual(560);
      expect(frame.height, `fáze ${step}: výška plátna`).toBeGreaterThanOrEqual(400);
      await inViewport(page, page.getByTestId("phase-nav-bottom"), `fáze ${step}: spodní navigace fází`);
    }
    // Kusovník (fáze 5)
    await page.getByTestId("wizard-bom").click();
    const bom = page.getByRole("dialog");
    await expect(bom).toBeVisible();
    await inViewport(page, bom, "Kusovník");
    await page.screenshot({ path: `test-results/phase99-bom-${viewport.width}.png` });
    await page.keyboard.press("Escape");
    // Designové řady a barvy (fáze 4)
    await page.getByTestId("wizard-step-4").click();
    await page.getByTestId("series-gallery-open").click();
    const gallery = page.getByTestId("series-gallery");
    await expect(gallery).toBeVisible();
    await inViewport(page, gallery, "Designové řady a barvy");
    await page.screenshot({ path: `test-results/phase99-gallery-${viewport.width}.png` });
    await page.keyboard.press("Escape");
    await page.getByTestId("wizard-step-1").click();
    await page.screenshot({ path: `test-results/phase99-floorplan-${viewport.width}.png` });
  });

  test(`🏭 ${size}: závod – BIM import a agendy bez přetečení`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(viewport);
    await open(page, "/plant/plant-jbc?bim=vzor", page.getByTestId("plant-phase-switcher"));
    const bim = page.getByRole("dialog");
    await expect(bim).toBeVisible({ timeout: 60_000 });
    await inViewport(page, bim, "BIM import");
    await page.screenshot({ path: `test-results/phase99-bim-${viewport.width}.png` });
    await page.keyboard.press("Escape");
    await noHorizontalOverflow(page, "mapa závodu");
    for (const phase of [2, 3, 4]) {
      await page.getByTestId(`plant-phase-${phase}`).click();
      await expect(page.getByTestId("plant-phase-switcher")).toHaveAttribute("data-phase", String(phase), { timeout: 60_000 });
      await noHorizontalOverflow(page, `agenda závodu ${phase}`);
    }
  });
}
