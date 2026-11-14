import { expect, test, type Page } from "@playwright/test";

import { startAsAccount } from "./helpers";

// Fáze 108: průmyslová část – nová hala z průvodce se nepřekryje se stávajícími budovami a jde upravit i smazat
// (seznam na mapě, hlavička podlaží), vycentrované podlaží s tlačítkem „+ Přidat rozváděč nebo stroj“, Chytrá revize
// (horizont 30 / 60 / 90 / 180 dnů) na mapě závodu, podlaží, /inspections a plánovači, formulář revizního technika
// (profil TIČR, měření na 1 klik, podpis, PIN, pečeť SHA-256) a měsíční report TIČR se zneplatněním záznamu.
test.describe.configure({ mode: "serial" });

const PLANT = "/plant/plant-jbc";
const HALL_A_1NP = "/plant/plant-jbc/building/bld-jbc-a/floor/floor-jbc-a-1np";
const BOARD = "/equipment/eq-rp-adm2";
const HALL = `Hala 108 ${Date.now().toString().slice(-5)}`;

type Rect = { x: number; y: number; w: number; h: number };
const bounds = (points: string): Rect => {
  const pairs = points.trim().split(/\s+/).map((pair) => pair.split(",").map(Number));
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

async function open(page: Page, url: string, ready: ReturnType<Page["getByTestId"]>) {
  await expect(async () => {
    await page.goto(url);
    await expect(ready).toBeVisible({ timeout: 20_000 });
  }).toPass({ timeout: 180_000 });
}

test("🏭 nová hala z průvodce se nepřekryje, jde upravit ze seznamu a smazat z hlavičky podlaží", async ({ page }) => {
  test.setTimeout(300_000);
  await startAsAccount(page, "acc-dvorak");
  // `?pruvodce=zavod` otevře rovnou dialog „Rychlý průvodce založením závodu“ (režim A)
  await open(page, `${PLANT}?pruvodce=zavod`, page.getByTestId("onboarding-build"));
  await expect(page.getByTestId("onboarding-build")).toHaveAttribute("data-step", "1");
  await page.getByLabel("Název první výrobní haly").fill(HALL);
  await page.getByTestId("onboarding-hall-submit").click();
  await expect(page.getByTestId("onboarding-hall-done")).toBeVisible({ timeout: 60_000 });

  // Mapa areálu: nová hala neleží přes žádnou stávající budovu
  await open(page, PLANT, page.getByTestId("campus-building").first());
  const card = page.getByTestId("building-card").filter({ hasText: HALL });
  await expect(card).toBeVisible();
  const code = (await card.getAttribute("data-building"))!;
  const shapes = await page.getByTestId("campus-building").evaluateAll((nodes) => nodes.map((node) => ({ code: node.getAttribute("data-code"), polygon: node.getAttribute("data-polygon") ?? "" })));
  const mine = shapes.find((shape) => shape.code === code)!;
  for (const other of shapes.filter((shape) => shape.code !== code)) expect(overlap(bounds(mine.polygon), bounds(other.polygon)), `${code} × ${other.code}`).toBe(false);

  // ✏️ Upravit ze seznamu budov na mapě
  await card.getByRole("button", { name: `Upravit budovu ${HALL}` }).click();
  const edit = page.getByTestId("building-edit-dialog");
  await edit.getByTestId("building-edit-name").fill(`${HALL} – upravená`);
  await edit.getByTestId("building-edit-save").click();
  await expect(edit).toBeHidden({ timeout: 30_000 });
  const renamed = page.getByTestId("building-card").filter({ hasText: `${HALL} – upravená` });
  await expect(renamed).toBeVisible({ timeout: 30_000 });

  // Podlaží nové haly: vycentrovaná stránka, tlačítko pro rozváděč / stroj, hlavička s úpravou a smazáním budovy
  await renamed.getByRole("link").first().click();
  await expect(page.getByTestId("floor-page")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("floor-add-equipment")).toContainText("Přidat rozváděč nebo stroj na toto podlaží");
  await expect(page.getByTestId("floor-add-equipment")).toHaveAttribute("href", /\/studio\?plant=plant-jbc&building=.+&floor=.+/);
  await expect(page.getByTestId("back-to-plant")).toContainText("Zpět na mapu závodu");
  const width = await page.getByTestId("floor-page").evaluate((node) => getComputedStyle(node).maxWidth);
  expect(width).toBe("1600px");
  await page.screenshot({ path: "test-results/phase108-new-hall-floor.png", fullPage: true });

  await page.getByTestId("building-header-delete").click();
  const remove = page.getByTestId("building-delete-dialog");
  await expect(remove.getByTestId("building-delete-impact")).toBeVisible({ timeout: 30_000 });
  // Hala z průvodce má hlavní rozváděč → smazání jen po opsání názvu budovy
  await expect(remove.getByTestId("building-delete-submit")).toBeDisabled();
  await remove.getByTestId("building-delete-confirm").fill(`${HALL} – upravená`);
  await remove.getByTestId("building-delete-submit").click();
  await expect(page).toHaveURL(/\/plant\/plant-jbc(\?.*)?$/, { timeout: 60_000 });
  await expect(page.getByTestId("building-card").filter({ hasText: HALL })).toHaveCount(0, { timeout: 30_000 });
});

test("🧠 Chytrá revize v /revize, v agendě 4 závodu, /inspections i v plánovači (fáze 115: ne na mapě ani v podlaží) – horizont 30 / 60 / 90 / 180 dnů", async ({ page }) => {
  test.setTimeout(300_000);
  await startAsAccount(page, "acc-novotny");
  const trip = page.getByTestId("trip-optimizer");
  await open(page, "/inspections", trip);
  await expect(trip).toHaveAttribute("data-state", "active");
  await expect(trip).toContainText("🧠 Chytrá revize – Optimalizace výjezdu revizního technika:");
  await expect(page.getByTestId("trip-summary")).toContainText("kvůli 1 neodkladné revizi");
  const count = async (horizon: number) => {
    await page.getByTestId(`trip-horizon-${horizon}`).click();
    await expect(trip).toHaveAttribute("data-horizon", String(horizon));
    return Number((await page.getByTestId("trip-total").textContent())?.match(/^(\d+)/)?.[1] ?? 0);
  };
  const short = await count(30);
  const long = await count(180);
  expect(long).toBeGreaterThanOrEqual(short);
  expect(await count(90)).toBeGreaterThanOrEqual(short);
  await expect(page.getByTestId("trip-row").first()).toHaveAttribute("data-anchor", "true");
  await expect(page.getByTestId("trip-merge")).toContainText("⚡ Sloučit vybrané");
  await expect(page.getByTestId("trip-send")).toContainText("📩 Odeslat tento sloučený seznam reviznímu technikovi k přípravě");

  // 📩 seznam k přípravě (náhled i bez uloženého technika)
  await page.getByTestId("trip-send").click();
  await expect(page.getByTestId("trip-send-preview")).toContainText("Sloučený revizní výjezd");
  await page.keyboard.press("Escape");

  // ⚡ sloučení otevře formulář revizního technika pro vybraná zařízení
  await page.getByTestId("trip-merge").click();
  await expect(page.getByTestId("revision-technician-form")).toContainText("Sloučený revizní výjezd");
  await expect(page.getByTestId("rt-profile-form")).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");

  await open(page, "/inspections/planner", trip);
  // Fáze 115: Chytrá revize je v centru „📋 Revize & Plánovač“ (/revize, agenda 4 závodu), ne na mapě areálu ani v podlaží
  await open(page, "/revize", trip);
  await open(page, `${PLANT}?faze=4`, trip);
  await open(page, PLANT, page.getByTestId("plant-strip"));
  await expect(trip).toHaveCount(0);
  await open(page, HALL_A_1NP, page.getByRole("group", { name: "Filtr stavu" }));
  await expect(trip).toHaveCount(0);
});

test("🖊️ formulář technika: profil TIČR, měření na 1 klik, podpis a PIN → uzamčený protokol s pečetí SHA-256; TIČR report a zneplatnění", async ({ page }) => {
  test.setTimeout(300_000);
  await page.route("**/api/ares?ico=*", (route) => route.fulfill({ json: { ico: "27074358", companyName: "Revize Kovář s.r.o.", dic: null, street: "Revizní 8", city: "Liberec", zip: "460 01" } }));
  await startAsAccount(page, "acc-kovar");
  await open(page, BOARD, page.getByTestId("signed-revision-entry"));
  await page.getByTestId("signed-revision-open").click();
  const form = page.getByTestId("revision-technician-form");
  await expect(form.getByTestId("rt-profile-form")).toBeVisible({ timeout: 30_000 });

  // Profil revizního technika (uloží se pro příští revize závodu)
  await form.getByTestId("rtp-name").fill("Ing. Jiří Kovář");
  await form.getByTestId("rtp-ico").fill("27074358");
  await form.getByRole("button", { name: "ARES" }).click();
  await expect(form.getByTestId("rtp-company")).toHaveValue("Revize Kovář s.r.o.");
  await form.getByTestId("rtp-email").fill("jiri.kovar@revize-kovar.example");
  await form.getByTestId("rtp-cert").fill("1248/23/R-EZ-E2A");
  await form.getByTestId("rtp-scope").selectOption("E2A");
  await form.getByTestId("rtp-cert-until").fill("2029-06-30");
  await form.getByTestId("rtp-instrument").fill("Metrel EurotestXC MI 3155");
  await form.getByTestId("rtp-cal").fill("KL-2026-0842");
  await form.getByTestId("rtp-pin").fill("482916");
  await form.getByTestId("rtp-save").click();
  await expect(form.getByTestId("rt-profile-card")).toContainText("1248/23/R-EZ-E2A", { timeout: 30_000 });

  // ✨ šablona měření → technik přepíše hodnotu z přístroje
  await form.getByTestId("rt-prefill").click();
  await expect(form.getByTestId("rt-template-warning")).toBeVisible();
  await form.getByTestId("rt-riso").fill("820");
  await expect(form.getByTestId("rt-template-warning")).toBeHidden();
  await expect(form.getByTestId("rt-verdict")).toHaveText("ZAŘÍZENÍ JE SCHOPNÉ BEZPEČNÉHO PROVOZU");

  // Podpis na plátno, razítko TIČR, PIN a potvrzení
  const pad = form.getByTestId("signature-pad");
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 12; step++) await page.mouse.move(box.x + 40 + step * 22, box.y + box.height / 2 + (step % 2 ? -18 : 14));
  await page.mouse.up();
  await expect(pad).toHaveAttribute("data-empty", "false");
  await expect(form.getByTestId("inspector-stamp")).toBeVisible();
  await form.getByTestId("rt-pin").fill("482916");
  await form.getByTestId("rt-confirm").check();
  await form.getByTestId("rt-submit").click();
  await expect(form.getByTestId("rt-signed")).toBeVisible({ timeout: 60_000 });
  await expect(form.getByTestId("rt-seal-hash")).toHaveText(/^SHA-256 [0-9a-f]{64}$/);
  const protocol = (await form.getByTestId("rt-open-protocol").getAttribute("href"))!;

  // Uzamčený protokol: podpis, razítko, pečeť ověřená přepočtem, nahrání PAdES
  await page.goto(protocol);
  await expect(page.getByTestId("protocol-seal")).toHaveAttribute("data-seal", "VALID", { timeout: 30_000 });
  await expect(page.getByTestId("protocol-seal")).toContainText("1248/23/R-EZ-E2A");
  await expect(page.getByTestId("protocol-signature")).toBeVisible();
  await expect(page.getByTestId("pades-upload")).toBeVisible();

  // 🛡️ Měsíční report TIČR: záznam pod číslem osvědčení → 🚨 Tato revize není moje!
  await open(page, "/inspections/ticr", page.getByTestId("ticr-report"));
  const row = page.getByTestId("ticr-row").filter({ hasText: "RP-ADM2" }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(/[0-9a-f]{8}…[0-9a-f]{6}/);
  await row.getByTestId("ticr-flag").click();
  await page.getByTestId("ticr-flag-pin").fill("482916");
  await page.getByTestId("ticr-flag-submit").click();
  await expect(page.getByTestId("ticr-row").filter({ hasText: "RP-ADM2" }).first()).toHaveAttribute("data-flagged", "true", { timeout: 30_000 });

  // Červené varování na kartě zařízení (pod QR štítkem)
  await open(page, BOARD, page.getByTestId("revision-misuse-banner"));
  await expect(page.getByTestId("revision-misuse-banner")).toContainText("⛔ POZOR: REVIZNÍ TECHNIK ZNEPLATNIL TENTO ZÁZNAM PRO PODEZŘENÍ ZE ZNEUŽITÍ OSVĚDČENÍ TIČR");
});
