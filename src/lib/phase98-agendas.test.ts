import { describe, expect, it } from "vitest";

import { PANEL_PHASES, nextPanelPage, panelPageCode, panelPageHref, panelPhaseOf, panelPhaseStatus, panelStepLabel, prevPanelPage, type PanelPage } from "./panel-builder/panel-phases";
import { PLANT_PHASES, daysUntil, equipmentGroupOf, plantPhaseHref, plantPhaseOf, plantPhaseStatus } from "./plant-phases";

// Fáze 98: stejná fázová filozofie v AI Panel Builderu (4 fáze projektu rozváděče) a v ELDOCK Průmysl (4 agendy závodu).
describe("AI Panel Builder – 4 fáze projektu rozváděče", () => {
  it("názvy fází podle zadání a stránky projektu ve fázích", () => {
    expect(PANEL_PHASES.map((phase) => phase.label)).toEqual(["1. Osazení DIN lišt & Skříň", "2. Strom zapojení, Fáze & Linter", "3. Výpočet oteplení IEC 60890", "4. Dokumentace, Kusovník & Štítky"]);
    const phases = (["recognition", "enclosure", "tree", "thermal", "documentation", "labels"] as const).map(panelPhaseOf);
    expect(phases).toEqual([1, 1, 2, 3, 4, 4]);
    expect((["recognition", "enclosure", "tree", "labels"] as const).map(panelPageCode)).toEqual(["1a", "1b", "2", "4b"]);
    expect(panelPageHref("recognition", "p1")).toBe("/panel-builder/p1");
    expect(panelPageHref("labels", "p1")).toBe("/panel-builder/p1/labels");
  });

  it("Předchozí / Další projde všechny části v pořadí, popisek přechodu podle fáze", () => {
    const order: PanelPage[] = [];
    for (let page: PanelPage | null = "recognition"; page; page = nextPanelPage(page)) order.push(page);
    expect(order).toEqual(["recognition", "enclosure", "tree", "thermal", "documentation", "labels"]);
    expect(prevPanelPage("tree")).toBe("enclosure");
    expect(prevPanelPage("recognition")).toBeNull();
    expect(panelStepLabel("recognition", "enclosure", true)).toBe("1b · Skříň rozváděče");
    expect(panelStepLabel("enclosure", "tree", true)).toBe("2. Strom zapojení, Fáze & Linter");
    expect(panelStepLabel("thermal", "documentation", true)).toBe("4a · Dokumentace a kusovník (PDF)");
    expect(panelStepLabel("tree", "enclosure", false)).toBe("1b · Skříň rozváděče");
  });

  it("fáze 1 je hotová až s osazením i skříní", () => {
    const base = { recognition: true, tree: false, enclosure: false, thermal: false, documentation: false };
    expect(panelPhaseStatus(base)[0]).toEqual({ id: 1, done: false, subtitle: "osazeno ✓ · skříň nezvolena" });
    expect(panelPhaseStatus({ ...base, enclosure: true })[0].done).toBe(true);
    expect(panelPhaseStatus({ ...base, thermal: true })[2]).toEqual({ id: 3, done: true, subtitle: "oteplení vyhovuje" });
    expect(panelPhaseStatus(base)[3].subtitle).toBe("PDF · kusovník · štítky");
  });
});

describe("ELDOCK Průmysl – 4 agendy závodu", () => {
  it("názvy agend podle zadání, fáze v adrese", () => {
    expect(PLANT_PHASES.map((phase) => phase.label)).toEqual(["1. Mapa závodu & BIM (.ifc)", "2. Rozváděče, Stroje & QR štítky", "3. Schémata, Červenka & Zálohy PLC", "4. Revize & Plánovač"]);
    expect([plantPhaseOf("3"), plantPhaseOf(["4"]), plantPhaseOf("9"), plantPhaseOf(undefined), plantPhaseOf("abc")]).toEqual([3, 4, 1, 1, 1]);
    expect(plantPhaseHref("plant-jbc", 1)).toBe("/plant/plant-jbc");
    expect(plantPhaseHref("plant-jbc", 2)).toBe("/plant/plant-jbc?faze=2");
  });

  it("skupiny zařízení a lhůta Nařízení (EU) 2023/1230", () => {
    expect([equipmentGroupOf("SWITCHBOARD"), equipmentGroupOf("TRANSFORMER"), equipmentGroupOf("CNC_MACHINE"), equipmentGroupOf("ROBOT_CELL"), equipmentGroupOf("POWER_TOOL")]).toEqual(["boards", "boards", "machines", "machines", "devices"]);
    expect(daysUntil("2027-01-20", new Date(2026, 10, 11))).toBe(70);
    expect(daysUntil("2027-01-20", new Date(2027, 0, 21))).toBe(-1);
  });

  it("podtitul a fajfka karet agend", () => {
    const counts = { buildings: 3, boards: 4, machines: 2, devices: 10, drawings: 5, redlines: 1, backups: 3, inspectionsDue: 2, substantial: 1 };
    const status = plantPhaseStatus(counts);
    expect(status.map((entry) => entry.subtitle)).toEqual(["3 budovy · 16 zařízení", "4 rozváděče · 2 stroje", "5 schémat · 1 zákres · 3 zálohy PLC", "2 revize k řešení · 1 podstatná změna"]);
    expect(status.map((entry) => entry.done)).toEqual([true, true, false, false]);
    const calm = plantPhaseStatus({ ...counts, redlines: 0, inspectionsDue: 0, substantial: 0 });
    expect(calm[2].done && calm[3].done).toBe(true);
    expect(calm[3].subtitle).toBe("revize v termínu · bez podstatných změn");
  });
});
