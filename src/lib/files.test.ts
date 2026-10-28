import path from "node:path";

import { describe, expect, it } from "vitest";

import { contentTypeFor, resolveUploadPath, validateUpload } from "./files";

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

describe("validateUpload", () => {
  it("přijme fotku a normalizuje příponu", () => {
    expect(validateUpload("photo", "IMG_0042.JPEG", 2_000_000)).toEqual({ ok: true, kind: "photo", extension: ".jpg" });
  });

  it("odmítne nepovolený formát, prázdný a příliš velký soubor", () => {
    expect(validateUpload("photo", "x.pdf", 1000).ok).toBe(false);
    expect(validateUpload("photo", "x.png", 0).ok).toBe(false);
    expect(validateUpload("photo", "x.png", 16 * 1024 * 1024).ok).toBe(false);
    expect(validateUpload("revision", "schema.pdf", 24 * 1024 * 1024).ok).toBe(true);
    expect(validateUpload("exe", "x.png", 10).ok).toBe(false);
  });
});
