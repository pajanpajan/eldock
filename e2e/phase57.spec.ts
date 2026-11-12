import { expect, test } from "@playwright/test";
import { ensureActive, goPhase, phaseForPalette, rightTab } from "./floorplan-phases";

// Fáze 57: 2D půdorys – úprava PDF podkladu (otočení, zoom, ořez, kalibrace s ověřením), značky dle ČSN EN 60617-11,
// rezerva kabeláže, prostředí dle ČSN 33 2000-5-51 před generováním a ovládání podle úrovně instalace.
test.describe.configure({ mode: "serial" });

/** Malé vektorové PDF (A4 na šířku, 842 × 595 pt): obvodová stěna 742 × 495 pt a dvě příčky. */
function floorplanPdf(): Buffer {
  const content = "2 w 50 50 m 792 50 l 792 545 l 50 545 l h S 400 50 m 400 545 l S 50 300 m 400 300 l S BT /F1 24 Tf 120 400 Td (Obyvak) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

test("PDF podklad se zobrazí hned po nahrání (bez obnovení stránky)", async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  // Čerstvý kontext testu nemá v localStorage žádný nákres; počkáme, až se studený dev server přestane přenačítat
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Podklad půdorysu").setInputFiles({ name: "pudorys.pdf", mimeType: "application/pdf", buffer: floorplanPdf() });
  const background = page.getByTestId("floorplan-background");
  await expect(background).toHaveAttribute("href", /\/api\/files\/photos\//);
  // Obrázek je opravdu načtený (ne prázdný rámeček), bez reloadu
  await expect.poll(async () => background.evaluate((node) => (node as SVGImageElement).getBBox().width)).toBeGreaterThan(0);
  await expect.poll(async () => page.evaluate(async () => {
    const href = document.querySelector('[data-testid="floorplan-background"]')?.getAttribute("href");
    if (!href) return 0;
    const image = new Image();
    image.src = href;
    await image.decode().catch(() => null);
    return image.naturalWidth;
  })).toBeGreaterThan(1000);
  await expect(page.getByTestId("floorplan-scale")).toContainText("15 × 10,6 m");

  // Úprava PDF → otočení o 90° doprava a zpět (plocha se prohodí)
  const menu = async (name: RegExp) => {
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByTestId("pdf-edit-menu").click();
    await page.getByRole("menuitem", { name }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  };
  await menu(/Otočit o 90° doprava/);
  await expect(page.getByTestId("floorplan-scale")).toContainText("10,6 × 15 m");
  await expect(page.locator("g:has(> [data-testid=floorplan-background])")).toHaveAttribute("transform", /rotate\(90\)/);
  await menu(/Otočit o 90° doleva/);
  await expect(page.getByTestId("floorplan-scale")).toContainText("15 × 10,6 m");

  // Zoom tlačítky a celý výkres
  const zoomGroup = page.getByRole("group", { name: "Zoom půdorysu" });
  await zoomGroup.getByRole("button", { name: "Přiblížit" }).click();
  await expect(page.getByTestId("zoom-level")).toHaveText("125 %");
  await zoomGroup.getByRole("button", { name: "Celý výkres" }).click();
  await expect(page.getByTestId("zoom-level")).toHaveText("100 %");

  // Ořez tažením a jeho zrušení
  const canvas = page.getByTestId("floorplan-canvas");
  await menu(/Oříznout podklad/);
  // Souřadnice až po otevření menu (klik na tlačítko může posunout stránku); fáze 98: plátno vyplní sloupec na výšku
  // okna a výkres je v něm vystředěný – souřadnice podle obrázku podkladu, ne podle rámečku plátna
  await canvas.scrollIntoViewIfNeeded();
  const sheet = (await background.boundingBox())!;
  await page.mouse.move(sheet.x + sheet.width * 0.02, sheet.y + sheet.height * 0.02);
  await page.mouse.down();
  await page.mouse.move(sheet.x + sheet.width * 0.52, sheet.y + sheet.height * 0.52, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("floorplan-scale")).toContainText("7,5 × 5,3 m");
  await menu(/Zrušit ořez/);
  await expect(page.getByTestId("floorplan-scale")).toContainText("15 × 10,6 m");

  // Kalibrace: horní stěna 742 pt = 261,8 mm × 50 = 13,09 m, kontrola proti měřítku výkresu 1 : 50
  await expect(page.getByTestId("calibration-state")).toHaveText("Měřítko nekalibrováno");
  await menu(/Kalibrovat měřítko/);
  const box = (await background.boundingBox())!;
  const at = (xPt: number, yPt: number) => ({ x: box.x + (xPt / 842) * box.width, y: box.y + (yPt / 595) * box.height });
  const click = (point: { x: number; y: number }) => page.mouse.click(point.x, point.y);
  await click(at(50, 50));
  await click(at(792, 50));
  const dialog = page.getByTestId("calibration-dialog");
  await dialog.getByLabel("Skutečná délka kóty").fill("13088 mm");
  await dialog.getByLabel("Měřítko výkresu").selectOption("50");
  await expect(dialog.getByTestId("scale-check")).toContainText("shoda");
  await expect(dialog.getByTestId("calibration-preview")).toContainText("14,9 × 10,5 m");
  await dialog.getByTestId("calibration-apply").click();
  await expect(page.getByTestId("calibration-state")).toHaveText("Měřítko neověřeno");

  // Ověření druhou (kolmou) kótou: pravá stěna 495 pt = 8,73 m; s odchylkou nad 2 % potvrdit nejde
  await click(at(792, 50));
  await click(at(792, 545));
  const verify = page.getByTestId("calibration-verify");
  await verify.getByLabel("Délka ověřovací kóty").fill("9,5 m");
  await expect(verify.getByTestId("verify-result")).toContainText("větší než ±2 %");
  await expect(verify.getByTestId("verify-confirm")).toHaveCount(0);
  await verify.getByLabel("Délka ověřovací kóty").fill("8731 mm");
  await expect(verify.getByTestId("verify-result")).toContainText("Měřítko sedí");
  await verify.getByTestId("verify-confirm").click();
  await expect(page.getByTestId("calibration-state")).toHaveText("✓ Měřítko ověřeno");
  // Fáze 98: kontrola před generováním je v kartě kabeláže fáze 5
  await goPhase(page, 5);
  await expect(page.getByTestId("generation-checklist")).toContainText("Měřítko ověřeno");
  await page.getByTestId("floorplan-canvas").screenshot({ path: "test-results/phase57-pdf.png" });
});

test("značky dle ČSN EN 60617-11, přesun / otočení / mazání, úroveň instalace, rezerva a prostředí před generováním", async ({ page }) => {
  test.setTimeout(360_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  // Fáze 98: značka je v paletě své fáze (rozváděč 2, zásuvky 3, světla a vypínače 4)
  const choose = async (label: string) => {
    await phaseForPalette(page, label);
    await palette.getByRole("button", { name: label, exact: false }).first().click();
  };

  // Místnost a rozváděč
  await goPhase(page, 1);
  await page.getByRole("button", { name: "Kreslit místnost" }).click();
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + 420, { steps: 6 });
  await page.mouse.up();
  await choose("Hlavní domovní / bytový rozváděč");
  await canvas.click({ position: { x: 140, y: 380 } });

  // Zásuvka u horní stěny se přicvakne a natočí nožičkou ke stěně, u pravé stěny o 90°
  await choose("Jednozásuvka");
  await canvas.click({ position: { x: 300, y: 112 } });
  await expect(page.getByTestId("element-detail")).toContainText("otočení 0°");
  await canvas.click({ position: { x: 488, y: 260 } });
  await expect(page.getByTestId("element-detail")).toContainText("otočení 90°");
  const sockets = canvas.locator('[data-element="socket"]');
  await expect(sockets).toHaveCount(2);
  await expect(canvas.locator('[data-symbol="socket"]').first()).toBeVisible();

  // V režimu vkládání klik na osazenou značku ji vybere (nevloží další) a tažením se přesune
  const first = sockets.first();
  const before = await first.getAttribute("transform");
  await first.click();
  await expect(sockets).toHaveCount(2);
  const target = (await first.boundingBox())!;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2 + 60, target.y + target.height / 2 + 2, { steps: 5 });
  await page.mouse.up();
  await expect(first).not.toHaveAttribute("transform", before ?? "");
  // Plovoucí lišta: otočit, měřítko značky, smazat
  const toolbar = canvas.getByTestId("element-toolbar");
  await toolbar.getByRole("button", { name: "Otočit značku o 90°" }).click();
  await expect(page.getByTestId("element-detail")).toContainText("otočení 90°");
  const scale = page.getByRole("radiogroup", { name: "Měřítko značky" });
  await scale.getByRole("radio", { name: "200 %" }).click();
  await expect(scale.getByRole("radio", { name: "200 %" })).toHaveAttribute("aria-checked", "true");
  await toolbar.getByRole("button", { name: "Smazat značku" }).click();
  await expect(sockets).toHaveCount(1);
  await page.keyboard.press("Escape");

  // Měřítko všech značek
  await page.getByTestId("wizard-step-3").click();
  const slider = page.getByLabel("Velikost značek");
  await slider.focus();
  for (let step = 0; step < 5; step++) await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("symbol-scale")).toHaveText("150 %");

  // Světlo + dva vypínače č. 1 → po spárování se kreslí jako střídavé řazení č. 6
  await choose("Stropní svítidlo");
  await canvas.click({ position: { x: 300, y: 260 } });
  await choose("Vypínač č. 1");
  await canvas.click({ position: { x: 180, y: 200 } });
  await canvas.click({ position: { x: 420, y: 200 } });
  await page.keyboard.press("Escape");
  for (const index of [0, 1]) {
    await ensureActive(page, canvas.locator('[data-element="switch-1"]').nth(index));
    await canvas.locator('[data-element="switch-1"]').nth(index).click();
    await page.getByRole("button", { name: "🔗 Přiřadit ke světlu" }).click();
    await canvas.getByRole("button", { name: /^Stropní svítidlo/ }).click();
    await page.keyboard.press("Escape");
  }
  await ensureActive(page, canvas.locator('[data-element="switch-1"]').first());
  await canvas.locator('[data-element="switch-1"]').first().click();
  await expect(page.getByTestId("switch-number")).toContainText("řazení č. 6");
  // Fáze 98: výkaz kabeláže a rezerva v pravém panelu / levé paletě fáze 5; fáze 100 – záložka Okruhy & Trasy
  await goPhase(page, 5);
  await rightTab(page, "circuits");
  await expect(page.getByTestId("cable-buy")).toContainText("CYKY-O");

  // Rezerva kabeláže v %
  const optimized = page.getByTestId("cable-totals").locator('[data-mode="OPTIMIZED"]');
  const length10 = await optimized.textContent();
  await page.getByLabel("Rezerva kabeláže [%]").fill("25");
  await expect(optimized).not.toHaveText(length10 ?? "");
  await expect(page.getByTestId("cable-panel")).toContainText("rezervy 25 %");

  // Úroveň instalace „sběrnice“: převod vypínačů na sběrnicová tlačítka, nová paleta, sběrnicová linka místo CYKY-O
  // Fáze 98: úroveň instalace v kartě designu fáze 4
  await goPhase(page, 4);
  await page.getByTestId("install-methodology").getByLabel("Úroveň instalace").selectOption("bus_loxone");
  const conversion = page.getByTestId("level-conversion");
  await expect(conversion).toContainText("Sběrnicové tlačítko 1násobné");
  await conversion.getByTestId("level-convert").click();
  await expect(canvas.locator('[data-element="bus-1"]')).toHaveCount(2);
  await expect(canvas.locator('[data-symbol="bus"]')).toHaveCount(2);
  await expect(palette.getByRole("button", { name: /Sběrnicové tlačítko 4násobné/ })).toBeVisible();
  await expect(palette.getByRole("button", { name: /Vypínač č\. 1/ })).toHaveCount(0);
  await expect(page.getByTestId("level-note")).toContainText("sběrnicové lince");
  await goPhase(page, 5);
  await rightTab(page, "circuits");
  await expect(page.getByTestId("cable-buy")).toContainText("KNX");
  await expect(page.getByTestId("cable-buy")).not.toContainText("CYKY-O");
  await expect(canvas.getByTestId("bus-line")).toBeAttached();
  await page.getByTestId("floorplan-canvas").screenshot({ path: "test-results/phase57-bus.png" });

  // Prostředí dle ČSN 33 2000-5-51 ed. 3 je povinné před generováním (fáze 100: záložka Kusovník & Rozváděč)
  await rightTab(page, "bom");
  const generate = page.getByTestId("generate-from-floorplan");
  await expect(page.getByTestId("generation-checklist")).toContainText("Zvolte prostředí instalace");
  await expect(generate).toBeDisabled();
  await page.getByTestId("floorplan-environment").selectOption("TIMBER");
  await expect(generate).toBeEnabled();
  await page.getByLabel("Název rozváděče").fill("RD57 sběrnice");
  await generate.click();
  await expect(page).toHaveURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD57 sběrnice");
  await page.goto(page.url() + "/documentation");
  await expect(page.getByTestId("environment-confirm")).toContainText("Potvrzeno");
  await expect(page.getByTestId("doc-cables")).toContainText("rezerva 25 %");
  await page.getByTestId("print-confirmation").getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: /Vytisknout \/ Exportovat/ })).toBeEnabled();
  await page.getByTestId("delete-project").click();
  await expect(page).toHaveURL(/\/panel-builder$/, { timeout: 30_000 });
});
