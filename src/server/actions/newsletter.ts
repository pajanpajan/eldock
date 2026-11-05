"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { brandEnv } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { smtpTransportFromEnv } from "@/server/mailer";
import { confirmSubscription, sendIssue, sendTestIssue, subscribe, unsubscribe } from "@/server/services/newsletter";
import { isSuperadmin } from "@/server/superadmin-session";

import type { ActionResult } from "./workflow";

// Fáze 56: newsletter – přihlášení (veřejné), potvrzení a odhlášení odkazem z e-mailu, rozesílání z velínu.

const baseUrl = () => (brandEnv("PUBLIC_URL") ?? SITE_URL).replace(/\/+$/, "");
const deps = () => ({ send: smtpTransportFromEnv(), baseUrl: baseUrl() });

/** Jednoduchý limit pokusů na IP (paměť procesu): 5 přihlášení za 10 minut. */
const attempts = new Map<string, number[]>();
async function allowAttempt() {
  const list = await headers();
  const ip = (list.get("x-forwarded-for")?.split(",")[0] ?? list.get("x-real-ip") ?? "local").trim();
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((time) => now - time < 10 * 60 * 1000);
  if (recent.length >= 5) return false;
  attempts.set(ip, [...recent, now]);
  if (attempts.size > 5000) attempts.clear();
  return true;
}

const subscribeSchema = z.object({
  email: z.string().trim().min(3).max(254),
  audience: z.string().max(40).nullable().optional(),
  consent: z.boolean(),
  source: z.string().max(40).optional(),
  /** Past na roboty – skryté pole musí zůstat prázdné. */
  website: z.string().max(200).optional(),
});

const SUBSCRIBED = "Hotovo. Poslali jsme vám e-mail s odkazem pro potvrzení odběru – bez potvrzení vám nic dalšího nepošleme.";

export async function subscribeNewsletterAction(input: z.input<typeof subscribeSchema>): Promise<ActionResult<{ message: string }>> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zadejte platnou e-mailovou adresu." };
  if (parsed.data.website) return { ok: true, data: { message: SUBSCRIBED } };
  if (!parsed.data.consent) return { ok: false, error: "Pro odběr je potřeba zaškrtnout souhlas se zasíláním novinek." };
  if (!(await allowAttempt())) return { ok: false, error: "Příliš mnoho pokusů. Zkuste to prosím za pár minut." };
  try {
    const result = await subscribe(prisma, { email: parsed.data.email, audience: parsed.data.audience ?? null, consent: true, source: parsed.data.source ?? "web" }, deps());
    return { ok: true, data: { message: result.status === "already" ? "Tuto adresu už máme potvrzenou – novinky vám chodí. Děkujeme!" : SUBSCRIBED } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error("[newsletter] přihlášení selhalo:", error);
    return { ok: false, error: "Přihlášení se nepodařilo. Zkuste to prosím později." };
  }
}

export async function confirmNewsletterAction(token: string): Promise<ActionResult<{ email: string }>> {
  const result = await confirmSubscription(prisma, token);
  if (result.ok) return { ok: true, data: { email: result.email } };
  return { ok: false, error: result.reason === "expired" ? "Odkaz už vypršel (platí 7 dní). Přihlaste se prosím znovu na eldock.cz." : "Odkaz je neplatný nebo už byl použit." };
}

export async function unsubscribeNewsletterAction(token: string): Promise<ActionResult<{ email: string }>> {
  const result = await unsubscribe(prisma, token);
  return result.ok ? { ok: true, data: { email: result.email } } : { ok: false, error: "Odkaz pro odhlášení je neplatný." };
}

const issueSchema = z.object({ subject: z.string().max(150), body: z.string().max(20_000), audience: z.string().max(40).nullable().optional() });

/** Velín: zkušební vydání na jednu adresu. */
export async function sendNewsletterTestAction(input: z.input<typeof issueSchema> & { to: string }): Promise<ActionResult> {
  if (!(await isSuperadmin())) return { ok: false, error: "Jen pro velín." };
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte předmět a text vydání." };
  try {
    await sendTestIssue({ to: String(input.to ?? ""), ...parsed.data }, deps());
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: error instanceof WorkflowError ? error.message : "Zkušební e-mail se nepodařilo odeslat." };
  }
}

/** Velín: rozeslání vydání všem potvrzeným odběratelům (nebo jedné cílové skupině). */
export async function sendNewsletterAction(input: z.input<typeof issueSchema>): Promise<ActionResult<{ sent: number; failed: number }>> {
  if (!(await isSuperadmin())) return { ok: false, error: "Jen pro velín." };
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte předmět a text vydání." };
  try {
    const result = await sendIssue(prisma, parsed.data, deps());
    revalidatePath("/superadmin");
    return { ok: true, data: { sent: result.sent, failed: result.failed } };
  } catch (error) {
    return { ok: false, error: error instanceof WorkflowError ? error.message : "Rozeslání se nepodařilo." };
  }
}
