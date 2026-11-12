import { describe, expect, it } from "vitest";

import { CHECKLIST_PHASES, PHASE_PALETTE, assembliesVisible, elementLook, filterLook, isLayerFilter, panelVisible, paletteGroupVisible, routeVisible } from "./floorplan-phases";
import { WIZARD_STEPS, nextStep, prevStep } from "./floorplan-wizard";

// Fáze 98: 2D půdorys jako fázový průvodce – v každé fázi jen nástroje a vrstvy dané fáze, volný přechod tam i zpět.

describe("fáze 98 – levá paleta a pravý panel podle fáze", () => {
  it("paleta: fáze 1 a 5 bez značek, fáze 2 rozváděče / zařizovací předměty / okna a nábytek, fáze 3 zásuvky a spotřebiče, fáze 4 světla, ovládání a stínění", () => {
    expect(PHASE_PALETTE[1]).toEqual([]);
    expect(PHASE_PALETTE[2]).toEqual(["panel", "fixtures", "architecture", "medical"]);
    expect(PHASE_PALETTE[3]).toEqual(["sockets", "appliances"]);
    expect(PHASE_PALETTE[4]).toEqual(["lights", "controls", "shading"]);
    expect(PHASE_PALETTE[5]).toEqual([]);
    expect(paletteGroupVisible(3, "lights")).toBe(false);
    expect(paletteGroupVisible(4, "lights")).toBe(true);
    // Kompaktní lišta „Zobrazit vše“ = bez filtru
    expect(paletteGroupVisible(null, "sockets") && paletteGroupVisible(null, "architecture")).toBe(true);
    expect([1, 2, 3, 4, 5].map((phase) => assembliesVisible(phase as 1))).toEqual([false, false, true, true, false]);
  });

  it("pravý panel: fáze 1 místnosti a podlaží, 2 přívod a typ prostoru, 3 zásuvkové okruhy a zóny, 4 design a Smart Home, 5 kontrola, generování, výkaz a kusovník", () => {
    expect(panelVisible(1, "rooms") && panelVisible(1, "detail") && !panelVisible(1, "bom")).toBe(true);
    expect(panelVisible(2, "site") && !panelVisible(2, "design") && !panelVisible(2, "socket-circuits")).toBe(true);
    expect(panelVisible(3, "socket-circuits") && panelVisible(3, "zone-checks") && !panelVisible(3, "checks") && !panelVisible(3, "smart")).toBe(true);
    expect(panelVisible(4, "design") && panelVisible(4, "smart") && panelVisible(4, "zone-checks") && !panelVisible(4, "socket-circuits") && !panelVisible(4, "cables")).toBe(true);
    // detail výběru ve všech fázích
    for (const phase of [1, 2, 3, 4, 5] as const) expect(panelVisible(phase, "detail"), `fáze ${phase}`).toBe(true);
    for (const section of ["generate", "checks", "circuits", "cables", "bom", "inventory"] as const) expect(panelVisible(5, section), section).toBe(true);
    expect(panelVisible(5, "rooms") || panelVisible(5, "socket-circuits") || panelVisible(5, "design")).toBe(false);
    // Bez filtru (kompaktní lišta) všechny karty kromě úzkých výřezů fází – ty jsou v liště
    expect(panelVisible(null, "bom") && panelVisible(null, "socket-circuits") && !panelVisible(null, "rooms") && !panelVisible(null, "generate")).toBe(true);
  });
});

describe("fáze 98 – chytrý filtr vrstev na plátně", () => {
  it("fáze 3: zásuvky a spotřebiče ostře, nábytek a zóny jako jemný podklad, světla a vypínače na 25 % a neklikatelné", () => {
    expect(elementLook(3, "sockets")).toEqual({ view: "active", opacity: 1 });
    expect(elementLook(3, "appliances").view).toBe("active");
    expect(elementLook(3, "architecture")).toEqual({ view: "context", opacity: 0.45 });
    expect(elementLook(3, "fixtures").view).toBe("context");
    expect(elementLook(3, "panel").view).toBe("context");
    expect(elementLook(3, "lights")).toEqual({ view: "dim", opacity: 0.25 });
    expect(elementLook(3, "controls")).toEqual({ view: "dim", opacity: 0.25 });
  });

  it("fáze 4: světla, ovladače a stínění ostře, zásuvky a nábytek na 30 %, rozváděč čitelný", () => {
    expect(elementLook(4, "lights").view).toBe("active");
    expect(elementLook(4, "shading").view).toBe("active");
    expect(elementLook(4, "sockets")).toEqual({ view: "dim", opacity: 0.3 });
    expect(elementLook(4, "architecture")).toEqual({ view: "dim", opacity: 0.3 });
    expect(elementLook(4, "panel").view).toBe("context");
  });

  it("fáze 1 a 2: čistý půdorys / jádro a interiér – ostatní prvky potlačené; fáze 5 a bez filtru vše", () => {
    expect(elementLook(1, "panel").view).toBe("dim");
    expect(elementLook(2, "panel").view).toBe("active");
    expect(elementLook(2, "architecture").view).toBe("active");
    expect(elementLook(2, "sockets").view).toBe("dim");
    expect(elementLook(5, "lights").view).toBe("active");
    expect(elementLook(null, "sockets").view).toBe("active");
  });

  it("trasy: fáze 3 bez světelných a sběrnicových, fáze 4 bez zásuvkových, fáze 1–2 žádné, fáze 5 podle filtru", () => {
    expect(routeVisible(3, "sockets") && routeVisible(3, "appliance") && routeVisible(3, "data") && routeVisible(3, "feeder")).toBe(true);
    expect(routeVisible(3, "lighting") || routeVisible(3, "shading") || routeVisible(3, "bus")).toBe(false);
    expect(routeVisible(4, "lighting") && routeVisible(4, "shading") && routeVisible(4, "bus") && routeVisible(4, "feeder")).toBe(true);
    expect(routeVisible(4, "sockets") || routeVisible(4, "appliance") || routeVisible(4, "data")).toBe(false);
    expect(routeVisible(1, "feeder") || routeVisible(2, "sockets") || routeVisible(2, "lighting")).toBe(false);
    expect(routeVisible(5, "lighting") && routeVisible(5, "sockets")).toBe(true);
    expect(routeVisible(5, "lighting", "power")).toBe(false);
    expect(routeVisible(5, "sockets", "lighting")).toBe(false);
    expect(routeVisible(5, "bus", "smart") && !routeVisible(5, "sockets", "smart")).toBe(true);
    expect(routeVisible(null, "lighting")).toBe(true);
    expect(filterLook("power", "lights").view).toBe("dim");
    expect(filterLook("lighting", "lights").view).toBe("active");
    expect(filterLook("all", "lights").view).toBe("active");
    expect(isLayerFilter("smart") && !isLayerFilter("nic")).toBe(true);
  });
});

describe("fáze 98 – 5 fází a volný přechod", () => {
  it("názvy fází, tlačítka Další fáze a Předchozí fáze; tahák má stejné pořadí", () => {
    expect(WIZARD_STEPS.map((step) => step.short)).toEqual(["Půdorys a místnosti", "Rozváděč a vybavení", "Zásuvky a spotřebiče", "Světla a vypínače", "Trasy, kusovník a rozváděč"]);
    expect([1, 2, 3, 4, 5].map((step) => prevStep(step as 1))).toEqual([1, 1, 2, 3, 4]);
    expect([1, 2, 3, 4, 5].map((step) => nextStep(step as 1))).toEqual([2, 3, 4, 5, 5]);
    expect(CHECKLIST_PHASES.map((entry) => entry.phase)).toEqual([1, 2, 3, 4, 5]);
    expect(CHECKLIST_PHASES[3].label).toBe("4. Světla, vypínače a Smart Home");
  });
});
