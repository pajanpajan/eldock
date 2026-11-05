import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewsletterTokenPage } from "@/components/landing/NewsletterTokenPage";
import { confirmNewsletterAction } from "@/server/actions/newsletter";

export const metadata: Metadata = { title: "Potvrzení odběru novinek", robots: { index: false, follow: false } };

const MESSAGES = {
  ok: { ok: true, message: "Děkujeme, odběr je potvrzený. Novinky budou chodit zhruba jednou měsíčně a v každém e-mailu najdete odkaz pro odhlášení." },
  vyprsel: { ok: false, message: "Odkaz už vypršel (platí 7 dní). Přihlaste se prosím znovu na eldock.cz." },
  neplatny: { ok: false, message: "Odkaz je neplatný nebo už byl použit." },
} as const;

/** Fáze 56: potvrzení odběru (double opt-in) tlačítkem z odkazu v e-mailu. */
export default async function ConfirmNewsletterPage({ searchParams }: PageProps<"/newsletter/potvrzeni">) {
  const params = await searchParams;
  const token = typeof params.t === "string" ? params.t : "";
  const state = typeof params.stav === "string" ? params.stav : null;
  // Do adresy jde jen kód stavu – text zprávy se nedá podvrhnout odkazem
  const result = state && state in MESSAGES ? MESSAGES[state as keyof typeof MESSAGES] : null;

  async function confirm() {
    "use server";
    const outcome = await confirmNewsletterAction(token);
    redirect(`/newsletter/potvrzeni?stav=${outcome.ok ? "ok" : outcome.error.includes("vypršel") ? "vyprsel" : "neplatny"}`);
  }

  return <NewsletterTokenPage kind="confirm" title="Potvrzení odběru novinek" text="Kliknutím potvrdíte, že chcete dostávat novinky Eldock na svůj e-mail." button="Potvrdit odběr" action={token ? confirm : null} result={result} />;
}
