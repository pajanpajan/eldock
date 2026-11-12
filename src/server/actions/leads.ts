"use server";

import { brandEnv } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { SITE_URL } from "@/lib/seo";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { smtpTransportFromEnv } from "@/server/mailer";
import { getPanelCompany } from "@/server/panel-session";
import { captureLead, type CaptureResult } from "@/server/services/leads";

import type { ActionResult } from "./workflow";

const baseUrl = () => (brandEnv("PUBLIC_URL") ?? SITE_URL).replace(/\/+$/, "");
const attempts = new Map<string, number[]>();

/**
 * Fáze 102: „📩 Kam vám máme poslat hotový kusovník a PDF dokumentaci?“ – kontakt z ukázkové firmy (trenažér, demo
 * scénáře). Jen pro ukázkovou firmu; nejvýš 5 odeslání za 10 minut na jednu relaci prohlížeče (ochrana před zneužitím).
 */
export async function captureLeadAction(input: unknown): Promise<ActionResult<CaptureResult>> {
  try {
    const company = await getPanelCompany();
    if (!company || company.id !== TESTER_COMPANY.id) return { ok: false, error: "Zachycení kontaktu je jen pro ukázkovou firmu." };
    const key = typeof input === "object" && input && "email" in input ? String((input as { email: unknown }).email).toLowerCase() : "?";
    const now = Date.now();
    const recent = (attempts.get(key) ?? []).filter((at) => now - at < 10 * 60_000);
    if (recent.length >= 5) return { ok: false, error: "Příliš mnoho pokusů – zkuste to za chvíli." };
    attempts.set(key, [...recent, now]);
    const result = await captureLead(prisma, input, { newsletter: { send: smtpTransportFromEnv(), baseUrl: baseUrl() } });
    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    return { ok: false, error: "Kontakt se nepodařilo uložit – zkuste to prosím znovu." };
  }
}
