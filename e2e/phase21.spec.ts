import path from "node:path";

import { expect, test } from "@playwright/test";

import { toast } from "./helpers";

const PHOTO = path.resolve("e2e", "fixtures", "rozvadec.png");

test("kreslení do fotky červenky: zákres se nahraje jako složená fotka", async ({ page }) => {
  // R-CNC-04 má otevřenou změnu → průvodce začíná krokem Fotky (bez nového čísla ZM).
  await page.goto("/equipment/eq-r-cnc-04/change-request");
  // Vložení souboru až po hydrataci (studený dev server)
  await expect(async () => {
    await page.getByTestId("photo-input").setInputFiles(PHOTO);
    await expect(page.locator("li[data-uploaded]")).toHaveCount(1, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.locator('li[data-uploaded="true"]')).toHaveCount(1, { timeout: 20_000 });
  const before = await page.locator('li[data-uploaded="true"] img').getAttribute("src");

  await page.getByRole("button", { name: /^Zakreslit do fotky/ }).click();
  const dialog = page.getByRole("dialog", { name: "Zakreslit do fotky" });
  const canvas = dialog.getByTestId("annotation-canvas");
  await expect(canvas).toBeVisible();
  await dialog.getByRole("button", { name: "Zakroužkovat" }).click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 6 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Šipka" }).click();
  await dialog.getByRole("button", { name: "Barva Žlutá" }).click();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 6 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Zpět" }).click();
  await dialog.getByRole("button", { name: "Šipka" }).click();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 6 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Uložit zákres" }).click();

  await expect(dialog).toBeHidden();
  const photo = page.locator('li[data-uploaded="true"]');
  await expect(photo).toContainText("Se zákresem");
  await expect(page.getByLabel("Popisek fotky")).toHaveValue("Zákres do fotky");
  await expect(photo.locator("img")).not.toHaveAttribute("src", before!);
});

test("revizní protokol do PDF: varianta spotřebič a VTZ", async ({ page, context }) => {
  await page.goto("/equipment/eq-sp-0330?tab=inspections");
  const [appliance] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: "Generovat revizní zprávu (PDF)" }).first().click()]);
  const protocol = appliance.getByTestId("inspection-protocol");
  await expect(protocol).toHaveAttribute("data-variant", "APPLIANCE");
  await expect(protocol).toContainText("Protokol o revizi elektrického spotřebiče");
  await expect(protocol).toContainText("0,22 mA");
  await expect(appliance.getByTestId("protocol-verdict")).toContainText("Zařízení je schopno bezpečného provozu.");
  await expect(protocol).toContainText("Razítko");
  await appliance.close();

  await page.goto("/inspections");
  const row = page.getByRole("row", { name: /RH1/ });
  const [vtz] = await Promise.all([context.waitForEvent("page"), row.getByRole("link", { name: /Generovat revizní zprávu \(PDF\) – RH1/ }).click()]);
  await expect(vtz.getByTestId("inspection-protocol")).toHaveAttribute("data-variant", "VTZ");
  await expect(vtz.getByTestId("inspection-protocol")).toContainText("NV 190/2022 Sb.");
});

test("hlídač lhůt: avízo bez SMTP se uloží do logu s náhledem", async ({ page }) => {
  await page.goto("/inspections/alerts");
  await expect(page.getByTestId("digest-overdue")).toContainText("PV-M1");
  await expect(page.locator('[data-testid^="digest-within"]', { hasText: "R-PLC-ML1" })).toHaveCount(1);
  await page.getByRole("button", { name: "Odeslat souhrnné avízo nyní" }).click();
  await expect(toast(page)).toContainText("Avízo uloženo do logu notifikací.");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Uloženo do logu (bez SMTP)");
  await expect(dialog.getByTestId("digest-email-preview")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("digest-log")).toContainText("Uloženo do logu (bez SMTP)");

  const cron = await page.request.post("/api/cron/inspection-alerts");
  expect(cron.status()).toBe(503);
});

test("hromadný import z Excelu: spárování lokality, hromadné přiřazení a QR kódy", async ({ page }) => {
  await page.goto("/inspections/import");
  await page.getByLabel("…nebo vložte tabulku z Excelu (Ctrl+V)").fill(
    [
      "Název\tEvidenční číslo\tKategorie\tInterval revize (měsíce)\tPoslední revize\tLokace",
      "Konvice E2E\tE2E-SP-01\tSpotřebič\t24\t12.03.2026\tAdministrativa 2. NP kuchyňka",
      "Vrtačka E2E\tE2E-NR-01\tNářadí\t6\t\tdílna u brusky",
      "Lampa\tE2E-X\tSvítidlo\t\t\t",
    ].join("\n"),
  );
  await page.getByRole("button", { name: "Načíst vložená data" }).click();
  await expect(page.getByTestId("import-row")).toHaveCount(3);
  await expect(page.getByLabel("Patro pro E2E-SP-01")).toHaveValue("floor-jbc-k-2np");
  await expect(page.getByLabel("Patro pro E2E-NR-01")).toHaveValue("");
  await expect(page.getByTestId("import-row").nth(2)).toContainText("Neznámá kategorie");

  // Nepřiřazená vrtačka je předvybraná → hromadně do Hala A › 1. NP
  await page.getByLabel("Budova").selectOption("Hala A - Lisovna");
  await page.getByLabel("Patro", { exact: true }).selectOption("floor-jbc-a-1np");
  await page.getByRole("button", { name: "Přiřadit vybraným (1)" }).click();
  await expect(page.getByLabel("Patro pro E2E-NR-01")).toHaveValue("floor-jbc-a-1np");

  await page.getByRole("button", { name: "Importovat 2 zařízení a vygenerovat QR kódy" }).click();
  const result = page.getByTestId("import-result");
  await expect(result).toContainText("Importováno 2 zařízení");
  await expect(result).toContainText(/QR [0-9A-F]{5}-[0-9A-F]{5}/);
  await result.getByRole("link", { name: "E2E-SP-01" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E-SP-01 - Konvice E2E");
  await expect(page.getByTestId("qr-label-url")).toHaveText(/\?qr=[0-9A-F]{10}$/);
});
