import { expect, test } from "@playwright/test";

// Fáze 87: video-návody – veřejná stránka /navody (bez přihlášení), přehrávače s kapitolami, stažení MP4, pozvánka
// pro kolegu do schránky, odkaz z úvodní stránky a tlačítko „🎬 Video-návod“ v editoru půdorysu (Interactive Tour)
// i v AI Panel Builderu.
test.describe.configure({ mode: "serial" });

const FILES = ["/tutorials/eldock-2d-pudorys-navod.mp4", "/tutorials/eldock-ai-panel-builder-navod.mp4"];

test.describe("veřejně bez přihlášení", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("🎬 /navody: status 200, dva přehrávače s kapitolami, stažení MP4 a pozvánka do schránky", async ({ page, request, context }) => {
    test.setTimeout(240_000);
    const response = await request.get("/navody", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    const html = await response.text();
    for (const file of FILES) expect(html).toContain(file);
    // MP4 bez přihlášení, s rozsahy (přetáčení v prohlížeči a na iPhonu)
    for (const file of FILES) {
      const media = await request.get(file, { headers: { Range: "bytes=0-1023" }, maxRedirects: 0 });
      expect([200, 206]).toContain(media.status());
      expect(media.headers()["content-type"]).toContain("video/mp4");
    }

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await expect(async () => {
      await page.goto("/navody");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Video-návody ELDOCK", { timeout: 10_000 });
    }).toPass({ timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 2, name: "Video 1: 2D Půdorys & Kabeláž" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Video 2: AI Panel Builder (Rozváděč z fotky / od nuly)" })).toBeVisible();
    await expect(page.locator("video")).toHaveCount(2);
    for (const id of ["pudorys", "panel-builder"]) {
      await expect(page.getByTestId(`tutorial-video-${id}`)).toHaveAttribute("preload", "metadata");
      await expect(page.getByTestId(`tutorial-${id}`).getByTestId("tutorial-chapter")).toHaveCount(5);
    }

    // klik na kapitolu 3 přetočí video na její začátek
    const video = page.getByTestId("tutorial-video-pudorys");
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState), { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
    const chapter = page.getByTestId("tutorial-pudorys").getByTestId("tutorial-chapter").nth(2);
    const start = Number(await chapter.getAttribute("data-start"));
    expect(start).toBeGreaterThan(10);
    await chapter.click();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThanOrEqual(start - 0.3);
    await expect(chapter).toHaveAttribute("aria-current", "step");
    await video.evaluate((element: HTMLVideoElement) => element.pause());

    // stažení pro WhatsApp a vyzkoušení
    await expect(page.getByTestId("tutorial-download-pudorys")).toHaveAttribute("href", FILES[0]);
    await expect(page.getByTestId("tutorial-download-pudorys")).toHaveAttribute("download", "");
    await expect(page.getByTestId("tutorial-download-panel-builder")).toContainText("Stáhnout video MP4 (pro WhatsApp)");
    await expect(page.getByTestId("tutorial-try-pudorys")).toHaveAttribute("href", "/panel-builder/floorplan");
    await expect(page.getByTestId("tutorial-try-panel-builder")).toHaveAttribute("href", "/panel-builder");

    // pozvánka s odkazem pro kolegu elektrikáře
    await page.getByTestId("copy-invite").click();
    await expect(page.getByTestId("copy-invite")).toContainText("Pozvánka je ve schránce");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("https://eldock.cz/navody");

    // úvodní stránka: odkaz hned vedle vzorového elaborátu, patička
    await page.goto("/");
    const card = page.getByTestId("segment-domov");
    await expect(card.getByTestId("tutorials-link")).toHaveAttribute("href", "/navody");
    // Od fáze 96 je odkaz v patičce dvakrát (mapa webu Domovní i „Nástroje a návody“)
    await expect(page.getByTestId("site-footer").getByRole("link", { name: "Video-návody" }).first()).toHaveAttribute("href", "/navody");
  });
});

test("🎬 Video-návod v editoru půdorysu (kapitoly, Interactive Tour) a v AI Panel Builderu", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });

  await page.getByTestId("tutorial-open").click();
  const dialog = page.getByTestId("tutorial-dialog");
  await expect(dialog.getByTestId("tutorial-video-pudorys")).toBeVisible();
  await expect(dialog.getByTestId("tutorial-chapter")).toHaveCount(5);

  // Interactive Tour: přehrávač do rohu, prvky kapitoly se na obrazovce zvýrazní
  await dialog.getByTestId("tutorial-tour-toggle").getByRole("switch").check();
  const dock = page.getByTestId("tutorial-tour");
  await expect(dock).toBeVisible();
  await expect(page.getByTestId("tutorial-dialog")).toHaveCount(0);
  await dock.getByTestId("tutorial-chapter").nth(1).click();
  const ring = page.getByTestId("tutorial-highlight").first();
  await expect(ring).toBeVisible();
  await expect(ring).toContainText("Výrobci, designové řady a barvy");
  // rámeček obepíná lištu výrobců (± 6 px okraj)
  await expect(async () => {
    const target = (await page.getByTestId("device-appearance").boundingBox())!;
    const box = (await ring.boundingBox())!;
    expect(Math.abs(box.x - (target.x - 6))).toBeLessThan(4);
    expect(Math.abs(box.width - (target.width + 12))).toBeLessThan(4);
  }).toPass({ timeout: 10_000 });
  await dock.getByTestId("tutorial-tour-close").click();
  await expect(dock).toHaveCount(0);
  await expect(page.getByTestId("tutorial-highlight")).toHaveCount(0);

  // AI Panel Builder: seznam rozváděčů i projekt
  await page.goto("/panel-builder");
  await page.getByTestId("tutorial-open").click();
  await expect(page.getByTestId("tutorial-dialog").getByTestId("tutorial-video-panel-builder")).toBeVisible();
  await expect(page.getByTestId("tutorial-dialog").getByTestId("tutorial-chapter")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: /PB-001/ }).first().click();
  await expect(page.getByTestId("tutorial-open")).toBeVisible({ timeout: 60_000 });
});
