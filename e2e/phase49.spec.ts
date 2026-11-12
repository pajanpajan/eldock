import { goPhase, phaseForPalette, rightTab } from "./floorplan-phases";
import { expect, test } from "@playwright/test";

// Fáze 49: 2D půdorys elektroinstalace – osazení značek, párování vypínače se světlem, výkaz kabeláže
// ve 3 režimech vedení, montážní výška prvku a rozváděč z půdorysu na 1 klik (výkaz v dokumentaci).
test.describe.configure({ mode: "serial" });

test("📐 2D půdorys: osazení, párování, výkaz kabeláže Spodem / Vrchem / Optimalizovaně a ⚡ rozváděč na 1 klik", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  // Odkaz z horní lišty Panel Builderu
  await expect(page.getByTestId("panel-builder-header").getByRole("link", { name: "📐 2D Půdorys & Kabeláž" })).toBeVisible();

  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  const place = async (label: string, ...points: [number, number][]) => {
    // Fáze 98: značka je v paletě své fáze (rozváděč 2, zásuvky 3, světla a vypínače 4)
    await phaseForPalette(page, label);
    await palette.getByRole("button", { name: label, exact: false }).first().click();
    for (const [x, y] of points) await canvas.click({ position: { x, y } });
    await page.keyboard.press("Escape");
  };
  // Fáze 98: výkaz kabeláže je v pravém panelu fáze 5; fáze 100 – v záložce 🔌 Okruhy & Trasy
  await goPhase(page, 5);
  await rightTab(page, "circuits");
  await expect(page.getByTestId("cable-empty")).toContainText("rozváděč");
  await place("Hlavní domovní / bytový rozváděč", [40, 40]);
  await place("Dvojzásuvka", [260, 80], [360, 80]);
  await place("Stropní svítidlo", [300, 260]);
  await place("Vypínač č. 1", [160, 220]);
  await place("Trouba", [500, 420]);

  // Párování vypínače se světlem (čárkovaná ovládací vazba + řazení) – fáze 98: ve fázi 5 jsou aktivní všechny prvky
  await goPhase(page, 5);
  await canvas.getByRole("button", { name: /^Vypínač č\. 1/ }).click();
  await page.getByRole("button", { name: "🔗 Přiřadit ke světlu" }).click();
  await canvas.getByRole("button", { name: /^Stropní svítidlo/ }).click();
  await expect(page.getByTestId("switch-link")).toHaveCount(1);
  await expect(page.getByTestId("switch-controls")).toContainText("řazení 1");
  await page.keyboard.press("Escape");

  // Výkaz kabeláže: 3 režimy, rozpis kabelů a trasy nad půdorysem
  await rightTab(page, "circuits");
  const totals = page.getByTestId("cable-totals");
  await expect(totals.locator("[data-mode]")).toHaveCount(3);
  await expect(page.getByTestId("cable-buy")).toContainText("CYKY-J 3×2,5");
  // Fáze 105: přívod světel do krabice vypínače a svod ke světlu (řazení 1) = CYKY-J 3×1,5 s rozpadem délky okruhu
  await expect(page.getByTestId("cable-buy")).toContainText("CYKY-J 3×1,5");
  await expect(page.getByTestId("circuit-breakdown").first()).toContainText("svislé svody k vypínačům a rozváděči");
  await expect(page.getByTestId("cable-route").first()).toBeVisible();
  // Fáze 98: směrování tras v levé paletě fáze 5
  await goPhase(page, 5);
  await rightTab(page, "circuits");
  await page.getByRole("radio", { name: /Spodem \(v podlaze\)/ }).click();
  await expect(totals.locator('[data-mode="BOTTOM"]')).toHaveClass(/border-primary/);
  await page.getByRole("radio", { name: /Optimalizovaně \(Auto\)/ }).click();

  // Montážní výška dvojzásuvky 300 → 1150 mm změní metráž vedení spodem
  const bottom = totals.locator('[data-mode="BOTTOM"]');
  const before = await bottom.textContent();
  await canvas.getByRole("button", { name: /^Dvojzásuvka/ }).first().click();
  await page.getByLabel("Montážní výška [mm]").fill("1150");
  // Fáze 100: klik na zásuvku otevřel záložku Detail – výkaz je v záložce Okruhy & Trasy
  await rightTab(page, "circuits");
  await expect(bottom).not.toHaveText(before ?? "");
  await page.screenshot({ path: "test-results/phase49-floorplan.png", fullPage: true });

  // ⚡ Rozváděč z půdorysu → projekt s výkazem kabeláže v dokumentaci (fáze 100: záložka ⚡ Kusovník & Rozváděč)
  await rightTab(page, "bom");
  await page.getByLabel("Název rozváděče").fill("RD49 z půdorysu");
  // Fáze 57: bez prostředí dle ČSN 33 2000-5-51 ed. 3 nelze generovat
  await expect(page.getByTestId("generate-from-floorplan")).toBeDisabled();
  await page.getByTestId("floorplan-environment").selectOption("INDOOR_DRY");
  await page.getByTestId("generate-from-floorplan").click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD49 z půdorysu");
  await expect(page.getByTestId("symbol--Q1")).toBeVisible();
  // Fáze 64: „📐 Upravit půdorys“ otevře tentýž uložený půdorys s odkazem na vygenerovaný rozváděč
  const projectUrl = page.url();
  await page.getByTestId("open-floorplan").click();
  await expect(page).toHaveURL(/\/panel-builder\/floorplan\/(?!novy)[\w-]+$/, { timeout: 60_000 });
  await expect(page.getByTestId("floorplan-project-link")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("floorplan-canvas")).toBeVisible();
  await page.goto(projectUrl + "/documentation");
  await expect(page.getByTestId("doc-cables")).toContainText("Výkaz kabeláže", { timeout: 30_000 });
  await expect(page.getByTestId("doc-cables")).toContainText("CYKY-J 3×2,5");

  // Úklid: smazání vrátí kredit
  await page.getByTestId("delete-project").click();
  await expect(page).toHaveURL(/\/panel-builder$/, { timeout: 30_000 });
});
