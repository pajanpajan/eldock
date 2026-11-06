import path from "node:path";

import { expect, test } from "@playwright/test";

import { startAsAccount } from "./helpers";

// Fáze 47: duplikace a vložení prvku vpravo, kompaktní linter, detailní fotka lišty (pravidlo F),
// ventilátor skříně v kroku oteplení a domovní přístroje ve Studiu.
test.describe.configure({ mode: "serial" });

const PHOTO = path.resolve("e2e", "fixtures", "rozvadec.png");

test("➕ přidat vpravo a 📑 duplikovat prvek, linter jako odznak, ventilátor v oteplení", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1500 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(async () => {
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
    await expect(page.getByLabel("Název rozváděče")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Název rozváděče").fill("Rozvodnice RD47 – dílna");
  await page.getByRole("button", { name: "📐 Založit návrh rozváděče" }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });

  const menu = page.getByRole("region", { name: "Konfigurátor prvku" });
  const card = page.getByTestId("placement-card");
  await menu.getByRole("button", { name: "ABB", exact: true }).click();
  await menu.getByRole("button", { name: "Zásuvky", exact: true }).click();
  await card.getByTestId("insert-1").click();
  await expect(page.getByTestId("symbol--F1")).toBeVisible();

  // Linter je jen malý odznak; detaily až po rozkliknutí
  const badge = page.getByTestId("linter-badge");
  await expect(badge).toContainText(/\d+ doporučení/);
  await expect(page.locator('[data-rule="rcd-missing"]')).toHaveCount(0);
  await badge.click();
  await expect(page.locator('[data-rule="rcd-missing"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-rule="rcd-missing"]')).toHaveCount(0);

  // Duplikovat → -F2 se stejným kusem (fáze 59: kopie se nevybere); přidat vpravo → vložení z palety za vybraný přístroj
  await page.getByTestId("vector-panel").getByRole("button", { name: /^-F1 / }).click();
  const configurator = page.getByTestId("item-configurator");
  await configurator.getByRole("button", { name: "📑 Duplikovat prvek" }).click();
  await expect(page.getByTestId("symbol--F2")).toBeVisible();
  await expect(page.getByTestId("vector-selected")).toHaveCount(0);
  await expect(page.getByTestId("configurator-mode")).toHaveText("➕ Vložit nový přístroj");
  await page.getByTestId("vector-panel").getByRole("button", { name: /^-F1 / }).click();
  await page.getByTestId("item-configurator").getByRole("button", { name: "➕ Přidat prvek vpravo" }).click();
  await expect(page.getByTestId("insert-target")).toContainText("vpravo od -F1");
  await page.getByTestId("placement-card").getByTestId("insert-1").click();
  await expect(page.getByTestId("vector-panel").locator("[data-symbol]")).toHaveCount(3);
  await expect(page.getByTestId("vector-selected")).toHaveCount(0);
  await expect(page.getByTestId("insert-target")).toHaveCount(0);

  // Krok oteplení: ventilátor skříně s potřebným průtokem a výběrem z katalogu
  await page.goto(page.url() + "/thermal");
  const fan = page.getByTestId("fan-panel");
  await expect(fan).toBeVisible({ timeout: 30_000 });
  await expect(fan.getByTestId("fan-need")).toContainText("V = 3,1 · Q / ΔT");
  await fan.getByLabel("Ventilátor skříně").selectOption({ index: 1 });
  await expect(fan.getByTestId("fan-detail")).toContainText("m³/h");
  await page.reload();
  await expect(page.getByTestId("fan-panel").getByLabel("Ventilátor skříně")).not.toHaveValue("");
});

test("pravidlo F: detailní fotka lišty v demo režimu se uloží jako náhled, prvky zůstanou", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1500 });
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("PB-001");
  const symbols = page.getByTestId("vector-panel").locator("[data-symbol]");
  const before = await symbols.count();
  await expect(page.getByRole("button", { name: /Nahrát detailní fotku této lišty/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nahrát detailní fotku lišty 1" })).toBeVisible();
  await page.getByLabel("Lišta pro detailní fotku").selectOption("2");
  await page.getByTestId("rail-photo-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("rail-photos")).toContainText("Lišta 2", { timeout: 30_000 });
  await expect(symbols).toHaveCount(before);
});

test("Studio: domovní přístroje ABB jako vlastní kategorie kroku 3 (do místnosti)", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await page.goto("/studio");
  await expect(async () => {
    await page.getByRole("button", { name: "Otevřít budovu: Administrativa" }).click();
    await expect(page.getByTestId("building-title")).toContainText("Administrativa", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("radiogroup", { name: "Místnosti patra" }).getByRole("radio", { name: "Kuchyňka" }).click();
  await page.getByTestId("eq-banner-DI").click();
  const tiles = page.getByRole("radiogroup", { name: "Produktové šablony" });
  await expect(tiles.getByRole("radio", { name: /Zásuvka 230 V – ABB Tango \(5518A-A2359 B\)/ })).toBeVisible();
  await expect(tiles.getByRole("radio", { name: /Dvojzásuvka – ABB Levit/ })).toBeVisible();
});
