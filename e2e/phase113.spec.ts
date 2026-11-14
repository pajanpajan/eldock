import { expect, test, type Locator, type Page } from "@playwright/test";

import { goPhase } from "./floorplan-phases";

// Fáze 113: 2. NP s vlastním PDF podkladem se uloží do cloudu (i po nasazení nové verze aplikace), přepínač podlaží ve
// štítku na plátně a v kartě Místnosti a podlaží, místnosti z PDF (🔍 automaticky, 🪄 klik, 📐 dva rohy) se stěnami ve
// 3D, velín (⚙️ SMTP & Cloud zálohy, ⭐ neomezený přístup), sady QR štítků neplátce DPH a limit Hlídače revizí.
test.describe.configure({ mode: "serial" });

const PUBLIC_STATE = { cookies: [], origins: [] };

/**
 * Půdorys A4 na šířku: obvodové zdi 17 pt (≈ 300 mm), příčky 8 pt s dveřmi 45 pt (≈ 800 mm) a popisky místností
 * (WinAnsi: ý = \375, í = \355, ž = \236, ² = \262).
 */
function roomsPdf(): Buffer {
  const walls = [
    [60, 60, 720, 17],
    [60, 523, 720, 17],
    [60, 60, 17, 480],
    [763, 60, 17, 480],
    [420, 77, 8, 123],
    [420, 245, 8, 278],
    [428, 300, 132, 8],
    [605, 300, 158, 8],
  ]
    .map(([x, y, w, h]) => `${x} ${y} ${w} ${h} re f`)
    .join(" ");
  const text = [
    "BT /F1 12 Tf 215 320 Td (1.01) Tj ET",
    "BT /F1 12 Tf 190 304 Td (Ob\\375vac\\355 pokoj) Tj ET",
    "BT /F1 12 Tf 210 288 Td (32,5 m\\262) Tj ET",
    "BT /F1 12 Tf 560 420 Td (1.02) Tj ET",
    "BT /F1 12 Tf 548 404 Td (Lo\\236nice) Tj ET",
    "BT /F1 12 Tf 560 190 Td (1.03) Tj ET",
    "BT /F1 12 Tf 545 174 Td (Koupelna) Tj ET",
  ].join(" ");
  const content = `0 g ${walls} ${text}`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

/** Klik do plátna v mm půdorysu. */
async function clickAt(page: Page, canvas: Locator, x: number, y: number) {
  await canvas.scrollIntoViewIfNeeded();
  const at = await canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const value = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: value.x, y: value.y };
  }, { x, y });
  await page.mouse.click(at.x, at.y);
}

async function openNewFloorplan(page: Page) {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

async function uploadPdf(page: Page, name: string) {
  await page.getByLabel("Podklad půdorysu").setInputFiles({ name, mimeType: "application/pdf", buffer: roomsPdf() });
  await expect(page.getByTestId("floorplan-background")).toHaveAttribute("href", /\/api\/files\/photos\/[\w-]+\.(webp|jpg)$/, { timeout: 60_000 });
  await page.keyboard.press("Escape");
}

const status = (page: Page) => page.getByTestId("floorplan-save-status");

test("💾 2. NP s vlastním PDF: ✓ Uloženo v cloudu, přepínač podlaží na plátně i vpravo, obnova po nasazení nové verze", async ({ page }) => {
  test.setTimeout(420_000);
  await openNewFloorplan(page);
  await uploadPdf(page, "prizemi.pdf");
  await expect(status(page)).toContainText("Uloženo v cloudu", { timeout: 60_000 });

  // B) karta Místnosti a podlaží: tlačítka podlaží a + Přidat podlaží
  await goPhase(page, 1);
  const floors = page.getByTestId("rooms-floor-switch");
  await expect(floors.getByRole("tab")).toHaveCount(1);
  await floors.getByTestId("rooms-floor-add").click();
  await expect(page.getByTestId("active-floor")).toContainText("2. NP");
  await expect(page.getByTestId("active-floor")).toContainText("+3,000");
  await uploadPdf(page, "patro.pdf");
  await expect(status(page)).toHaveAttribute("data-state", "saved", { timeout: 60_000 });
  await expect(status(page)).toContainText("Uloženo v cloudu");

  // A) štítek na plátně – 2 podlaží: najetím výzva „⇄ Přepnout na 1. NP ±0,000“, klik přepne
  const badge = page.getByTestId("floor-badge");
  await expect(badge).toHaveAttribute("data-floors", "2");
  await badge.hover();
  await expect(page.getByTestId("floor-badge-switch")).toBeVisible();
  await expect(page.getByTestId("floor-badge-switch")).toContainText("Přepnout na 1. NP ±0,000");
  await page.screenshot({ path: "test-results/phase113-floor-badge.png" });
  await badge.click();
  await expect(page.getByTestId("active-floor")).toContainText("1. NP");
  await floors.getByTestId("rooms-floor-2. NP").click();
  await expect(page.getByTestId("active-floor")).toContainText("2. NP");

  // 3 podlaží: plovoucí menu všech podlaží
  await floors.getByTestId("rooms-floor-add").click();
  await expect(page.getByTestId("active-floor")).toContainText("3. NP");
  await expect(page.getByTestId("floor-badge")).toHaveAttribute("data-floors", "3");
  await page.getByTestId("floor-badge-toggle").hover();
  const menu = page.getByTestId("floor-badge-menu");
  await expect(menu.getByRole("menuitemradio")).toHaveCount(3);
  await menu.getByTestId("floor-badge-item-1. NP").click();
  await expect(page.getByTestId("active-floor")).toContainText("1. NP");
  await expect(status(page)).toContainText("Uloženo v cloudu", { timeout: 60_000 });

  // Po nasazení nové verze: Server Action staré stránky server nezná → záloha v prohlížeči, znovunačtení a uložení
  let stale = true;
  await page.route(/\/panel-builder\/floorplan\/[^/?]+$/, async (route) => {
    if (stale && route.request().method() === "POST" && route.request().headers()["next-action"]) {
      stale = false;
      return route.fulfill({ status: 404, headers: { "x-nextjs-action-not-found": "1", "content-type": "text/plain" }, body: "Server action not found." });
    }
    return route.continue();
  });
  const reloaded = page.waitForEvent("load", { timeout: 60_000 });
  await floors.getByTestId("rooms-floor-add").click();
  await expect(status(page)).toHaveAttribute("data-state", "stale", { timeout: 30_000 });
  await reloaded;
  await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 60_000 });
  await expect(status(page)).toContainText("Uloženo v cloudu", { timeout: 60_000 });
  await goPhase(page, 1);
  await expect(page.getByTestId("rooms-floor-switch").getByRole("tab")).toHaveCount(4);

  // Po novém načtení: každé podlaží má svůj podklad
  await page.reload();
  await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 60_000 });
  await goPhase(page, 1);
  await page.getByTestId("rooms-floor-switch").getByTestId("rooms-floor-2. NP").click();
  await expect(page.getByTestId("floorplan-background")).toHaveAttribute("href", /\/api\/files\/photos\//);
  await page.getByTestId("rooms-floor-switch").getByTestId("rooms-floor-1. NP").click();
  await expect(page.getByTestId("floorplan-background")).toHaveAttribute("href", /\/api\/files\/photos\//);
});

test("🔍 místnosti z PDF: 🪄 klik do místnosti, automatické rozpoznání s názvy, 📐 dva rohy a příčky ve 3D", async ({ page }) => {
  test.setTimeout(420_000);
  await openNewFloorplan(page);
  await uploadPdf(page, "pudorys-mistnosti.pdf");
  await goPhase(page, 1);
  const canvas = page.getByTestId("floorplan-canvas");
  const tools = page.getByTestId("pdf-room-tools");
  await expect(tools.getByTestId("pdf-rooms-wand")).toBeEnabled();

  // Stupeň 2: 🪄 klik do ložnice (vpravo nahoře) – název z popisku PDF bez dotazu
  // A4 na šířku 842 pt = 15 m (výchozí měřítko): 1 pt ≈ 17,8 mm, osa y od horního okraje
  const pt = 15_000 / 842;
  await tools.getByTestId("pdf-rooms-wand").click();
  await clickAt(page, canvas, 650 * pt, (595 - 470) * pt);
  await expect(canvas.locator("[data-room]")).toHaveCount(1, { timeout: 60_000 });
  await expect(canvas.getByTestId("room-Ložnice")).toBeAttached();
  await page.keyboard.press("Escape");

  // Stupeň 1: 🔍 automaticky – zbylé dvě místnosti s názvy z PDF (ložnice se nezdvojí)
  await tools.getByTestId("pdf-rooms-auto").click();
  await expect(canvas.locator("[data-room]")).toHaveCount(3, { timeout: 60_000 });
  await expect(canvas.getByTestId("room-Obývací pokoj")).toBeAttached();
  await expect(canvas.getByTestId("room-Koupelna")).toBeAttached();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Rozpoznáno 2 místnosti (názvy z PDF: 2)" }).first()).toBeVisible();
  await page.getByTestId("floorplan-canvas").screenshot({ path: "test-results/phase113-rooms.png" });

  // Stupeň 3: 📐 dva rohy v okraji výkresu – nástroj zůstává aktivní
  await tools.getByTestId("pdf-rooms-2click").click();
  await clickAt(page, canvas, 100, 100);
  await expect(canvas.getByTestId("room2-draft")).toBeAttached();
  await clickAt(page, canvas, 900, 900);
  await expect(canvas.locator("[data-room]")).toHaveCount(4);
  await expect(tools.getByTestId("pdf-rooms-2click")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  // 3D náhled: stěny a vnitřní příčky z místností
  await page.getByTestId("pseudo3d-open").click();
  const modal = page.getByTestId("pseudo3d-modal");
  await expect(modal.getByTestId("pseudo3d-room-walls")).toContainText("Stěny a vnitřní příčky z místností podlaží (4)");
  expect(await modal.locator('[data-testid="pseudo3d-wall-face"]').count()).toBeGreaterThanOrEqual(16);
  await modal.screenshot({ path: "test-results/phase113-3d.png" });
});

test("🏢 velín a ceník: neplátce DPH, 5 sad QR štítků, ⚙️ SMTP & Cloud zálohy, ⭐ neomezený přístup; Hlídač s limitem", async ({ page, browser }) => {
  test.setTimeout(420_000);
  // Ceník: 5 výchozích sad bez nastavení ve velínu, mix sada 890 Kč (neplátce DPH)
  await expect(async () => {
    await page.goto("/panel-builder/credits");
    await expect(page.getByTestId("label-sets")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  const sets = page.getByTestId("label-sets");
  // 5 výchozích sad (velín z testu fáze 112 mohl přidat další)
  for (const code of ["LABELS_A100", "LABELS_A500", "LABELS_S50", "LABELS_M50", "LABELS_A60S30M10"]) await expect(sets.getByTestId(`label-set-${code}`)).toBeVisible();
  await expect(sets.getByTestId("label-set-LABELS_A100")).toContainText("490 Kč");
  await expect(sets.getByTestId("label-set-LABELS_A100")).toContainText("4,90 Kč/ks");
  await sets.getByTestId("order-labels-LABELS_A60S30M10").click();
  await expect(page).toHaveURL(/\/panel-builder\/credits\/[^/]+$/, { timeout: 60_000 });
  await expect(page.getByTestId("payment-qr")).toHaveAttribute("data-spd", /AM:890\.00\*CC:CZK/);
  await page.goto(`${page.url()}/invoice`);
  const invoice = page.getByTestId("invoice");
  await expect(invoice.getByTestId("invoice-supplier")).toContainText("Neplátce DPH", { timeout: 60_000 });
  await expect(invoice.getByTestId("invoice-item")).toContainText("STARTOVACÍ MIX SADA ELDOCK");
  await expect(invoice.getByTestId("invoice-total")).toHaveText("890 Kč");

  // Velín
  await page.goto("/superadmin?tab=nastaveni");
  await expect(page).toHaveURL(/\/superadmin\/login/, { timeout: 60_000 });
  await page.getByLabel("Heslo velínu").fill("eldock2026");
  await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SuperAdmin velín", { timeout: 60_000 });
  await page.goto("/superadmin?tab=nastaveni");
  const settings = page.getByTestId("platform-settings");
  await expect(settings).toBeVisible({ timeout: 60_000 });
  await expect(settings.getByTestId("backup-local-info")).toContainText("💾 Lokální záloha na serveru je aktivní (S3/R2 cloud úložiště je volitelné)");
  await settings.getByTestId("smtp-host").fill("smtp.example.invalid");
  await settings.getByTestId("smtp-port").fill("465");
  await settings.getByTestId("smtp-user").fill("info@eldock.cz");
  await settings.getByTestId("smtp-password").fill("Heslo-k-postovni-schrance");
  await settings.getByTestId("smtp-save").click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "SMTP uloženo (smtp.example.invalid:465)" }).first()).toBeVisible({ timeout: 30_000 });
  await expect(settings.getByTestId("smtp-password")).toHaveAttribute("placeholder", /uloženo/);
  await settings.getByTestId("smtp-test").click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "SMTP neodpovídá nebo odmítlo přihlášení" }).first()).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: "test-results/phase113-velin.png", fullPage: true });
  // Úklid: další testy počítají s e-maily jen do logu (bez SMTP) – potvrzení dialogu „Odebrat SMTP z velínu?“
  page.once("dialog", (dialog) => void dialog.accept());
  await settings.getByTestId("smtp-clear").click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "SMTP odebráno z velínu." }).first()).toBeVisible({ timeout: 30_000 });
  await page.goto("/superadmin?tab=backups");
  await expect(page.getByTestId("backup-local-active")).toContainText("Lokální záloha na serveru je aktivní");

  // ⭐ neomezený přístup u firmy (ukázková firma ho má ze seedu)
  await page.goto("/superadmin?tab=companies");
  const tester = page.locator("tr").filter({ hasText: "Elektro Tester s.r.o." }).first();
  await expect(tester.getByTestId("company-unlimited")).toBeChecked({ timeout: 60_000 });

  // Hlídač revizí: stav limitu zařízení podle tarifu závodu
  const plant = await browser.newPage();
  await plant.goto("/hlidac-revizi");
  await expect(plant.getByTestId("hlidac-entitlement")).toBeVisible({ timeout: 120_000 });
  await expect(plant.getByTestId("hlidac-entitlement")).toHaveAttribute("data-reason", /UNLIMITED|INTERNAL|SUBSCRIPTION|TRIAL/);
  await plant.close();

  // Patička veřejného webu: neplátce DPH a bankovní spojení
  const visitor = await browser.newPage({ storageState: PUBLIC_STATE });
  await visitor.goto("/");
  await expect(visitor.getByTestId("footer-registry")).toContainText("Neplátce DPH");
  await expect(visitor.getByTestId("footer-registry")).toContainText("Č. ú.");
  await visitor.close();
});
