import { describe, expect, it } from "vitest";

import { checkLabel, formatQrToken, labelUrl, newQrToken } from "./qr-label";

describe("QR štítek", () => {
  it("generuje unikátní kódy v jednotném formátu", () => {
    const tokens = new Set(Array.from({ length: 200 }, newQrToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(/^[0-9A-F]{10}$/);
  });

  it("skládá přímý odkaz na detail zařízení s kódem štítku", () => {
    expect(labelUrl("https://eldock.cz/", "eq-rh1", "A3F09C11B2")).toBe("https://eldock.cz/equipment/eq-rh1?qr=A3F09C11B2");
    expect(labelUrl("https://eldock.cz", "eq-rh1", null)).toBe("https://eldock.cz/equipment/eq-rh1");
  });

  it("formátuje kód po pěti znacích", () => {
    expect(formatQrToken("A3F09C11B2")).toBe("A3F09-C11B2");
  });

  it("rozpozná platný, nahrazený a chybějící kód", () => {
    expect(checkLabel(undefined, "A3F09C11B2")).toBe("none");
    expect(checkLabel("a3f09c11b2", "A3F09C11B2")).toBe("valid");
    expect(checkLabel("FFFFFFFFFF", "A3F09C11B2")).toBe("replaced");
    expect(checkLabel(["FFFFFFFFFF"], null)).toBe("replaced");
  });
});
