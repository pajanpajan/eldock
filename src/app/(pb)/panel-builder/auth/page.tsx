import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Flame, ShieldCheck, Zap } from "lucide-react";

import { PanelAuthForms } from "@/components/companies/PanelAuthForms";
import { safeNextPath } from "@/lib/auth";
import { LEAD_BONUS_TEXT } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { getPanelCompany } from "@/server/panel-session";
import { leadPrefill } from "@/server/services/leads";

export const metadata: Metadata = { title: "AI Panel Builder – přihlášení a registrace" };

/** Vstup do samostatného produktu ELDOCK AI Panel Builder: přihlášení firmy nebo registrace (Tester). */
export default async function PanelAuthPage({ searchParams }: PageProps<"/panel-builder/auth">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  // Fáze 102: z ukázkové firmy (trenažér) jde dokončit registraci – odkaz z okna kontaktu s 45 kredity
  const token = typeof params.lead === "string" ? params.lead : null;
  const lead = token ? await leadPrefill(prisma, token) : null;
  const current = await getPanelCompany();
  const registering = params.tab === "register" || Boolean(lead);
  if (current && !(current.id === TESTER_COMPANY.id && registering)) redirect(next?.startsWith("/panel-builder") || (next && /^\/q\/EL-\d{6,9}$/.test(next)) ? next : "/panel-builder");

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section className="space-y-4 lg:pt-4">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">ELDOCK AI Panel Builder</p>
        <h1 className="text-3xl font-bold tracking-tight">Výrobní dokumentace, oteplení a CE štítek rozváděče z fotky za 3 minuty</h1>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <Zap className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> AI rozpozná přístroje na DIN lištách a navrhne zapojení.
          </li>
          <li className="flex gap-2">
            <Flame className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> Výpočet oteplení dle IEC TR 60890 a fázová bilance.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> 6 listů dokumentace s vaší firmou v razítku, prohlášení o shodě a výrobní štítek CE.
          </li>
        </ul>
        <p className="rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
          {lead ? `Registrace z odkazu dokumentace: ${LEAD_BONUS_TEXT} (zkušební 2D půdorys + zkušební rozváděč). E-mail a IČO máte předvyplněné, sídlo doplní registr ARES.` : "Registrace firmy je zdarma s 1 testovacím projektem (zkušební 2D půdorys + zkušební rozváděč, výstupy se zkušebním označením). Údaje firmy doplníme z registru ARES podle IČO."}
        </p>
      </section>
      <PanelAuthForms next={next} initialTab={registering ? "register" : "login"} lead={lead && token ? { token, email: lead.email, ico: lead.ico, companyName: lead.companyName, dic: lead.dic } : null} />
    </div>
  );
}
