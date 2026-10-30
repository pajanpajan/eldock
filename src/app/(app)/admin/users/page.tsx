import type { Metadata } from "next";

import { CreateSubAccountForm } from "@/components/admin/CreateSubAccountForm";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCOUNT_TYPES, PERMISSION_LABELS, accountLayers } from "@/lib/accounts";
import { MAP_LAYERS } from "@/lib/map-layers";
import { cn } from "@/lib/utils";
import { getAccountUsers } from "@/server/queries/accounts";
import { getCurrentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Správa podúčtů" };

// Správa podúčtů závodu: oprávnění a výřez kategorií zařízení (jen technický ředitel).
export default async function AdminUsersPage() {
  const account = await getCurrentAccount();
  if (!account.can("manageUsers")) return <NoAccess title="Správa podúčtů" current={account.accountType} suggest="PLANT_ADMIN" />;
  const users = await getAccountUsers();

  return (
    <PageTransition>
      <PageHeader title="Správa podúčtů" description="Účty závodu, jejich oprávnění a kategorie zařízení, které vidí (výřez dat na mapě i v přehledech)." />
      <div className="space-y-6">
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Osoba</TableHead>
                <TableHead>Účet</TableHead>
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
                  <TableRow key={user.id} className="align-top">
                    <TableCell className="whitespace-normal">
                      <span className="block font-medium">{user.name}</span>
                      <span className="block text-xs text-muted-foreground">{user.title}</span>
                      <span className="block text-xs text-muted-foreground">{user.email}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", definition.badge)}>{definition.label}</span>
                      {user.scopeLayers ? <span className="mt-1 block text-xs text-amber-300">vlastní výřez</span> : null}
                    </TableCell>
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
        <CreateSubAccountForm />
      </div>
    </PageTransition>
  );
}
