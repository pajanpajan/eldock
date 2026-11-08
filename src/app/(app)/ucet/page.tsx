import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordCard, SessionsCard, TwoFactorCard } from "@/components/account/AccountSecurity";
import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { getMyAccount } from "@/server/queries/accounts";

export const metadata: Metadata = { title: "Můj účet" };

// Fáze 67: „Můj účet“ uživatele registrované firmy – heslo, přihlášená zařízení, dvoufázové ověření.
export default async function MyAccountPage() {
  const account = await getMyAccount();
  if (!account) redirect("/login");
  return (
    <PageTransition>
      <PageHeader title="Můj účet" description={`${account.name} · ${account.email}`} />
      {account.companyId ? (
        <div className="space-y-6">
          <ChangePasswordCard email={account.email} name={account.name} forced={account.mustChangePassword} />
          <TwoFactorCard enabledAt={account.totpEnabledAt?.toISOString() ?? null} codesLeft={account.recoveryCodesLeft} />
          <SessionsCard
            sessions={account.sessions.map((session) => ({ id: session.id, device: session.device, createdAt: session.createdAt.toISOString(), lastSeenAt: session.lastSeenAt.toISOString() }))}
            currentId={account.currentSessionId}
          />
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Účty obchodního dema mají společné heslo dema – vlastní heslo, dvoufázové ověření a správa zařízení jsou pro účty registrovaných firem.
        </p>
      )}
    </PageTransition>
  );
}
