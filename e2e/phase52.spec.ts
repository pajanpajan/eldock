import { expect, test } from "@playwright/test";

// Fáze 52: metodika ČSN 33 2130 ed. 4 – úroveň instalace a uložení kabelů v 2D půdorysu, světla na RCBO
// typ A, CYKY-J ke každému vypínači v retrofitu, soupis místností s úrovní instalace a legislativní
// rámec + protokol o určení vnějších vlivů v elaborátu.
test.describe.configure({ mode: "serial" });

test("📐 2D půdorys: retrofit = CYKY-J k vypínači, světla na RCBO typ A, Iz a Zs okruhu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({
      timeout: 5_000,
    });
  }).toPass({ timeout: 90_000 });
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", {
    name: "Paleta elektroinstalačních značek",
  });
  const place = async (label: string, ...points: [number, number][]) => {
    await palette
      .getByRole("button", { name: label, exact: false })
      .first()
      .click();
    for (const [x, y] of points) await canvas.click({ position: { x, y } });
    await page.keyboard.press("Escape");
  };
  await expect(
    palette.getByRole("button", { name: /ABB řazení 1SSo/ }),
  ).toBeVisible();
  await place("Hlavní domovní / bytový rozváděč", [40, 40]);
  await place("Stropní svítidlo", [300, 260]);
  await place("Vypínač č. 1", [160, 220]);
  await canvas.getByRole("button", { name: /^Vypínač č\. 1/ }).click();
  await page.getByRole("button", { name: "🔗 Přiřadit ke světlu" }).click();
  await canvas.getByRole("button", { name: /^Stropní svítidlo/ }).click();
  await page.keyboard.press("Escape");

  // Klasika: svod CYKY-O; světla B10 na RCBO typ A 30 mA s Iz a impedancí smyčky
  await expect(page.getByTestId("cable-buy")).toContainText("CYKY-O 3×1,5");
  await expect(page.getByTestId("circuit-protection").first()).toContainText(
    "RCBO B10 typ A 30 mA · Iz 19,5 A · Zs",
  );

  // Retrofit: v každé krabici vypínače N → CYKY-J, žádné CYKY-O
  const methodology = page.getByTestId("install-methodology");
  await methodology
    .getByLabel("Úroveň instalace")
    .selectOption("smart_retrofit");
  await expect(page.getByTestId("cable-buy")).not.toContainText("CYKY-O");
  await expect(page.getByTestId("cable-buy")).toContainText("CYKY-J 3×1,5");

  // Uložení A2 (tepelná izolace) → Iz 1,5 mm² = 14 A
  await methodology.getByLabel("Způsob uložení kabelů").selectOption("A2");
  await expect(page.getByTestId("circuit-protection").first()).toContainText(
    "Iz 14 A",
  );
  await page.screenshot({
    path: "test-results/phase52-floorplan.png",
    fullPage: true,
  });
});

test("🏠 soupis místností: úroveň instalace retrofit, světla na RCBO a vnější vlivy v elaborátu", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1200 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await page
      .getByRole("button", { name: "Nový projekt rozváděče" })
      .click({ timeout: 5_000 });
    await expect(page.getByTestId("project-modes")).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 90_000 });
  await page.getByRole("button", { name: /Ze soupisu místností/ }).click();
  await page.getByLabel("Úroveň instalace").selectOption("smart_retrofit");
  await expect(page.getByText(/hluboké krabice min\. 65 mm/)).toBeVisible();
  await page.getByLabel("Uložení kabelů").selectOption("B2");
  await expect(
    page.getByLabel(/Počítat dvojzásuvku jako 2 zásuvky/),
  ).toBeChecked();
  await page.getByLabel("Název rozváděče").fill("RD52 retrofit");
  await page
    .getByRole("button", { name: "🏠 Vygenerovat rozváděč", exact: true })
    .click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "RD52 retrofit",
  );
  // -FA1 lednice, -FA2… světelné okruhy na RCBO typ A
  await expect(page.getByTestId("symbol--FA2")).toBeVisible();

  await page.goto(page.url() + "/documentation");
  await expect(page.getByTestId("doc-legal")).toContainText(
    "Vyhláška č. 131/2024 Sb.",
    { timeout: 30_000 },
  );
  await expect(page.getByTestId("doc-legal")).toContainText(
    "Nařízení vlády č. 190/2022 Sb.",
  );
  const influences = page.getByTestId("doc-influences");
  await expect(influences).toContainText(
    "Protokol o určení vnějších vlivů dle TNI 33 2000-5-51:2022",
  );
  await expect(influences.locator("[data-influence]")).toHaveCount(15);

  await page.getByTestId("delete-project").click();
  await expect(page).toHaveURL(/\/panel-builder$/, { timeout: 30_000 });
});
