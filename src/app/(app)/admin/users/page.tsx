import type { Metadata } from "next";

import { AccountSecurityActions } from "@/components/admin/AccountSecurityActions";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { CreateSubAccountForm } from "@/components/admin/CreateSubAccountForm";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCOUNT_TYPES, PERMISSION_LABELS, accountLayers } from "@/lib/accounts";
import { formatDateTime } from "@/lib/format";
import { MAP_LAYERS } from "@/lib/map-layers";
import { SECURITY_EVENT_LABELS } from "@/lib/security-events";
import { cn } from "@/lib/utils";
import { getAccountUsers, getCompanySecurityLog } from "@/server/queries/accounts";
import { getCurrentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Správa podúčtů" };

// Správa podúčtů závodu: oprávnění a výřez kategorií zařízení (jen technický ředitel). Fáze 67: u registrované firmy
// stav přihlášení, pozvánky a odkazy na heslo, blokace, odhlášení ze zařízení a bezpečnostní deník.
export default async function AdminUsersPage() {
  const account = await getCurrentAccount();
  if (!account.can("manageUsers")) return <NoAccess title="Správa podúčtů" current={account.accountType} suggest="PLANT_ADMIN" />;
  const company = Boolean(account.user.companyId);
  const [users, log] = await Promise.all([getAccountUsers(), company ? getCompanySecurityLog() : Promise.resolve([])]);

  return (
    <PageTransition>
      <PageHeader title="Správa podúčtů" description="Účty závodu, jejich oprávnění a kategorie zařízení, které vidí (výřez dat na mapě i v přehledech)." />
      <AdminTabs current="/admin/users" canUsers canModules={account.can("manageModules")} canData={company} />
      <div className="space-y-6">
        {!company ? (
          <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            Obchodní demo: účty se přihlašují společným heslem dema. Vlastní hesla, pozvánky, blokace a bezpečnostní deník mají účty registrovaných firem.
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Osoba</TableHead>
                <TableHead>Účet</TableHead>
                {company ? <TableHead>Přihlášení</TableHead> : null}
                <TableHead>Kategorie zařízení</TableHead>
                <TableHead>Oprávnění</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                if (!user.accountType) return null;
                const definition = ACCOUNT_TYPES[user.accountType];
                const layers = accountLayers({ accountType: user.accountType, scopeLayers: user.scopeLayers });
                return (
                  <TableRow key={user.id} className="align-top" data-testid={`account-row-${user.email}`}>
                    <TableCell className="whitespace-normal">
                      <span className="block font-medium">{user.name}</span>
                      <span className="block text-xs text-muted-foreground">{user.title}</span>
                      <span className="block text-xs text-muted-foreground">{user.email}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", definition.badge)}>{definition.label}</span>
                      {user.scopeLayers ? <span className="mt-1 block text-xs text-amber-300">vlastní výřez</span> : null}
                    </TableCell>
                    {company ? (
                      <TableCell className="space-y-1.5 whitespace-normal" data-testid="account-status">
                        <span
                          className={cn(
                            "inline-block rounded-full border px-2 py-0.5 text-xs font-medium",
                            user.disabledAt ? "border-red-500/60 text-red-300" : !user.hasPassword ? "border-amber-500/60 text-amber-200" : "border-emerald-500/60 text-emerald-300",
                          )}
                        >
                          {user.disabledAt ? "Zablokovaný" : !user.hasPassword ? "Čeká na nastavení hesla" : user.mustChangePassword ? "Aktivní – změní heslo" : "Aktivní"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {user.lastLoginAt ? `Naposledy ${formatDateTime(user.lastLoginAt)}` : "Zatím nepřihlášen"} · {user.totpEnabledAt ? "2FA zapnuté" : "bez 2FA"} · zařízení {user.activeSessions}
                        </span>
                        <AccountSecurityActions userId={user.id} name={user.name} hasPassword={user.hasPassword} disabled={Boolean(user.disabledAt)} activeSessions={user.activeSessions} self={user.id === account.user.id} removable />
                      </TableCell>
                    ) : null}
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {MAP_LAYERS.filter((layer) => layers.includes(layer.key)).map((layer) => (
                          <span key={layer.key} className="rounded-md border border-border px-1.5 py-0.5 text-xs">
                            {layer.label}
                          </span>
                        ))}
                      </div>
                      {!definition.showInspections ? <span className="mt-1 block text-xs text-muted-foreground">bez lhůtníku revizí</span> : null}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {definition.permissions.map((permission) => (
                          <span key={permission} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                            {PERMISSION_LABELS[permission]}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <CreateSubAccountForm company={company} />
        {company ? (
          <section aria-labelledby="security-log" className="space-y-3">
            <h2 id="security-log" className="text-lg font-semibold">
              Bezpečnostní deník
            </h2>
            <p className="text-sm text-muted-foreground">Přihlášení, neúspěšné pokusy, změny hesel, pozvánky a blokace účtů firmy (posledních 60 událostí). IP adresy se neukládají.</p>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kdy</TableHead>
                    <TableHead>Událost</TableHead>
                    <TableHead>Účet</TableHead>
                    <TableHead>Provedl</TableHead>
                    <TableHead>Poznámka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.length ? (
                    log.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-xs">{formatDateTime(event.createdAt)}</TableCell>
                        <TableCell className={cn("text-sm", SECURITY_EVENT_LABELS[event.kind].tone === "bad" ? "text-red-300" : SECURITY_EVENT_LABELS[event.kind].tone === "warn" ? "text-amber-200" : "")}>
                          {SECURITY_EVENT_LABELS[event.kind].label}
                        </TableCell>
                        <TableCell className="text-sm">{event.userName ?? event.email ?? "–"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{event.actorName ?? "–"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{event.detail ?? ""}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        Zatím žádné události.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}
      </div>
    </PageTransition>
  );
}
