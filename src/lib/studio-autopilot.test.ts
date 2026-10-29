import { describe, expect, it } from "vitest";

import { bestParent, buildingShortName, nextTag, suggestName, type AutopilotSource } from "./studio-autopilot";

const TAGS = ["RM1", "R-ML-01", "ML-01", "ML-02", "SP-0201", "SP-0322", "NR-0112", "TR1", "LPS-A", "R-C-01"];

describe("nextTag", () => {
  it("další volný tag podle typu a budovy", () => {
    expect(nextTag("SWITCHBOARD", { buildingCode: "C", tags: TAGS })).toBe("R-C-02");
    expect(nextTag("SWITCHBOARD", { buildingCode: "d", tags: TAGS })).toBe("R-D-01");
    expect(nextTag("PRODUCTION_LINE", { buildingCode: "C", tags: TAGS })).toBe("ML-03");
    expect(nextTag("APPLIANCE", { buildingCode: "C", tags: TAGS })).toBe("SP-0323");
    expect(nextTag("POWER_TOOL", { buildingCode: "C", tags: TAGS })).toBe("NR-0113");
    expect(nextTag("WELDER", { buildingCode: "C", tags: TAGS })).toBe("SV-0001");
    expect(nextTag("TRANSFORMER", { buildingCode: "C", tags: TAGS })).toBe("TR2");
    expect(nextTag("LIGHTNING_ROD", { buildingCode: "A", tags: TAGS })).toBe("LPS-A2");
    expect(nextTag("LIGHTNING_ROD", { buildingCode: "C", tags: TAGS })).toBe("LPS-C");
  });
});

describe("suggestName", () => {
  it("hlavní rozváděč budovy, další rozváděče, linky s číslem a převzatá místnost", () => {
    expect(suggestName("SWITCHBOARD", { tag: "R-C-01", zone: null, buildingName: "Hala C - Svařovna", boardsInBuilding: 0 })).toBe("Hlavní rozváděč Hala C");
    expect(suggestName("SWITCHBOARD", { tag: "R-C-02", zone: null, buildingName: "Hala C", boardsInBuilding: 1 })).toBe("Podružný rozváděč 2");
    expect(suggestName("SWITCHBOARD", { tag: "R-C-02", zone: "Svařovna", buildingName: "Hala C", boardsInBuilding: 1 })).toBe("Rozváděč – Svařovna");
    expect(suggestName("PRODUCTION_LINE", { tag: "ML-03", zone: null, buildingName: "Hala C", boardsInBuilding: 1 })).toBe("Výrobní linka 3");
    expect(suggestName("WELDER", { tag: "SV-0008", zone: "Svařovna", buildingName: "Hala C", boardsInBuilding: 1 })).toBe("Svářečka – Svařovna");
    expect(suggestName("EMERGENCY_LIGHTING", { tag: "NO-C", zone: null, buildingName: "Hala C - Svařovna", boardsInBuilding: 1 })).toBe("Nouzové osvětlení Hala C");
    expect(buildingShortName("Hala A - Lisovna")).toBe("Hala A");
  });
});

describe("bestParent", () => {
  const source = (id: string, type: AutopilotSource["type"], floorId: string, isMain = false, inBuilding = false): AutopilotSource => ({ id, tag: id, type, floorId, isMain, inBuilding });
  const SOURCES = [source("TR1", "TRANSFORMER", "e1", true), source("RM1", "SWITCHBOARD", "e0", true), source("R-ML-01", "SWITCHBOARD", "b1"), source("R-C-01", "SWITCHBOARD", "c2", false, true)];

  it("stejné patro → stejná budova → hlavní rozváděč", () => {
    expect(bestParent("PRODUCTION_LINE", SOURCES, "b1")?.tag).toBe("R-ML-01");
    expect(bestParent("PRODUCTION_LINE", SOURCES, "c1")?.tag).toBe("R-C-01");
    expect(bestParent("SWITCHBOARD", SOURCES.slice(0, 3), "new")?.tag).toBe("RM1");
    expect(bestParent("TRANSFORMER", SOURCES, "x")).toBeNull();
    expect(bestParent("SWITCHBOARD", [source("TR1", "TRANSFORMER", "e1", true)], "x")?.tag).toBe("TR1");
  });
});
