import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

// Fáze 92: onboarding bez čtecích bublin a dva oddělené světy – trenažér 2D půdorysu (rozdělaný bungalov, 3 úkoly,
// rozváděč bez kreditu), živý tahák zakázky a rozváděče, tréninkové zakázky AI Panel Builderu, průvodce výrobním
// závodem (založení haly a stroje, mise noční poruchy) a reálné fotky řad přes Ctrl+V (velín).
test.describe.configure({ mode: "serial" });

const PHOTO_FILE = path.join("storage", "catalog-images", "abb", "tango", "abb-tango-n-socket.webp");
const PHOTO_MANIFEST = path.join("storage", "catalog-images", "manifest.json");

async function screen(canvas: Locator, x: number, y: number) {
  await canvas.evaluate((svg) => svg.scrollIntoView({ block: "center", behavior: "instant" }));
  return canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const at = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: at.x, y: at.y };
  }, { x, y });
}

async function clickAt(page: Page, x: number, y: number) {
  const at = await screen(page.getByTestId("floorplan-canvas"), x, y);
  await page.mouse.click(at.x, at.y);
}

async function credits(page: Page) {
  await page.goto("/panel-builder");
  const text = await page.getByRole("heading", { level: 1, name: "AI Panel Builder" }).locator("xpath=../..").innerText();
  return Number(/zbývá (\d+)/.exec(text)?.[1] ?? Number.NaN);
}

async function openEditor(page: Page, url: string) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
  await expect(async () => {
    await page.goto(url);
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

test("trenažér 2D půdorysu: rozdělaný bungalov, 3 úkoly se samoodškrtáváním a rozváděč bez odečtu kreditu", async ({ page }) => {
  test.setTimeout(360_000);
  const before = await credits(page);
  expect(before).toBeGreaterThan(0);
  // V horní liště půdorysu i v seznamu půdorysů
  await page.goto("/panel-builder/floorplan");
  await expect(page.getByTestId("floorplan-trainer-open")).toHaveAttribute("href", "/panel-builder/floorplan/trenazer");

  await openEditor(page, "/panel-builder/floorplan/trenazer");
  const trainer = page.getByTestId("floorplan-trainer");
  await expect(trainer).toHaveAttribute("data-current", "bed-socket");
  await expect(page.getByTestId("floorplan-save-status")).toHaveAttribute("data-state", "trainer");
  await expect(page.getByTestId("floorplan-name")).toContainText("Cvičný bungalov 4+kk");
  // Rozdělaný dům: místnosti, nábytek a rozváděč RH s trasami kabelů; nový uživatel nemá tahák navíc
  await expect(page.getByTestId("live-checklist")).toHaveCount(0);
  await expect(page.getByTestId("trainer-target")).toBeAttached();
  await expect(page.getByTestId("palette").locator('[data-entry="double-socket"][data-trainer-focus="true"] button').first()).toHaveClass(/trainer-pulse/);

  // Úkol 1: dvojzásuvka u postele → trasa kabelu po stěně
  await trainer.getByTestId("trainer-pick-tool").click();
  await clickAt(page, 11400, 1250);
  await expect(trainer).toHaveAttribute("data-current", "bath-dimmer");
  await expect(trainer.getByTestId("trainer-done-1")).toContainText("kabel automaticky oběhl stěnu místnosti");
  await expect(page.getByTestId("trainer-target")).toHaveCount(0);

  // Úkol 2: stmívání stropního svítidla v koupelně → stmívací akční člen ABB-free@home v rozváděči
  await page.keyboard.press("Escape");
  await trainer.getByTestId("trainer-show-light").click();
  await page.getByTestId("light-dim").check();
  await expect(trainer).toHaveAttribute("data-current", "generate");
  await expect(trainer.getByTestId("trainer-done-2")).toContainText("DA/M.4.210.2.1");
  await expect(page.getByTestId("floorplan-editor")).toHaveAttribute("data-trainer-step", "generate");

  // Úkol 3: ⚡ Vygenerovat rozváděč → AI Panel Builder s gratulací, kredit beze změny
  await trainer.getByTestId("trainer-generate").click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/?]+\?trenazer=hotovo/, { timeout: 180_000 });
  await expect(page.getByTestId("trainer-congrats")).toContainText("Gratulujeme");
  const checklist = page.getByTestId("panel-checklist");
  await expect(checklist).toHaveAttribute("data-trainer", "true");
  await expect(checklist).toContainText("Rozváděč z cvičného bungalovu");
  expect(await credits(page)).toBe(before);
});

test("živý tahák vlastní zakázky: odškrtává se sám, tlačítka vedou na správné místo, pilulka a vypnutí", async ({ page }) => {
  test.setTimeout(300_000);
  await openEditor(page, "/panel-builder/floorplan/novy");
  const list = page.getByTestId("live-checklist");
  await expect(list).toHaveAttribute("data-current", "base");
  await expect(page.getByTestId("live-checklist-change-series")).toBeVisible();
  await expect(page.getByTestId("live-checklist-series-detail")).toContainText("ABB");

  // 1) místnost X × Y
  const form = page.getByTestId("room-by-size");
  await form.getByTestId("room-size-name").fill("Obývací pokoj");
  await form.getByTestId("room-size-x").fill("5");
  await form.getByTestId("room-size-y").fill("4");
  await form.getByTestId("room-size-create").click();
  await expect(page.getByTestId("live-checklist-base")).toHaveAttribute("data-ok", "true");
  await expect(list).toHaveAttribute("data-current", "panel");

  // 3) [Vybrat rozváděč RH] rovnou aktivuje pokládku rozváděče
  const room = await page.locator('[data-room="Obývací pokoj"]').first().evaluate((node) => {
    const box = (node as SVGGraphicsElement).getBBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  await page.getByTestId("live-checklist-pick-panel").click();
  await clickAt(page, room.x - 1200, room.y);
  await expect(page.getByTestId("live-checklist-panel")).toHaveAttribute("data-ok", "true");

  // 4) zásuvka a světlo – živé počty
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  await palette.getByRole("button", { name: "Dvojzásuvka", exact: false }).first().click();
  await clickAt(page, room.x + 800, room.y);
  await palette.getByRole("button", { name: "Stropní svítidlo", exact: false }).first().click();
  await clickAt(page, room.x, room.y + 600);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("live-checklist-devices")).toHaveAttribute("data-ok", "true");
  await expect(page.getByTestId("live-checklist-devices-detail")).toHaveText("1 zásuvka · 1 světlo · 0 spotřebičů");
  await expect(list).toHaveAttribute("data-current", "output");
  await expect(page.getByTestId("live-checklist-bom")).toContainText("KOPOS");

  // 2) [Změnit řadu/barvu] otevře galerii řad
  await page.getByTestId("live-checklist-change-series").click();
  await expect(page.getByTestId("series-gallery")).toBeVisible();
  await page.keyboard.press("Escape");

  // Pilulka „🧭 Tahák (4/5 hotovo)“ a zpět; trvalé vypnutí a zapnutí v liště
  await page.getByTestId("live-checklist-minimize").click();
  await expect(page.getByTestId("live-checklist-pill")).toHaveText("🧭 Tahák (4/5 hotovo)");
  await page.getByTestId("live-checklist-pill").click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByTestId("live-checklist-off").click();
  await expect(list).toHaveCount(0);
  await page.getByTestId("live-checklist-on").click();
  await expect(page.getByTestId("live-checklist")).toBeVisible();
});

test("tréninkové zakázky na 1 klik bez kreditu: RD + FVE s chybou pro Elektro-linter a opravou jedním klikem", async ({ page }) => {
  test.setTimeout(300_000);
  const before = await credits(page);
  // Firma Tester má vlastní projekty → zakázky za tlačítkem „🎯 Vyzkoušet nanečisto (Trenažér zdarma)“
  await page.getByTestId("trainer-jobs-open").click();
  const jobs = page.getByTestId("trainer-jobs");
  await expect(jobs.getByText("TRENAŽÉR – 0 kreditů")).toHaveCount(4);
  await expect(jobs.getByTestId("trainer-job-byt-3kk")).toContainText("Bytová rozvodnice 48M");
  await expect(jobs.getByTestId("trainer-job-floorplan")).toHaveAttribute("href", "/panel-builder/floorplan/trenazer");
  await jobs.getByTestId("trainer-job-open-rd-fve").click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/?]+$/, { timeout: 180_000 });
  const projectUrl = page.url();

  const checklist = page.getByTestId("panel-checklist");
  await expect(checklist).toHaveAttribute("data-trainer", "true");
  await expect(checklist.getByTestId("panel-checklist-defect")).toContainText("Wallbox");
  await expect(checklist.getByTestId("panel-checklist-recognition")).toHaveAttribute("data-ok", "false");
  await expect(checklist.getByTestId("panel-checklist-recognition-task")).toContainText("Opravit 1 klikem");

  // Elektro-linter v kroku 1: chránič wallboxu typu A → oprava jedním klikem na typ B
  await page.getByTestId("linter-badge").click();
  await page.getByRole("button", { name: /\[Opravit 1 klikem\] Přepnout/ }).first().click();
  await expect(checklist.getByTestId("panel-checklist-recognition")).toHaveAttribute("data-ok", "true", { timeout: 60_000 });

  // Krok 4: oteplení zkontrolované otevřením kroku
  await page.goto(`${projectUrl}/thermal`);
  await expect(page.getByTestId("panel-checklist-thermal")).toHaveAttribute("data-ok", "true", { timeout: 60_000 });

  // Podruhé se otevře stejná zakázka, kredit beze změny
  expect(await credits(page)).toBe(before);
  await page.getByTestId("trainer-jobs-open").click();
  await expect(page.getByTestId("trainer-job-open-rd-fve")).toHaveText("Pokračovat v zakázce");
});

test("oddělené světy: v Panel Builderu nic ze Správy závodů, v závodě nic z půdorysů a Panel Builderu", async ({ page }) => {
  test.setTimeout(240_000);
  for (const url of ["/panel-builder", "/panel-builder/floorplan"]) {
    await page.goto(url);
    await expect(page.getByTestId("plant-guide-open")).toHaveCount(0);
    await expect(page.getByTestId("industrial-onboarding-card")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/Průvodce závodem|noční poruchy/);
  }
  await page.goto("/app");
  await expect(page).toHaveURL(/\/plant\//, { timeout: 60_000 });
  await expect(page.getByTestId("plant-guide-open")).toBeVisible();
  for (const id of ["floorplan-trainer", "live-checklist", "trainer-jobs", "trainer-jobs-closed", "panel-checklist"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await page.getByTestId("plant-guide-open").click();
  const dialog = page.getByTestId("industrial-onboarding");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("onboarding-modes")).toBeVisible();
  await expect(dialog).not.toContainText(/půdorys|bungalov|Panel Builder|vypínač|zásuvk/i);
});

test("mise noční poruchy linky: mapa / QR, Červenka ve schématu, EU 2023/1230, simulátor 60 kW a Kniha revizí", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/plant\//, { timeout: 60_000 });
  await page.goto(`${page.url().split("?")[0]}?pruvodce=mise`);
  const mission = page.getByTestId("onboarding-mission");
  await expect(mission).toHaveAttribute("data-current", "locate");
  await page.getByTestId("mission-machine-pin").click();
  await expect(mission).toHaveAttribute("data-current", "redline");
  await expect(page.getByTestId("mission-sheet").locator("svg")).toBeVisible({ timeout: 30_000 });

  // ✏️ Červenka: červená poznámka do výkresu
  await page.getByTestId("mission-redline").click();
  const box = (await page.getByTestId("mission-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.mouse.down();
  for (let step = 1; step <= 12; step++) await page.mouse.move(box.x + box.width * (0.3 + step * 0.02), box.y + box.height * (0.4 + Math.sin(step / 2) * 0.05));
  await page.mouse.up();
  await expect(page.getByTestId("mission-redline-sent")).toBeVisible();
  await expect(mission).toHaveAttribute("data-current", "backup", { timeout: 10_000 });

  // Zálohy SW (PLC/HMI) a hlídač legislativy
  await expect(page.getByTestId("mission-assessment")).toHaveAttribute("data-level", "NONE_1_TO_1");
  await expect(page.getByTestId("mission-assessment")).toContainText("2023/1230");
  await page.getByTestId("mission-backup-ok").click();

  // Simulátor zátěže a Kniha revizí
  await page.getByTestId("mission-simulate").click();
  await expect(page.getByTestId("mission-simulation").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("mission-simulation")).toContainText("RM-L2");
  await page.getByTestId("mission-logbook-open").click();
  await expect(page.getByTestId("mission-logbook")).toContainText("LIS-2");
  await expect(page.getByTestId("mission-finished")).toBeVisible({ timeout: 10_000 });
});

test("průvodce založením závodu: nová firma → hala s rozvodnou → stroj se vzorovým schématem → QR štítek a karta stroje", async ({ page }) => {
  test.setTimeout(300_000);
  await page.route("**/api/ares?ico=*", (route) => route.fulfill({ json: { ico: "12345679", companyName: "Lisovna Průvodce s.r.o.", dic: null, street: "Tovární 9", city: "Jablonec nad Nisou", zip: "466 01" } }));
  await page.goto("/register-plant");
  await page.getByLabel("IČO").fill("12345679");
  await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Lisovna Průvodce s.r.o.");
  await page.getByLabel("Kontaktní osoba (Technický ředitel)").fill("Ing. Petra Průvodcová");
  await page.getByLabel("Telefon").fill("+420 777 920 920");
  await page.getByLabel("Název prvního závodu").fill("Závod Jablonec – Lisovna");
  await page.getByLabel("E-mail (přihlášení)").fill(`pruvodce-${Date.now()}@lisovna.example`);
  await page.getByLabel("Heslo (min. 10 znaků)").fill("Lisovna2026!");
  await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
  await page.getByRole("button", { name: "Registrovat závod a přihlásit se" }).click();
  await expect(page).toHaveURL(/\/plant\//, { timeout: 60_000 });
  const plantUrl = page.url().split("?")[0];

  // Nový závod: karta průvodce na stránce (nic neblokuje), režim A
  const card = page.getByTestId("industrial-onboarding-card");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByTestId("onboarding-mode-build").click();
  const build = page.getByTestId("onboarding-build");
  await expect(build).toHaveAttribute("data-step", "1");
  await page.getByLabel("Název první výrobní haly").fill("Hala 1 – Výroba");
  await page.getByTestId("onboarding-hall-submit").click();
  await expect(page.getByTestId("onboarding-hall-done")).toContainText("HR-1", { timeout: 60_000 });

  await page.getByLabel("Název stroje / rozváděče").fill("CNC Centrum 1");
  await page.getByLabel("Příkon [kW]").fill("22");
  await page.getByTestId("onboarding-sample-schematic").click();
  await expect(page.getByTestId("onboarding-schematic")).toContainText("Vzorové schéma");
  await page.getByTestId("onboarding-machine-submit").click();
  const ready = page.getByTestId("onboarding-ready");
  await expect(ready).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("onboarding-qr").locator("svg")).toBeVisible();
  await expect(page.getByTestId("onboarding-label-40")).toHaveAttribute("href", /\/label\?format=40$/);
  const cardHref = (await page.getByTestId("onboarding-open-card").getAttribute("href"))!;
  await expect(page.getByTestId("onboarding-open-redline")).toHaveAttribute("href", `${cardHref}/change-request`);

  // Čtvercový štítek 20 × 20 mm k tisku
  await page.goto(`${cardHref}/label?format=20`);
  await expect(page.getByTestId("qr-square-label")).toHaveAttribute("data-size", "20");

  // Karta stroje s platnou revizí v1.0; hala v mapě areálu
  await page.goto(cardHref);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("CNC Centrum 1");
  await expect(page.locator("main")).toContainText("v1.0");
  await page.goto(plantUrl);
  await expect(page.locator("main")).toContainText("Hala 1 – Výroba");
  await expect(page.getByTestId("industrial-onboarding-card")).toHaveCount(0);
});

test("reálné fotky řad: velín vloží fotku přes Ctrl+V, uloží se trvale a vidí ji všichni; bez velínu 403", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const manifestBefore = await readFile(PHOTO_MANIFEST, "utf8").catch(() => null);
  try {
    // Bez přihlášení do velínu nahrávání odmítne a v galerii není přepínač
    const refused = await page.request.post("/api/catalog-images/upload", { multipart: { series: "ABB|Tango", part: "socket", color: "abb-tango-n", file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } } });
    expect(refused.status()).toBe(403);

    // Velín
    await page.goto("/superadmin/login");
    await page.getByLabel("Heslo velínu").fill("eldock2026");
    await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("SuperAdmin velín", { timeout: 60_000 });

    await openEditor(page, "/panel-builder/floorplan/novy");
    await page.getByTestId("wizard-step-2").click();
    await page.getByTestId("series-gallery-open").click();
    const gallery = page.getByTestId("series-gallery");
    await gallery.getByTestId("gallery-series-Tango").click();
    await gallery.getByTestId("gallery-color").filter({ hasText: "Černá" }).first().click();
    await gallery.getByTestId("gallery-upload-toggle").click();
    const slot = gallery.getByTestId("photo-slot-socket");
    await slot.click();
    await expect(slot).toHaveAttribute("data-selected", "true");

    // Ctrl+V: obrázek ve schránce (PNG z canvasu) → vložit do vybraného slotu
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, 320, 320);
      ctx.fillStyle = "#e4e4e7";
      ctx.fillRect(80, 80, 160, 160);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), "image/png"));
      const data = new DataTransfer();
      data.items.add(new File([blob], "zasuvka-tango-cerna.png", { type: "image/png" }));
      document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(slot).toHaveAttribute("data-real", "true", { timeout: 60_000 });
    await expect(slot.locator("img")).toHaveAttribute("src", /^\/api\/catalog-images\/file\/abb\/tango\/abb-tango-n-socket\.webp\?v=/);

    // Jiný uživatel bez velínu: stejná fotka po novém otevření, přepínač nahrávání nemá
    const other = await browser.newContext({ storageState: "e2e/.auth/state.json" });
    const view = await other.newPage();
    await openEditor(view, "/panel-builder/floorplan/novy");
    await view.getByTestId("wizard-step-2").click();
    await view.getByTestId("series-gallery-open").click();
    const otherGallery = view.getByTestId("series-gallery");
    await otherGallery.getByTestId("gallery-series-Tango").click();
    await otherGallery.getByTestId("gallery-color").filter({ hasText: "Černá" }).first().click();
    await expect(otherGallery.locator('[data-slot="socket"]')).toHaveAttribute("data-real", "true", { timeout: 30_000 });
    await expect(otherGallery.getByTestId("gallery-upload-toggle")).toHaveCount(0);
    await other.close();
  } finally {
    // Úklid: fotka a manifest úložiště jako před testem
    await rm(PHOTO_FILE, { force: true });
    if (manifestBefore === null) await rm(PHOTO_MANIFEST, { force: true });
    else await writeFile(PHOTO_MANIFEST, manifestBefore);
  }
});
