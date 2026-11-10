// Fáze 87: „režisér“ video-návodů – akce nad skutečnou aplikací tak, aby byly vidět: kurzor nejdřív plynule dojede
// k cíli a teprve pak klikne, posuny stránky jsou plynulé a nic důležitého nezůstane pod titulkovou lištou.
// `Chapter` hlídá časovou osu komentáře – akce kapitoly čekají na slovo nebo titulek, o kterém hlas právě mluví.

/** Svislá oblast obrazovky bez titulkové lišty (lišta zabírá spodních ~200 px Full HD). */
export const SAFE = { top: 84, bottom: 850 };

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

const normalize = (value) =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}@]+/gu, "");

export class Chapter {
  /**
   * @param {{ audioStart: number; durationMs: number; cues: { start: number; end: number; words: { w: string; t: number }[] }[] }} timeline
   */
  constructor(timeline) {
    this.audioStart = timeline.audioStart;
    this.durationMs = timeline.durationMs;
    this.cues = timeline.cues;
  }

  /** Čas (epoch ms) bodu komentáře: číslo = ms od začátku komentáře, `{ cue }`, `{ word, cue? }` nebo "end". */
  at(spec) {
    if (typeof spec === "number") return this.audioStart + spec;
    if (spec === "end") return this.audioStart + this.durationMs;
    if (spec && typeof spec.word === "string") {
      const wanted = normalize(spec.word);
      for (let index = spec.cue ?? 0; index < this.cues.length; index++) {
        const word = this.cues[index].words.find((entry) => normalize(entry.w).startsWith(wanted));
        if (word) return this.audioStart + word.t + (spec.offset ?? 0);
      }
      throw new Error(`Slovo „${spec.word}“ v komentáři kapitoly není`);
    }
    if (spec && typeof spec.cue === "number") return this.audioStart + (this.cues[spec.cue]?.start ?? this.durationMs) + (spec.offset ?? 0);
    throw new Error(`Neznámý bod komentáře ${JSON.stringify(spec)}`);
  }

  /** Počká na bod komentáře (s předstihem `lead` ms – kurzor má dojet právě ve chvíli, kdy hlas slovo řekne). */
  async until(spec, lead = 0) {
    await sleep(this.at(spec) - lead - Date.now());
  }

  /** Zbývající čas do bodu komentáře (ms, může být záporný). */
  left(spec = "end") {
    return this.at(spec) - Date.now();
  }
}

export class Director {
  /** @param {import("@playwright/test").Page} page */
  constructor(page, { log = () => {} } = {}) {
    this.page = page;
    this.cursor = { x: 960, y: 560 };
    this.log = log;
  }

  sleep(ms) {
    return sleep(ms);
  }

  /** Plynulý přesun kurzoru (délka podle vzdálenosti, 0,3–0,7 s), pak skutečná myš na stejné místo. */
  async glide(x, y, ms) {
    const distance = Math.hypot(x - this.cursor.x, y - this.cursor.y);
    const duration = ms ?? Math.round(Math.min(680, Math.max(280, 220 + distance * 0.32)));
    await this.page.evaluate(([px, py, d]) => window.__eldockTutorial?.move(px, py, d), [x, y, duration]).catch(() => {});
    await sleep(duration + 40);
    await this.page.mouse.move(x, y);
    this.cursor = { x, y };
  }

  /** Počká, až se stránka i prvek přestanou posouvat (plynulý scroll). */
  async settle(locator) {
    let last = "";
    let stable = 0;
    for (let round = 0; round < 40 && stable < 3; round++) {
      await sleep(70);
      const now = await (locator ? locator.boundingBox().then((box) => JSON.stringify(box)) : this.page.evaluate(() => String(window.scrollY))).catch(() => "");
      stable = now === last ? stable + 1 : 0;
      last = now;
    }
  }

  /** Prvek do zorného pole nad titulkovou lištu (plynule, jen když tam není). */
  async reveal(locator, { block = "center" } = {}) {
    await locator.waitFor({ state: "visible", timeout: 60_000 });
    const inView = await locator.evaluate((element, safe) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= safe.top && rect.bottom <= safe.bottom && rect.left >= 0 && rect.right <= window.innerWidth;
    }, SAFE);
    if (!inView) {
      await locator.evaluate((element, where) => element.scrollIntoView({ block: where, inline: "nearest", behavior: "smooth" }), block);
      await this.settle(locator);
    }
  }

  async center(locator, position) {
    await this.reveal(locator);
    const box = await locator.boundingBox();
    if (!box) throw new Error(`Prvek není vidět: ${locator}`);
    return { x: box.x + (position?.x ?? box.width / 2), y: box.y + (position?.y ?? box.height / 2) };
  }

  /** Kurzor k prvku a chvíli na něm (ukázání bez kliknutí). */
  async point(locator, { hold = 700, position } = {}) {
    const at = await this.center(locator, position);
    await this.glide(at.x, at.y);
    await sleep(hold);
  }

  /** Klik s viditelným příjezdem kurzoru a vlnou. */
  async click(locator, { position, pause = 80, after = 220, button = "left", clickCount = 1 } = {}) {
    const at = await this.center(locator, position);
    await this.clickAt(at.x, at.y, { pause, after, button, clickCount });
  }

  async clickAt(x, y, { pause = 80, after = 220, button = "left", clickCount = 1, glide } = {}) {
    await this.glide(x, y, glide);
    await sleep(pause);
    await this.page.mouse.click(x, y, { button, clickCount });
    await sleep(after);
  }

  /** Nativní <select>: kurzor + vlna, hodnotu vybere generátor (rozbalovací seznam bezhlavý prohlížeč nekreslí). */
  async select(locator, value, { after = 450 } = {}) {
    const at = await this.center(locator);
    await this.glide(at.x, at.y);
    await sleep(120);
    await this.page.evaluate(([px, py]) => window.__eldockTutorial?.pulse(px, py), [at.x, at.y]);
    await sleep(120);
    await locator.selectOption(value);
    await sleep(after);
  }

  /** Psaní do pole po znacích. */
  async type(locator, text, { delay = 42, clear = true, after = 300 } = {}) {
    await this.click(locator, { after: 120 });
    if (clear) await locator.fill("");
    await locator.pressSequentially(text, { delay });
    await sleep(after);
  }

  async press(key, after = 250) {
    await this.page.keyboard.press(key);
    await sleep(after);
  }

  /** Tažení myší po přímce (v krocích, kurzor sleduje myš bez zpoždění). */
  async drag(from, to, { ms = 900, steps = 24, hold = 160 } = {}) {
    await this.glide(from.x, from.y);
    await sleep(hold);
    await this.page.evaluate(() => window.__eldockTutorial?.drag(true)).catch(() => {});
    await this.page.mouse.down();
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      await this.page.mouse.move(from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased);
      await sleep(ms / steps);
    }
    await this.page.mouse.up();
    await this.page.evaluate(() => window.__eldockTutorial?.drag(false)).catch(() => {});
    this.cursor = { ...to };
    await sleep(hold);
  }

  /** Plynulé posunutí stránky. */
  async scrollTo(y) {
    await this.page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
    await this.settle();
  }

  async scrollBy(dy) {
    await this.page.evaluate((delta) => window.scrollBy({ top: delta, behavior: "smooth" }), dy);
    await this.settle();
  }

  /** Bod plánu v mm → souřadnice obrazovky (matice SVG plátna). */
  async planPoint(canvas, x, y) {
    return canvas.evaluate((svg, point) => {
      const matrix = svg.getScreenCTM();
      const at = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      return { x: at.x, y: at.y };
    }, { x, y });
  }

  /** Počká na klid sítě po navigaci (bez chyby, když stránka dál něco načítá). */
  async idle(timeout = 8000) {
    await this.page.waitForLoadState("networkidle", { timeout }).catch(() => {});
  }
}
