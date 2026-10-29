import { expect, test, type Page } from "@playwright/test";

import { pin, startAsAccount, toast } from "./helpers";

// Fáze 19: nový závod od nuly ve Studiu, vícelistová kniha PCSCHEMATIC a diagnostika spojů.

/** Akce až po hydrataci (studený dev server může stránku ještě přenačíst). */
async function whenReady(action: () => Promise<void>, check: () => Promise<void>) {
  await expect(async () => {
    await action();
    await check();
  }).toPass({ timeout: 30_000 });
}

/** Průsečík os rastru 12 × 8 (viewBox 1200 × 800, okraj 70 px) → pozice v plátně v px. */
async function gridPoint(page: Page, row: number, col: number) {
  const box = (await page.getByTestId("studio-grid").boundingBox())!;
  const x = 70 + col * (1050 / 11);
  const y = 70 + row * (690 / 7);
  return { x: box.x + (x / 1200) * box.width, y: box.y + (y / 800) * box.height };
}

test("Studio: úplně nový závod od nuly – čistá mapa, uložení v jedné transakci a přepnutí do závodu", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await page.goto("/plant/plant-jbc");
  await whenReady(
    () => page.getByRole("link", { name: "+ Nový závod od nuly" }).click(),
    () => expect(page.getByTestId("new-plant-fields")).toBeVisible({ timeout: 2_000 }),
  );
  await expect(page.getByRole("radio", { name: /Vytvořit úplně nový závod od nuly/ })).toHaveAttribute("aria-checked", "true");

  await page.getByLabel("Název závodu").fill("Závod Mladá Boleslav – Lakovna");
  await page.getByLabel("Kód závodu").fill("mbl");
  await page.getByLabel("Město / adresa").fill("Průmyslová 3, Mladá Boleslav");
  await page.getByLabel("Šířka areálu [m]").fill("360");
  await expect(page.getByTestId("campus-size")).toHaveText("Areál 360 × 200 m");
  // Čistý oplocený pozemek s vrátnicí – žádné budovy Jablonce
  await expect(page.getByTestId("campus-map")).toContainText("Vrátnice");
  await expect(page.getByTestId("campus-map")).not.toContainText("Hala B");
  await expect(page.getByTestId("campus-map")).not.toContainText("Energetika");
  await expect(page.getByLabel("Název budovy")).toHaveValue("Hala A - Výroba");
  await page.getByRole("button", { name: "Zahodit koncept" }).click();
  await expect(toast(page)).toContainText("Koncept budovy zahozen");
  await page.getByLabel("Název budovy").fill("Hala A - Lakovna");

  await page.getByRole("button", { name: "Další krok" }).click();
  await page.getByRole("button", { name: "Další krok" }).click();

  // První rozváděč nového závodu je kořenový (hlavní) – žádný zdroj napájení zatím neexistuje.
  const at = await gridPoint(page, 1, 8);
  await page.mouse.click(at.x, at.y);
  await expect(page.getByLabel("Tag")).toHaveValue("R-A-01");
  await expect(page.getByRole("checkbox", { name: /Hlavní rozváděč/ })).toBeChecked();
  await page.getByRole("button", { name: "Osadit R-A-01" }).click();

  await page.getByRole("button", { name: "Založit závod a uložit budovu" }).click();
  await expect(toast(page)).toContainText("Závod Mladá Boleslav – Lakovna založen");
  await expect(page).toHaveURL(/\/floor\//);
  await expect(pin(page, "R-A-01")).toBeVisible();

  // Aplikace si nový závod zapamatovala (cookie digitry-plant)
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Závod Mladá Boleslav – Lakovna");
  await expect(page.getByText("Hala A - Lakovna").first()).toBeVisible();
});

test("kniha PCSCHEMATIC: obsah, křížový odkaz /4.6 a diagnostika (propípávač, PLC, fáze)", async ({ page }) => {
  await page.goto("/equipment/eq-rm1?tab=schema");
  const toc = page.getByRole("navigation", { name: "Obsah dokumentace" });
  await expect(toc.getByRole("button")).toHaveCount(7);
  await expect(page.getByTestId("sheet-indicator")).toContainText("List 1 / 6");
  await expect(page.getByTestId("pc-sheet")).toContainText("PCSCHEMATIC");

  await whenReady(
    () => toc.getByRole("button", { name: /Silové schéma/ }).click(),
    () => expect(page.getByTestId("pc-sheet")).toHaveAttribute("data-sheet", "3", { timeout: 2_000 }),
  );
  await page.locator('[data-testid="pc-sheet"] [data-xref="/4.6"]').first().click();
  await expect(page.getByTestId("pc-sheet")).toHaveAttribute("data-sheet", "4");
  await expect(page.getByTestId("sheet-column-highlight")).toHaveAttribute("data-column", "6");
  await expect(page).toHaveURL(/sheet=4&col=6/);

  await toc.getByRole("button", { name: /Původní výkres revize/ }).click();
  await expect(page.getByRole("link", { name: "Stáhnout" })).toBeVisible();

  // Diagnostika & spoje
  await page.getByRole("tab", { name: "🔍 Diagnostika & Spoje (Údržba)" }).click();
  await page.getByLabel("Svorka, vodič nebo přístroj").fill("X1:U");
  const hits = page.getByTestId("trace-hit");
  await expect(hits).toHaveCount(2);
  await expect(hits.nth(1)).toContainText("-X1:U → -M1:U1");
  await expect(hits.nth(1)).toContainText("-W1");
  await page.getByLabel("Svorka, vodič nebo přístroj").fill("18");
  await expect(hits).toHaveCount(1);

  await page.getByLabel("PLC adresa nebo signál").fill("ALARM_ON_1");
  await expect(page.getByTestId("plc-hit")).toHaveCount(1);
  await expect(page.getByTestId("plc-hit")).toContainText("DO2");
  await expect(page.getByTestId("plc-hit")).toContainText("Relay");

  await expect(page.getByTestId("phase-recommendation")).toContainText(/Nejmenší zatížení je na fázi L\d \(rezerva/);
  await page.getByLabel("Nový jednofázový okruh [A]").fill("10");
  await expect(page.getByTestId("phase-recommendation")).toContainText(/Nový okruh 10 A připojte na L\d/);

  // Proklik z výsledku propípávače do listu
  await page.getByLabel("Svorka, vodič nebo přístroj").fill("X1:U");
  await hits.nth(1).getByRole("button", { name: /Otevřít list 3, sloupec 5/ }).click();
  await expect(page.getByTestId("pc-sheet")).toHaveAttribute("data-sheet", "3");
  await expect(page.getByTestId("sheet-column-highlight")).toHaveAttribute("data-column", "5");
});
