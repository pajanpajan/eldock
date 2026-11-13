import { expect, test, type Locator, type Page } from "@playwright/test";

import { phaseForPalette } from "./floorplan-phases";

// Fáze 110: 3D náhled a kontrola výšek i pro nahraný PDF podklad bez nakreslených místností – odvozené obvodové stěny
// a příčky, PDF podklad na podlaze izometrie, 🔌 kabelové trasy ve 3D i na stěně a pohled na stěnu s virtuální
// místností „Celý půdorys (PDF podklad)“ (bez hlášky „Nakreslete nejdřív místnost“).
test.describe.configure({ mode: "serial" });

/** Malé vektorové PDF (A4 na šířku): obvodová stěna a dvě příčky – jako ve fázi 57. */
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

async function clickAt(page: Page, canvas: Locator, x: number, y: number) {
  await canvas.scrollIntoViewIfNeeded();
  const at = await canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const value = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: value.x, y: value.y };
  }, { x, y });
  await page.mouse.click(at.x, at.y);
}

/** Prvek z palety přímo na PDF podklad (bez nakreslené místnosti). */
async function place(page: Page, canvas: Locator, label: string | RegExp, x: number, y: number) {
  await phaseForPalette(page, label);
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  await palette.getByRole("button", { name: label }).first().click();
  await clickAt(page, canvas, x, y);
  await page.keyboard.press("Escape");
}

test("📐 PDF podklad bez místností: 3D stěny, podklad na podlaze, 🔌 trasy a pohled na stěnu „Celý půdorys (PDF podklad)“", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Podklad půdorysu").setInputFiles({ name: "pudorys.pdf", mimeType: "application/pdf", buffer: floorplanPdf() });
  await expect(page.getByTestId("floorplan-background")).toHaveAttribute("href", /\/api\/files\/photos\//);
  await expect(page.getByTestId("floorplan-scale")).toContainText("15 × 10,6 m");

  const canvas = page.getByTestId("floorplan-canvas");
  await place(page, canvas, "Hlavní domovní / bytový rozváděč", 7000, 1600);
  await place(page, canvas, "Dvojzásuvka", 2500, 1600);
  await place(page, canvas, "Dvojzásuvka", 11_000, 1600);
  await place(page, canvas, "Stropní svítidlo", 3500, 5000);
  await place(page, canvas, /^Vypínač č\. 1/, 6000, 5000);
  expect(await canvas.locator("[data-element]").count()).toBeGreaterThanOrEqual(5);
  await expect(canvas.locator("[data-room]")).toHaveCount(0);

  await page.getByTestId("pseudo3d-open").click();
  const modal = page.getByTestId("pseudo3d-modal");
  const iso = modal.getByTestId("pseudo3d-iso");
  await expect(iso).toBeVisible();
  expect(await iso.getByTestId("pseudo3d-wall-face").count()).toBeGreaterThanOrEqual(4);
  await expect(modal.getByTestId("pseudo3d-pdf-mode")).toContainText("📐 PDF režim: Obvodové stěny a příčky byly automaticky odvozeny z prvků na PDF podkladu");
  await expect(iso.getByTestId("pseudo3d-floor-pdf")).toBeAttached();
  await modal.getByTestId("pseudo3d-floor-toggle").click();
  await expect(iso.getByTestId("pseudo3d-floor-pdf")).toHaveCount(0);
  await modal.getByTestId("pseudo3d-floor-toggle").click();
  await expect(iso.getByTestId("pseudo3d-floor-pdf")).toBeAttached();

  // 🔌 Kabelové trasy – výchozí zapnuté, vypnout a znovu zapnout jedním klikem
  const cables = modal.getByTestId("pseudo3d-cables");
  await expect(cables).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => iso.getByTestId("pseudo3d-cable").count(), { timeout: 30_000 }).toBeGreaterThan(0);
  await modal.screenshot({ path: "test-results/phase110-iso.png" });
  await cables.click();
  await expect(cables).toHaveAttribute("aria-pressed", "false");
  await expect(iso.getByTestId("pseudo3d-cable")).toHaveCount(0);
  await cables.click();
  await expect.poll(() => iso.getByTestId("pseudo3d-cable").count()).toBeGreaterThan(0);

  // Pohled na stěnu: virtuální místnost celého půdorysu, prvky 0–2600 mm, změna výšky
  await modal.getByRole("button", { name: "Pohled na stěnu" }).click();
  const room = modal.getByTestId("pseudo3d-room");
  await expect(room).toHaveValue("__plan");
  await expect(room.locator("option:checked")).toHaveText("Celý půdorys (PDF podklad)");
  const wall = modal.getByTestId("pseudo3d-wall");
  await expect(wall).toBeVisible();
  await expect(modal).not.toContainText("Nakreslete nejdřív místnost");
  expect(await wall.getByTestId("pseudo3d-wall-element").count()).toBeGreaterThanOrEqual(5);
  await expect.poll(() => wall.getByTestId("pseudo3d-wall-cable").count(), { timeout: 30_000 }).toBeGreaterThan(0);
  for (const side of ["Východní", "Jižní", "Západní", "Severní"]) {
    await modal.getByRole("group", { name: "Stěna" }).getByRole("button", { name: side }).click();
    expect(await wall.getByTestId("pseudo3d-wall-element").count()).toBeGreaterThanOrEqual(5);
  }
  const socket = wall.locator('[data-testid="pseudo3d-wall-element"][data-z="300"]').first();
  const id = await socket.getAttribute("data-id");
  await socket.click();
  await modal.getByTestId("pseudo3d-height-input").fill("1150");
  await modal.getByTestId("pseudo3d-height-apply").click();
  await expect(wall.locator(`[data-testid="pseudo3d-wall-element"][data-id="${id}"]`)).toHaveAttribute("data-z", "1150");
  await modal.screenshot({ path: "test-results/phase110-wall.png" });
});
