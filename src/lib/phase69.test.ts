import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { readZip } from "@/server/services/test-zip";
import { ZipWriter, dosDateTime, zipEntryName } from "@/server/zip";

import { CLOSURE_GRACE_DAYS, DATA_REQUEST_KIND_LABELS, DATA_REQUEST_STATUS_LABELS, isClosureConfirmed } from "./data-requests";

// Fáze 69: zápis ZIP pro export dat firmy (struktura, CRC, komprese, rozbalení) a konstanty žádostí o data.

describe("zápis ZIP (export dat firmy)", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "eldock-zip-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("JSON se komprimuje, soubory se uloží beze změny, CRC a velikosti sedí, české názvy v UTF-8", async () => {
    const photo = path.join(dir, "foto.jpg");
    const bytes = Buffer.from(Array.from({ length: 70_000 }, (_, index) => (index * 7919) % 251));
    writeFileSync(photo, bytes);
    const target = path.join(dir, "export.zip");
    const zip = new ZipWriter(target, new Date("2026-11-08T10:20:30"));
    const json = JSON.stringify(Array.from({ length: 200 }, (_, index) => ({ tag: `RM${index}`, name: "Rozváděč hlavní" })));
    await zip.addBuffer("data/zarizeni.json", json);
    await zip.addBuffer("README.txt", "Export dat – žluťoučký kůň");
    await zip.addFile("soubory/photos/foto.jpg", photo);
    const size = await zip.close();

    const buffer = readFileSync(target);
    expect(buffer.length).toBe(size);
    const entries = readZip(buffer);
    expect([...entries.keys()]).toEqual(["data/zarizeni.json", "README.txt", "soubory/photos/foto.jpg"]);
    expect(entries.get("data/zarizeni.json")!.toString("utf8")).toBe(json);
    expect(entries.get("README.txt")!.toString("utf8")).toBe("Export dat – žluťoučký kůň");
    expect(entries.get("soubory/photos/foto.jpg")!.equals(bytes)).toBe(true);
    // JSON je komprimovaný (archiv je menší než data)
    expect(buffer.length).toBeLessThan(json.length + bytes.length);
  });

  it("názvy položek: bez úvodního lomítka, „..“ a zpětných lomítek; duplicita je chyba", async () => {
    expect(zipEntryName("/data/../a\\b.json")).toBe("data/a/b.json");
    expect(() => zipEntryName("../")).toThrow();
    const zip = new ZipWriter(path.join(dir, "dup.zip"));
    await zip.addBuffer("a.txt", "1");
    await expect(zip.addBuffer("a.txt", "2")).rejects.toThrow(/už v ZIP je/);
    await zip.close();
  });

  it("datum a čas MS-DOS", () => {
    const { time, date } = dosDateTime(new Date(2026, 10, 8, 10, 20, 30));
    expect(date).toBe(((2026 - 1980) << 9) | (11 << 5) | 8);
    expect(time).toBe((10 << 11) | (20 << 5) | 15);
  });
});

describe("žádosti o data – konstanty", () => {
  it("potvrzení zrušení účtu slovem ZRUŠIT (i bez diakritiky a malými)", () => {
    expect(isClosureConfirmed("ZRUŠIT")).toBe(true);
    expect(isClosureConfirmed(" zrusit ")).toBe(true);
    expect(isClosureConfirmed("smazat")).toBe(false);
    expect(CLOSURE_GRACE_DAYS).toBe(30);
    expect(Object.keys(DATA_REQUEST_KIND_LABELS)).toHaveLength(4);
    expect(DATA_REQUEST_STATUS_LABELS.PENDING.label).toBe("čeká na lhůtu");
  });
});
