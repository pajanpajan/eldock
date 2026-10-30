import { expect, test } from "@playwright/test";

test("reálný projekt PCSCHEMATIC v PDF: náhled, stažení originálu a porovnání s předchozí revizí", async ({ page }) => {
  const pdf = await page.request.get("/demo-docs/pohon-vrat-motor.pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  await page.goto("/equipment/eq-pv-m1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pohon sekčních vrat");

  const viewer = page.getByTestId("pdf-viewer");
  await expect(viewer).toHaveCount(1);
  await expect(viewer.locator("iframe")).toHaveAttribute("src", "/demo-docs/pohon-vrat-motor.pdf#view=FitH");
  await expect(viewer.getByRole("link", { name: "Stáhnout originál" })).toHaveAttribute("href", "/demo-docs/pohon-vrat-motor.pdf");
  await expect(viewer.getByRole("button", { name: "Celá obrazovka" })).toBeVisible();

  // Porovnání vykresluje obě PDF přes pdf.js (fáze 22) – stará verze vlevo, nová vpravo.
  await page.getByRole("button", { name: "Porovnat s v1.0" }).click();
  await expect(page.getByTestId("pdf-viewer")).toHaveCount(0);
  await expect(page.getByTestId("compare-side-before")).toContainText("Předchozí v1.0");
  await expect(page.getByTestId("compare-side-after")).toContainText("Vybraná v1.1");
  await page.getByRole("button", { name: "Zavřít porovnání" }).click();
  await expect(page.getByTestId("pdf-viewer")).toHaveCount(1);

  // Další dva projekty: areálový rozváděč a PLC skříň
  await page.goto("/equipment/eq-rh1");
  await expect(page.getByTestId("pdf-viewer").locator("iframe")).toHaveAttribute("src", /domovni-rozvadec-rh1\.pdf/);
  await page.goto("/equipment/eq-r-plc-ml1");
  await expect(page.getByTestId("pdf-viewer").locator("iframe")).toHaveAttribute("src", /plc-rozvadec-linka\.pdf/);
});

test("PDF dokumentace bez přihlášení není dostupná", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const response = await context.request.get("/demo-docs/pohon-vrat-motor.pdf", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  await context.close();
});
