import { describe, expect, it } from "vitest";

import { mapRectToMeters, metersToMapRect, needsTypedConfirmation, placementError, rectToBuildingMap } from "./building-edit";
import { findFreeSpot, freeSpotFor, overlapArea, polygonBounds, rectsOverlap } from "./campus-layout";
import { freeHallSpot } from "./plant-onboarding";
import {
  STANDARD_MEASUREMENTS,
  VERDICT_TEXT,
  certificateKey,
  detectPades,
  deviceLabel,
  instrumentText,
  isStandardTemplate,
  measurementLines,
  monthLabel,
  monthRange,
  pragueMonth,
  previousMonth,
  sealPayload,
  sealTimestamp,
  shortCircuitFromLoop,
  type SealRecord,
} from "./revision-signature";
import { DUE_SOON_DAYS, INSPECTION_MINUTES, daysText, formatMinutes, moreItemsText, planRevisionTrips, tripListText, tripSummaryText, type TripItem } from "./revision-trip";

// Fáze 108 – čisté funkce: budovy bez překryvu, Chytrá revize (horizont 30 / 60 / 90 dnů), pečeť SHA-256 a měsíc TIČR.

describe("fáze 108 – budovy v areálu bez překryvu", () => {
  const existing = ["8,10 36,10 36,30 8,30", "40,10 68,10 68,30 40,30"];

  it("nová hala z průvodce se nepoloží přes stávající budovy (dřív padala na pevné místo 8,10)", () => {
    const spot = freeHallSpot(existing);
    for (const polygon of existing) expect(rectsOverlap(spot, polygonBounds(polygon))).toBe(false);
    expect(spot.x).toBeGreaterThanOrEqual(0);
    expect(spot.x + spot.w).toBeLessThanOrEqual(100);
  });

  it("v zaplněném areálu se budova zmenší, a když se nevejde, vybere se místo s nejmenším překryvem", () => {
    // Volný pruh 30 % vpravo: hala 40 × 40 se vejde jen zmenšená
    const shrunk = freeSpotFor({ w: 40, h: 40 }, [{ x: 0, y: 0, w: 66, h: 100 }]);
    expect(shrunk.fits).toBe(true);
    expect(shrunk.scale).toBeLessThan(1);
    expect(overlapArea(shrunk.rect, { x: 0, y: 0, w: 66, h: 100 })).toBe(0);
    // Plný areál: místo s nejmenším překryvem, nikdy slepě levý horní roh
    const crowded = Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, col) => ({ x: col * 25, y: row * 25, w: 24, h: 24 }))).flat();
    const full = freeSpotFor({ w: 30, h: 30 }, crowded);
    expect(full.fits).toBe(false);
    const overlap = (rect: { x: number; y: number; w: number; h: number }) => crowded.reduce((sum, other) => sum + overlapArea(rect, other), 0);
    expect(overlap(full.rect)).toBeLessThanOrEqual(overlap({ x: 2, y: 2, w: 30, h: 30 }));
    const free = freeSpotFor({ w: 10, h: 10 }, [{ x: 0, y: 0, w: 50, h: 50 }]);
    expect(free).toMatchObject({ fits: true, scale: 1 });
    expect(overlapArea(free.rect, { x: 0, y: 0, w: 50, h: 50 })).toBe(0);
    expect(findFreeSpot({ w: 10, h: 10 }, [])).toEqual(expect.objectContaining({ w: 10, h: 10 }));
  });

  it("úprava budovy: metry ⇄ procenta mapy, polygon a kontrola polohy (mimo areál / přes jinou halu)", () => {
    const campus = { width: 400, height: 280 };
    const rect = metersToMapRect({ x: 40, y: 28, w: 80, h: 56 }, campus);
    expect(rect).toEqual({ x: 10, y: 10, w: 20, h: 20 });
    expect(mapRectToMeters(rect, campus)).toEqual({ x: 40, y: 28, w: 80, h: 56 });
    expect(rectToBuildingMap(rect)).toMatchObject({ mapPolygon: "10,10 30,10 30,30 10,30", labelX: 20 });
    const buildings = [
      { id: "a", name: "Hala A", mapPolygon: "8,10 36,10 36,30 8,30" },
      { id: "b", name: "Hala B", mapPolygon: "60,60 80,60 80,80 60,80" },
    ];
    expect(placementError({ x: 10, y: 12, w: 10, h: 10 }, "b", buildings)).toMatch(/Hala A/);
    // Budova se může posunout „sama přes sebe“
    expect(placementError({ x: 10, y: 12, w: 10, h: 10 }, "a", buildings)).toBeNull();
    expect(placementError({ x: 95, y: 10, w: 10, h: 10 }, "a", buildings)).toMatch(/mimo areál/);
    expect(needsTypedConfirmation({ inspections: 0, documents: 0, equipment: 0 })).toBe(false);
    expect(needsTypedConfirmation({ inspections: 2, documents: 0, equipment: 1 })).toBe(true);
  });
});

const item = (id: string, daysLeft: number | null, extra: Partial<TripItem> = {}): TripItem => ({
  id,
  tag: id.toUpperCase(),
  name: `Zařízení ${id}`,
  type: "SWITCHBOARD",
  buildingName: "Hala A",
  buildingOrder: 1,
  floorCode: "1NP",
  floorLevel: 0,
  floorName: "1. NP",
  zone: null,
  state: daysLeft === null ? "MISSING" : daysLeft < 0 ? "EXPIRED" : daysLeft <= 30 ? "EXPIRING" : "VALID",
  daysLeft,
  validUntil: null,
  plantId: "p",
  plantName: "Závod Liberec",
  buildingId: "a",
  floorId: "f",
  buildingCenter: { x: 10, y: 10 },
  ...extra,
});

describe("fáze 108 – Chytrá revize (optimalizace výjezdu technika)", () => {
  const hallB = { buildingId: "b", buildingName: "Hala B", buildingOrder: 2, buildingCenter: { x: 30, y: 10 } };
  const hallC = { buildingId: "c", buildingName: "Hala C", buildingOrder: 3, buildingCenter: { x: 90, y: 90 } };
  const items = [
    item("r1", -12), // po termínu – kotva výjezdu
    item("r2", 20), // DUE_SOON, stejná budova
    item("r3", 55, hallC), // vzdálená budova
    item("r4", 50, hallB), // sousední budova
    item("r5", 85), // stejná budova, do 90 dnů
    item("r6", 150, hallB), // jen v horizontu 180
    item("r7", null), // bez revize – do výjezdu se nenabízí
    item("r8", -3, { state: "FAILED" }), // vyřazené – řeší zápis revize
  ];

  it("kotva = zařízení po termínu; nabídka podle horizontu 30 / 60 / 90 / 180 dnů", () => {
    const tags = (horizon: number) => planRevisionTrips(items, horizon)[0].rows.map((row) => row.item.tag);
    expect(planRevisionTrips(items, 90)[0].anchor.item.tag).toBe("R1");
    expect(tags(30)).toEqual(["R2"]);
    expect(tags(60)).toEqual(["R2", "R4", "R3"]);
    expect(tags(90)).toEqual(["R2", "R5", "R4", "R3"]);
    expect(tags(180)).toEqual(["R2", "R5", "R4", "R6", "R3"]);
  });

  it("řazení stejná budova → sousední budovy (vzdálenost na mapě), bez revize a vyřazená zařízení vynechá", () => {
    const [trip] = planRevisionTrips(items, 90);
    expect(trip.rows.map((row) => [row.item.tag, row.sameBuilding])).toEqual([
      ["R2", true],
      ["R5", true],
      ["R4", false],
      ["R3", false],
    ]);
    expect(trip.urgentCount).toBe(2);
    expect(trip.sameBuildingCount).toBe(2);
    expect(trip.minutes).toBe(5 * INSPECTION_MINUTES.SWITCHBOARD);
    expect(trip.rows.some((row) => ["R7", "R8"].includes(row.item.tag))).toBe(false);
  });

  it("detail podlaží: kotva přednostně v budově podlaží; bez neodkladné revize se výjezd nenabízí", () => {
    const withB = [...items, item("b1", 10, hallB)];
    expect(planRevisionTrips(withB, 90, { focusBuildingId: "b" })[0].anchor.item.tag).toBe("B1");
    expect(planRevisionTrips([item("x", 45), item("y", 120)], 180)).toEqual([]);
    expect(DUE_SOON_DAYS).toBe(30);
  });

  it("výjezdy po závodech (CAE) – nejnaléhavější závod první", () => {
    const other = [item("z1", -40, { plantId: "p2", plantName: "Závod Brno" }), item("z2", 70, { plantId: "p2", plantName: "Závod Brno" })];
    const trips = planRevisionTrips([...items, ...other], 90);
    expect(trips.map((trip) => trip.plantName)).toEqual(["Závod Brno", "Závod Liberec"]);
    expect(trips[0].rows.map((row) => row.item.tag)).toEqual(["Z2"]);
  });

  it("texty banneru, dnů a odhadu času", () => {
    const [trip] = planRevisionTrips(items, 90);
    expect(tripSummaryText(trip)).toContain("kvůli 1 neodkladné revizi");
    expect(tripSummaryText(trip)).toContain("přibalit další 4 zařízení v téže budově / závodě");
    expect(tripSummaryText(trip)).toContain("v nejbližších 90 dnech");
    expect(moreItemsText(7)).toBe("dalších 7 zařízení");
    expect(daysText(-12)).toBe("po termínu 12 dní");
    expect(daysText(1)).toBe("za 1 den");
    expect(formatMinutes(90)).toBe("≈ 1 h 30 min");
    expect(tripListText(trip, [trip.anchor, ...trip.rows])).toContain("■ Hala A");
  });
});

const record = (equipmentId: string, extra: Partial<SealRecord> = {}): SealRecord => ({
  equipmentId,
  type: "PERIODIC",
  inspectionDate: new Date("2026-11-13T10:00:00Z"),
  validUntil: new Date("2029-11-13T10:00:00Z"),
  reportNumber: "RT-20261113-00001",
  result: "CAPABLE",
  defectsSummary: "Bez zjištěných závad",
  measuringInstrument: "Metrel EurotestXC MI 3155",
  calibrationRef: "KL-2026-0842",
  insulationResistance: 500,
  protectiveConductorResistance: 0.05,
  rcdTestJson: null,
  shortCircuitA: 657,
  connectionsOk: true,
  actsPerformed: null,
  inspectorName: "Ing. Martin Dvořák",
  inspectorLicense: "1248/23/R-EZ-E2A",
  inspectorScope: "E2A",
  inspectorAuthorization: null,
  inspectorCompany: null,
  inspectorIco: null,
  signatureUrl: "/api/files/attachments/sig.png",
  signedAt: new Date("2026-11-13T08:15:02Z"),
  signedIp: "203.0.113.7",
  signedDevice: "Chrome · Windows",
  pinVerified: true,
  ...extra,
});

describe("fáze 108 – podpis revize a pečeť SHA-256", () => {
  it("kanonický obsah pečeti nezávisí na pořadí záznamů a změní se s jakýmkoli údajem, časem nebo IP", () => {
    const base = sealPayload([record("b"), record("a")]);
    expect(sealPayload([record("a"), record("b")])).toBe(base);
    expect(sealPayload([record("a", { insulationResistance: 450 }), record("b")])).not.toBe(base);
    expect(sealPayload([record("a", { signedIp: "198.51.100.1" }), record("b")])).not.toBe(base);
    expect(sealPayload([record("a", { result: "INCAPABLE" }), record("b")])).not.toBe(base);
    expect(JSON.parse(base)).toMatchObject({ v: 1, protocol: "RT-20261113-00001", inspector: { certificate: "1248/23/R-EZ-E2A" } });
  });

  it("číslo osvědčení TIČR se páruje bez ohledu na mezery, velikost písmen, pomlčky a přípony rozsahu", () => {
    const key = certificateKey("1248/23/R-EZ-E2A");
    expect(certificateKey("  1248/23/r–ez–e2a ")).toBe(key);
    expect(certificateKey("TIČR č. 1248/23/R-EZ-E2A (E2A)")).toBe(key);
    expect(certificateKey("1248/23/R-EZ-E2B")).not.toBe(key);
  });

  it("šablona měření na 1 klik: R_iso, PE, Z_s / I_k, RCD 30 mA / 18 ms, termovize; posudek a přístroj", () => {
    const lines = measurementLines(STANDARD_MEASUREMENTS);
    expect(lines[0]).toBe("Izolační odpor R_iso > 500 MΩ při 500 V DC");
    expect(lines.join(" ")).toContain("PE 0,05 Ω");
    expect(lines.join(" ")).toContain("I_Δn 30 mA, vybavovací čas t_A 18 ms");
    expect(lines.at(-1)).toBe("Kontrola oteplení / termovize a dotažení spojů: VYHOVUJE");
    expect(shortCircuitFromLoop(0.35)).toBe(657);
    expect(isStandardTemplate(STANDARD_MEASUREMENTS)).toBe(true);
    expect(isStandardTemplate({ ...STANDARD_MEASUREMENTS, insulationResistance: 820 })).toBe(false);
    expect(VERDICT_TEXT.CAPABLE).toBe("ZAŘÍZENÍ JE SCHOPNÉ BEZPEČNÉHO PROVOZU");
    expect(instrumentText({ instrument: "Metrel EurotestXC MI 3155", calibrationNo: "KL-2026-0842", calibrationValidUntil: "2027-10-31" })).toBe("Metrel EurotestXC MI 3155, Kalibrační list č. KL-2026-0842, platnost do 10/2027");
  });

  it("PAdES: PDF se slovníkem podpisu (/ByteRange, /SubFilter) se rozpozná, obyčejné PDF a jiný soubor ne", () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    expect(detectPades(encode("%PDF-1.7\n1 0 obj << /Type /Sig /SubFilter /ETSI.CAdES.detached /ByteRange [0 120 2000 300] >> endobj"))).toEqual({ pdf: true, signatures: 1, subFilter: "ETSI.CAdES.detached" });
    expect(detectPades(encode("%PDF-1.4\n1 0 obj << /Type /Page >> endobj"))).toEqual({ pdf: true, signatures: 0, subFilter: null });
    expect(detectPades(encode("PK\u0003\u0004 zip"))).toMatchObject({ pdf: false });
  });

  it("měsíc reportu v pražském čase (SEČ), předchozí měsíc a časové razítko UTC / SEČ", () => {
    expect(monthRange("2026-11")).toEqual({ from: new Date("2026-10-31T23:00:00Z"), to: new Date("2026-11-30T23:00:00Z") });
    expect(monthRange("2026-07").from).toEqual(new Date("2026-06-30T22:00:00Z"));
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(pragueMonth(new Date("2026-11-30T23:30:00Z"))).toBe("2026-12");
    expect(monthLabel("2026-11")).toBe("Listopad 2026");
    expect(sealTimestamp(new Date("2026-11-13T08:15:02Z")).utc).toBe("2026-11-13 08:15:02 UTC");
    expect(sealTimestamp(new Date("2026-11-13T08:15:02Z")).local).toMatch(/9:15:02/);
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36")).toBe("Chrome · Windows");
  });
});
