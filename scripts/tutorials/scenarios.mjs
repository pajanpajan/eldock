// Fáze 87: scénáře video-návodů – co se v každé kapitole děje na obrazovce. Kapitola dostane režiséra (`Director`)
// a časovou osu komentáře (`Chapter`): akce čekají na slovo nebo titulek, o kterém hlas právě mluví
// (`ch.until({ word: "Levit", cue: 1 }, 300)` = kurzor vyrazí 300 ms předem). Texty komentáře jsou v `src/lib/tutorials.ts`.

import { SAFE } from "./director.mjs";

// ---------------------------------------------------------------- 2D půdorys & kabeláž

/** Místnosti nákresu v mm (plocha 20 × 16 m): obývací pokoj s kuchyní a koupelna. */
const ROOMS = [
  { name: "Obývací pokoj", from: [1000, 1000], to: [9000, 7000] },
  { name: "Koupelna", from: [9000, 1000], to: [12500, 4500] },
];

const editor = (page) => ({
  canvas: page.getByTestId("floorplan-canvas"),
  palette: page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" }),
});

/**
 * Plátno nahoru pod lištu kroku – celý nákres nad titulkovou lištou. Lišta kroku nad plátnem mění podle režimu
 * (vkládání / výběr) výšku a plátno poskočí o pár desítek px – v toleranci se stránka neposouvá.
 */
async function frameCanvas(d) {
  const { canvas } = editor(d.page);
  const top = await canvas.evaluate((svg) => svg.getBoundingClientRect().top);
  if (top >= 105 && top <= 235) return;
  const scrollY = await d.page.evaluate(() => window.scrollY);
  await d.scrollTo(Math.max(0, Math.round(scrollY + top - 150)));
}

/** Paleta po jedné kategorii – položky jsou vždy nahoře a stránka se při výběru neposouvá. */
async function openGroup(d, group) {
  const { palette } = editor(d.page);
  const single = palette.getByTestId("palette-single");
  if (!(await single.isChecked())) await d.click(single, { after: 160 });
  const toggle = palette.getByTestId(`palette-toggle-${group}`);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await d.click(toggle, { after: 180 });
}

/**
 * Prvek z palety (`[data-entry]` nebo „label:…“) na body plánu v mm; po vložení Esc (konec vkládání) a Esc (bez výběru).
 * `group` = kategorie, která se otevře v režimu „jen jedna“ (null = položka je vidět v rozbalené paletě).
 */
async function place(d, group, entry, points, { keepSelected = false } = {}) {
  const { canvas, palette } = editor(d.page);
  if (group) await openGroup(d, group);
  const item = entry.startsWith("label:") ? palette.getByRole("button", { name: entry.slice(6), exact: false }).first() : palette.locator(`[data-entry="${entry}"] > button`).first();
  await d.click(item, { after: 140 });
  await frameCanvas(d);
  for (const [x, y] of points) {
    const at = await d.planPoint(canvas, x, y);
    await d.clickAt(at.x, at.y, { after: 200 });
  }
  await d.press("Escape", 100);
  if (!keepSelected) await d.press("Escape", 100);
}

/**
 * Fáze 89: krok průvodce 2D půdorysem (1 podklad a místnosti, 2 systém a design, 3 osazení, 4 trasy, 5 výstupy) –
 * nad plátnem je vždy jen lišta aktivního kroku, kapitola videa proto začíná kliknutím na svůj krok.
 */
async function wizardStep(d, step) {
  const wizard = d.page.getByTestId("floorplan-wizard");
  if (!(await wizard.isVisible().catch(() => false))) return;
  if ((await wizard.getAttribute("data-step")) === String(step)) return;
  await d.click(d.page.getByTestId(`wizard-step-${step}`), { after: 250 });
  await d.page
    .waitForFunction((wanted) => document.querySelector('[data-testid="floorplan-wizard"]')?.getAttribute("data-step") === String(wanted), step, { timeout: 10_000 })
    .catch(() => {});
}

/** Rychlý název vybrané místnosti v detailu místnosti (pravý sloupec). */
async function nameRoom(d, name) {
  const detail = d.page.getByTestId("room-detail");
  const chip = detail.getByRole("group", { name: "Rychlé názvy místností" }).getByRole("button", { name, exact: true });
  if (await chip.isVisible().catch(() => false)) await d.click(chip, { after: 200 });
}

/** Místnost tažením: nástroj v liště kroku 1, tah po plátně (posun stránky jen když by místnost byla mimo obraz) a rychlý název. */
async function drawRoom(d, room, { name = true } = {}) {
  const { page } = d;
  const { canvas } = editor(page);
  await d.click(page.getByRole("button", { name: "Kreslit místnost (obdélník)" }), { after: 150 });
  let from = await d.planPoint(canvas, ...room.from);
  let to = await d.planPoint(canvas, ...room.to);
  if ([from, to].some((point) => point.y < SAFE.top + 60 || point.y > SAFE.bottom)) {
    await frameCanvas(d);
    from = await d.planPoint(canvas, ...room.from);
    to = await d.planPoint(canvas, ...room.to);
  }
  await d.drag(from, to, { ms: 700, steps: 18, hold: 100 });
  if (name) await nameRoom(d, room.name);
}

const pudorys = {
  async prepare(d) {
    const { page } = d;
    await page.goto("/panel-builder/floorplan");
    await page.getByTestId("floorplan-new").waitFor({ timeout: 120_000 });
    await d.idle();
    await d.glide(1180, 520, 400);
  },
  chapters: [
    // 1. Úvod, plocha a měřítko – nový půdorys, místnosti tažením, podklad PDF / DXF, kalibrace a plocha až 100 × 100 m
    async (d, ch) => {
      const { page } = d;
      await d.point(page.getByTestId("floorplan-new"), { hold: 150 });
      await ch.until({ cue: 0, offset: 900 });
      await d.click(page.getByTestId("floorplan-new"), { after: 150 });
      await editor(page).canvas.waitFor({ timeout: 120_000 });
      await d.idle(4000);
      const firstCanvas = await editor(page).canvas.elementHandle();
      await drawRoom(d, ROOMS[0], { name: false });
      // první změna založí půdorys na serveru (/novy → /<id>) a editor se přemontuje (klíč = id) – úpravy z doby před
      // přemontováním se ztratí; počkat na nový editor a teprve pak první místnost pojmenovat. Průvodce od fáze 90
      // zůstává na kroku 1 (krok v sessionStorage podle id půdorysu), wizardStep(d, 1) je jen pojistka.
      await page.waitForURL(/\/panel-builder\/floorplan\/(?!novy)[^/?#]+$/, { timeout: 30_000 }).catch(() => {});
      for (let round = 0; round < 40 && (await firstCanvas?.evaluate((element) => element.isConnected).catch(() => false)); round++) await d.sleep(100);
      await editor(page).canvas.waitFor({ timeout: 30_000 });
      await d.sleep(300);
      await wizardStep(d, 1);
      const middle = await d.planPoint(editor(page).canvas, 5000, 4000);
      await d.clickAt(middle.x, middle.y, { after: 250 });
      await nameRoom(d, ROOMS[0].name);
      await drawRoom(d, ROOMS[1]);
      await ch.until({ word: "nahrát", cue: 2 }, 500);
      await d.point(page.locator('[data-tour="floorplan-upload"]'), { hold: 450 });
      await ch.until({ word: "zkalibrovat", cue: 2 }, 500);
      await d.point(page.locator('[data-tour="floorplan-calibrate"]'), { hold: 450 });
      const preset = page.getByTestId("plane-preset");
      await ch.until({ word: "plochu", cue: 3 }, 700);
      await d.select(preset, "hall", { after: 500 });
      await ch.until({ word: "metrů", cue: 3 }, 400);
      await d.select(preset, "house", { after: 250 });
      // ⛶ Přizpůsobit pohled – plátno se přiblíží na nakreslené místnosti
      await d.click(page.getByTestId("plane-fit"), { after: 200 });
    },
    // 2. Výrobci, designové řady a barvy (+ sběrnicová úroveň instalace u chytré domácnosti)
    async (d, ch) => {
      const { page } = d;
      const appearance = page.getByTestId("device-appearance");
      const brands = appearance.getByRole("radiogroup", { name: "1. Výrobce" });
      const series = appearance.getByRole("radiogroup", { name: "2. Designová řada" });
      const colors = appearance.getByTestId("insert-colors");
      const families = appearance.getByTestId("abb-families");
      const level = page.getByLabel("Úroveň instalace");
      await wizardStep(d, 2);
      await d.reveal(appearance);
      await ch.until({ word: "výrobce" }, 450);
      await d.click(brands.getByRole("radio", { name: /Schneider/ }).first());
      await ch.until({ word: "řadu" }, 350);
      await d.click(series.getByRole("radio").nth(1));
      await ch.until({ word: "barvu" }, 350);
      await d.click(colors.getByRole("radio").nth(1));
      await ch.until({ word: "ABB", cue: 1 }, 450);
      await d.click(brands.getByRole("radio", { name: "ABB", exact: true }));
      await d.click(series.getByRole("radio", { name: "Zoni", exact: true }));
      await d.click(series.getByRole("radio", { name: "Levit M", exact: true }));
      // chytrá domácnost = sběrnicová úroveň instalace (ČSN 33 2130 ed. 4)
      await ch.until({ word: "chytré", cue: 1 }, 500);
      await d.select(level, "bus_loxone", { after: 300 });
      if (await families.isVisible().catch(() => false)) await d.click(families.getByRole("radio").nth(1), { after: 350 });
      await d.click(appearance.getByTestId("smart-brand-Loxone"), { after: 350 });
      await d.click(appearance.getByTestId("smart-brand-TapHome"), { after: 350 });
      await ch.until({ word: "Kdykoliv", cue: 2 }, 300);
      await d.select(level, "classic", { after: 250 });
      await d.click(brands.getByRole("radio", { name: "ABB", exact: true }), { after: 200 });
      if (await families.isVisible().catch(() => false)) await d.click(families.getByRole("radio").first(), { after: 200 });
      await d.click(appearance.getByTestId("series-gallery-open"), { after: 600 });
      const gallery = page.getByTestId("series-gallery");
      await d.click(gallery.getByTestId("gallery-color").nth(2), { after: 500 });
      await ch.until({ word: "objednací", cue: 2 }, 300);
      await d.point(gallery.getByTestId("gallery-details"), { hold: 500 });
      await d.click(gallery.getByTestId("gallery-apply"), { after: 300 });
    },
    // 3. Rozváděč, zásuvky, vypínač, ⭐, žaluzie, čidlo, spotřebič, svítidlo se stmíváním a RGBW, vana a umyvadlo
    async (d, ch) => {
      const { page } = d;
      await wizardStep(d, 3);
      await frameCanvas(d);
      // sbalené sestavy ve víceramečku – celá paleta je pak vidět nad titulkovou lištou
      const assemblies = page.getByTestId("assembly-palette-toggle");
      if ((await assemblies.getAttribute("aria-expanded").catch(() => null)) === "true") await d.click(assemblies, { after: 200 });
      // rozváděč, zásuvky a vypínač jsou v rozbalené paletě nahoře – bez přepínání kategorií
      await place(d, null, "panel", [[1500, 6400]]);
      await place(d, null, "double-socket", [[3000, 1350], [7000, 1350]]);
      await place(d, null, "switch-1", [[8650, 6300]]);
      // „připnout hvězdičkou“ – vypínač jde do ⭐ Oblíbených
      const star = editor(page).palette.locator('[data-entry="switch-1"]').getByRole("button", { name: "Oblíbené" }).first();
      if (await star.isVisible().catch(() => false)) await d.click(star, { after: 350 });
      await place(d, "shading", "blind-motor", [[5000, 1200]]);
      await place(d, "shading", "window-contact", [[5800, 1200]]);
      await place(d, "appliances", "label:Trouba", [[8550, 2700]]);
      await ch.until({ cue: 3 }, 600);
      await place(d, "lights", "ceiling-light", [[5000, 4000]], { keepSelected: true });
      const dim = page.getByTestId("light-dim").first();
      if (await dim.isVisible().catch(() => false)) {
        await d.click(dim, { after: 300 });
        await d.click(page.getByTestId("light-color").first(), { after: 400 });
      }
      // Esc z fokusovaného zaškrtávátka editor nebere – nejdřív fokus pryč, pak zrušit výběr svítidla
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
      await d.press("Escape", 100);
      await frameCanvas(d);
      await place(d, "fixtures", "bath", [[10750, 1500]]);
    },
    // 4. Trasy kabelů po stěnách, posun úseku myší, vedení spodem / vrchem a oko okruhu
    async (d, ch) => {
      const { page } = d;
      const { canvas } = editor(page);
      await wizardStep(d, 4);
      await frameCanvas(d);
      const route = canvas.getByTestId("cable-route").first();
      if (await route.count()) await d.point(route, { hold: 700 });
      await ch.until({ cue: 2 }, 600);
      // vybraný okruh dostane úchyty úseků – svislý úsek po levé stěně jde posunout jen v ose X (na horní stěně jsou
      // vývod žaluzie a okenní kontakt – tah by chytil je)
      await d.click(page.locator('[data-testid="circuit-row"][data-layer="sockets"]').first(), { after: 500 });
      await frameCanvas(d);
      const segment = await page.evaluate(() => {
        const lines = [...document.querySelectorAll('[data-testid="route-segment"][data-axis="vertical"]')];
        const best = lines.sort((a, b) => Math.abs(b.y2.baseVal.value - b.y1.baseVal.value) - Math.abs(a.y2.baseVal.value - a.y1.baseVal.value))[0];
        if (!best) return null;
        const box = best.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height * 0.45 };
      });
      if (segment && segment.y > SAFE.top && segment.y < SAFE.bottom) await d.drag(segment, { x: segment.x + 40, y: segment.y }, { ms: 800 });
      await ch.until({ cue: 3 }, 500);
      await d.click(page.getByRole("radio", { name: /Spodem \(v podlaze\)/ }).first(), { after: 450 });
      await d.click(page.getByRole("radio", { name: /Vrchem/ }).first(), { after: 450 });
      await d.click(page.getByRole("radio", { name: /Optimalizovaně \(Auto\)/ }).first(), { after: 250 });
      await ch.until({ cue: 4 }, 500);
      const eye = page.getByTestId("circuit-eye").first();
      await d.click(eye, { after: 800 });
      await d.click(eye, { after: 250 });
      await d.press("Escape", 150);
    },
    // 5. Kusovník s objednacími čísly, export PDF / DXF a rozváděč z půdorysu na 1 klik
    async (d, ch) => {
      const { page } = d;
      // krok 5 průvodce: kusovník, export a žluté „⚡ Vygenerovat rozváděč z tohoto půdorysu“ v jedné liště
      await wizardStep(d, 5);
      const bom = page.getByTestId("wizard-bom");
      await d.click((await bom.isVisible().catch(() => false)) ? bom : page.getByTestId("wiring-bom-open").first(), { after: 700 });
      const table = page.getByTestId("wiring-bom-table");
      if (await table.isVisible().catch(() => false)) {
        await d.point(table, { hold: 500, position: { x: 300, y: 90 } });
        await table.evaluate((element) => element.closest("[role=dialog]")?.scrollBy({ top: 300, behavior: "smooth" }));
        await d.sleep(800);
      }
      await d.press("Escape", 250);
      await ch.until({ cue: 1 }, 500);
      await d.click(page.getByTestId("export-pdf").first(), { after: 900 });
      await d.press("Escape", 250);
      await d.point(page.getByTestId("export-dxf").first(), { hold: 350 });
      await ch.until({ cue: 2 }, 600);
      const name = page.getByLabel("Název rozváděče");
      await d.click(name, { after: 100 });
      await name.fill("RH – rodinný dům Novák");
      const environment = page.getByTestId("floorplan-environment");
      if (await environment.isVisible().catch(() => false)) await d.select(environment, "INDOOR_DRY", { after: 200 });
      const generate = page.getByTestId("wizard-generate");
      await d.click((await generate.isVisible().catch(() => false)) ? generate : page.getByTestId("generate-from-floorplan"), { after: 200 });
      await page.waitForURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 120_000 });
      await page.getByTestId("vector-panel").waitFor({ timeout: 120_000 });
      await d.idle(4000);
      await d.point(page.getByTestId("vector-panel"), { hold: 600 });
    },
  ],
};

// ---------------------------------------------------------------- AI Panel Builder

/** Počká, až konfigurátor dokončí vložení (tlačítka jsou během serverové akce vypnutá). */
async function insertDone(card) {
  for (let round = 0; round < 100; round++) {
    if (await card.getByTestId("insert-1").isEnabled().catch(() => true)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Fáze 98: projekt rozváděče má 4 fáze (`PANEL_PHASES`) – kapitola přejde na svou fázi kliknutím na krokovou kartu
 * (`panel-phase-N`) nebo na část fáze (`panel-page-enclosure` = 1b, `panel-page-labels` = 4b) a počká na její stránku.
 */
async function openPanelPage(d, testId, url) {
  const { page } = d;
  await d.click(page.getByTestId(testId).first(), { after: 200 });
  await page.waitForURL(url, { timeout: 120_000 });
}

const panelBuilder = {
  async prepare(d) {
    const { page } = d;
    await page.goto("/panel-builder");
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).waitFor({ timeout: 120_000 });
    await d.idle();
    await d.glide(1100, 520, 400);
  },
  chapters: [
    // Úvod – založení projektu (fotka / půdorys / od nuly), soustava 1f / 3f, volitelná rozvodnice a 4 fáze projektu
    async (d, ch) => {
      const { page } = d;
      await d.click(page.getByRole("button", { name: "Nový projekt rozváděče" }), { after: 500 });
      const name = page.getByLabel("Název rozváděče");
      await d.click(name, { after: 100 });
      await name.fill("Rozvodnice RD Novák");
      const modes = page.getByTestId("project-modes");
      await ch.until({ word: "vyfocením", cue: 1 }, 450);
      await d.point(modes.getByRole("button", { name: /Pasport z fotek/ }), { hold: 450 });
      await ch.until({ word: "půdorysu", cue: 1 }, 450);
      await d.point(modes.getByRole("link", { name: /2D půdorys/ }), { hold: 350 });
      await ch.until({ word: "nuly", cue: 1 }, 350);
      await d.click(modes.getByRole("button", { name: /Navrhnout od nuly/ }), { after: 250 });
      await ch.until({ word: "jednofázovou", cue: 2 }, 350);
      const supply = page.getByTestId("supply-select");
      await d.select(supply, "1F_TNS", { after: 350 });
      await d.select(supply, "3F_TNCS", { after: 250 });
      const choice = page.getByTestId("enclosure-choice");
      await d.click(choice.getByTestId("enclosure-choice-toggle"), { after: 300 });
      await d.select(choice.getByTestId("enclosure-brand"), "ABB", { after: 200 });
      const series = choice.getByTestId("enclosure-series");
      // Fáze 88: MISTRAL65 3 × 18 M (1SLM006501A1208) je v ověřené řadě Mistral65 z katalogu ABB pro ČR
      await series.locator('option[value="mistral65|cat"]').waitFor({ state: "attached", timeout: 30_000 });
      await d.select(series, "mistral65|cat", { after: 200 });
      const model = choice.getByTestId("enclosure-model");
      const value = await model.locator("option", { hasText: "1SLM006501A1208" }).getAttribute("value");
      await d.select(model, value, { after: 400 });
      await d.point(choice.getByTestId("enclosure-choice-summary"), { hold: 400 });
      await d.click(page.getByRole("button", { name: /Založit návrh rozváděče/ }), { after: 200 });
      await page.waitForURL(/\/panel-builder\/[^/]+$/, { timeout: 120_000 });
      await page.getByTestId("vector-panel").waitFor({ timeout: 120_000 });
      await d.idle(4000);
      // „ve čtyřech fázích“ – kurzor přejede krokové karty fází 1 → 4 nad plátnem
      await ch.until({ word: "čtyřech", cue: 3 }, 400);
      for (const phase of [1, 2, 3, 4]) await d.point(page.getByTestId(`panel-phase-${phase}`), { hold: phase === 1 ? 500 : 320 });
    },
    // Fáze 1 – 1a osazení DIN lišt z kaskádového katalogu, chytrá domácnost a Elektro-linter s opravou 1 klikem, 1b skříň
    async (d, ch) => {
      const { page } = d;
      const menu = page.getByRole("region", { name: "Konfigurátor prvku" });
      const card = page.getByTestId("placement-card");
      await d.reveal(page.getByTestId("vector-panel"), { block: "start" });
      await d.click(menu.getByRole("button", { name: "ABB", exact: true }), { after: 300 });
      const insert = async (chip, times = 1) => {
        await d.click(menu.getByRole("button", { name: chip, exact: true }).first(), { after: 250 });
        const button = times === 1 ? card.getByTestId("insert-1") : card.getByRole("button", { name: `Vložit ${times}× na aktivní lištu` });
        await d.click(button, { after: 250 });
        await insertDone(card);
      };
      await insert("Hlavní vypínač");
      await insert("Chránič");
      await ch.until({ word: "akčních", cue: 1 }, 500);
      const smart = menu.getByRole("button", { name: /Chytrá domácnost/ }).first();
      if (await smart.isVisible().catch(() => false)) await d.point(smart, { hold: 600 });
      await insert("Zásuvky", 3);
      await insert("Kuchyně");
      await insert("Světla");
      await insert("Světla");
      await ch.until({ cue: 3 }, 700);
      const linter = page.getByTestId("linter");
      const badge = linter.getByTestId("linter-badge");
      if (await badge.isVisible().catch(() => false)) {
        await d.click(badge, { after: 500 });
        const issue = linter.locator('[data-rule="rcd-lighting-mixed"]');
        if (await issue.isVisible().catch(() => false)) {
          await d.point(issue, { hold: 600 });
          await ch.until({ word: "opraví", cue: 3 }, 600);
          await d.click(issue.getByRole("button", { name: /Opravit 1 klikem/ }), { after: 900 });
        }
      }
      await d.press("Escape", 150);
      // část 1b – skříň zvolená při zakládání (Mistral65 3 × 18 M): zaplnění, krytí a rezerva
      await ch.until({ cue: 4 }, 500);
      await openPanelPage(d, "panel-page-enclosure", /\/enclosure$/);
      await page.getByTestId("enclosure-current").waitFor({ timeout: 120_000 });
      await d.idle(4000);
      const lock = page.getByTestId("enclosure-lock");
      if (await lock.isVisible().catch(() => false)) await d.point(lock, { hold: 450 });
      await d.point(page.getByTestId("enclosure-current"), { hold: 700, position: { x: 260, y: 90 } });
    },
    // Fáze 2 – AI strom zapojení, fáze L1–L3, sběrnice PE, bod rozdělení PEN, nulové můstky a souhrn Elektro-linteru
    async (d, ch) => {
      const { page } = d;
      await openPanelPage(d, "panel-phase-2", /\/tree$/);
      const propose = page.getByRole("button", { name: "AI návrh zapojení na 1 klik" });
      await propose.waitFor({ timeout: 120_000 });
      await d.idle(4000);
      await d.click(propose, { after: 900 });
      await ch.until({ cue: 1 }, 300);
      const panel = page.getByTestId("vector-panel");
      const device = panel.getByRole("button", { name: /^-F2 / }).first();
      if (await device.isVisible().catch(() => false)) {
        await d.click(device, { after: 400 });
        const phase = page.getByTestId("tree-inspector").getByRole("button", { name: / fáze L/, pressed: true }).first();
        if (await phase.isVisible().catch(() => false)) await d.point(phase, { hold: 700 });
      }
      await ch.until({ cue: 2 }, 400);
      const strip = page.getByTestId("busbar-strip");
      await d.point(strip.getByTestId("busbar-PE"), { hold: 600 });
      await ch.until({ word: "PEN", cue: 2 }, 400);
      const pen = strip.getByText("PEN ⇄");
      if (await pen.isVisible().catch(() => false)) await d.point(pen, { hold: 600 });
      await ch.until({ cue: 3 }, 300);
      await d.point(strip.locator('[data-testid^="busbar-N"]').last(), { hold: 400 });
      await d.click(strip, { after: 1300 });
      await d.press("Escape", 200);
      // souhrn Elektro-linteru nad stromem (nálezy uloženého projektu, oprava 1 klikem vede do části 1a)
      await ch.until({ cue: 4 }, 500);
      const linter = page.getByTestId("tree-linter");
      if (await linter.isVisible().catch(() => false)) await d.point(linter, { hold: 900, position: { x: 260, y: 18 } });
    },
    // Fáze 3 – výpočet oteplení (ztráty, teplota nahoře, verdikt)
    async (d, ch) => {
      const { page } = d;
      await openPanelPage(d, "panel-phase-3", /\/thermal$/);
      await page.getByTestId("thermal-verdict").waitFor({ timeout: 120_000 });
      await d.idle(4000);
      await d.point(page.getByTestId("thermal-curve"), { hold: 700 });
      await ch.until({ cue: 1 }, 400);
      await d.point(page.getByTestId("thermal-table"), { hold: 700, position: { x: 220, y: 70 } });
      await d.point(page.getByTestId("thermal-curve"), { hold: 500 });
      await ch.until({ cue: 2 }, 400);
      await d.point(page.getByTestId("thermal-verdict"), { hold: 700 });
    },
    // Fáze 4 – 4a 6listový elaborát (osazení, 1P schéma, kusovník, kusová zkouška, vnější vlivy, prohlášení, CE), 4b popisky 1:1
    async (d, ch) => {
      const { page } = d;
      await openPanelPage(d, "panel-phase-4", /\/documentation$/);
      await page.getByTestId("documentation").waitFor({ timeout: 120_000 });
      await d.idle(4000);
      const print = page.getByRole("button", { name: /Vytisknout \/ Exportovat/ }).first();
      if (await print.isVisible().catch(() => false)) await d.point(print, { hold: 600 });
      const show = async (id, block) => {
        const sheet = page.getByTestId(id).first();
        if (!(await sheet.count())) return;
        await sheet.evaluate((element, where) => element.scrollIntoView({ block: where, behavior: "smooth" }), block);
        await d.settle(sheet);
        await d.sleep(700);
      };
      await ch.until({ cue: 1 }, 300);
      for (const id of ["doc-parts", "doc-routine-test", "doc-influences"]) await show(id, "start");
      await ch.until({ cue: 2 }, 300);
      for (const id of ["doc-declaration", "ce-label"]) await show(id, "center");
      // část 4b – štítky: kurzor se vrátí k přepínači částí fáze nahoře
      await ch.until({ cue: 3 }, 900);
      await openPanelPage(d, "panel-page-labels", /\/labels$/);
      await page.getByTestId("label-sheet").waitFor({ timeout: 120_000 });
      await d.idle(3000);
      await d.point(page.getByTestId("label-sheet"), { hold: 700, position: { x: 300, y: 200 } });
    },
  ],
};

export const SCENARIOS = { pudorys, "panel-builder": panelBuilder };
