import { expect, test } from "@playwright/test";

import { toast } from "./helpers";

test("visual diff revizí PDF: vedle sebe, posuvník a barevný diff", async ({ page }) => {
  await page.goto("/equipment/eq-pv-m1");
  await page.getByRole("button", { name: "Porovnat s v1.0" }).click();

  const before = page.getByTestId("compare-side-before");
  const after = page.getByTestId("compare-side-after");
  await expect(before).toContainText("Předchozí v1.0");
  await expect(after).toContainText("Vybraná v1.1");
  // pdf.js vykreslí stránku do obrázku (blob:)
  await expect(before.getByRole("img", { name: "Schéma v1.0" })).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });
  await expect(after.getByRole("img", { name: "Schéma v1.1" })).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });

  await page.getByLabel("Číslo stránky").selectOption("6");
  await expect(before).toContainText("str. 6");

  await page.getByRole("radio", { name: "Posuvník" }).click();
  await expect(page.getByTestId("compare-overlay").getByRole("img", { name: "Schéma v1.1" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("radio", { name: "Barevný diff" }).click();
  await expect(page.getByTestId("compare-diff").getByRole("img", { name: /Barevný rozdíl v1\.0 a v1\.1/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("diff-stats")).toContainText(/změna \d/);
  await expect(page.getByTestId("diff-legend")).toContainText("Odebráno ve v1.1");
});

test("interaktivní reference ve schématu: štítky, rozpis prvků a karta propojeného zařízení", async ({ page }) => {
  await page.goto("/equipment/eq-pv-m1");
  await page.getByRole("button", { name: /^Interaktivní prvky \(10\)$/ }).click();
  const schematic = page.getByTestId("interactive-schematic");
  await expect(schematic.getByTestId("interactive-page")).toHaveText("str. 6 / 52");
  await expect(schematic.getByRole("img", { name: /Výkres v1\.1, stránka 6/ })).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });

  // Klik na štítek -M1 přímo ve výkresu
  await schematic.getByRole("button", { name: "-M1 – Pohon sekčních vrat 3~ 400 V" }).click();
  const card = page.getByTestId("reference-card");
  await expect(card).toContainText("Pohon sekčních vrat 3~ 400 V");
  await expect(card).toContainText("Platná revize dokumentace: v1.1");
  await expect(card).toContainText("ZM-2026-0040");
  await expect(card.getByRole("link", { name: "Přejít na kartu zařízení PV-M1" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Klik v rozpisu prvků přepne stránku (PLC je na str. 17) a otevře kartu
  await schematic.getByTestId("reference-list").getByRole("button", { name: /-UC2/ }).click();
  await expect(schematic.getByTestId("interactive-page")).toHaveText("str. 17 / 52");
  await card.getByRole("link", { name: "Přejít na kartu zařízení R-PLC-ML1" }).click();
  await expect(page).toHaveURL(/\/equipment\/eq-r-plc-ml1$/);
});

test("CAE reference: přidání nové reference kliknutím do výkresu", async ({ page }) => {
  await page.goto("/equipment/eq-pv-m1?layer=refs");
  const schematic = page.getByTestId("interactive-schematic");
  await expect(schematic.getByRole("img", { name: /stránka 6/ })).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });
  await schematic.getByRole("button", { name: "Upravit reference" }).click();
  const drawing = schematic.getByTestId("interactive-drawing");
  const box = (await drawing.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3);

  const dialog = page.getByRole("dialog", { name: "Nová reference ve výkresu" });
  await dialog.getByLabel("Označení").fill("k1");
  await dialog.getByLabel("Název prvku").fill("Řídicí relé PLC");
  await dialog.getByLabel("Propojené zařízení (karta)").selectOption("eq-r-plc-ml1");
  await dialog.getByRole("button", { name: "Uložit referenci" }).click();
  await expect(toast(page)).toContainText("Reference -K1 uložena.");
  await expect(schematic.getByRole("button", { name: "-K1 – Řídicí relé PLC" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Interaktivní prvky \(11\)$/ })).toBeVisible();
});
