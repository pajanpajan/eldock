import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { NACE_SEGMENT_LABEL, type AresCompany } from "@/lib/ares";
import { LEAD_CONSENT_VERSION, LEAD_MARKETING_TEXT, LEAD_PROCESSING_TEXT, leadSchema, type LeadContext, type LeadRole, type LeadRow } from "@/lib/leads";
import { referrerHost, trafficSource } from "@/lib/telemetry";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { lookupAres } from "./ares";
import { subscribe, type NewsletterDeps } from "./newsletter";
import { recordServerEvent } from "./telemetry";

// Fáze 102: zachycený kontakt z trenažéru / ukázkové firmy. Údaje firmy doplní registr ARES podle IČO (název, sídlo,
// DIČ, obory CZ-NACE → zaměření). Souhlas s obchodními sděleními vede přes stávající newsletter s dvojím potvrzením.

/** Role kontaktu → profese newsletteru. */
const AUDIENCE_OF: Record<LeadRole, string> = { installer: "elektrikar", designer: "jine", facility: "technicky-reditel" };

const addressOf = (company: AresCompany) => [company.street, [company.zip, company.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export interface CaptureResult {
  token: string;
  company: { companyName: string; segmentLabel: string; nace: string[] } | null;
  aresError: string | null;
  newsletter: "pending" | "already" | "none";
}

export async function captureLead(prisma: PrismaClient, input: unknown, deps: { fetcher?: typeof fetch; newsletter?: NewsletterDeps } = {}): Promise<CaptureResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) throw new WorkflowError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatné údaje.");
  const lead = parsed.data;
  const ares = lead.ico ? await lookupAres(lead.ico, deps.fetcher) : null;
  const company = ares?.ok ? ares.company : null;
  const source = trafficSource({ referrerHost: referrerHost(lead.source?.referrer ?? null), utmSource: lead.source?.utmSource ?? null });
  const consentText = lead.marketing ? `${LEAD_PROCESSING_TEXT} ${LEAD_MARKETING_TEXT}` : LEAD_PROCESSING_TEXT;
  const firm = company
    ? { ico: company.ico, companyName: company.companyName, dic: company.dic, address: addressOf(company), nace: JSON.stringify(company.nace), segment: company.segment }
    : lead.ico
      ? { ico: lead.ico }
      : {};
  const data = { ...firm, role: lead.role, context: JSON.stringify(lead.context), consentText, consentVersion: LEAD_CONSENT_VERSION, ...(lead.source?.utmCampaign ? { utmCampaign: lead.source.utmCampaign.slice(0, 120) } : {}) };
  const existing = await prisma.lead.findUnique({ where: { email: lead.email }, select: { id: true, marketingConsent: true, source: true } });
  const saved = existing
    ? await prisma.lead.update({ where: { id: existing.id }, data: { ...data, marketingConsent: existing.marketingConsent || lead.marketing, captures: { increment: 1 } }, select: { token: true } })
    : await prisma.lead.create({ data: { email: lead.email, ...data, source, marketingConsent: lead.marketing, token: randomBytes(18).toString("base64url") }, select: { token: true } });

  // Obchodní sdělení jen se souhlasem – dvojí potvrzení e-mailem (newsletter), bez SMTP odkaz jen v logu serveru
  let newsletter: CaptureResult["newsletter"] = "none";
  if (lead.marketing && deps.newsletter) {
    try {
      const result = await subscribe(prisma, { email: lead.email, audience: AUDIENCE_OF[lead.role], source: "trenazer", consent: true }, deps.newsletter);
      newsletter = result.status === "already" ? "already" : "pending";
    } catch {
      newsletter = "none";
    }
  }
  await recordServerEvent(prisma, { type: "lead_captured", path: "/", props: { kind: lead.context.kind, trigger: lead.context.trigger, segment: company?.segment ?? "unknown", ares: Boolean(company), marketing: lead.marketing } });
  return {
    token: saved.token,
    company: company ? { companyName: company.companyName, segmentLabel: NACE_SEGMENT_LABEL[company.segment], nace: company.nace } : null,
    aresError: ares && !ares.ok ? ares.error : null,
    newsletter,
  };
}

/** Předvyplnění registrace z odkazu kontaktu (jen dosud nevyužitý token). */
export async function leadPrefill(prisma: PrismaClient, token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const lead = await prisma.lead.findUnique({ where: { token }, select: { email: true, ico: true, companyName: true, dic: true, address: true, registeredCompanyId: true } });
  return lead && !lead.registeredCompanyId ? { email: lead.email, ico: lead.ico, companyName: lead.companyName, dic: lead.dic, address: lead.address } : null;
}

/** Registrace z odkazu kontaktu: kontakt se propojí s firmou (token jen jednou) – fáze 111: bez kreditů navíc, firma má 1 testovací projekt. */
export async function applyLeadBonus(prisma: PrismaClient, token: string | null | undefined, companyId: string): Promise<boolean> {
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return false;
  const { count } = await prisma.lead.updateMany({ where: { token, registeredCompanyId: null }, data: { registeredCompanyId: companyId } });
  return count > 0;
}

/** Řádky kontaktů pro velín a export CSV. */
export async function leadRows(prisma: PrismaClient, take = 500): Promise<(LeadRow & { context: LeadContext | null })[]> {
  const rows = await prisma.lead.findMany({ orderBy: { updatedAt: "desc" }, take });
  return rows.map((row) => {
    let context: LeadContext | null = null;
    let nace: string[] = [];
    try {
      context = JSON.parse(row.context) as LeadContext;
    } catch {
      context = null;
    }
    try {
      const parsed: unknown = JSON.parse(row.nace);
      nace = Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === "string") : [];
    } catch {
      nace = [];
    }
    return {
      email: row.email,
      ico: row.ico,
      companyName: row.companyName,
      segmentLabel: row.segment && row.segment in NACE_SEGMENT_LABEL ? NACE_SEGMENT_LABEL[row.segment as keyof typeof NACE_SEGMENT_LABEL] : "–",
      nace,
      role: row.role,
      summary: context?.summary ?? "",
      trigger: context?.trigger ?? "",
      circuits: context?.circuits ?? null,
      boards: context?.boards ?? null,
      source: row.source,
      marketingConsent: row.marketingConsent,
      registered: Boolean(row.registeredCompanyId),
      createdAt: row.createdAt,
      context,
    };
  });
}
