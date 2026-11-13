import { expect, test, type Page } from "@playwright/test";

import { PUBLIC_STATE } from "./auth";
import { goPhase, rightTab, confirmLayoutWizard } from "./floorplan-phases";
import { startAs } from "./helpers";

// Fáze 103: zámek místností 2D půdorysu v krocích 2–5, generátor QR štítků ve velínu, kusová zkouška a uzamčení
// dokumentace rozváděče (Verze 1.0 → odemknutí → Verze 1.1, karta /q/EL-… s historií a vodoznakem NEAKTUÁLNÍ)
// a Červenka v ELDOCK Poolu (první projektant úkol přijme, druhému se zamkne).

test.describe.configure({ mode: "serial" });

const toastWith = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text }).first();

async function superadmin(page: Page) {
  await page.goto("/superadmin");
  await expect(page).toHaveURL(/\/superadmin\/login/, { timeout: 60_000 });
  await page.getByLabel("Heslo velínu").fill("eldock2026");
  await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SuperAdmin velín", { timeout: 60_000 });
}

test("🔒 2D půdorys: místnosti a stěny jdou upravit jen v kroku 1 – v krocích 2–5 se nepohnou ani nesmažou", async ({ page }) => {
  await page.goto("/panel-builder/floorplan?demo=rd-4kk");
  const canvas = page.getByTestId("floorplan-canvas");
  // Šatna (12,0–14,8 × 7,1–10,6 m): tlačítko v horním rohu, svítidlo uprostřed, skříň u spodní stěny
  const room = canvas.getByTestId("room-Šatna");
  await expect(room).toBeVisible({ timeout: 90_000 });
  await goPhase(page, 3);
  // Kabelové trasy po stěnách skryté (přepínač / klávesa K) – klik míří na plochu místnosti, ne na trasu okruhu
  const cables = page.getByTestId("toggle-cables");
  if ((await cables.getAttribute("aria-pressed")) !== "false") await cables.click();
  await expect(canvas.getByTestId("cable-route")).toHaveCount(0);
  const box = (await room.boundingBox())!;
  const spot = { x: box.x + box.width * 0.14, y: box.y + box.height * 0.74 };
  // Poloha a rozměr místnosti v mm (atributy SVG – obrys vybrané místnosti je jen silnější)
  const geometry = () => room.evaluate((node) => ["x", "y", "width", "height", "points"].map((name) => node.getAttribute(name)).join("|"));
  const original = await geometry();
  // Tažení po ploše místnosti – místnost zůstane na místě (v kroku 2–5 tah vybírá prvky obdélníkem)
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.move(spot.x + 120, spot.y - 90, { steps: 8 });
  await page.mouse.up();
  expect(await geometry()).toBe(original);
  // Tah vybral obdélníkem prvky šatny – Esc výběr zruší; rychlý klik (bez prodlevy) pak vybere zamčenou místnost
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(canvas.getByTestId("element-toolbar")).toHaveCount(0);
  await page.mouse.click(spot.x, spot.y);
  const detail = page.getByTestId("room-detail");
  await expect(detail).toHaveAttribute("data-locked", "true");
  await expect(detail.getByTestId("room-locked")).toContainText("🔒 Rozvržení místností je v této fázi uzamčeno proti nechtěnému posunutí.");
  await expect(detail.getByLabel("Šířka X [m]")).toBeDisabled();
  await expect(detail.getByRole("button", { name: /Smazat místnost/ })).toHaveCount(0);
  await expect(canvas.getByTestId("room-handle")).toHaveCount(0);
  // Delete smaže jen elektro prvek / nábytek, nikdy místnost
  await page.keyboard.press("Delete");
  await expect(canvas.locator('[data-room="Šatna"]')).toHaveCount(1);
  expect(await geometry()).toBe(original);
  // ✏️ Přepnout do Fáze 1 → místnost je zase plně editovatelná
  await detail.getByTestId("room-unlock").click();
  await expect(page.getByTestId("floorplan-wizard")).toHaveAttribute("data-step", "1");
  // Krok 1 má nad plátnem jinou lištu (plocha X × Y) – plátno se posune, místo kliknutí znovu z polohy místnosti
  const unlocked = (await room.boundingBox())!;
  await page.mouse.click(unlocked.x + unlocked.width * 0.14, unlocked.y + unlocked.height * 0.74);
  await expect(page.getByTestId("room-detail")).not.toHaveAttribute("data-locked", "true");
  await expect(page.getByTestId("room-detail").getByLabel("Šířka X [m]")).toBeEnabled();
  await expect(canvas.getByTestId("room-handle")).toBeVisible();
});

test("🏷️ Generátor QR štítků ve velínu: série pro firmu, kotouč Zebra 1:1, arch A4, ZPL, API a historie", async ({ page }) => {
  await superadmin(page);
  await page.getByRole("link", { name: "🏷️ Generátor QR štítků ELDOCK" }).click();
  const tab = page.getByTestId("qr-labels-tab");
  await expect(tab).toBeVisible({ timeout: 60_000 });
  await tab.getByTestId("qr-batch-company").fill("Elektro E2E s.r.o.");
  await tab.getByTestId("qr-batch-email").fill("e2e@elektro.example");
  await tab.getByTestId("qr-purpose-MACHINE").click();
  await tab.getByTestId("qr-batch-count").fill("3");
  await tab.getByTestId("qr-batch-submit").click();
  const created = tab.getByTestId("qr-batch-created");
  await expect(created).toContainText("Elektro E2E s.r.o.", { timeout: 30_000 });
  const codes = ((await created.textContent()) ?? "").match(/EL-\d{6}/g) ?? [];
  expect(codes).toHaveLength(2);
  const [from, to] = codes as [string, string];
  expect(Number(to.slice(3)) - Number(from.slice(3))).toBe(2);
  await expect(tab.getByTestId("qr-batch-row").filter({ hasText: "Elektro E2E s.r.o." }).getByTestId("qr-batch-activated")).toHaveText("0 / 3");

  // Kotouč Zebra ZD421t: 3 štítky 70 × 40 mm, každý na vlastní stránce, QR kód s logem EL uprostřed
  await page.goto((await created.getByTestId("qr-batch-print-roll").getAttribute("href"))!);
  await expect(page.getByTestId("label-roll")).toHaveAttribute("data-count", "3", { timeout: 60_000 });
  await expect(page.getByTestId("eldock-label")).toHaveCount(3);
  await expect(page.getByTestId("eldock-label").first()).toHaveAttribute("data-code", from);
  await expect(page.getByTestId("eldock-label").first().locator("svg image")).toHaveCount(1);
  // Stránka tisku = rozměr štítku (Playwright text uvnitř <style> nečte – kontrola přes DOM)
  expect(await page.evaluate(() => [...document.querySelectorAll("style")].some((style) => style.textContent?.includes("size: 70mm 40mm")))).toBe(true);
  await page.getByTestId("label-format-a4").click();
  await expect(page.getByTestId("label-a4")).toBeVisible();
  const zpl = await page.request.get(page.url().replace(/\/tisk.*$/, "/zpl"));
  expect(zpl.status()).toBe(200);
  expect(await zpl.text()).toContain(`^FDHA,https://eldock.cz/q/${from}^FS`);
  const api = await page.request.get("/api/qr-labels");
  expect(api.status()).toBe(200);
  expect((await api.json()).lastSequenceNumber).toBeGreaterThanOrEqual(Number(to.slice(3)));

  // Nespárovaný štítek po naskenování: patří firmě série
  await page.goto(`/q/${from}`);
  await expect(page.getByTestId("qr-unpaired")).toContainText("Elektro E2E s.r.o.", { timeout: 60_000 });
});

test("👨‍🔧 Kusová zkouška a uzamčení do cloudu: Verze 1.0 pod QR štítkem → odemknutí → Verze 1.1, 1.0 NEAKTUÁLNÍ s vodoznakem", async ({ page, browser }) => {
  test.setTimeout(360_000);
  page.on("dialog", (dialog) => void dialog.accept());
  // Rozváděč z 2D půdorysu vzorového RD (navázaný půdorys = druhý dokument verze)
  await page.goto("/panel-builder/floorplan?demo=rd-4kk");
  await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 90_000 });
  await goPhase(page, 5);
  await rightTab(page, "bom");
  const generate = page.getByTestId("generate-from-floorplan");
  const environment = page.getByTestId("floorplan-environment");
  if (await environment.count()) await environment.selectOption("TIMBER");
  await page.getByLabel("Název rozváděče").fill("RD103 kusová zkouška");
  await expect(generate).toBeEnabled();
  await generate.click();
  await confirmLayoutWizard(page);
  await expect(page).toHaveURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 120_000 });
  const projectUrl = page.url();
  await page.goto(`${projectUrl}/documentation`);

  const panel = page.getByTestId("inspector-panel");
  await expect(panel).toHaveAttribute("data-doc-state", "DRAFT", { timeout: 90_000 });
  // Protokol o kusové zkoušce: body 11.2, 11.3, 11.5, 11.6, 11.7 potvrdí výrobce, 11.4 / 11.8 / 11.9 doplní měření
  const routine = page.getByTestId("routine-test");
  for (const point of [1, 2, 4, 5, 6]) await routine.getByRole("group", { name: new RegExp(`^Bod ${point}:`) }).getByRole("button", { name: "✓ Vyhovuje" }).click();
  await expect(routine).toContainText("Uloženo", { timeout: 30_000 });

  async function inspect(riso: string) {
    await panel.getByTestId("inspector-name").fill("Ing. Jan Revizní");
    await panel.getByTestId("inspector-cert").fill("E2A č. 1234/2026");
    await panel.getByTestId("inspector-riso").fill(riso);
    await panel.getByTestId("inspector-pe").fill("0,04");
    await panel.getByTestId("inspector-rcd-ma").fill("22");
    await panel.getByTestId("inspector-rcd-ms").fill("18");
    await panel.getByTestId("inspector-mechanical").check();
    await expect(panel.getByTestId("inspector-ready")).toBeVisible({ timeout: 30_000 });
  }
  await inspect("550");
  await expect(panel.getByTestId("inspector-lock")).toContainText("🔒 Potvrdit kusovou zkoušku, uzamknout PDF v cloudu a vydat Verzi 1.0");
  await panel.getByTestId("inspector-lock").click();
  await expect(toastWith(page, "Vydána Verze 1.0")).toBeVisible({ timeout: 60_000 });
  await expect(panel).toHaveAttribute("data-doc-state", "LOCKED_PUBLISHED", { timeout: 30_000 });
  await expect(panel.getByTestId("inspector-current")).toContainText("Schválená platná dokumentace – Verze 1.0");
  await expect(page.getByTestId("project-doc-state")).toContainText("Uzamčená schválená verze");
  const serial = ((await panel.getByTestId("inspector-card-link").textContent()) ?? "").trim();
  expect(serial).toMatch(/^EL-\d{6}$/);
  // Uzamčený rozváděč: protokol jen pro čtení
  await expect(routine).toHaveAttribute("data-readonly", "true");

  // Karta QR štítku: platná verze a dva dokumenty
  await page.goto(`/q/${serial}`);
  await expect(page.getByTestId("qr-current")).toContainText("Schválená platná dokumentace – Verze 1.0", { timeout: 60_000 });
  await expect(page.getByTestId("qr-doc-pdf")).toContainText("📄 Kompletní PDF dokumentace rozváděče + Kusová zkouška (Verze 1.0 – AKTUÁLNÍ)");
  await expect(page.getByTestId("qr-doc-floorplan")).toContainText("📐 Prováděcí 2D půdorys a kabelové trasy (Verze 1.0 – AKTUÁLNÍ)");
  await page.getByTestId("qr-doc-pdf").click();
  await expect(page.getByTestId("snapshot-badge")).toHaveText("Verze 1.0 – AKTUÁLNÍ", { timeout: 60_000 });
  await expect(page.getByTestId("doc-inspection")).toContainText("Ing. Jan Revizní");
  await expect(page.getByTestId("doc-inspection-verdict")).toHaveText("ZAŘÍZENÍ JE SCHOPNÉ BEZPEČNÉHO PROVOZU");
  await expect(page.getByTestId("doc-watermark")).toHaveCount(0);

  // 🔓 Odemknout z karty → krok Dokumentace, rozpracovaná Verze 1.1
  await page.goto(`/q/${serial}`);
  await page.getByTestId("qr-unlock").click();
  await expect(page).toHaveURL(/\/documentation\?revize=1/, { timeout: 60_000 });
  await page.getByTestId("inspector-unlock").click();
  await expect(toastWith(page, "Verze 1.1 (Rozpracovaná změna)")).toBeVisible({ timeout: 60_000 });
  await expect(panel).toHaveAttribute("data-doc-state", "DRAFT", { timeout: 30_000 });
  await expect(panel.getByTestId("inspector-revision-note")).toContainText("Verze 1.1");
  await inspect("600");
  await panel.getByTestId("inspector-lock").click();
  await expect(toastWith(page, "Vydána Verze 1.1")).toBeVisible({ timeout: 60_000 });

  // Karta: platí 1.1, v historii 1.0 NEAKTUÁLNÍ; snímek 1.0 s červeným štítkem v hlavičce listů a vodoznakem
  await page.goto(`/q/${serial}`);
  await expect(page.getByTestId("qr-current")).toContainText("Verze 1.1", { timeout: 60_000 });
  const history = page.getByTestId("qr-history");
  await history.locator("summary").click();
  await expect(history.getByTestId("qr-history-row")).toContainText("Verze 1.0");
  await expect(history.getByTestId("qr-history-row")).toContainText("⚠️ NEAKTUÁLNÍ – nahrazeno verzí 1.1");
  await page.goto(`/q/${serial}/v/1.0`);
  await expect(page.getByTestId("snapshot-badge")).toHaveText("⚠️ NEAKTUÁLNÍ VERZE (1.0) – NAHRAZENO VERZÍ 1.1", { timeout: 60_000 });
  await expect(page.getByTestId("doc-version-badge").first()).toHaveAttribute("data-superseded", "true");
  await expect(page.getByTestId("doc-version-badge").first()).toHaveText("⚠️ NEAKTUÁLNÍ VERZE (1.0) – NAHRAZENO VERZÍ 1.1");
  await expect(page.getByTestId("doc-watermark").first()).toBeAttached();
  await page.goto(`/q/${serial}/v/1.1/pudorys`);
  await expect(page.getByTestId("floorplan-document")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("floorplan-document-bom-table")).toBeVisible();

  // Technik u rozváděče bez přihlášení: karta i dokumentace, ale bez osobních údajů zákazníka
  const visitor = await browser.newContext({ storageState: PUBLIC_STATE });
  const anonymous = await visitor.newPage();
  await anonymous.goto(`/q/${serial}`);
  await expect(anonymous.getByTestId("qr-current")).toContainText("Verze 1.1", { timeout: 60_000 });
  await anonymous.getByTestId("qr-doc-pdf").click();
  await expect(anonymous.getByTestId("snapshot-badge")).toHaveText("Verze 1.1 – AKTUÁLNÍ", { timeout: 60_000 });
  await expect(anonymous.getByText("Jméno zákazníka, místo instalace a razítko firmy vidí jen přihlášená firma výrobce rozváděče.")).toBeVisible();
  await visitor.close();
});

test("🌐 Červenka v ELDOCK Poolu: první projektant úkol přijme, druhému se zamkne; odevzdané PDF schválí údržba", async ({ page, browser }) => {
  test.setTimeout(360_000);
  page.on("dialog", (dialog) => void dialog.accept());
  // Velín schválí dva projektanty poolu (přístupový kód se ukáže jen jednou)
  await superadmin(page);
  await page.getByRole("link", { name: "🌐 ELDOCK Pool projektantů" }).click();
  const tab = page.getByTestId("pool-tab");
  await expect(tab).toBeVisible({ timeout: 60_000 });
  async function approve(name: string, email: string) {
    await tab.getByTestId("pool-designer-name").fill(name);
    await tab.getByTestId("pool-designer-email").fill(email);
    await tab.getByTestId("pool-designer-submit").click();
    const issued = tab.getByTestId("pool-designer-code");
    await expect(issued).toContainText(email, { timeout: 30_000 });
    return ((await issued.locator("strong").textContent()) ?? "").trim();
  }
  const janaCode = await approve("Jana Svobodová", "jana.e2e@pool.example");
  const petrCode = await approve("Petr Dvořák", "petr.e2e@pool.example");

  // Údržba: Červenka (zákres + poznámka) → 🌐 ELDOCK Pool, EPLAN, 1 500 Kč
  await startAs(page, "MAINTENANCE");
  await page.goto("/equipment/eq-r-lak-01/change-request");
  const draw = page.getByLabel("Plocha pro zákres – kreslete prstem, perem nebo myší");
  await expect(draw).toBeVisible({ timeout: 60_000 });
  await draw.scrollIntoViewIfNeeded();
  const box = (await draw.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) await page.mouse.move(box.x + box.width * 0.4 + step * 6, box.y + box.height * 0.5 + step * 3);
  await page.mouse.up();
  await page.getByRole("button", { name: "Další" }).click();
  await page.getByRole("button", { name: "Další" }).click();
  await page.locator("#change-note").fill("Doplněn jistič F9 B16 pro novou zásuvku u lakovací kabiny.");
  await page.getByRole("button", { name: "Další" }).click();
  await page.getByTestId("routing-pool").click();
  await page.getByTestId("routing-format").selectOption("EPLAN");
  await page.getByTestId("routing-preset").selectOption("1");
  await expect(page.getByTestId("routing-reward")).toHaveValue("1500");
  await page.getByRole("button", { name: "🚀 Odeslat do ELDOCK Poolu projektantů" }).click();
  await expect(toastWith(page, "odeslána do ELDOCK Poolu projektantů")).toBeVisible({ timeout: 60_000 });
  const number = (((await toastWith(page, "odeslána do ELDOCK Poolu projektantů").textContent()) ?? "").match(/ZM-2026-\d{4}/) ?? [""])[0];
  expect(number).toMatch(/^ZM-2026-\d{4}$/);

  // Dva projektanti v portálu – oba vidí volný úkol s odměnou
  async function designer(email: string, code: string) {
    const context = await browser.newContext({ storageState: PUBLIC_STATE });
    const portal = await context.newPage();
    await portal.goto("/portal-projektantu");
    await portal.getByTestId("pool-email").fill(email);
    await portal.getByTestId("pool-code").fill(code);
    await portal.getByTestId("pool-login-submit").click();
    await expect(portal.getByTestId("pool-designer")).toBeVisible({ timeout: 60_000 });
    return { context, portal, task: portal.getByTestId("pool-task").filter({ hasText: number }) };
  }
  const jana = await designer("jana.e2e@pool.example", janaCode);
  const petr = await designer("petr.e2e@pool.example", petrCode);
  await expect(jana.task).toHaveAttribute("data-status", "OPEN");
  await expect(jana.task.getByTestId("pool-task-status")).toHaveText("🟢 VOLNÝ ÚKOL K PŘIJETÍ");
  await expect(jana.task.getByTestId("pool-task-reward")).toContainText("1 500 Kč");
  await expect(jana.task.getByTestId("pool-task-preview")).toBeVisible();
  await expect(petr.task.getByTestId("pool-claim")).toBeVisible();

  // ✋ Jana je první – Petrovi (stará stránka) se přijetí odmítne a úkol se mu zamkne
  await jana.task.getByTestId("pool-claim").click();
  await expect(toastWith(jana.portal, "Úkol je váš")).toBeVisible({ timeout: 30_000 });
  await expect(jana.task).toHaveAttribute("data-status", "CLAIMED");
  await petr.task.getByTestId("pool-claim").click();
  await expect(toastWith(petr.portal, "Úkol už přijal projektant Jana Svobodová.")).toBeVisible({ timeout: 30_000 });
  await expect(petr.task.getByTestId("pool-task-status")).toHaveText("🔒 Přijato projektantem Jana Svobodová");
  await expect(petr.task.getByTestId("pool-claim")).toHaveCount(0);
  await expect(petr.task.getByTestId("pool-package")).toHaveCount(0);

  // Jana: balíček podkladů a odevzdání nového čistého PDF schématu
  const download = jana.portal.waitForEvent("download");
  await jana.task.getByTestId("pool-package").click();
  expect((await download).suggestedFilename()).toBe(`eldock-${number}-podklady.zip`);
  await jana.task.getByTestId("pool-upload-pdf").setInputFiles({ name: "prekresleno.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n") });
  await jana.task.getByTestId("pool-upload-summary").fill("Doplněn jistič F9 B16, přečíslovány svorky X3.");
  await jana.task.getByTestId("pool-upload-submit").click();
  await expect(toastWith(jana.portal, "čeká na schválení údržbou")).toBeVisible({ timeout: 60_000 });
  await expect(jana.task).toHaveAttribute("data-status", "SUBMITTED");

  // Údržba schválí → stará verze do archivu, Červenka „✅ Zapracováno do dokumentace“
  await page.goto("/equipment/eq-r-lak-01/approve");
  await page.getByRole("button", { name: "Potvrdit a propsat do systému" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Potvrdit a propsat", exact: true }).click();
  await expect(page).toHaveURL(/tab=history/, { timeout: 60_000 });
  await jana.portal.reload();
  await expect(jana.task.getByTestId("pool-task-status")).toHaveText("✅ Zapracováno do dokumentace", { timeout: 60_000 });
  await jana.context.close();
  await petr.context.close();
});
