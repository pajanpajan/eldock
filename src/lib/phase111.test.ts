import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PricingOverview } from "@/components/credits/PricingOverview";

import { ACTION_PRICES, BUNDLE_SWITCHBOARD_PRICE, CREDIT_PACKAGES, PAYWALL_TITLE, SUBSCRIPTIONS, TRIAL_WATERMARK, creditsValidAfterTopUp, orderProduct, pricePerCredit, savingPercent, subscriptionCreditDue, subscriptionUntilAfter } from "./credits";
import { floorplanCharge, freeTrialProjectsRemaining, outputAccess, switchboardCharge, trialRemainingText } from "./credits/entitlements";
import { ID_LABEL_SIZES, idLabelData, titleWithoutTag } from "./equipment-id-label";
import { HLIDAC_MODES, HLIDAC_PALETTE, buildingGrid, devicePosition, nextBuildingCode, paletteDevice, parseRooms, roomKind, roomZones } from "./hlidac";
import { normalizeReading, parseNameplateText, protectionClassOf, readingToEquipment, serialOf } from "./nameplate";
import { GATEWAY, GATEWAY_SIDES } from "./site-sections";

// Fáze 111: ceník a nároky (1 testovací projekt, balíček celá zakázka, prodejní modal), AI čtečka výrobního štítku,
// identifikační štítek, Hlídač revizí a úvodní rozcestník.

describe("fáze 111 – ceník a 1 testovací projekt", () => {
  it("ceny akcí, balíčky (Kč / kredit, úspora) a předplatné", () => {
    expect(ACTION_PRICES).toEqual({ switchboard: 15, floorplan: 15, bundle: 25, quote: 8, cnc: 8 });
    expect(BUNDLE_SWITCHBOARD_PRICE).toBe(10);
    expect(CREDIT_PACKAGES.map((pkg) => [pkg.credits, pkg.priceExclVat, pricePerCredit(pkg), savingPercent(pkg)])).toEqual([
      [30, 750, 25, 0],
      [125, 2490, 19.92, 20],
      [300, 4990, 16.63, 33],
    ]);
    expect(SUBSCRIPTIONS.map((plan) => [plan.plan, plan.monthExclVat, plan.yearExclVat, plan.monthlyCredits, plan.deviceLimit])).toEqual([
      ["PRO", 1490, 14900, 100, null],
      ["BUILDINGS", 1990, 19900, 0, 500],
      ["ENTERPRISE", 6900, 69000, 0, 5000],
    ]);
    expect(orderProduct("SUB_PRO_YEAR")).toMatchObject({ kind: "SUBSCRIPTION", priceExclVat: 14900, credits: 100, subscription: { plan: "PRO", months: 12 } });
    expect(orderProduct("START_10")).toMatchObject({ kind: "LEGACY" });
    expect(orderProduct("SUB_PRO_DAY")).toBeNull();
    expect(PAYWALL_TITLE).toBe("💎 Odemkněte plnou verzi ELDOCK – Tato zakázka vám ušetří ~8 hodin práce (5 200 Kč)");
    expect(TRIAL_WATERMARK).toBe("ZKUŠEBNÍ VÝSTUP – ELDOCK TRIAL (1. testovací projekt zdarma)");
  });

  it("zkušební půdorys a rozváděč zdarma, pak 15 kr.; z zaplaceného půdorysu doplatek 10 kr.; výstupy podle licence", () => {
    const fresh = { trialFloorplanUsed: false, trialSwitchboardUsed: false };
    expect(freeTrialProjectsRemaining(fresh)).toBe(1);
    expect(trialRemainingText(fresh)).toBe("🎁 1 testovací projekt zdarma: zkušební 2D půdorys + zkušební rozváděč");
    expect(floorplanCharge(fresh)).toMatchObject({ license: "TRIAL", cost: 0 });
    expect(switchboardCharge(fresh)).toMatchObject({ license: "TRIAL", cost: 0 });
    const used = { trialFloorplanUsed: true, trialSwitchboardUsed: true };
    expect(freeTrialProjectsRemaining(used)).toBe(0);
    expect(trialRemainingText(used)).toBeNull();
    expect(floorplanCharge(used)).toMatchObject({ license: "PAID", cost: 15 });
    expect(switchboardCharge(used)).toMatchObject({ license: "PAID", cost: 15 });
    expect(switchboardCharge(used, { floorplanLicense: "PAID" })).toMatchObject({ license: "BUNDLE", cost: 10 });
    expect(switchboardCharge(used, { floorplanLicense: "BUNDLE" })).toMatchObject({ license: "BUNDLE", cost: 0 });
    expect(switchboardCharge(used, { floorplanLicense: "TRIAL" })).toMatchObject({ license: "PAID", cost: 15 });
    expect(outputAccess("TRIAL", "pdf")).toEqual({ allowed: true, watermark: true, cost: 0 });
    expect(outputAccess("PAID", "pdf")).toEqual({ allowed: true, watermark: false, cost: 0 });
    expect(outputAccess("PAID", "quote")).toEqual({ allowed: false, watermark: false, cost: 8 });
    expect(outputAccess("BUNDLE", "quote")).toEqual({ allowed: true, watermark: false, cost: 0 });
    expect(outputAccess("BUNDLE", "cnc")).toEqual({ allowed: false, watermark: false, cost: 8 });
    expect(outputAccess("PAID", "cnc", { cnc: true }).allowed).toBe(true);
    expect(outputAccess("SAMPLE", "quote")).toEqual({ allowed: true, watermark: false, cost: 0 });
  });

  it("platnost kreditů 12 měsíců od dobití, předplatné navazuje, měsíční kredity PRO", () => {
    expect(creditsValidAfterTopUp(null, new Date("2026-11-13T10:00:00Z")).toISOString()).toBe("2027-11-13T10:00:00.000Z");
    expect(creditsValidAfterTopUp(new Date("2028-01-01T00:00:00Z"), new Date("2026-11-13T10:00:00Z")).toISOString()).toBe("2028-01-01T00:00:00.000Z");
    expect(subscriptionUntilAfter(new Date("2026-12-10T00:00:00Z"), new Date("2026-11-13T00:00:00Z"), 1).toISOString()).toBe("2027-01-10T00:00:00.000Z");
    const pro = { subscriptionPlan: "PRO", subscriptionUntil: new Date("2027-11-01T00:00:00Z"), subscriptionCreditedAt: new Date("2026-11-01T00:00:00Z") };
    expect(subscriptionCreditDue(pro, new Date("2026-11-20T00:00:00Z"))).toBe(false);
    expect(subscriptionCreditDue(pro, new Date("2026-12-01T00:00:00Z"))).toBe(true);
    expect(subscriptionCreditDue({ ...pro, subscriptionPlan: "BUILDINGS" }, new Date("2026-12-01T00:00:00Z"))).toBe(false);
    expect(subscriptionCreditDue({ ...pro, subscriptionUntil: new Date("2026-11-15T00:00:00Z") }, new Date("2026-12-01T00:00:00Z"))).toBe(false);
  });

  it("ceník na webu: testovací projekt, ceny akcí, balíčky a tarify budov", () => {
    const installer = renderToStaticMarkup(createElement(PricingOverview, { audience: "installer" }));
    for (const text of ["1 testovací projekt zdarma", "Kompletní rozváděč", "Výhodný balíček celá zakázka", "ušetří 5 kreditů", "125 kreditů", "ELDOCK PRO", "20 ks stříbrných QR štítků"]) expect(installer).toContain(text);
    const buildings = renderToStaticMarkup(createElement(PricingOverview, { audience: "buildings" }));
    expect(buildings).toContain("ELDOCK REVIZE &amp; BUDOVY");
    expect(buildings).toContain("5 000 zařízení");
    expect(buildings).toContain("/kontakt?tema=tarif-buildings");
  });
});

describe("fáze 111 – AI čtečka výrobního štítku", () => {
  it("monitor, prodlužovačka, nářadí a konvice: výrobce, model, S/N, napětí, příkon, proud, krytí, třída", () => {
    expect(parseNameplateText("DELL\nMonitor Dell UltraSharp 27\nModel: U2723QE\nS/N: CN-0892K1-74210\n100-240V ~ 50/60Hz 1.5A\nClass I")).toMatchObject({ name: "Monitor Dell UltraSharp 27", manufacturer: "Dell", model: "U2723QE", serialNumber: "CN-0892K1-74210", voltage: "100–240 V AC / 50/60 Hz", currentA: 1.5, protectionClass: "I" });
    expect(parseNameplateText("Prodlužovací přívod 5 zásuvek 3 m\nEmos P0513\nTyp P0513 250V~ 16A 3680W IP20\nV.č. 2304-118822")).toMatchObject({ manufacturer: "Emos", model: "P0513", serialNumber: "2304-118822", powerW: 3680, currentA: 16, ipRating: "IP20" });
    expect(parseNameplateText("Hilti AG 125-15DB\nTYPE AG 125-15DB 230 V 6,5 A 50-60 Hz 1500 W\nSer. No. 4180123456 回")).toMatchObject({ manufacturer: "Hilti", serialNumber: "4180123456", protectionClass: "II", currentA: 6.5, powerW: 1500, voltage: "230 V AC / 50/60 Hz" });
    expect(parseNameplateText("SELV 12 V DC 500 mA Tridonic")).toMatchObject({ protectionClass: "III", voltage: "12 V DC", currentA: 0.5 });
    expect(parseNameplateText("")).toMatchObject({ name: null, serialNumber: null });
    expect(protectionClassOf("TŘÍDA OCHRANY II")).toBe("II");
    expect(serialOf("Výrobní číslo: ABC-12345")).toBe("ABC-12345");
  });

  it("odpověď AI → čtení (chybějící údaje doplní text štítku) → sloupce zařízení", () => {
    const reading = normalizeReading({ rawText: "Bosch GSB 18V-55 S/N 803001234 IP20 Class II", manufacturer: "Bosch", model: "GSB 18V-55", powerW: "0", protectionClass: "2", usageGroup: "c", year: 2023 });
    expect(reading).toMatchObject({ manufacturer: "Bosch", serialNumber: "803001234", ipRating: "IP20", protectionClass: "II", usageGroup: "C", year: 2023, powerW: null });
    expect(readingToEquipment({ ...reading, voltage: "18 V DC", currentA: 2, powerW: 40 })).toEqual({ manufacturer: "Bosch", model: "GSB 18V-55", serialNumber: "803001234", ratedVoltage: "18 V DC", ratedCurrent: "2 A (40 W)", ratedPowerKw: 0.04, ipRating: "IP20", protectionClass: "II", usageGroup: "C", yearInstalled: 2023 });
  });

  it("identifikační štítek: QR EL-xxxxxx, název bez tagu, výrobce a model, S/N, místnost, třída a skupina, příští revize", () => {
    expect(ID_LABEL_SIZES.map((size) => [size.id, size.widthMm, size.heightMm])).toEqual([["50x25", 50, 25], ["30x15", 30, 15]]);
    expect(titleWithoutTag("SP-0001 - Monitor", "SP-0001")).toBe("Monitor");
    const label = idLabelData({ tag: "SP-0001", name: "SP-0001 - Monitor Dell", manufacturer: "Dell", model: "U2723QE", serialNumber: "CN-1", protectionClass: "I", usageGroup: "E", assignedZone: "Kancelář 204" }, { serial: "EL-000042", building: "Budova A", floor: "2. NP", validUntil: new Date("2027-03-12T12:00:00Z") });
    expect(label).toEqual({ serial: "EL-000042", qrUrl: "https://eldock.cz/q/EL-000042", tag: "SP-0001", title: "Monitor Dell", brandModel: "Dell U2723QE", serialNumber: "CN-1", location: "Kancelář 204 · 2. NP · Budova A", classGroup: "Tř. I · sk. E (ČSN 33 1600)", nextRevision: "Revize do 12. 3. 2027" });
  });
});

describe("fáze 111 – Hlídač revizí a úvodní rozcestník", () => {
  it("režimy objektu, paleta 3 skupin na 1 klik, místnosti z textu a rozvržení pater", () => {
    expect(HLIDAC_MODES.OFFICE).toMatchObject({ buildingType: "OFFICE", usageGroup: "E" });
    expect(HLIDAC_MODES.FACTORY).toMatchObject({ buildingType: "PRODUCTION", usageGroup: "C" });
    expect(HLIDAC_PALETTE.map((group) => group.items.length)).toEqual([5, 5, 4]);
    expect(paletteDevice("extension")).toMatchObject({ type: "EXTENSION_CORD", handHeld: true });
    expect(paletteDevice("board")).toMatchObject({ type: "SWITCHBOARD" });
    expect(parseRooms("Kancelář 101, Open-space;\nKuchyňka, Kancelář 101,  ")).toEqual(["Kancelář 101", "Open-space", "Kuchyňka"]);
    expect(["Serverovna", "Sklad", "Dílna", "Kuchyňka", "Kancelář 1"].map(roomKind)).toEqual(["ELECTRICAL", "STORAGE", "WORKSHOP", "FACILITIES", "OFFICE"]);
    expect(buildingGrid([2, 6])).toMatchObject({ widthM: 24, depthM: 10, stepMeters: 6 });
    const zones = roomZones(["A", "B", "C", "D", "E"]);
    expect(zones.map((zone) => [zone.x, zone.y])).toEqual([[0, 0], [6, 0], [12, 0], [18, 0], [0, 5]]);
    expect(devicePosition(zones[1], 0)).toEqual({ x: 6.8, y: 0.8 });
    expect(devicePosition(zones[1], 5)).toEqual({ x: 6.8, y: 1.8 });
    expect(nextBuildingCode(["A", "B", "D"])).toBe("C");
  });

  it("rozcestník: vlevo domovní instalace & rozváděče, vpravo průmysl, budovy & Hlídač revizí – 3 body a tlačítko", () => {
    expect(GATEWAY_SIDES).toEqual(["elektroinstalace", "prumysl-a-revize"]);
    expect(GATEWAY.elektroinstalace).toMatchObject({ path: "/sekce/elektroinstalace", title: "Domovní a komerční elektroinstalace & Rozváděče", cta: "Vstoupit do sekce: Domovní instalace & Rozváděče →" });
    expect(GATEWAY["prumysl-a-revize"]).toMatchObject({ path: "/sekce/prumysl-a-revize", title: "Průmysl, Administrativní budovy & Hlídač revizí", cta: "Vstoupit do sekce: Průmysl, Budovy & Hlídač revizí →" });
    expect(GATEWAY.elektroinstalace.points.map((point) => point.title)).toEqual(["2D Půdorys & Kabeláž", "AI Panel Builder", "Cenové nabídky & Kusovníky"]);
    expect(GATEWAY["prumysl-a-revize"].modules.find((module) => module.id === "hlidac")?.launch.href).toBe("/hlidac-revizi");
  });
});
