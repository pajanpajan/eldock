import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewsletterTokenPage } from "@/components/landing/NewsletterTokenPage";
import { unsubscribeNewsletterAction } from "@/server/actions/newsletter";

export const metadata: Metadata = { title: "Odhlášení odběru novinek", robots: { index: false, follow: false } };

const MESSAGES = {
  ok: { ok: true, message: "Odhlášeno. Žádné další novinky vám neposíláme." },
  neplatny: { ok: false, message: "Odkaz pro odhlášení je neplatný." },
} as const;

/** Fáze 56: odhlášení newsletteru tlačítkem z odkazu v e-mailu (souhlas se tím odvolává). */
export default async function UnsubscribeNewsletterPage({ searchParams }: PageProps<"/newsletter/odhlaseni">) {
  const params = await searchParams;
  const token = typeof params.t === "string" ? params.t : "";
  const state = typeof params.stav === "string" ? params.stav : null;
  // Do adresy jde jen kód stavu – text zprávy se nedá podvrhnout odkazem
  const result = state && state in MESSAGES ? MESSAGES[state as keyof typeof MESSAGES] : null;

  async function leave() {
    "use server";
    const outcome = await unsubscribeNewsletterAction(token);
    redirect(`/newsletter/odhlaseni?stav=${outcome.ok ? "ok" : "neplatny"}`);
  }

  return <NewsletterTokenPage kind="unsubscribe" title="Odhlášení odběru novinek" text="Kliknutím odhlásíte odběr novinek Eldock a odvoláte souhlas se zasíláním." button="Odhlásit odběr" action={token ? leave : null} result={result} />;
}
