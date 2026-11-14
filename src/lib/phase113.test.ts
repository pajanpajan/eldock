import { describe, expect, it } from "vitest";

import { BACKGROUND_MAX_SIDE, BACKGROUND_QUALITY, backgroundExtension, encodingSteps, fitSide } from "./panel-builder/background-image";
import { HLIDAC_TRIAL_DEVICES, deviceCapacityLeft, deviceEntitlement, deviceEntitlementLabel, deviceLimitMessage, licenseOf, outputAccess, unlimitedPlan } from "./credits";
import { addFloor, emptyDraft, parseDraft, switchFloor, type FloorplanDraft } from "./panel-builder/floorplan-editor";
import { imagePointToPlan, type FloorplanBackground } from "./panel-builder/floorplan-pdf";
import { isRoomText } from "./panel-builder/pdf-room-detector";
import { DEFAULT_LABEL_SETS, DEFAULT_OPERATOR, footerDetails, formatIban, labelCountOf, labelItemsOf, labelItemsText, labelOrderTitle, labelSetCode, parseLabelSets, parseOperator, pricePerPiece, registryLines } from "./operator";
import { LOCAL_BACKUP_INFO, parseStoredSmtp, smtpInputSchema, backupStorageInputSchema } from "./platform-settings";
import { RELOAD_INTERVAL_MS, isStaleDeployment, mayReload } from "./stale-deploy";

// Fáze 113: podklad půdorysu (WebP do 2400 px), popisky místností z PDF v nákresu, provozovatel neplátce DPH, výchozí sady
// QR štítků, ⭐ neomezený přístup a limit zařízení Hlídače, nastavení SMTP / záloh ve velínu a nová verze po nasazení.

describe("fáze 113 – podklad půdorysu a více podlaží", () => {
  it("delší strana 2400 px, WebP / JPEG 0,82, pak nižší kvalita a menší rozlišení", () => {
    expect(fitSide(3200, 2262)).toEqual({ width: 2400, height: 1697, scale: 0.75 });
    expect(fitSide(1200, 800).scale).toBe(1);
    expect(fitSide(1000, 4000)).toMatchObject({ width: 600, height: BACKGROUND_MAX_SIDE });
    const steps = encodingSteps(2400);
    expect(steps[0]).toEqual({ scale: 1, quality: BACKGROUND_QUALITY });
    expect(steps.map((step) => step.quality)).toEqual([0.82, 0.72, 0.62, 0.68, 0.68]);
    expect(encodingSteps(1500).every((step) => step.scale === 1)).toBe(true);
    expect(backgroundExtension("image/webp")).toBe("webp");
    expect(backgroundExtension("image/jpeg")).toBe("jpg");
  });

  it("každé podlaží si drží vlastní podklad, měřítko a popisky místností z PDF (uložení i načtení)", () => {
    const background = (url: string, labels = true): FloorplanBackground => ({
      url,
      widthPx: 2400,
      heightPx: 1697,
      rotation: 0,
      crop: null,
      pagePt: { width: 842, height: 595 },
      ...(labels ? { labels: [{ text: "1.01 Obývací pokoj", x: 300.04, y: 400, h: 18 }, { text: "x".repeat(200), x: 1, y: 1, h: 1 }] } : {}),
    });
    let draft: FloorplanDraft = { ...emptyDraft(), background: background("/api/files/photos/prizemi.webp"), mmPerPx: 6.25 };
    draft = addFloor(draft, { name: "2. NP", levelMm: 3000 });
    draft = { ...draft, background: background("/api/files/photos/patro.webp", false), mmPerPx: 7 };
    const saved = parseDraft(JSON.parse(JSON.stringify(draft)));
    expect(saved?.floorName).toBe("2. NP");
    expect(saved?.background?.url).toBe("/api/files/photos/patro.webp");
    expect(saved?.mmPerPx).toBe(7);
    const ground = switchFloor(saved!, saved!.otherFloors[0].id);
    expect(ground.background?.url).toBe("/api/files/photos/prizemi.webp");
    expect(ground.mmPerPx).toBe(6.25);
    expect(ground.background?.labels?.[0]).toEqual({ text: "1.01 Obývací pokoj", x: 300, y: 400, h: 18 });
    expect(ground.background?.labels?.[1].text).toHaveLength(80);
    // Podklad jen ze souborů úložiště (žádný data: URL v nákresu)
    expect(parseDraft({ ...JSON.parse(JSON.stringify(draft)), background: { ...background("data:image/png;base64,AAAA"), url: "data:image/png;base64,AAAA" } })?.background).toBeNull();
    expect(isRoomText("Ložnice")).toBe(true);
    expect(isRoomText("3 600")).toBe(false);
  });

  it("bod obrázku podkladu → mm půdorysu při otočení a ořezu", () => {
    const base = { widthPx: 1000, heightPx: 500, crop: null } as const;
    expect(imagePointToPlan({ ...base, rotation: 0 }, 10, { x: 100, y: 50 })).toEqual({ x: 1000, y: 500 });
    expect(imagePointToPlan({ ...base, rotation: 90 }, 10, { x: 100, y: 50 })).toEqual({ x: 4500, y: 1000 });
    expect(imagePointToPlan({ ...base, rotation: 180 }, 10, { x: 100, y: 50 })).toEqual({ x: 9000, y: 4500 });
    expect(imagePointToPlan({ ...base, rotation: 270 }, 10, { x: 100, y: 50 })).toEqual({ x: 500, y: 9000 });
    expect(imagePointToPlan({ ...base, rotation: 0, crop: { x: 50, y: 20, w: 500, h: 300 } }, 10, { x: 100, y: 50 })).toEqual({ x: 500, y: 300 });
  });

  it("nová verze aplikace po nasazení: rozpoznání chyby Server Action a znovunačtení nejvýš jednou za minutu", () => {
    expect(isStaleDeployment(new Error('Server Action "40aa" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action'))).toBe(true);
    expect(isStaleDeployment(new Error("Failed to fetch"))).toBe(false);
    expect(mayReload(null, 1000)).toBe(true);
    expect(mayReload(1000, 1000 + RELOAD_INTERVAL_MS - 1)).toBe(false);
    expect(mayReload(1000, 1000 + RELOAD_INTERVAL_MS)).toBe(true);
  });
});

describe("fáze 113 – provozovatel neplátce DPH a sady QR štítků", () => {
  it("výchozí provozovatel je neplátce DPH, IČO / DIČ nepovinné, v patičce bankovní spojení", () => {
    expect(DEFAULT_OPERATOR.vatPayer).toBe(false);
    expect(registryLines(DEFAULT_OPERATOR)).toEqual(["Neplátce DPH"]);
    expect(footerDetails(DEFAULT_OPERATOR)).toEqual(["Neplátce DPH", `Č. ú. ${DEFAULT_OPERATOR.accountNumber}`]);
    expect(formatIban("CZ1755000000000918118002")).toBe("CZ17 5500 0000 0009 1811 8002");
    // Uložený účet a IBAN se při načtení nepřepíšou výchozími
    const stored = parseOperator(JSON.stringify({ ...DEFAULT_OPERATOR, iban: "CZ6508000000192000145399", accountNumber: "19-2000145399/0800", vatPayer: true }));
    expect(stored).toMatchObject({ iban: "CZ6508000000192000145399", accountNumber: "19-2000145399/0800", vatPayer: true });
    expect(footerDetails({ ...stored, street: "Podhorská 1", ico: "27082440", dic: "CZ27082440" })).toEqual(["Podhorská 1, 466 01 Jablonec nad Nisou", "IČO 27082440", "DIČ CZ27082440", "Č. ú. 19-2000145399/0800"]);
  });

  it("5 výchozích sad odolných QR štítků v prodeji hned po nasazení", () => {
    expect(DEFAULT_LABEL_SETS.map((set) => [set.code, set.count, set.priceExclVat])).toEqual([
      ["LABELS_A100", 100, 490],
      ["LABELS_A500", 500, 1750],
      ["LABELS_S50", 50, 745],
      ["LABELS_M50", 50, 1450],
      ["LABELS_A60S30M10", 100, 890],
    ]);
    expect(pricePerPiece(DEFAULT_LABEL_SETS[0], false)).toBe("4,90 Kč/ks");
    expect(pricePerPiece(DEFAULT_LABEL_SETS[1], false)).toBe("3,50 Kč/ks");
    expect(pricePerPiece(DEFAULT_LABEL_SETS[2], false)).toBe("14,90 Kč/ks");
    expect(pricePerPiece(DEFAULT_LABEL_SETS[3], false)).toBe("29,00 Kč/ks");
    expect(parseLabelSets(null)).toEqual(DEFAULT_LABEL_SETS);
    // Fáze 114: prázdný seznam = výchozí sady
    expect(parseLabelSets("[]")).toEqual(DEFAULT_LABEL_SETS);
    expect(labelItemsOf("LABELS_A60S30M10")).toEqual([
      { kind: "A", count: 60 },
      { kind: "S", count: 30 },
      { kind: "M", count: 10 },
    ]);
    expect(labelItemsOf("LABELS_50")).toEqual([{ kind: "A", count: 50 }]);
    expect(labelItemsOf("START_30")).toBeNull();
    expect(labelCountOf("LABELS_A60S30M10")).toBe(100);
    expect(labelSetCode([{ kind: "M", count: 10 }, { kind: "A", count: 60 }, { kind: "S", count: 30 }])).toBe("LABELS_A60S30M10");
    expect(labelItemsText(labelItemsOf("LABELS_A60S30M10")!)).toBe("60× Spotřebič 30 × 15 mm + 30× Rozváděč 50 × 25 mm + 10× Stroj 70 × 40 mm");
    expect(labelOrderTitle("LABELS_A60S30M10")).toMatch(/^STARTOVACÍ MIX SADA ELDOCK/);
    expect(labelOrderTitle("LABELS_A50")).toBe("Sada QR štítků ELDOCK (50× Spotřebič 30 × 15 mm)");
  });
});

describe("fáze 113 – ⭐ neomezený přístup a limit zařízení Hlídače revizí", () => {
  const now = new Date("2026-11-14T10:00:00Z");
  const company = (extra: Partial<Parameters<typeof deviceEntitlement>[0][number]> = {}) => ({ id: "c1", unlimitedAccess: false, subscriptionPlan: null, subscriptionUntil: null, ...extra });

  it("plná verze bez kreditů a bez zkušebního označení", () => {
    expect(unlimitedPlan("floorplan")).toMatchObject({ license: "UNLIMITED", cost: 0, reason: "UNLIMITED" });
    expect(licenseOf("UNLIMITED")).toBe("UNLIMITED");
    for (const output of ["pdf", "dxf", "xlsx", "quote", "cnc"] as const) expect(outputAccess("UNLIMITED", output)).toEqual({ allowed: true, watermark: false, cost: 0 });
    expect(outputAccess("TRIAL", "pdf").watermark).toBe(true);
  });

  it("zkušební limit, tarify REVIZE & BUDOVY / PRŮMYSL a závody bez limitu", () => {
    const trial = deviceEntitlement([company()], 12, now);
    expect(trial).toMatchObject({ unlimited: false, limit: HLIDAC_TRIAL_DEVICES, reason: "TRIAL" });
    expect(deviceCapacityLeft(trial)).toBe(HLIDAC_TRIAL_DEVICES - 12);
    expect(deviceEntitlementLabel(trial)).toBe(`📦 12 / ${HLIDAC_TRIAL_DEVICES} zařízení – zkušební limit`);
    expect(deviceLimitMessage(trial)).toMatch(/REVIZE & BUDOVY/);
    const buildings = deviceEntitlement([company({ subscriptionPlan: "BUILDINGS", subscriptionUntil: new Date("2027-01-01") })], 120, now);
    expect(buildings).toMatchObject({ limit: 500, reason: "SUBSCRIPTION" });
    expect(deviceEntitlement([company({ subscriptionPlan: "ENTERPRISE", subscriptionUntil: new Date("2027-01-01") }), company({ id: "c2", subscriptionPlan: "BUILDINGS", subscriptionUntil: new Date("2027-01-01") })], 900, now).limit).toBe(5000);
    // Prošlý tarif = zkušební limit; PRO Hlídač nezahrnuje
    expect(deviceEntitlement([company({ subscriptionPlan: "BUILDINGS", subscriptionUntil: new Date("2026-01-01") })], 1, now).reason).toBe("TRIAL");
    expect(deviceEntitlement([company({ subscriptionPlan: "PRO", subscriptionUntil: new Date("2027-01-01") })], 1, now).reason).toBe("TRIAL");
    expect(deviceEntitlement([company({ unlimitedAccess: true })], 9999, now)).toMatchObject({ unlimited: true, reason: "UNLIMITED" });
    expect(deviceEntitlement([company({ id: "company-tester" })], 9999, now, ["company-tester"]).unlimited).toBe(true);
    expect(deviceEntitlement([], 9999, now)).toMatchObject({ unlimited: true, reason: "INTERNAL" });
    expect(deviceCapacityLeft(deviceEntitlement([], 9999, now))).toBe(Infinity);
  });
});

describe("fáze 113 – SMTP a zálohy ve velínu", () => {
  it("kontrola formuláře SMTP a úložiště, uložené nastavení bez hesla v čitelné podobě", () => {
    expect(smtpInputSchema.safeParse({ host: "smtp.seznam.cz", port: 465, secure: true, user: "info@eldock.cz", password: "tajne", from: "ELDOCK <info@eldock.cz>" }).success).toBe(true);
    expect(smtpInputSchema.safeParse({ host: "smtp.seznam.cz", port: 0, secure: true, user: "", from: "ELDOCK" }).success).toBe(false);
    expect(backupStorageInputSchema.safeParse({ endpoint: "https://abc.r2.cloudflarestorage.com", bucket: "eldock-zalohy", accessKeyId: "AKIA1234" }).success).toBe(true);
    expect(backupStorageInputSchema.safeParse({ endpoint: "ftp://x", bucket: "b", accessKeyId: "a" }).success).toBe(false);
    expect(parseStoredSmtp(JSON.stringify({ host: "smtp.seznam.cz", port: 587, secure: false, user: "u", passwordSealed: "v1:abc", from: "ELDOCK <info@eldock.cz>" }))).toMatchObject({ port: 587, secure: false, passwordSealed: "v1:abc" });
    expect(parseStoredSmtp("{}")).toBeNull();
    expect(LOCAL_BACKUP_INFO).toBe("💾 Lokální záloha na serveru je aktivní (S3/R2 cloud úložiště je volitelné)");
  });
});
