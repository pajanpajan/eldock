import { describe, expect, it } from "vitest";

import { IMMUTABLE_CACHE, SEED_CACHE, etagMatches, fileCacheControl, fileETag } from "./file-cache";

describe("cache souborů", () => {
  it("nahrané soubory (UUID) jsou neměnné, seed soubory s revalidací", () => {
    expect(fileCacheControl(["photos", "3f2b8c1e-9d4a-4f6b-8e2a-1c5d7e9f0a12.jpg"])).toBe(IMMUTABLE_CACHE);
    expect(fileCacheControl(["photos", "seed", "equipment-RH1.svg"])).toBe(SEED_CACHE);
    expect(fileCacheControl(["revisions", "seed", "3f2b8c1e-9d4a-4f6b-8e2a-1c5d7e9f0a12.svg"])).toBe(SEED_CACHE);
    expect(fileCacheControl(["documents", "RS-2026-PP-0050.svg"])).toBe(SEED_CACHE);
  });

  it("ETag z velikosti a času změny a porovnání s If-None-Match", () => {
    const etag = fileETag(975036, 1_761_800_000_000);
    expect(etag).toMatch(/^W\/"[0-9a-z]+-[0-9a-z]+"$/);
    expect(etagMatches(etag, etag)).toBe(true);
    expect(etagMatches(`"x", ${etag.replace("W/", "")}`, etag)).toBe(true);
    expect(etagMatches("*", etag)).toBe(true);
    expect(etagMatches('W/"jiny"', etag)).toBe(false);
    expect(etagMatches(null, etag)).toBe(false);
  });
});
