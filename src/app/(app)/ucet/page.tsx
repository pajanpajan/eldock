import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordCard, SessionsCard, TwoFactorCard } from "@/components/account/AccountSecurity";
import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { formatDate } from "@/lib/format";
import { getMyAccount } from "@/server/queries/accounts";
import { getPendingClosure } from "@/server/queries/data-requests";

export const metadata: Metadata = { title: "Můj účet" };

// Fáze 67: „Můj účet“ uživatele registrované firmy – heslo, přihlášená zařízení, dvoufázové ověření.
export default async function MyAccountPage() {
  const account = await getMyAccount();
  if (!account) redirect("/login");
  const closure = await getPendingClosure(account.companyId ?? null);
  return (
    <PageTransition>
      <PageHeader title="Můj účet" description={`${account.name} · ${account.email}`} />
      {account.companyId ? (
        <div className="space-y-6">
          {closure ? (
            <p className="rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-100" role="alert" data-testid="account-closure-pending">
              Správce firmy požádal o zrušení účtu firmy – data se smažou {formatDate(closure.scheduledAt ?? closure.requestedAt)}.
            </p>
          ) : null}
          <ChangePasswordCard email={account.email} name={account.name} forced={account.mustChangePassword} />
          <TwoFactorCard enabledAt={account.totpEnabledAt?.toISOString() ?? null} codesLeft={account.recoveryCodesLeft} />
          <SessionsCard
            sessions={account.sessions.map((session) => ({ id: session.id, device: session.device, createdAt: session.createdAt.toISOString(), lastSeenAt: session.lastSeenAt.toISOString() }))}
            currentId={account.currentSessionId}
          />
          <section aria-labelledby="my-data" className="space-y-2 rounded-xl border border-border bg-card p-4">
            <h2 id="my-data" className="text-lg font-semibold">
              Moje údaje
            </h2>
            <p className="text-sm text-muted-foreground">
              Profil, přihlášená zařízení, události bezpečnostního deníku a přehled záznamů, které jste ve firmě vytvořili (JSON). Úplná dokumentace firmy je u správce firmy.
            </p>
            <a href="/api/data-export?scope=me" download className="inline-flex text-sm font-medium text-primary hover:underline" data-testid="personal-export">
              Stáhnout moje údaje (JSON)
            </a>
          </section>
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Účty obchodního dema mají společné heslo dema – vlastní heslo, dvoufázové ověření a správa zařízení jsou pro účty registrovaných firem.
        </p>
      )}
    </PageTransition>
  );
}
