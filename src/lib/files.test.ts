import path from "node:path";

import { describe, expect, it } from "vitest";

import { contentTypeFor, resolveUploadPath } from "./files";

const ROOT = path.resolve("storage/uploads");

describe("resolveUploadPath", () => {
  it("povolí soubor v povolené složce", () => {
    expect(resolveUploadPath(ROOT, ["revisions", "seed", "RM1-v1.2.svg"])).toBe(
      path.join(ROOT, "revisions", "seed", "RM1-v1.2.svg"),
    );
  });

  it("odmítne path traversal a neznámé složky", () => {
    expect(resolveUploadPath(ROOT, ["photos", "..", "..", "dev.db"])).toBeNull();
    expect(resolveUploadPath(ROOT, ["photos", "..%2F..%2Fdev.db"])).toBeNull();
    expect(resolveUploadPath(ROOT, ["photos", "a\\..\\b.png"])).toBeNull();
    expect(resolveUploadPath(ROOT, ["secret", "x.png"])).toBeNull();
    expect(resolveUploadPath(ROOT, ["photos"])).toBeNull();
  });

  it("odmítne nepovolenou příponu", () => {
    expect(resolveUploadPath(ROOT, ["photos", "x.html"])).toBeNull();
    expect(resolveUploadPath(ROOT, ["photos", "x.js"])).toBeNull();
  });
});

describe("contentTypeFor", () => {
  it("rozpozná typ podle přípony", () => {
    expect(contentTypeFor("a/b.SVG")).toBe("image/svg+xml");
    expect(contentTypeFor("a/b.pdf")).toBe("application/pdf");
  });
});
