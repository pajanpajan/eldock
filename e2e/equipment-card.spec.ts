import { expect, test } from "@playwright/test";

// 1×1 PNG – fotka „z mobilu“
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("karta zařízení: fotografie, QR štítek, tisk a přegenerování kódu", async ({ page }) => {
  await page.goto("/equipment/eq-rh1");
  await expect(page.getByTestId("equipment-photo")).toHaveAttribute("src", "/api/files/photos/seed/equipment-RH1.svg");

  const label = page.getByTestId("qr-label");
  await expect(label).toContainText("RH1");
  await expect(label).toContainText("ID eq-rh1");
  const urlText = page.getByTestId("qr-label-url");
  await expect(urlText).toHaveText(/\/equipment\/eq-rh1\?qr=[0-9A-F]{10}$/);
  const oldUrl = (await urlText.textContent())!;

  // Tisková stránka štítku 62 × 29 mm
  const print = await page.request.get("/equipment/eq-rh1/label");
  expect(print.status()).toBe(200);
  expect(await print.text()).toContain("size: 62mm 29mm");

  await page.getByRole("button", { name: "Přiřadit nový QR kód" }).click();
  await expect(page.getByRole("dialog")).toContainText("Původní fyzický štítek na stroji RH1 přestane fungovat");
  await page.getByRole("button", { name: "Přegenerovat" }).click();
  await expect(page.locator("[data-sonner-toast]").first()).toContainText("Nový QR kód");
  await expect(urlText).not.toHaveText(oldUrl);

  // Starý štítek po naskenování ohlásí neplatnost, nový je v pořádku
  await page.goto(new URL(oldUrl).pathname + new URL(oldUrl).search);
  await expect(page.getByTestId("qr-label-replaced")).toBeVisible();
  const newUrl = (await page.getByTestId("qr-label-url").textContent())!;
  await page.goto(new URL(newUrl).pathname + new URL(newUrl).search);
  await expect(page.getByTestId("qr-label-replaced")).toHaveCount(0);
});

test("nahrání fotografie zařízení z mobilu", async ({ page }) => {
  await page.goto("/equipment/eq-sp-0330");
  await expect(page.getByTestId("equipment-photo")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "konvice.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("[data-sonner-toast]").first()).toContainText("Fotografie SP-0330 uložena.");
  await expect(page.getByTestId("equipment-photo")).toHaveAttribute("src", /^\/api\/files\/photos\/(?!seed\/)/);
});
