import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import { PUBLIC_STATE } from "./auth";

// Fáze 107: kontaktní a zpětnovazební hub – /kontakt bez přihlášení, plovoucí tlačítko „💬 Nápověda, Chyby & Kontakt“
// s rychlými akcemi, vložení printscreenu přes Ctrl + V (událost paste se schránkou) i nahráním souboru, číslo tiketu
// #EL-…, „Nahlásit chybu“ v AI Panel Builderu a 2D půdorysu s ID projektu a velín „📬 Zprávy, Chyby & Schůzky“.
test.describe.configure({ mode: "serial" });

/** Ctrl + V: událost paste s obrázkem ve schránce (výstřižek obrazovky 2560 × 1440) na zadaném prvku. */
async function pasteScreenshot(page: Page, selector: string, label: string) {
  await page.evaluate(
    async ({ target, text }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 2560;
      canvas.height = 1440;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#1e3a8a";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#facc15";
      context.font = "bold 120px sans-serif";
      context.fillText(text, 160, 720);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), "image/png"));
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], "image.png", { type: "image/png" }));
      document.querySelector(target)!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }));
    },
    { target: selector, text: label },
  );
}

const photo = () => sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 220, g: 38, b: 38 } } }).png().toBuffer();

let ticket = "";

test("📬 /kontakt bez přihlášení: 200, formulář se 7 kategoriemi, přímé kontakty a Ctrl + V kdekoli na stránce", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ storageState: PUBLIC_STATE });
  const response = await context.request.get("/kontakt", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  const page = await context.newPage();
  await page.goto("/kontakt?kategorie=BUG");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kontakt & Spolupráce", { timeout: 60_000 });
  await expect(page.getByTestId("kontakt-person")).toHaveText("Pavel Janoušek · ELDOCK.cz");
  await expect(page.getByTestId("kontakt-details")).toContainText("Možnost osobní schůzky i online ukázky");
  const form = page.getByTestId("contact-form");
  await expect(form.locator("[data-testid^='contact-category-']")).toHaveCount(7);
  await expect(form).toHaveAttribute("data-category", "BUG");
  // Na stránce /kontakt plovoucí tlačítko není (formulář je na ní celý)
  await expect(page.getByTestId("contact-fab")).toHaveCount(0);
  // Navigace webu: odkaz Kontakt & Spolupráce
  await expect(page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: "Kontakt & Spolupráce" })).toHaveAttribute("href", "/kontakt");

  await pasteScreenshot(page, "body", "Ctrl+V na stránce /kontakt");
  await expect(form.getByTestId("contact-preview")).toHaveCount(1, { timeout: 30_000 });
  await form.getByTestId("contact-message").fill("E2E 107: na stránce kontakt nejde vložit printscreen");
  await form.getByTestId("contact-contact").fill("tester107@firma.example");
  await form.getByTestId("contact-submit").click();
  await expect(page.getByTestId("contact-ticket")).toContainText(/č\. #EL-\d{4,}/, { timeout: 60_000 });

  // Schůzka: forma na 1 klik, IČO, telefon a e-mail
  await page.getByTestId("contact-again").click();
  await form.getByTestId("contact-category-MEETING").click();
  await form.getByTestId("contact-subtype-regional").click();
  await form.getByTestId("contact-name").fill("Jan Novák E2E");
  await form.getByTestId("contact-company").fill("Elektro Novák E2E");
  await form.getByTestId("contact-phone").fill("+420 777 107 107");
  await form.getByTestId("contact-message").fill("Úterý dopoledne v Liberci");
  await form.getByTestId("contact-submit").click();
  await expect(page.getByTestId("contact-ticket")).toContainText("#EL-", { timeout: 60_000 });
  await page.screenshot({ path: "test-results/phase107-kontakt.png", fullPage: true });
  await context.close();
});

test("💬 Plovoucí tlačítko: rychlá akce „Nahlásit chybu“, printscreen přes Ctrl + V i ze souboru, náhledy s × a číslo tiketu", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ storageState: PUBLIC_STATE });
  const page = await context.newPage();
  await page.goto("/navody");
  const fab = page.getByTestId("contact-fab");
  await expect(fab).toBeVisible({ timeout: 60_000 });
  await expect(fab).toContainText("Nápověda, Chyby & Kontakt");
  // Najetí myší ukáže rychlé akce (klik na tlačítko pak rovnou otevře hlavní formulář)
  await fab.hover();
  const menu = page.getByTestId("contact-fab-menu");
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
  await expect(menu).toContainText("📅 Sjednat osobní schůzku / Demo");
  await menu.getByTestId("contact-quick-BUG").click();

  const modal = page.getByTestId("contact-modal");
  await expect(modal.getByTestId("contact-form")).toHaveAttribute("data-category", "BUG");
  await pasteScreenshot(page, "[data-testid='contact-modal']", "Ctrl+V v modalu");
  await expect(modal.getByTestId("contact-preview")).toHaveCount(1, { timeout: 30_000 });
  await modal.getByTestId("contact-file").setInputFiles([
    { name: "foto-mobilem.png", mimeType: "image/png", buffer: await photo() },
    { name: "druha.png", mimeType: "image/png", buffer: await photo() },
  ]);
  await expect(modal.getByTestId("contact-preview")).toHaveCount(3, { timeout: 30_000 });
  // Zmenšeno na max. 1600 px (WebP / JPEG)
  const width = await modal.getByTestId("contact-preview").first().locator("img").evaluate((node) => (node as HTMLImageElement).naturalWidth);
  expect(width).toBe(1600);
  await modal.getByTestId("contact-preview-remove").nth(2).click();
  await expect(modal.getByTestId("contact-preview")).toHaveCount(2);
  await modal.locator("summary", { hasText: "Technická diagnostika" }).click();
  await expect(modal.getByTestId("contact-diag-url")).toContainText("/navody");
  await modal.getByTestId("contact-message").fill("E2E 107: video se na mobilu nespustí");
  await modal.getByTestId("contact-contact").fill("+420 600 107 107");
  await page.screenshot({ path: "test-results/phase107-modal.png" });
  await modal.getByTestId("contact-submit").click();
  const done = modal.getByTestId("contact-ticket");
  await expect(done).toContainText(/č\. #EL-\d{4,}/, { timeout: 60_000 });
  ticket = ((await done.textContent()) ?? "").replace("č. ", "").trim();
  await expect(modal.getByTestId("contact-done")).toContainText("na telefon +420 600 107 107");
  await context.close();
});

test("📱 Mobil: kulaté tlačítko 💬 nad spodními lištami, klepnutí ukáže rychlé akce", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ storageState: PUBLIC_STATE, viewport: { width: 375, height: 812 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/navody");
  const fab = page.getByTestId("contact-fab");
  await expect(fab).toBeVisible({ timeout: 60_000 });
  const box = (await fab.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(56);
  // Nad pevnými spodními lištami (žádanka o změnu, hromadná revize) – aspoň 80 px od spodního okraje
  expect(812 - (box.y + box.height)).toBeGreaterThanOrEqual(78);
  await fab.tap();
  await expect(page.getByTestId("contact-fab-menu").getByRole("menuitem")).toHaveCount(5);
  await page.getByTestId("contact-quick-MEETING").tap();
  await expect(page.getByTestId("contact-modal").getByTestId("contact-form")).toHaveAttribute("data-category", "MEETING");
  await page.screenshot({ path: "test-results/phase107-mobile.png" });
  await context.close();
});

test("🍪 Před volbou cookies je plovoucí tlačítko nad lištou cookies – lištu nepřekrývá a jde použít", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/navody");
  const banner = page.getByTestId("consent-banner");
  await expect(banner).toBeVisible({ timeout: 60_000 });
  const fab = page.getByTestId("contact-fab");
  await expect.poll(async () => {
    const [fabBox, bannerBox] = [await fab.boundingBox(), await banner.boundingBox()];
    return fabBox && bannerBox ? Math.round(bannerBox.y - (fabBox.y + fabBox.height)) : -1;
  }, { timeout: 10_000 }).toBeGreaterThanOrEqual(8);
  await fab.hover();
  await page.getByTestId("contact-quick-IDEA").click();
  await expect(page.getByTestId("contact-modal").getByTestId("contact-form")).toHaveAttribute("data-category", "IDEA");
  await page.keyboard.press("Escape");
  // Tlačítka lišty zůstávají volná; po volbě se tlačítko vrátí dolů
  await banner.getByRole("button", { name: "Odmítnout vše" }).click();
  await expect(banner).toHaveCount(0);
  await expect.poll(async () => Math.round(900 - ((await fab.boundingBox())!.y + (await fab.boundingBox())!.height)), { timeout: 10_000 }).toBeLessThanOrEqual(30);
  await context.close();
});

test("🐛 „Nahlásit chybu“ v AI Panel Builderu a 2D půdorysu otevře modal s ID projektu a krokem průvodce", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).first().click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 60_000 });
  const projectId = page.url().split("/").pop()!;
  await page.getByTestId("report-ai-error").click();
  const modal = page.getByTestId("contact-modal");
  await expect(modal.getByTestId("contact-form")).toHaveAttribute("data-category", "BUG");
  await modal.locator("summary", { hasText: "Technická diagnostika" }).click();
  await expect(modal.getByTestId("contact-diag-project")).toHaveText(projectId);
  await expect(modal.getByTestId("contact-diag-module")).toContainText("AI Panel Builder");
  await pasteScreenshot(page, "[data-testid='contact-modal']", "Ctrl+V z Panel Builderu");
  await expect(modal.getByTestId("contact-preview")).toHaveCount(1, { timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);

  // 2D půdorys: tlačítko v liště průvodce a kompaktní pilulka plovoucího tlačítka
  await page.goto("/panel-builder/floorplan?demo=rd-4kk");
  await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("contact-fab-wrap")).toHaveAttribute("data-compact", "true");
  await page.getByTestId("floorplan-report-bug").first().click();
  await expect(modal.getByTestId("contact-form")).toHaveAttribute("data-category", "BUG");
  await modal.locator("summary", { hasText: "Technická diagnostika" }).click();
  await expect(modal.getByTestId("contact-diag-module")).toContainText("2D Půdorys");
  await expect(modal.getByTestId("contact-diag-module")).toContainText(/\d\. |Kompaktní lišta/);
  await pasteScreenshot(page, "[data-testid='contact-modal']", "Ctrl+V z 2D pudorysu");
  await expect(modal.getByTestId("contact-preview")).toHaveCount(1, { timeout: 30_000 });
  await modal.getByTestId("contact-message").fill("E2E 107: trasa kabelu v půdorysu přeskakuje");
  await modal.getByTestId("contact-submit").click();
  await expect(modal.getByTestId("contact-ticket")).toContainText("#EL-", { timeout: 60_000 });
  await page.screenshot({ path: "test-results/phase107-floorplan.png" });
});

test("🛠️ Velín „📬 Zprávy, Chyby & Schůzky“: odznak nepřečtených, náhled printscreenu v lightboxu, stav a interní poznámka", async ({ page }) => {
  test.setTimeout(180_000);
  expect(ticket).toMatch(/^#EL-\d{4,}$/);
  await page.goto("/superadmin");
  await expect(page).toHaveURL(/\/superadmin\/login/, { timeout: 60_000 });
  await page.getByLabel("Heslo velínu").fill("eldock2026");
  await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SuperAdmin velín", { timeout: 60_000 });
  await expect(page.getByTestId("contact-unread-badge")).toBeVisible();
  await page.getByRole("link", { name: /📬 Zprávy, Chyby & Schůzky/ }).click();
  const tab = page.getByTestId("contact-messages-tab");
  await expect(tab).toBeVisible({ timeout: 60_000 });
  await tab.getByTestId("contact-filter-bugs").click();
  const card = tab.locator(`[data-testid='contact-message'][data-ticket='${ticket}']`);
  await expect(card).toHaveAttribute("data-unread", "true", { timeout: 60_000 });
  await expect(card).toContainText("E2E 107: video se na mobilu nespustí");
  await expect(card.getByRole("link", { name: "+420 600 107 107" })).toHaveAttribute("href", "tel:+420600107107");
  await expect(card.getByTestId("contact-message-url")).toHaveText("/navody");
  const thumbnails = card.getByTestId("contact-attachment");
  await expect(thumbnails).toHaveCount(2);
  await expect.poll(() => thumbnails.first().locator("img").evaluate((node) => ((node as HTMLImageElement).complete ? (node as HTMLImageElement).naturalWidth : 0)), { timeout: 30_000 }).toBeGreaterThan(0);
  await thumbnails.first().click();
  const lightbox = page.getByTestId("contact-lightbox");
  await expect(lightbox).toBeVisible();
  await expect(lightbox).toContainText(`${ticket} · 1 / 2`);
  await page.keyboard.press("ArrowRight");
  await expect(lightbox).toContainText(`${ticket} · 2 / 2`);
  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);

  await card.getByTestId("contact-status-IN_PROGRESS").click();
  await expect(card).toHaveAttribute("data-status", "IN_PROGRESS", { timeout: 30_000 });
  await expect(card).toHaveAttribute("data-unread", "false");
  await card.getByTestId("contact-note").fill("E2E: přehrávač na iOS – opravit v 107.1");
  await card.getByTestId("contact-note-save").click();
  await expect(card.getByTestId("contact-note")).toHaveValue("E2E: přehrávač na iOS – opravit v 107.1", { timeout: 30_000 });
  await card.getByTestId("contact-status-RESOLVED").click();
  await expect(card).toHaveAttribute("data-status", "RESOLVED", { timeout: 30_000 });
  await page.screenshot({ path: "test-results/phase107-velin.png", fullPage: false });
});
