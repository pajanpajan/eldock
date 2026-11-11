import { afterEach, describe, expect, it, vi } from "vitest";

import { buildXlsx, zipStored } from "../../src/lib/xlsx";
import { remoteZipDirectory, remoteZipEntry } from "./remote-zip.mjs";
import { columnIndex, parseCsv, readXlsx } from "./xlsx-read.mjs";

// Fáze 97: čtení tabulek XLSX / CSV bez závislostí a vzdáleného ZIPu po částech (HTTP Range) – fotobanka Legrand má 16 GB,
// Eldock z ní stahuje jen adresář a jednotlivé fotky.

afterEach(() => vi.unstubAllGlobals());

describe("fáze 97 – XLSX a CSV", () => {
  it("sešit z exportu Eldocku se přečte zpět (text, čísla, diakritika, prázdné buňky)", async () => {
    const rows = [
      ["Položka", "Název položky", "EAN", "cena od 1. 8. 2026 CZK/1000MJ"],
      ["KU 68-45_KA", "KRABICE UNIVERZÁLNÍ", "8595568936233", 9380],
      ["KPR 68_KA", "KRABICE PŘÍSTROJOVÁ", null, 36880],
    ];
    const sheets = await readXlsx(Buffer.from(buildXlsx("Ceník", rows)));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("Ceník");
    expect(sheets[0].rows[0]).toEqual(["Položka", "Název položky", "EAN", "cena od 1. 8. 2026 CZK/1000MJ"]);
    expect(sheets[0].rows[1]).toEqual(["KU 68-45_KA", "KRABICE UNIVERZÁLNÍ", "8595568936233", "9380"]);
    expect(sheets[0].rows[2][0]).toBe("KPR 68_KA");
    expect(sheets[0].rows[2][2] ?? "").toBe("");
  });

  it("odkaz buňky → sloupec a CSV se středníkem i uvozovkami", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("Z9")).toBe(25);
    expect(columnIndex("AB12")).toBe(27);
    expect(parseCsv('﻿kód;název;EAN\r\nKU 68-45_KA;"Krabice ""univerzální""; 45 mm";8595568936233\n')).toEqual([
      ["kód", "název", "EAN"],
      ["KU 68-45_KA", 'Krabice "univerzální"; 45 mm', "8595568936233"],
    ]);
  });
});

describe("fáze 97 – vzdálený ZIP po částech", () => {
  const archive = Buffer.from(zipStored([
    { name: "foto/LG-752101-WEB-F.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]) },
    { name: "foto/LG-752201-WEB-F.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 4, 5, 6, 7]) },
  ]));
  const ranges: string[] = [];
  const serve = (acceptRanges = true) =>
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      const header = new Headers(init?.headers).get("Range") ?? "";
      ranges.push(header);
      const match = /bytes=(\d+)-(\d+)/.exec(header);
      if (!acceptRanges || !match) return new Response(archive, { status: 200 });
      const end = Math.min(Number(match[2]), archive.length - 1);
      return new Response(archive.subarray(Number(match[1]), end + 1), { status: 206 });
    });

  it("adresář a jedna položka bez stažení celého archivu", async () => {
    serve();
    const directory = await remoteZipDirectory("https://assets.example/obrazky.zip", { size: archive.length });
    expect(directory.entries.map((entry) => entry.name)).toEqual(["foto/LG-752101-WEB-F.jpg", "foto/LG-752201-WEB-F.jpg"]);
    const second = await remoteZipEntry("https://assets.example/obrazky.zip", directory.entries[1]);
    expect([...second]).toEqual([0xff, 0xd8, 0xff, 4, 5, 6, 7]);
    expect(ranges.every((range) => /^bytes=\d+-\d+$/.test(range))).toBe(true);
  });

  it("server bez podpory Range → chyba (celý archiv se nestahuje)", async () => {
    serve(false);
    await expect(remoteZipDirectory("https://assets.example/obrazky.zip", { size: archive.length })).rejects.toThrow(/částečné stažení/);
  });
});
