import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SAMPLE_SCHEDULE, floorplanFromSchedule, sanitizeSchedule } from "@/engine/room-schedule";
import { buildSwitchboardFromCircuits, generateCircuitsFromFloorplan } from "@/engine/floorplan-bridge";
import { standardEnclosureMatrix } from "@/lib/panel-builder/enclosures";
import { filterProjects, isDeletableUpload, projectUploads, refundsCredit } from "@/lib/panel-builder/project-admin";
import { stepProgress } from "@/lib/panel-builder/project";
import { PRIVATE_PATHS, jsonLdScript, landingJsonLd } from "@/lib/seo";

describe("fáze 48 – přehled projektů Panel Builderu", () => {
  const projects = [
    { code: "PB-001", name: "Domovní / Podružný rozváděč", customerName: "Vzor", installationSite: null, status: "COMPLETED" as const },
    { code: "PB-007", name: "test-1", customerName: null, installationSite: "Liberec, Husova", status: "DRAFT" as const },
    { code: "PB-008", name: "Rozvodnice dílna", customerName: "Kovárna Novák", installationSite: null, status: "TREE_BUILT" as const },
  ];

  it("hledání podle kódu, názvu, zákazníka i místa (bez diakritiky) a filtr stavu", () => {
    expect(filterProjects(projects, "pb-008", "ALL").map((p) => p.code)).toEqual(["PB-008"]);
    expect(filterProjects(projects, "kovarna", "ALL").map((p) => p.code)).toEqual(["PB-008"]);
    expect(filterProjects(projects, "husova", "ALL").map((p) => p.code)).toEqual(["PB-007"]);
    expect(filterProjects(projects, "", "OPEN").map((p) => p.code)).toEqual(["PB-007", "PB-008"]);
    expect(filterProjects(projects, "", "DONE").map((p) => p.code)).toEqual(["PB-001"]);
  });

  it("kredit se vrací jen za nedokončený projekt mimo vzorový PB-001", () => {
    expect(refundsCredit({ code: "PB-007", status: "DRAFT" })).toBe(true);
    expect(refundsCredit({ code: "PB-008", status: "COMPLETED" })).toBe(false);
    expect(refundsCredit({ code: "PB-001", status: "DRAFT" })).toBe(false);
  });

  it("mazat smí jen vlastní nahrané soubory – nikdy seed/, cizí cesty ani path traversal", () => {
    expect(isDeletableUpload("/api/files/photos/abc.jpg")).toBe(true);
    for (const url of ["/api/files/photos/seed/panel-pb-001.svg", "/api/files/photos/../x.jpg", "/demo-docs/a.pdf", "/api/files/photos", null]) expect(isDeletableUpload(url)).toBe(false);
    expect(projectUploads({ photoUrl: "/api/files/photos/seed/panel-pb-001.svg", railPhotosJson: '{"1":"/api/files/photos/r1.jpg","2":"/api/files/photos/r1.jpg"}' })).toEqual(["/api/files/photos/r1.jpg"]);
  });

  it("stav kroků ✓ Hotovo / Rozpracováno", () => {
    const items = [{ recognitionStatus: "VERIFIED" as const }, { recognitionStatus: "PARTIAL" as const }];
    expect(stepProgress({ items, status: "TREE_BUILT", connected: true, thermalOk: true })).toEqual({ recognition: true, tree: true, thermal: true, documentation: false });
    expect(stepProgress({ items: [...items, { recognitionStatus: "UNRECOGNIZED" }], status: "RECOGNIZED", connected: true, thermalOk: false })).toEqual({ recognition: false, tree: false, thermal: false, documentation: false });
    expect(stepProgress({ items: [], status: "DRAFT", connected: true, thermalOk: true })).toMatchObject({ recognition: false, thermal: false });
  });
});

describe("soupis místností → most půdorys → rozváděč", () => {
  it("očištění vstupu a syntetický půdorys s délkou kabelu podle vzdálenosti místnosti", () => {
    const clean = sanitizeSchedule([{ name: "  Garáž  ", distanceM: 500, singleSockets: -2, doubleSockets: 2.6, lights: 1, switchPlaces: 9, appliances: ["ev_charger", "ev_charger", "x" as never] }, { name: " ", distanceM: 2, singleSockets: 1, doubleSockets: 0, lights: 0, switchPlaces: 0, appliances: [] }]);
    expect(clean).toEqual([{ name: "Garáž", distanceM: 100, singleSockets: 0, doubleSockets: 3, lights: 1, switchPlaces: 6, appliances: ["ev_charger"] }]);
    const { plan, calibration } = floorplanFromSchedule([{ ...clean[0], distanceM: 12 }], "classic");
    expect(plan.nodes.map((node) => node.kind)).toEqual(["double_socket", "double_socket", "double_socket", "light", "appliance"]);
    expect(calibration.calculateCableLength(plan.nodes[0])).toBeGreaterThan(12_000);
  });

  it("vzorový dům: okruhy dle ČSN 33 2130 ed. 4, chrániče a skříň s 25% rezervou", () => {
    const { plan, calibration } = floorplanFromSchedule(SAMPLE_SCHEDULE, "classic");
    const circuits = generateCircuitsFromFloorplan(plan, calibration);
    expect(circuits.circuits.map((circuit) => circuit.label)).toEqual(expect.arrayContaining(["Trouba – Kuchyně", "Pračka – Koupelna"]));
    const board = buildSwitchboardFromCircuits(circuits, { mode: "classic", enclosures: standardEnclosureMatrix().map((row) => ({ ...row, id: row.articleNumber })) });
    expect(board.devices.filter((device) => device.category === "RCD").length).toBeGreaterThanOrEqual(1);
    expect(board.enclosure?.totalModules ?? 0).toBeGreaterThanOrEqual(board.requiredModules);
  });
});

describe("technické SEO", () => {
  it("robots.txt: veřejné stránky povolené, interní trasy zakázané, odkaz na sitemap", () => {
    const rules = robots().rules as { allow: string[]; disallow: string[] };
    expect(rules.allow).toEqual(expect.arrayContaining(["/", "/panel-builder/auth", "/register-plant", "/ukazka-elaboratu"]));
    expect(rules.disallow).toEqual(expect.arrayContaining(["/plant/", "/equipment/", "/cae/", "/inspections/", "/admin/", "/api/"]));
    expect(PRIVATE_PATHS.some((path) => "/apple-icon".startsWith(path))).toBe(false);
    expect(robots().sitemap).toBe("https://eldock.cz/sitemap.xml");
  });

  it("sitemap.xml jen s veřejnými absolutními URL", () => {
    const urls = sitemap().map((entry) => entry.url);
    // Fáze 54: + právní stránky
    expect(urls).toEqual([
      "https://eldock.cz",
      "https://eldock.cz/ukazka-elaboratu",
      "https://eldock.cz/panel-builder/auth",
      "https://eldock.cz/register-plant",
      "https://eldock.cz/obchodni-podminky",
      "https://eldock.cz/ochrana-osobnich-udaju",
    ]);
  });

  it("JSON-LD SoftwareApplication + Organization s klíčovými slovy, bezpečné do <script>", () => {
    const ld = landingJsonLd();
    expect(ld["@graph"].map((node) => node["@type"])).toEqual(["Organization", "SoftwareApplication"]);
    const text = JSON.stringify(ld);
    for (const keyword of ["návrh rozváděčů", "ČSN EN IEC 61439", "IEC 60890", "štítek rozváděče CE", "pasportizace rozváděče z fotky", "ČSN 33 1500"]) expect(text).toContain(keyword);
    expect(jsonLdScript({ text: "</script><script>alert(1)" })).not.toContain("</script>");
  });
});
