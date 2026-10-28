import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { pin, startAs, switchRole, toast } from "./helpers";

// Celá smyčka přes přepínač rolí: Údržba zadá (zákres myší + fotka) → CAE převezme a nahraje
// revizi → Údržba vrátí s komentářem → CAE nahraje znovu → Údržba schválí → archiv.

test.describe.configure({ mode: "serial" });

const EQUIPMENT = "/equipment/eq-r-ml-01";
const FLOOR = "/plant/plant-jbc/building/bld-jbc-b/floor/floor-jbc-b-1np";
const PHOTO = path.resolve("e2e", "fixtures", "rozvadec.png");
const REJECT_REASON = "Chybí přečíslování svorky X2:5 po výměně stykače.";

async function expectPin(page: Page, status: RegExp) {
  await page.goto(FLOOR);
  await expect(pin(page, "R-ML-01")).toHaveAttribute("aria-label", status);
}

async function openTicket(page: Page) {
  await page.goto("/cae");
  await page.getByRole("row", { name: /R-ML-01/ }).getByRole("link").click();
  await expect(page).toHaveURL(/\/cae\/tickets\/[^/]+$/);
}

async function uploadRevision(page: Page, summary: string) {
  await page.getByRole("link", { name: "Nahrát novou revizi" }).click();
  await expect(page).toHaveURL(/\/revision$/);
  await page.getByLabel(/Technické shrnutí/).fill(summary);
  await page.getByRole("button", { name: "Vygenerovat upravené schéma" }).click();
  await expect(page.getByRole("img", { name: /Náhled schématu/ })).toBeVisible();
  await page.getByRole("button", { name: "Odeslat ke schválení" }).click();
  await expect(page).toHaveURL(/\/cae\/tickets\/[^/]+$/);
  await expect(toast(page)).toContainText("čeká na schválení údržbou");
}

test("údržba zadá → CAE nahraje → údržba vrátí → CAE nahraje znovu → údržba schválí", async ({ page }) => {
  await startAs(page, "MAINTENANCE");

  // 1) Údržba: průvodce „Zadat změnu“.
  await page.goto(EQUIPMENT);
  await page.getByRole("link", { name: "Zadat změnu" }).click();
  await expect(page).toHaveURL(/\/change-request$/);

  // Zákres myší – kroužek kolem části schématu.
  const canvas = page.getByLabel("Plocha pro zákres – kreslete prstem, perem nebo myší");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width * 0.3;
  const cy = box.y + box.height * 0.5;
  await page.mouse.move(cx + 40, cy);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(t) * 40, cy + Math.sin(t) * 30);
  }
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Vymazat zákres" })).toBeEnabled();
  await page.getByRole("button", { name: "Další" }).click();

  // Fotka z fixture.
  await page.getByTestId("photo-input").setInputFiles(PHOTO);
  await expect(page.locator('li[data-uploaded="true"]')).toHaveCount(1, { timeout: 20_000 });
  await page.getByLabel("Popisek fotky").fill("Nový stykač K2");
  await page.getByRole("button", { name: "Další" }).click();

  // Poznámka a odeslání.
  await page.locator("#change-note").fill("Vyměněn stykač K2 za Siemens 3RT2026, svorka X2:5 přeznačena.");
  await page.getByRole("button", { name: "Další" }).click();
  await page.getByRole("button", { name: "Odeslat do CAE" }).click();
  await expect(page).toHaveURL(new RegExp(`${EQUIPMENT}$`));
  await expect(toast(page)).toContainText("ZM-2026-0043");
  const banner = page.getByRole("alert", { name: "Výstraha: nahlášená změna" });
  await expect(banner).toContainText("Vyměněn stykač K2");
  await expect(banner.getByRole("button", { name: /Nový stykač K2/ })).toBeVisible();
  await expectPin(page, /Čeká na aktualizaci/);

  // 2) CAE: ticket na dashboardu, převzetí a nová revize v1.3.
  await switchRole(page, "CAE_ENGINEER");
  await expect(page).toHaveURL(/\/cae$/);
  await expect(page.getByRole("row", { name: /ZM-2026-0043/ })).toContainText("Nová");
  await openTicket(page);
  await page.getByRole("button", { name: "Převzít" }).click();
  await expect(toast(page)).toContainText("převzat");
  await expect(page.getByRole("list", { name: "Historie ticketu" })).toContainText("Převzato");
  await uploadRevision(page, "Stykač K2 nahrazen typem Siemens 3RT2026.");
  await switchRole(page, "MAINTENANCE");
  await expectPin(page, /Čeká na schválení/);

  // 3) Údržba: porovnání a vrácení s povinným komentářem.
  await page.goto(EQUIPMENT);
  await page.getByRole("link", { name: "Zkontrolovat novou revizi" }).click();
  await expect(page).toHaveURL(/\/approve$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("v1.3");
  await page.getByRole("button", { name: "Vrátit k přepracování" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Vrátit k přepracování" })).toBeDisabled();
  await dialog.getByLabel(/Důvod vrácení/).fill(REJECT_REASON);
  await dialog.getByRole("button", { name: "Vrátit k přepracování" }).click();
  await expect(toast(page)).toContainText("vrácena k přepracování");
  await expectPin(page, /Čeká na aktualizaci/);

  // 4) CAE: komentář v timeline, nová revize v1.4.
  await switchRole(page, "CAE_ENGINEER");
  await openTicket(page);
  await expect(page.getByRole("list", { name: "Historie ticketu" })).toContainText(REJECT_REASON);
  await uploadRevision(page, "Stykač K2 nahrazen, svorka X2:5 přečíslována.");

  // 5) Údržba: schválení → zelená, archiv.
  await switchRole(page, "MAINTENANCE");
  await page.goto(`${EQUIPMENT}/approve`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("v1.4");
  await page.getByRole("button", { name: "Potvrdit a propsat do systému" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Potvrdit a propsat", exact: true }).click();
  await expect(page).toHaveURL(/tab=history/);
  await expect(toast(page)).toContainText("v1.4 je platná");

  const history = page.getByRole("list", { name: "Historie revizí" });
  await expect(history.locator("> li").nth(0)).toContainText("v1.4");
  await expect(history.locator("> li").nth(0)).toContainText("Platná");
  await expect(history.locator("> li").nth(1)).toContainText("Vrácená");
  await expect(history.locator("> li").nth(1)).toContainText(REJECT_REASON);
  await expect(history.locator("> li").nth(2)).toContainText("v1.2");
  await expect(history.locator("> li").nth(2)).toContainText("Archiv");
  await expectPin(page, /Aktuální/);
});
