import { expect, test } from "@playwright/test";

import { startAs } from "./helpers";

// Fáze 53: prediktivní životnost součástek (B10d, motohodiny, Arrhenius), zatížení přívodního kabelu
// dle ČSN 33 2000-5-52 ed. 2 se simulátorem nového stroje, pavouk napájení s % Iz a hlídač.
test.describe.configure({ mode: "serial" });

const HALL_B_1NP = "/plant/plant-jbc/building/bld-jbc-b/floor/floor-jbc-b-1np";

test("⏳ R-CNC-04: zdroj -T1 po Arrheniovi 🔴, nejištěný přívod, simulátor a výměna filtru na 1 klik", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await startAs(page, "MAINTENANCE");
  await expect(async () => {
    await page.goto("/equipment/eq-r-cnc-04?tab=diagnostics");
    await expect(page.getByTestId("component-lifespan")).toBeVisible({
      timeout: 5_000,
    });
  }).toPass({ timeout: 90_000 });
  await expect(page.getByTestId("health-wear-badge")).toBeVisible();
  await expect(page.getByTestId("health-cable-badge")).toContainText(
    "Přetížený / nejištěný přívod",
  );

  const lifespan = page.getByTestId("component-lifespan");
  const psu = lifespan.locator('[data-component="-T1"]');
  await expect(psu).toHaveAttribute("data-status", "CRITICAL_EXPIRED");
  await expect(psu.getByTestId("arrhenius")).toContainText(
    "z 50 000 h na 28 717 h",
  );
  await expect(psu.getByTestId("lifespan-stock")).toHaveText(
    "⚠️ Chybí na skladě!",
  );
  await expect(lifespan.locator('[data-component="-U1"]')).toHaveAttribute(
    "data-status",
    "OK",
  );

  // Přívodní kabel: In 125 A > Iz po korekci seskupením a teplotou
  const feeder = page.getByTestId("feeder-cable");
  await expect(feeder.getByTestId("feeder-summary")).toContainText(
    "RM1 ➔ R-CNC-04",
  );
  await expect(feeder.getByTestId("cable-message").first()).toContainText(
    "NEJIŠTĚNÝ KABEL: Jistič In (125 A)",
  );

  // Simulátor: +30 kW → dopad na přívod, hlavní rozváděč RM1 i transformátor TR1
  const simulator = page.getByTestId("load-simulator");
  await simulator.getByLabel("Nový stroj [kW]").fill("30");
  await expect(simulator.getByTestId("simulator-amps")).toContainText(
    "+48,1 A",
  );
  await expect(simulator.locator("[data-sim]")).toHaveCount(3);
  await expect(simulator.locator('[data-sim="R-CNC-04"]')).toHaveAttribute(
    "data-status",
    "CRITICAL",
  );
  await expect(simulator.locator('[data-sim="TR1"]')).toBeVisible();

  // Výměna filtrační vložky = reset 0 %, odpis ze skladu
  const filter = lifespan.locator('[data-component="-FAN1"]');
  await expect(filter).toHaveAttribute("data-status", "CRITICAL_EXPIRED");
  await filter
    .getByRole("button", { name: /Zapsat výměnu kusu za nový/ })
    .click();
  await expect(lifespan.locator('[data-component="-FAN1"]')).toHaveAttribute(
    "data-status",
    "OK",
    { timeout: 15_000 },
  );
  await expect(
    lifespan
      .locator('[data-component="-FAN1"]')
      .getByTestId("lifespan-percent"),
  ).toContainText("0 %");
  await expect(
    lifespan.locator('[data-component="-FAN1"]').getByTestId("lifespan-stock"),
  ).toHaveText("Skladem: 3 ks");
  await page.screenshot({
    path: "test-results/phase53-cnc.png",
    fullPage: true,
  });
});

test("🟡 R-LIS-01: stykač -K1 před výměnou, přívod s nízkou rezervou, hlídač a pavouk napájení", async ({
  page,
}) => {
  await startAs(page, "MAINTENANCE");
  await expect(async () => {
    await page.goto("/equipment/eq-r-lis-01?tab=diagnostics");
    await expect(page.getByTestId("component-lifespan")).toBeVisible({
      timeout: 5_000,
    });
  }).toPass({ timeout: 90_000 });
  await expect(page.locator('[data-component="-K1"]')).toHaveAttribute(
    "data-status",
    "PLAN_REPLACEMENT",
  );
  await expect(
    page.locator('[data-component="-K_SAF1"]').getByTestId("lifespan-percent"),
  ).toContainText("42");
  await expect(page.getByTestId("cable-load")).toContainText("🟡 Vytížení");

  await page.goto("/inspections/alerts");
  await expect(page.getByTestId("badge-components")).toContainText(
    /Součástky před koncem životnosti \([1-9]/,
  );
  await expect(page.getByTestId("badge-cables")).toContainText(
    "Přetížené / nejištěné kabely (1)",
  );

  await page.goto(HALL_B_1NP);
  const toggle = page.getByRole("button", {
    name: /Zobrazit pavouka napájení/,
  });
  await expect(async () => {
    await toggle.click();
    await expect(page.getByTestId("power-spider")).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 30_000 });
  await expect(page.locator('[data-spider-cable="OK"]').first()).toContainText(
    "% Iz",
  );
});
