import { expect, test } from "@playwright/test";

// Fáze 55: vzorový elaborát se stromem a sběrnicemi PE / N, horní lišta půdorysu s řadami ABB 2026, značky a kusovník.

test.describe("fáze 55 – veřejná ukázka", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("vzorový elaborát PB-001: úplné jednopólové schéma a sběrnice PE / N v kusovníku", async ({ page }) => {
    await page.goto("/ukazka-elaboratu");
    await expect(page.getByTestId("doc-parts")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Nezapojeno ve stromu/)).toHaveCount(0);
    await expect(page.getByTestId("doc-parts")).toContainText("PE sběrnice");
    await expect(page.getByTestId("doc-parts")).toContainText("N můstek");
  });
});

test("🎨 2D půdorys: horní lišta s řadami ABB 2026, barvy podle řady, soustava, značky a kusovník s objednacími čísly", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });

  // Lišta je nad plátnem, paleta vlevo už výběr řady neobsahuje
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  await expect(palette.getByTestId("device-appearance")).toHaveCount(0);
  await page.getByTestId("wizard-step-2").click();
  const appearance = page.getByTestId("device-appearance");
  // Fáze 74: barvy klapky / krytu (řada barev rámečku pod ní má stejné názvy)
  const insert = appearance.getByTestId("insert-colors");
  await appearance.getByRole("radio", { name: "Levit M" }).click();
  await expect(insert.getByRole("radio", { name: /Onyx \/ kouřová černá \(63\)/ })).toBeVisible();
  await expect(insert.getByRole("radio", { name: /Bílá \(500\)/ })).toHaveCount(0);
  await appearance.getByRole("radio", { name: "Zoni" }).click();
  await expect(insert.getByRole("radio", { name: /Pudrová \/ bílá \(242\/142\)/ })).toBeVisible();
  await expect(insert.getByRole("radio", { name: /Bílá \(500\)/ })).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("floorplan-supply").selectOption("1F_TNS");

  // Zásuvka a vypínač jako elektrotechnické značky
  const canvas = page.getByTestId("floorplan-canvas");
  await palette.getByRole("button", { name: "Jednozásuvka" }).click();
  await canvas.click({ position: { x: 200, y: 200 } });
  await palette.getByRole("button", { name: /Vypínač č\. 1 \(jednopólový\)/ }).click();
  await canvas.click({ position: { x: 260, y: 200 } });
  await page.keyboard.press("Escape");
  await expect(canvas.locator('[data-symbol="socket"]')).toHaveCount(1);
  await expect(canvas.locator('[data-symbol="switch"]')).toHaveCount(1);

  // Kusovník s objednacími čísly Zoni bílá 500
  await page.getByTestId("wiring-bom-open").click();
  const table = page.getByTestId("wiring-bom-table");
  await expect(table).toContainText("6619T-A06657 500");
  await expect(table).toContainText("3559-A01345");
  await expect(table).toContainText("3559T-A00651 500");
  await expect(table).toContainText("3901T-A00010 500");
  // Fáze 91: instalační krabice v samostatné tabulce – zásuvka KU 68-45 (náhrada KU 68-1901), vypínač hluboká KPR 68 (WAGO)
  const boxes = page.getByTestId("wiring-bom-boxes-table");
  await expect(boxes).toContainText("KU 68-45_KA");
  await expect(boxes).toContainText("KPR 68_KA");
  await page.screenshot({ path: "test-results/phase55-floorplan.png", fullPage: true });
});
