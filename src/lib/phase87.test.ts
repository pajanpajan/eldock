import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { proxy } from "@/proxy";
import { PUBLIC_PAGES } from "@/lib/seo";
import { footerSections } from "@/lib/site-map";
import { TUTORIALS, chapterBadge, chapterText, formatClock, formatMegabytes, inviteMessage, posterOf, tutorialById } from "@/lib/tutorials";
import { TUTORIAL_MEDIA } from "@/lib/tutorials.generated";

const PUBLIC_DIR = path.join(process.cwd(), "public");

// Fáze 87: video-návody pro testery – data kapitol, vygenerovaná MP4 (H.264 + AAC) a veřejná stránka /navody.
describe("fáze 87 – video-návody", () => {
  it("dva návody po 5 kapitolách s titulky do dvou řádků a odznakem kroku", () => {
    expect(TUTORIALS.map((tutorial) => tutorial.id)).toEqual(["pudorys", "panel-builder"]);
    expect(TUTORIALS.map((tutorial) => tutorial.file)).toEqual(["/tutorials/eldock-2d-pudorys-navod.mp4", "/tutorials/eldock-ai-panel-builder-navod.mp4"]);
    for (const tutorial of TUTORIALS) {
      expect(tutorial.chapters).toHaveLength(5);
      expect(new Set(tutorial.chapters.map((chapter) => chapter.id)).size).toBe(5);
      for (const chapter of tutorial.chapters) {
        expect(chapter.cues.length).toBeGreaterThan(0);
        // titulková lišta má místo zhruba na dva řádky
        for (const cue of chapter.cues) expect(cue.text.length).toBeLessThanOrEqual(130);
        expect(chapterText(chapter)).toBe(chapter.cues.map((cue) => cue.text).join(" "));
      }
    }
    expect(chapterBadge(tutorialById("pudorys"), 1)).toBe("KROK 2 / 5 · Výrobci, designové řady a barvy");
    // scénář videa 2 odpovídá skutečným krokům aplikace (3. Skříň, 4. Oteplení, 5. Dokumentace)
    expect(tutorialById("panel-builder").chapters.map((chapter) => chapter.title)).toEqual([
      "Založení projektu, soustava a rozvodnice",
      "1. Návrh a osazení – DIN lišty a Elektro-linter",
      "2. Zapojení – strom, fáze L1–L3 a sběrnice PE / N",
      "3. Skříň a 4. výpočet oteplení",
      "5. Elaborát PDF, štítek CE a popisky 1:1",
    ]);
  });

  it("vygenerovaná MP4 existují, sedí velikostí na metadata a mají obraz H.264 i český zvuk AAC", () => {
    for (const tutorial of TUTORIALS) {
      const media = TUTORIAL_MEDIA[tutorial.id];
      expect(media, `${tutorial.id}: spusťte npm run tutorials:generate`).toBeDefined();
      if (!media) continue;
      const file = path.join(PUBLIC_DIR, tutorial.file);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBe(media.sizeBytes);
      expect(media.sizeBytes).toBeGreaterThan(100_000);
      expect([media.video, media.audio, media.width, media.height]).toEqual(["h264", "aac", 1920, 1080]);
      // MP4 kontejner s faststart: atom moov je před mdat (přehrání hned, i na iPhonu a ve WhatsAppu)
      const head = readFileSync(file).subarray(0, 64 * 1024).toString("latin1");
      expect(head.slice(4, 8)).toBe("ftyp");
      expect(head.indexOf("moov")).toBeGreaterThan(0);
      expect(head.indexOf("moov")).toBeLessThan(head.indexOf("mdat") < 0 ? Infinity : head.indexOf("mdat"));
      expect(existsSync(path.join(PUBLIC_DIR, posterOf(tutorial.file)))).toBe(true);
      // kapitoly vzestupně, první na začátku, poslední před koncem videa
      expect(media.chapters).toHaveLength(tutorial.chapters.length);
      expect(media.chapters[0]).toBeLessThan(1);
      media.chapters.forEach((start, index) => index && expect(start).toBeGreaterThan(media.chapters[index - 1] + 5));
      expect(media.chapters.at(-1)!).toBeLessThan(media.durationSec - 5);
    }
  });

  it("veřejná stránka /navody v sitemap, robots, patičce a bez přihlášení", async () => {
    expect(PUBLIC_PAGES.map((page) => page.path)).toContain("/navody");
    expect(sitemap().map((entry) => entry.url)).toContain("https://eldock.cz/navody");
    expect(footerSections({ showcase: false }).flatMap((section) => section.links.map((link) => link.href))).toContain("/navody");
    for (const pathname of ["/navody", "/tutorials/eldock-2d-pudorys-navod.mp4", "/tutorials/eldock-ai-panel-builder-navod.jpg"]) {
      const response = await proxy(new NextRequest(`https://eldock.cz${pathname}`));
      expect(response.status, pathname).toBe(200);
      expect(response.headers.get("location"), pathname).toBeNull();
    }
    // editor půdorysu bez přihlášené firmy dál vede na přihlášení Panel Builderu
    const editor = await proxy(new NextRequest("https://eldock.cz/panel-builder/floorplan"));
    expect(editor.headers.get("location")).toContain("/panel-builder/auth");
  });

  it("pozvánka pro kolegu, časy kapitol a velikost videa", () => {
    expect(inviteMessage("https://eldock.cz/navody")).toMatch(/video-návody .*https:\/\/eldock\.cz\/navody$/);
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65.4)).toBe("1:05");
    expect(formatClock(119.6)).toBe("2:00");
    expect(formatMegabytes(7_760_000)).toBe("7,4 MB");
    expect(posterOf("/tutorials/a.mp4")).toBe("/tutorials/a.jpg");
  });
});
