import { describe, expect, it } from "vitest";

import { arrowHead, fontSizeFor, isMeaningful, strokeWidthFor } from "./photo-annotation";

describe("zákres do fotky", () => {
  it("hroty šipky leží za koncem čáry symetricky", () => {
    const [left, right] = arrowHead([0, 0], [100, 0], 10);
    expect(left[0]).toBeLessThan(100);
    expect(right[0]).toBeCloseTo(left[0]);
    expect(left[1]).toBeCloseTo(-right[1]);
  });

  it("tloušťka čáry a písmo se škálují s fotkou", () => {
    expect(strokeWidthFor(2000, 1500)).toBe(12);
    expect(strokeWidthFor(100, 100)).toBe(2);
    expect(fontSizeFor(2000, 1500)).toBe(70);
  });

  it("omylná ťuknutí a prázdný text se neukládají", () => {
    expect(isMeaningful({ kind: "pen", color: "#ef4444", points: [[0.1, 0.1]] })).toBe(false);
    expect(isMeaningful({ kind: "rect", color: "#ef4444", from: [0.1, 0.1], to: [0.105, 0.1] })).toBe(false);
    expect(isMeaningful({ kind: "ellipse", color: "#ef4444", from: [0.1, 0.1], to: [0.3, 0.3] })).toBe(true);
    expect(isMeaningful({ kind: "text", color: "#eab308", at: [0.5, 0.5], text: "  " })).toBe(false);
  });
});
