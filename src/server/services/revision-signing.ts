// Fáze 108: podepsaná revize revizního technika – profily techniků závodu (PIN scrypt + zámek po 5 chybách),
// zápis revize jednoho i více zařízení (sloučený výjezd) s kryptografickou pečetí SHA-256, časovým razítkem
// UTC / SEČ, IP a zařízením, ověření pečeti, připojení kvalifikovaného podpisu PAdES, měsíční kontrolní report
// pod číslem osvědčení TIČR a zneplatnění cizí revize (zneužití osvědčení). Bez `server-only` (testy nad SQLite).

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { InspectionResult, InspectorProfile } from "@/generated/prisma/client";
import { formatDateShort } from "@/lib/format";
import { isPortable } from "@/lib/inspection-rules";
import { renderBatchProtocolSvg } from "@/lib/mock-graphics/compliance";
import type { DocumentSeal } from "@/lib/mock-graphics/document";
import {
  PIN_LOCK_MINUTES,
  PIN_MAX_FAILURES,
  SEAL_VERSION,
  SIGNABLE_TYPE_LABELS,
  certificateKey,
  detectPades,
  deviceLabel,
  instrumentText,
  measurementLines,
  monthLabel,
  monthRange,
  pragueMonth,
  previousMonth,
  sealPayload,
  sealTimestamp,
  shortHash,
  stampLines,
  type InspectorProfileView,
  type SealRecord,
  type SignableType,
  type SignedMeasurements,
} from "@/lib/revision-signature";
import { WorkflowError } from "@/lib/workflow/state-machine";
import type { MailTransport } from "@/server/mailer";

import { MAX_BATCH, prepareInspectionRows, type RecordInspectionInput } from "./inspection";

const fail = (message: string, code: "VALIDATION" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" = "VALIDATION"): never => {
  throw new WorkflowError(code, message);
};

export const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

// ---------------------------------------------------------------------------
//  PIN
// ---------------------------------------------------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 } as const;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function pinMatches(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(pin, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const dayText = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);
const parseDay = (value: string | null | undefined) => (value ? new Date(`${value}T10:00:00Z`) : null);

export function profileView(profile: InspectorProfile, now: Date = new Date()): InspectorProfileView {
  return {
    id: profile.id,
    plantId: profile.plantId,
    name: profile.name,
    company: profile.company,
    ico: profile.ico,
    phone: profile.phone,
    email: profile.email,
    certificateNo: profile.certificateNo,
    certificateScope: (profile.certificateScope as InspectorProfileView["certificateScope"]) ?? null,
    certificateValidUntil: dayText(profile.certificateValidUntil),
    authorizationNo: profile.authorizationNo,
    instrument: profile.instrument,
    calibrationNo: profile.calibrationNo,
    calibrationValidUntil: dayText(profile.calibrationValidUntil),
    signatureUrl: profile.signatureUrl,
    monthlyEmail: profile.monthlyEmail,
    locked: Boolean(profile.pinLockedUntil && profile.pinLockedUntil > now),
  };
}

/** Firma Správy závodů vlastnící závod (bezpečnostní audit). */
async function plantCompanyId(prisma: PrismaClient, plantId: string) {
  const company = await prisma.registeredCompany.findFirst({ where: { plantId, productScope: "PLANT_MANAGEMENT" }, select: { id: true } });
  return company?.id ?? null;
}

export interface AuditContext {
  now?: Date;
  actorId?: string | null;
  /** HMAC IP (`ipKeyOf`) – bezpečnostní audit neukládá IP v čitelné podobě. */
  ipKey?: string | null;
}

/** Ověří PIN technika; po 5 chybách zamkne podpis na 15 minut a každou chybu zapíše do bezpečnostního auditu. */
export async function verifyPin(prisma: PrismaClient, profileId: string, pin: string, context: AuditContext = {}) {
  const now = context.now ?? new Date();
  const profile = await prisma.inspectorProfile.findUnique({ where: { id: profileId } });
  if (!profile) return fail("Profil revizního technika nebyl nalezen.", "NOT_FOUND");
  if (profile.pinLockedUntil && profile.pinLockedUntil > now) {
    return fail(`Podpis je po ${PIN_MAX_FAILURES} chybných PINech zablokovaný do ${profile.pinLockedUntil.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" })}.`, "FORBIDDEN");
  }
  if (!pinMatches(pin, profile.pinHash)) {
    const failures = profile.pinFailures + 1;
    const lock = failures >= PIN_MAX_FAILURES;
    await prisma.$transaction([
      prisma.inspectorProfile.update({
        where: { id: profile.id },
        data: { pinFailures: lock ? 0 : failures, pinLockedUntil: lock ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000) : profile.pinLockedUntil },
      }),
      prisma.securityEvent.create({
        data: {
          kind: "INSPECTOR_PIN_FAILED",
          companyId: await plantCompanyId(prisma, profile.plantId),
          actorId: context.actorId ?? null,
          ipKey: context.ipKey ?? null,
          detail: JSON.stringify({ profileId: profile.id, failures: lock ? PIN_MAX_FAILURES : failures, locked: lock }),
          createdAt: now,
        },
      }),
    ]);
    return fail(lock ? `Chybný PIN – podpis je na ${PIN_LOCK_MINUTES} minut zablokovaný.` : `Chybný PIN (zbývá ${PIN_MAX_FAILURES - failures} pokusů).`, "FORBIDDEN");
  }
  if (profile.pinFailures || profile.pinLockedUntil) {
    await prisma.inspectorProfile.update({ where: { id: profile.id }, data: { pinFailures: 0, pinLockedUntil: null } });
  }
  return profile;
}

// ---------------------------------------------------------------------------
//  Profily techniků
// ---------------------------------------------------------------------------

export async function listInspectorProfiles(prisma: PrismaClient, where: Prisma.InspectorProfileWhereInput, now: Date = new Date()) {
  const profiles = await prisma.inspectorProfile.findMany({ where, orderBy: [{ name: "asc" }, { createdAt: "asc" }] });
  return profiles.map((profile) => profileView(profile, now));
}

export interface SaveProfileInput {
  inspectorProfileId?: string | null;
  plantId: string;
  name: string;
  company?: string | null;
  ico?: string | null;
  phone?: string | null;
  email?: string | null;
  certificateNo: string;
  certificateScope?: string | null;
  certificateValidUntil?: string | null;
  authorizationNo?: string | null;
  instrument?: string | null;
  calibrationNo?: string | null;
  calibrationValidUntil?: string | null;
  monthlyEmail?: boolean;
  pin?: string | null;
  currentPin?: string | null;
}

/** Založí profil (s PINem) nebo upraví údaje; nový PIN jen po zadání současného. */
export async function saveInspectorProfile(prisma: PrismaClient, input: SaveProfileInput, context: AuditContext & { createdById?: string | null } = {}) {
  const now = context.now ?? new Date();
  const data = {
    name: input.name.trim(),
    company: input.company?.trim() || null,
    ico: input.ico?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    certificateNo: input.certificateNo.trim(),
    certificateKey: certificateKey(input.certificateNo),
    certificateScope: input.certificateScope || null,
    certificateValidUntil: parseDay(input.certificateValidUntil),
    authorizationNo: input.authorizationNo?.trim() || null,
    instrument: input.instrument?.trim() || null,
    calibrationNo: input.calibrationNo?.trim() || null,
    calibrationValidUntil: parseDay(input.calibrationValidUntil),
    ...(input.monthlyEmail === undefined ? {} : { monthlyEmail: input.monthlyEmail }),
  };
  if (!data.certificateKey) fail("Vyplňte evidenční číslo osvědčení TIČR.");
  if (data.monthlyEmail && !data.email) fail("Pro měsíční report vyplňte e-mail technika.");
  if (input.inspectorProfileId) {
    const existing = await prisma.inspectorProfile.findUnique({ where: { id: input.inspectorProfileId }, select: { id: true, plantId: true } });
    if (!existing || existing.plantId !== input.plantId) return fail("Profil revizního technika nebyl nalezen.", "NOT_FOUND");
    let pinHash: string | undefined;
    if (input.pin) {
      if (!input.currentPin) fail("Pro změnu PINu zadejte současný PIN.");
      await verifyPin(prisma, existing.id, input.currentPin!, context);
      pinHash = hashPin(input.pin);
    }
    const saved = await prisma.inspectorProfile.update({ where: { id: existing.id }, data: { ...data, ...(pinHash ? { pinHash, pinFailures: 0, pinLockedUntil: null } : {}) } });
    return profileView(saved, now);
  }
  if (!input.pin) fail("Nastavte osobní bezpečnostní PIN (4–8 číslic) – potvrzuje se jím vydání revize.");
  const saved = await prisma.inspectorProfile.create({ data: { ...data, plantId: input.plantId, createdById: context.createdById ?? null, pinHash: hashPin(input.pin!) } });
  return profileView(saved, now);
}

// ---------------------------------------------------------------------------
//  Podepsaná revize (vrstva A)
// ---------------------------------------------------------------------------

export const SIGNATURE_MAX_BYTES = 300 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** `data:image/png;base64,…` z plátna → PNG (ověřená hlavička a velikost). */
export function parseSignaturePng(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return fail("Podpis musí být obrázek PNG z podpisového plátna.");
  const png = Buffer.from(match[1], "base64");
  if (png.byteLength > SIGNATURE_MAX_BYTES) fail("Obrázek podpisu je příliš velký.");
  if (png.byteLength < 64 || !PNG_MAGIC.every((byte, index) => png[index] === byte)) fail("Podpis musí být obrázek PNG z podpisového plátna.");
  return png;
}

export interface SignedRevisionInput {
  equipmentIds: string[];
  inspectorProfileId: string;
  pin: string;
  type: SignableType;
  /** Lhůta příští revize v letech; `null` = podle lhůty každého zařízení. */
  intervalYears: number | null;
  inspectionDate: string;
  reportNumber?: string | null;
  extraordinaryReason?: string | null;
  measurements: SignedMeasurements;
  result: InspectionResult;
  defectsSummary?: string | null;
  /** Nový podpis z plátna (data URL PNG); bez něj uložený podpis profilu. */
  signaturePng?: string | null;
  rememberSignature?: boolean;
  /** Technik potvrzuje, že hodnoty odpovídají skutečnému měření (šablona není měření). */
  confirmMeasured: boolean;
}

export interface SigningContext extends AuditContext {
  ip: string | null;
  userAgent: string | null;
  storeSignature: (png: Buffer) => Promise<string>;
  storeReport: (svg: string) => Promise<string>;
  /** Uložený podpis profilu → bajty (vložení do zprávy). */
  loadFile?: (url: string) => Promise<Buffer | null>;
}

const pngDataUrl = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;

/** Sloupce záznamu, které chrání pečeť (stejný výběr pro zápis i ověření). */
const SEAL_SELECT = {
  equipmentId: true,
  type: true,
  inspectionDate: true,
  validUntil: true,
  reportNumber: true,
  result: true,
  defectsSummary: true,
  measuringInstrument: true,
  calibrationRef: true,
  insulationResistance: true,
  protectiveConductorResistance: true,
  rcdTestJson: true,
  shortCircuitA: true,
  connectionsOk: true,
  actsPerformed: true,
  inspectorName: true,
  inspectorLicense: true,
  inspectorScope: true,
  inspectorAuthorization: true,
  inspectorCompany: true,
  inspectorIco: true,
  signatureUrl: true,
  signedAt: true,
  signedIp: true,
  signedDevice: true,
  pinVerified: true,
} as const satisfies Prisma.InspectionRecordSelect;

const sealOf = (records: readonly SealRecord[]) => sha256(sealPayload(records));

/**
 * Zapíše podepsanou revizi jednoho nebo více zařízení (sloučený výjezd, jeden protokol): ověří PIN, uloží podpis,
 * spočítá pečeť SHA-256 nad údaji protokolu, technikem, měřením, časem a IP, vygeneruje zprávu s patičkou
 * a vše zapíše v jedné transakci včetně události REVISION_SIGNED v bezpečnostním auditu.
 */
export async function recordSignedRevision(prisma: PrismaClient, input: SignedRevisionInput, context: SigningContext) {
  const now = context.now ?? new Date();
  if (!input.confirmMeasured) fail("Před podpisem potvrďte, že uvedené hodnoty odpovídají skutečnému měření.");
  const ids = [...new Set(input.equipmentIds)];
  if (!ids.length) fail("Vyberte alespoň jedno zařízení.");
  if (ids.length > MAX_BATCH) fail(`Najednou lze podepsat nejvýše ${MAX_BATCH} zařízení.`);
  if (input.intervalYears !== null && (!Number.isInteger(input.intervalYears) || input.intervalYears < 1 || input.intervalYears > 4)) fail("Lhůta příští revize je 1–4 roky.");
  if (input.type === "EXTRAORDINARY" && !input.extraordinaryReason?.trim()) fail("U mimořádné revize uveďte důvod (oprava, změna, havárie…).");

  const profile = await verifyPin(prisma, input.inspectorProfileId, input.pin, context);
  const inPlant = await prisma.equipment.count({ where: { id: { in: ids }, floor: { building: { plantId: profile.plantId } } } });
  if (inPlant !== ids.length) fail("Profil technika patří jinému závodu než vybraná zařízení.");

  // Podpis: nový z plátna, nebo uložený v profilu
  let signatureUrl: string;
  let signatureImage: string | null = null;
  let freshSignature = false;
  if (input.signaturePng) {
    const png = parseSignaturePng(input.signaturePng);
    signatureUrl = await context.storeSignature(png);
    signatureImage = pngDataUrl(png);
    freshSignature = true;
  } else if (profile.signatureUrl) {
    signatureUrl = profile.signatureUrl;
    const stored = await context.loadFile?.(profile.signatureUrl);
    signatureImage = stored ? pngDataUrl(stored) : null;
  } else {
    return fail("Podepište se na plátno (uložený podpis profil zatím nemá).");
  }

  const view = profileView(profile, now);
  const m = input.measurements;
  const lines = measurementLines(m);
  const defects = input.defectsSummary?.trim() || null;
  const reportNumber = input.reportNumber?.trim() || `RT-${input.inspectionDate.replace(/-/g, "")}-${String(now.getTime()).slice(-5)}`;
  const rcdTest =
    m.rcdRatedMa !== null || m.rcdTripTimeMs !== null || m.loopImpedance !== null
      ? { ratedMa: m.rcdRatedMa ?? 30, type: m.rcdType, tripTimeMs: m.rcdTripTimeMs, loopOhm: m.loopImpedance, noTripAtHalf: null, tripCurrentMa: null, breakerA: null, breakerCurve: "B" as const }
      : null;
  const inputs: RecordInspectionInput[] = ids.map((equipmentId) => ({
    equipmentId,
    type: input.type,
    inspectionDate: input.inspectionDate,
    validityMonths: input.intervalYears ? input.intervalYears * 12 : null,
    reportNumber,
    inspectorName: profile.name,
    inspectorLicense: profile.certificateNo,
    inspectorScope: profile.certificateScope,
    inspectorValidUntil: dayText(profile.certificateValidUntil),
    result: input.result,
    defectsSummary: defects,
    measuringInstrument: instrumentText(view),
    insulationResistance: m.insulationResistance,
    protectiveConductorResistance: m.protectiveConductorResistance,
    rcdTest,
    extraordinaryReason: input.type === "EXTRAORDINARY" ? input.extraordinaryReason?.trim() : null,
    actsPerformed: lines.length ? `Prohlídka, měření a zkoušky dle ČSN 33 1500 a ČSN 33 2000-6 ed. 2: ${lines.join("; ")}.` : null,
  }));
  const rows = await prepareInspectionRows(prisma, inputs, now);

  const signing = {
    inspectorProfileId: profile.id,
    inspectorCompany: profile.company,
    inspectorIco: profile.ico,
    inspectorPhone: profile.phone,
    inspectorEmail: profile.email,
    inspectorAuthorization: profile.authorizationNo,
    calibrationRef: profile.calibrationNo ? `${profile.calibrationNo}${profile.calibrationValidUntil ? ` (platnost do ${formatDateShort(profile.calibrationValidUntil)})` : ""}` : null,
    shortCircuitA: m.shortCircuitA,
    connectionsOk: m.connectionsOk,
    signatureUrl,
    signedAt: now,
    signedIp: context.ip?.slice(0, 64) ?? null,
    signedDevice: deviceLabel(context.userAgent)?.slice(0, 120) ?? null,
    pinVerified: true,
    sealVersion: SEAL_VERSION,
  };
  const sealRecords: SealRecord[] = rows.map((row) => ({
    equipmentId: row.columns.equipmentId,
    type: row.columns.type,
    inspectionDate: row.columns.inspectionDate,
    validUntil: row.columns.validUntil,
    reportNumber: row.columns.reportNumber,
    result: row.columns.result,
    defectsSummary: row.columns.defectsSummary,
    measuringInstrument: row.columns.measuringInstrument,
    insulationResistance: row.columns.insulationResistance,
    protectiveConductorResistance: row.columns.protectiveConductorResistance,
    rcdTestJson: row.columns.rcdTestJson,
    actsPerformed: row.columns.actsPerformed,
    inspectorName: row.columns.inspectorName,
    inspectorLicense: row.columns.inspectorLicense,
    inspectorScope: row.columns.inspectorScope,
    ...signing,
  }));
  const sealHash = sealOf(sealRecords);

  const stamp = stampLines(view);
  const time = sealTimestamp(now);
  const seal: DocumentSeal = {
    signaturePng: signatureImage,
    stamp: { title: stamp.title, name: stamp.name, certificate: stamp.certificate, scope: stamp.scope, authorization: stamp.authorization },
    footer: [
      `Pečeť SHA-256: ${sealHash}`,
      `Elektronicky podepsal(a): ${profile.name} · osvědčení TIČR č. ${profile.certificateNo}${profile.certificateScope ? ` (${profile.certificateScope})` : ""} · vydání potvrzeno osobním PINem`,
      `Časové razítko: ${time.utc} · ${time.local} · IP ${signing.signedIp ?? "neuvedena"}${signing.signedDevice ? ` · ${signing.signedDevice}` : ""}`,
      `Protokol ${reportNumber} je uzamčený – Eldock otisk kdykoli přepočítá z uložených údajů (shoda = obsah nezměněn).`,
      "Prostý elektronický podpis s pečetí obsahu (eIDAS čl. 25 odst. 1); kvalifikovaný podpis PAdES lze připojit.",
    ],
  };
  const svg =
    rows.length === 1
      ? rows[0].svg({ seal, measurementLines: lines })
      : renderBatchProtocolSvg({
          protocolNumber: reportNumber,
          title: `Protokol sloučené revize – ${SIGNABLE_TYPE_LABELS[input.type]}`,
          inspectionDate: formatDateShort(rows[0].inspectionDate),
          inspectorName: profile.name,
          inspectorLicense: profile.certificateScope ? `${profile.certificateNo} (${profile.certificateScope})` : profile.certificateNo,
          instrument: instrumentText(view),
          result: input.result,
          defectsSummary: defects,
          measurementLines: lines,
          items: rows.map((row) => ({
            tag: row.equipment.tag,
            name: row.equipment.name,
            standard: row.standard,
            validUntil: input.result === "INCAPABLE" ? "vyřazeno" : formatDateShort(row.validUntil),
          })),
          seal,
        });
  const reportUrl = await context.storeReport(svg);

  const companyId = await plantCompanyId(prisma, profile.plantId);
  const created = await prisma.$transaction([
    ...rows.map((row) =>
      prisma.inspectionRecord.create({
        data: { ...row.columns, ...signing, sealHash, reportUrl, defects: { create: row.defects } },
        select: { id: true, equipmentId: true, validUntil: true },
      }),
    ),
    ...(freshSignature && input.rememberSignature ? [prisma.inspectorProfile.update({ where: { id: profile.id }, data: { signatureUrl }, select: { id: true } })] : []),
    prisma.securityEvent.create({
      data: {
        kind: "REVISION_SIGNED",
        companyId,
        actorId: context.actorId ?? null,
        ipKey: context.ipKey ?? null,
        detail: JSON.stringify({ reportNumber, count: rows.length, seal: sealHash.slice(0, 16), profileId: profile.id }),
        createdAt: now,
      },
    }),
  ]);
  const records = created.slice(0, rows.length) as { id: string; equipmentId: string; validUntil: Date }[];
  const tags = new Map(rows.map((row) => [row.equipment.id, row.equipment.tag]));
  return {
    reportNumber,
    sealHash,
    reportUrl,
    count: records.length,
    recordIds: records.map((record) => record.id),
    items: records.map((record) => ({ id: record.equipmentId, recordId: record.id, tag: tags.get(record.equipmentId) ?? "", validUntil: record.validUntil })),
  };
}

/** Záznamy jednoho podepsaného protokolu (stejné číslo zprávy a pečeť). */
async function protocolGroup(prisma: PrismaClient, record: { reportNumber: string; sealHash: string | null }) {
  if (!record.sealHash) return [];
  return prisma.inspectionRecord.findMany({ where: { reportNumber: record.reportNumber, sealHash: record.sealHash }, select: { id: true, ...SEAL_SELECT } });
}

export type SealStatus = "VALID" | "TAMPERED" | "UNSIGNED";

/** Přepočítá pečeť z uložených údajů protokolu a porovná ji s uloženým otiskem. */
export async function verifySeal(prisma: PrismaClient, inspectionId: string): Promise<{ status: SealStatus; sealHash: string | null; recomputed: string | null; count: number }> {
  const record = await prisma.inspectionRecord.findUnique({ where: { id: inspectionId }, select: { reportNumber: true, sealHash: true, sealVersion: true } });
  if (!record) return fail("Záznam revize nebyl nalezen.", "NOT_FOUND");
  if (!record.sealHash) return { status: "UNSIGNED", sealHash: null, recomputed: null, count: 0 };
  const group = await protocolGroup(prisma, record);
  const recomputed = sha256(sealPayload(group, record.sealVersion ?? SEAL_VERSION));
  return { status: recomputed === record.sealHash ? "VALID" : "TAMPERED", sealHash: record.sealHash, recomputed, count: group.length };
}

// ---------------------------------------------------------------------------
//  Vrstva B – kvalifikovaný podpis PAdES
// ---------------------------------------------------------------------------

/** Připojí k uzamčenému protokolu PDF podepsané technikem (PAdES); jednou – podepsaný protokol se už nemění. */
export async function attachPades(
  prisma: PrismaClient,
  input: { inspectionId: string; bytes: Uint8Array },
  context: { now?: Date; storePdf: (data: Buffer) => Promise<string> },
) {
  const now = context.now ?? new Date();
  const record = await prisma.inspectionRecord.findUnique({ where: { id: input.inspectionId }, select: { id: true, reportNumber: true, sealHash: true, padesUrl: true, misuseFlaggedAt: true } });
  if (!record) return fail("Záznam revize nebyl nalezen.", "NOT_FOUND");
  if (!record.sealHash) fail("PAdES lze připojit jen k revizi podepsané v Eldocku (vrstva A).");
  if (record.misuseFlaggedAt) fail("Záznam je zneplatněný technikem – podpis už nelze připojit.");
  if (record.padesUrl) fail("K protokolu už je připojený podepsaný PDF (PAdES). Uzamčený protokol se nemění.", "CONFLICT");
  const detected = detectPades(input.bytes);
  if (!detected.pdf) fail("Soubor není PDF.");
  if (!detected.signatures) fail("PDF neobsahuje elektronický podpis (PAdES). Podepište protokol certifikátem a nahrajte ho znovu.");
  const data = Buffer.from(input.bytes);
  const url = await context.storePdf(data);
  const info = `${detected.subFilter ?? "podpis PDF"} · ${detected.signatures}× podpis · ${Math.max(1, Math.round(data.byteLength / 1024))} kB · SHA-256 ${sha256(data)}`;
  const group = await protocolGroup(prisma, record);
  await prisma.inspectionRecord.updateMany({ where: { id: { in: group.map((entry) => entry.id) } }, data: { padesUrl: url, padesUploadedAt: now, padesInfo: info.slice(0, 300) } });
  return { url, info, count: group.length };
}

// ---------------------------------------------------------------------------
//  Měsíční report TIČR a zneplatnění
// ---------------------------------------------------------------------------

export interface MonthlyRow {
  id: string;
  at: Date;
  signed: boolean;
  plantName: string;
  buildingName: string;
  floorName: string;
  equipmentId: string;
  tag: string;
  name: string;
  hasQr: boolean;
  portable: boolean;
  type: string;
  result: InspectionResult;
  reportNumber: string;
  inspectorName: string;
  ip: string | null;
  device: string | null;
  sealHash: string | null;
  padesInfo: string | null;
  flaggedAt: Date | null;
  flaggedNote: string | null;
}

export interface MonthlyReport {
  month: string;
  label: string;
  certificateNo: string;
  rows: MonthlyRow[];
  totals: { count: number; revisions: number; pieceTests: number; signed: number; flagged: number };
  /** Záznamy pod tímto číslem mimo závody účtu (bez podrobností – jen upozornění). */
  foreignCount: number;
}

const inMonth = (range: { from: Date; to: Date }): Prisma.InspectionRecordWhereInput => ({
  OR: [{ signedAt: { gte: range.from, lt: range.to } }, { signedAt: null, inspectionDate: { gte: range.from, lt: range.to } }],
});

/** Všechny revize pod číslem osvědčení v daném měsíci (podle času podpisu, u nepodepsaných dne revize). */
export async function monthlyReport(prisma: PrismaClient, input: { certificateNo: string; month: string; plant: Prisma.PlantWhereInput }): Promise<MonthlyReport> {
  const key = certificateKey(input.certificateNo);
  if (!key) return fail("Vyplňte číslo osvědčení TIČR.");
  const range = monthRange(input.month);
  const scope: Prisma.InspectionRecordWhereInput = { equipment: { floor: { building: { plant: input.plant } } } };
  const [records, foreign] = await Promise.all([
    prisma.inspectionRecord.findMany({
      where: { AND: [scope, inMonth(range)] },
      orderBy: [{ signedAt: "asc" }, { inspectionDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        type: true,
        result: true,
        reportNumber: true,
        inspectionDate: true,
        inspectorName: true,
        inspectorLicense: true,
        signedAt: true,
        signedIp: true,
        signedDevice: true,
        sealHash: true,
        padesInfo: true,
        misuseFlaggedAt: true,
        misuseNote: true,
        equipment: { select: { id: true, tag: true, name: true, type: true, qrToken: true, floor: { select: { name: true, building: { select: { name: true, plant: { select: { name: true } } } } } } } },
      },
    }),
    prisma.inspectionRecord.findMany({ where: { AND: [{ NOT: scope }, inMonth(range)] }, select: { inspectorLicense: true } }),
  ]);
  const rows: MonthlyRow[] = records
    .filter((record) => certificateKey(record.inspectorLicense) === key)
    .map((record) => ({
      id: record.id,
      at: record.signedAt ?? record.inspectionDate,
      signed: Boolean(record.sealHash),
      plantName: record.equipment.floor.building.plant.name,
      buildingName: record.equipment.floor.building.name,
      floorName: record.equipment.floor.name,
      equipmentId: record.equipment.id,
      tag: record.equipment.tag,
      name: record.equipment.name,
      hasQr: Boolean(record.equipment.qrToken),
      portable: isPortable(record.equipment.type),
      type: record.type,
      result: record.result,
      reportNumber: record.reportNumber,
      inspectorName: record.inspectorName,
      ip: record.signedIp,
      device: record.signedDevice,
      sealHash: record.sealHash,
      padesInfo: record.padesInfo,
      flaggedAt: record.misuseFlaggedAt,
      flaggedNote: record.misuseNote,
    }))
    // Chronologicky podle času podpisu (u nepodepsaných dne revize) – SQLite řadí NULL napřed
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const pieceTests = rows.filter((row) => row.portable).length;
  return {
    month: input.month,
    label: monthLabel(input.month),
    certificateNo: input.certificateNo,
    rows,
    totals: {
      count: rows.length,
      revisions: rows.length - pieceTests,
      pieceTests,
      signed: rows.filter((row) => row.signed).length,
      flagged: rows.filter((row) => row.flaggedAt).length,
    },
    foreignCount: foreign.filter((record) => certificateKey(record.inspectorLicense) === key).length,
  };
}

/**
 * 🚨 „Tato revize není moje!“ – technik (PIN profilu se stejným číslem osvědčení) zneplatní záznam vystavený
 * pod jeho číslem: revize přestane platit (lhůtník, QR karta), dostane červené varování a zapíše se do auditu.
 */
export async function flagMisuse(prisma: PrismaClient, input: { inspectionId: string; inspectorProfileId: string; pin: string; note?: string | null }, context: AuditContext = {}) {
  const now = context.now ?? new Date();
  const profile = await verifyPin(prisma, input.inspectorProfileId, input.pin, context);
  const record = await prisma.inspectionRecord.findUnique({
    where: { id: input.inspectionId },
    select: { id: true, reportNumber: true, inspectorLicense: true, misuseFlaggedAt: true, equipmentId: true, equipment: { select: { tag: true, floor: { select: { building: { select: { plantId: true } } } } } } },
  });
  if (!record) return fail("Záznam revize nebyl nalezen.", "NOT_FOUND");
  if (certificateKey(record.inspectorLicense) !== profile.certificateKey) fail("Záznam není vystavený pod vaším číslem osvědčení TIČR.", "FORBIDDEN");
  if (record.misuseFlaggedAt) return { flaggedAt: record.misuseFlaggedAt, already: true };
  const note = input.note?.trim().slice(0, 500) || null;
  await prisma.$transaction([
    prisma.inspectionRecord.update({ where: { id: record.id }, data: { misuseFlaggedAt: now, misuseNote: note } }),
    prisma.securityEvent.create({
      data: {
        kind: "REVISION_MISUSE",
        companyId: await plantCompanyId(prisma, record.equipment.floor.building.plantId),
        actorId: context.actorId ?? null,
        ipKey: context.ipKey ?? null,
        detail: JSON.stringify({ inspectionId: record.id, tag: record.equipment.tag, reportNumber: record.reportNumber, certificate: profile.certificateKey, profileId: profile.id }),
        createdAt: now,
      },
    }),
  ]);
  return { flaggedAt: now, already: false };
}

// ---------------------------------------------------------------------------
//  E-maily: měsíční report a sloučený seznam výjezdu
// ---------------------------------------------------------------------------

export const MONTHLY_KIND = "TICR_MONTHLY";
export const TRIP_KIND = "REVISION_TRIP";
/** Nejvýš 10 ručně odeslaných e-mailů (report / seznam výjezdu) za hodinu na uživatele. */
export const MAIL_LIMIT_PER_HOUR = 10;

const RESULT_TEXT: Record<InspectionResult, string> = { CAPABLE: "schopno", CAPABLE_WITH_DEFECTS: "s výhradou", INCAPABLE: "neschopno" };
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Řádky CSV výkazu (oddělovač `;`, české Excelové prostředí). */
export function monthlyCsv(report: MonthlyReport): string {
  const head = ["Datum a čas podpisu (UTC)", "Závod", "Budova", "Podlaží", "Označení", "Zařízení", "QR štítek", "Druh", "Výsledek", "Číslo zprávy", "Revizní technik", "IP při podpisu", "Zařízení při podpisu", "SHA-256", "PAdES", "Stav"];
  const cell = (value: string | null | undefined) => {
    const text = (value ?? "").replace(/\r?\n/g, " ");
    return /[;"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [head.join(";")];
  for (const row of report.rows) {
    lines.push(
      [
        row.at.toISOString().replace("T", " ").slice(0, 19),
        row.plantName,
        row.buildingName,
        row.floorName,
        row.tag,
        row.name,
        row.hasQr ? "ano" : "ne",
        row.type,
        RESULT_TEXT[row.result],
        row.reportNumber,
        row.inspectorName,
        row.ip,
        row.device,
        row.sealHash,
        row.padesInfo ? "ano" : "ne",
        row.flaggedAt ? "ZNEPLATNĚNO – podezření ze zneužití osvědčení" : row.signed ? "podepsáno" : "nepodepsáno",
      ]
        .map(cell)
        .join(";"),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Otisk výkazu (SHA-256 nad CSV bez BOM) – „podepsaný“ měsíční výkaz pro fakturaci a evidenci TIČR. */
export const monthlyDigest = (report: MonthlyReport) => sha256(monthlyCsv(report).replace(/^﻿/, ""));

export function monthlyEmail(report: MonthlyReport, profile: { name: string }, origin: string) {
  const subject = `Kontrolní report revizí TIČR ${report.certificateNo} – ${report.label}`;
  const link = `${origin}/inspections/ticr?month=${report.month}`;
  const lines = report.rows.map(
    (row) => `${row.at.toISOString().slice(0, 16).replace("T", " ")} UTC · ${row.plantName} / ${row.buildingName} · ${row.tag} · ${RESULT_TEXT[row.result]} · ${row.signed ? `SHA-256 ${shortHash(row.sealHash)}` : "nepodepsáno"}${row.flaggedAt ? " · ZNEPLATNĚNO" : ""}`,
  );
  const intro = `Dobrý den, ${profile.name},\n\nv měsíci ${report.label} bylo pod vaším číslem osvědčení TIČR ${report.certificateNo} vystaveno ${report.totals.count} záznamů (revize ${report.totals.revisions}, kontroly spotřebičů ${report.totals.pieceTests}, podepsáno ${report.totals.signed}, zneplatněno ${report.totals.flagged}).`;
  const foreign = report.foreignCount ? `\n\nPozor: dalších ${report.foreignCount} záznamů pod tímto číslem leží mimo vaše závody. Pokud o nich nevíte, kontaktujte podporu Eldock.` : "";
  const outro = `\n\nPokud mezi nimi je revize, kterou jste neprovedl(a), otevřete report a označte ji tlačítkem „🚨 Nahlásit zneužití / Tato revize není moje!“:\n${link}\n\nOtisk výkazu SHA-256: ${monthlyDigest(report)}`;
  const text = `${intro}\n\n${lines.join("\n") || "Žádné záznamy."}${foreign}${outro}`;
  const html = `<p>${escapeHtml(intro).replace(/\n/g, "<br>")}</p><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("") || "<li>Žádné záznamy.</li>"}</ul>${foreign ? `<p><strong>${escapeHtml(foreign.trim())}</strong></p>` : ""}<p>${escapeHtml(outro.trim()).replace(/\n/g, "<br>")}</p>`;
  return { subject, text, html };
}

/** Kolik e-mailů uživatel ručně odeslal za poslední hodinu (ochrana proti zneužití odesílání). */
export async function assertMailQuota(prisma: PrismaClient, userId: string | null, now: Date = new Date()) {
  if (!userId) return;
  const sent = await prisma.notificationLog.count({ where: { triggeredBy: userId, kind: { in: [MONTHLY_KIND, TRIP_KIND, "LIFESPAN_PURCHASE"] }, createdAt: { gte: new Date(now.getTime() - 3600_000) } } });
  if (sent >= MAIL_LIMIT_PER_HOUR) fail("Za poslední hodinu jste odeslali příliš mnoho e-mailů. Zkuste to prosím později.", "FORBIDDEN");
}

/** Odešle (nebo bez SMTP jen zaloguje) e-mail a zapíše ho do logu notifikací. */
export async function deliverMail(
  prisma: PrismaClient,
  input: { kind: string; plantId: string; to: string; subject: string; text: string; html: string; itemCount: number; triggeredBy: string; transport: MailTransport | null },
) {
  let delivery: "SENT" | "LOGGED" | "FAILED" = "LOGGED";
  let error: string | null = null;
  if (input.transport) {
    try {
      await input.transport({ to: [input.to], subject: input.subject, html: input.html, text: input.text });
      delivery = "SENT";
    } catch (cause) {
      delivery = "FAILED";
      error = cause instanceof Error ? cause.message.slice(0, 500) : "Neznámá chyba SMTP.";
    }
  }
  return prisma.notificationLog.create({
    data: { kind: input.kind, plantId: input.plantId, subject: input.subject, recipients: input.to, html: input.html, text: input.text, itemCount: input.itemCount, delivery, error, triggeredBy: input.triggeredBy },
  });
}

/** Měsíční report jednoho profilu na jeho e-mail (ručně z reportu nebo z denní údržby). */
export async function sendMonthlyReport(
  prisma: PrismaClient,
  input: { profileId: string; month: string; origin: string; transport: MailTransport | null; triggeredBy: string; plant?: Prisma.PlantWhereInput },
) {
  const profile = await prisma.inspectorProfile.findUnique({ where: { id: input.profileId } });
  if (!profile) return fail("Profil revizního technika nebyl nalezen.", "NOT_FOUND");
  if (!profile.email) return fail("Profil technika nemá e-mail – doplňte ho v profilu.");
  const report = await monthlyReport(prisma, { certificateNo: profile.certificateNo, month: input.month, plant: input.plant ?? { id: profile.plantId } });
  const mail = monthlyEmail(report, profile, input.origin);
  const log = await deliverMail(prisma, { kind: MONTHLY_KIND, plantId: profile.plantId, to: profile.email, ...mail, itemCount: report.totals.count, triggeredBy: input.triggeredBy, transport: input.transport });
  return { delivery: log.delivery, to: profile.email, count: report.totals.count };
}

/**
 * Denní údržba: 1. den v měsíci (Praha) pošle profilům se zapnutým přepínačem souhrn za předchozí měsíc
 * (jednou – `lastMonthlyReport`). Report pokrývá závod profilu.
 */
export async function sendDueMonthlyReports(prisma: PrismaClient, input: { now?: Date; origin: string; transport: MailTransport | null }) {
  const now = input.now ?? new Date();
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", day: "2-digit" }).format(now);
  if (today !== "01") return [];
  const month = previousMonth(pragueMonth(now));
  const profiles = await prisma.inspectorProfile.findMany({ where: { monthlyEmail: true, email: { not: null }, OR: [{ lastMonthlyReport: null }, { lastMonthlyReport: { not: month } }] }, select: { id: true } });
  const results = [];
  for (const profile of profiles) {
    const sent = await sendMonthlyReport(prisma, { profileId: profile.id, month, origin: input.origin, transport: input.transport, triggeredBy: "cron" });
    await prisma.inspectorProfile.update({ where: { id: profile.id }, data: { lastMonthlyReport: month } });
    results.push({ profileId: profile.id, ...sent });
  }
  return results;
}
