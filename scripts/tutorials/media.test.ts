import { describe, expect, it } from "vitest";

import { Chapter } from "./director.mjs";
import { alignCues, speechOf } from "./media.mjs";

// Fáze 87: časování titulků generátoru video-návodů z hranic slov hlasové syntézy (Edge TTS, ms).
describe("generátor video-návodů – titulky podle hlasu", () => {
  const cues = [
    { text: "Vítejte v Eldocku." },
    { text: "Zátěž mezi fáze L1, L2 a L3.", say: "Zátěž mezi fáze el jedna, el dva a el tři." },
    { text: "Barvu přístrojů – například Zoni." },
  ];

  it("text pro syntézu skládá výslovnost a hlídá rozsahy titulků", () => {
    const { speech, ranges } = speechOf(cues);
    expect(speech).toBe("Vítejte v Eldocku. Zátěž mezi fáze el jedna, el dva a el tři. Barvu přístrojů – například Zoni.");
    expect(ranges.map(([from, to]) => speech.slice(from, to))).toEqual([cues[0].text, cues[1].say, cues[2].text]);
  });

  it("slova titulků dostanou časy svých hranic, titulek s výslovností rovnoměrně", () => {
    const words = "Vítejte v Eldocku. Zátěž mezi fáze el jedna, el dva a el tři. Barvu přístrojů například Zoni.".split(" ");
    // syntetické hranice po 300 ms (pomlčku Edge TTS jako slovo nehlásí)
    const boundaries = words.map((part, index) => ({ part: `${part} `, start: 100 + index * 300, end: 100 + index * 300 + 250 }));
    const timed = alignCues(cues, boundaries, 6000);
    expect(timed.map((cue) => cue.text)).toEqual(cues.map((cue) => cue.text));
    expect(timed[0].words).toEqual([
      { w: "Vítejte", t: 100 },
      { w: "v", t: 400 },
      { w: "Eldocku.", t: 700 },
    ]);
    // „L1,“ atd. nejsou v řeči – slova titulku se rozloží mezi první a poslední hranici titulku
    expect(timed[1].start).toBe(1000);
    expect(timed[1].end).toBe(100 + 12 * 300 + 250);
    const spread = timed[1].words.map((word) => word.t);
    expect(spread[0]).toBe(1000);
    expect([...spread].sort((a, b) => a - b)).toEqual(spread);
    // pomlčka převezme čas předchozího slova
    expect(timed[2].words.map((word) => word.w)).toEqual(["Barvu", "přístrojů", "–", "například", "Zoni."]);
    expect(timed[2].words[2].t).toBe(timed[2].words[1].t);
    expect(timed[2].start).toBeLessThan(timed[2].end);
  });

  it("časová osa kapitoly najde slovo i titulek a počká s předstihem", async () => {
    const timeline = new Chapter({ audioStart: 10_000, durationMs: 6000, cues: alignCues(cues, [{ part: "Vítejte", start: 50, end: 400 }, { part: "Barvu", start: 4000, end: 4300 }, { part: "Zoni.", start: 5200, end: 5600 }], 6000) });
    expect(timeline.at({ word: "zoni" })).toBe(10_000 + 5200);
    expect(timeline.at({ cue: 2 })).toBe(14_000);
    expect(timeline.at("end")).toBe(16_000);
    expect(() => timeline.at({ word: "neexistuje" })).toThrow(/neexistuje/);
    const now = new Chapter({ audioStart: Date.now() - 1000, durationMs: 500, cues: [] });
    const started = Date.now();
    await now.until(0);
    expect(Date.now() - started).toBeLessThan(50);
  });
});
