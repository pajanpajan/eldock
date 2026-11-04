import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ARCHIVE_DIR, BUNDLE_NAME, archiveFiles, buildArchiveBundle } from "./archive-bundle";

describe("sjednocený archiv docs/archiv/ARCHIV-KOMPLET.md", () => {
  it("obsahuje všechny samostatné soubory archivu a je aktuální (jinak spusťte npm run docs:bundle)", () => {
    const files = archiveFiles();
    expect(files[0]).toBe("SPECIFIKACE-MVP.md");
    expect(files).not.toContain(BUNDLE_NAME);
    const current = readFileSync(path.join(ARCHIVE_DIR, BUNDLE_NAME), "utf8").replace(/\r\n/g, "\n");
    for (const name of files) expect(current).toContain(`# 📄 ${name}`);
    // Deník posledních fází z aktuálního plánu (fáze 48)
    expect(current).toContain("# 📄 docs/PLAN.md");
    expect(current).toBe(buildArchiveBundle());
  });
});
