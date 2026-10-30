import Link from "next/link";
import { CalendarCheck, CalendarRange, FileCheck2, Inbox, PencilRuler, ScanLine, UsersRound, type LucideIcon } from "lucide-react";

import type { Permission } from "@/lib/accounts";
import type { AddonModule } from "@/lib/modules";
import { APP_HOME, auditReportHref, inspectionsHref, plannerHref, rapidInspectionHref } from "@/lib/routes";
import { getModuleState } from "@/server/modules";
import { getAccountUsers } from "@/server/queries/accounts";
import { getPlants } from "@/server/queries/plant";
import { getAuthSession, getCurrentAccount, getRememberedPlantId } from "@/server/session";

import { AccountSwitcher } from "./AccountSwitcher";
import { LogoutButton } from "./LogoutButton";
import { Logo } from "./Logo";
import { PlantSwitcher } from "./PlantSwitcher";

const NAV: { href: string; label: string; srLabel: string; icon: LucideIcon; permission: Permission; module?: AddonModule; hideInFieldView?: boolean }[] = [
  { href: "/cae", label: "Back-Office", srLabel: "CAE Back-Office", icon: Inbox, permission: "caeOffice" },
  { href: inspectionsHref, label: "Revize", srLabel: "Přehled revizí", icon: CalendarCheck, permission: "inspections", hideInFieldView: true },
  { href: plannerHref, label: "Plánovač", srLabel: "Plánovač revizí", icon: CalendarRange, permission: "planner", module: "INSPECTIONS_PRO" },
  { href: rapidInspectionHref, label: "Rychlá revize", srLabel: "Rychlá revize", icon: ScanLine, permission: "rapid", module: "INSPECTIONS_PRO" },
  { href: auditReportHref, label: "Audit", srLabel: "Auditní report", icon: FileCheck2, permission: "audit", module: "INSPECTIONS_PRO" },
  { href: "/studio", label: "Studio", srLabel: "Studio výstavby závodu", icon: PencilRuler, permission: "studio", module: "ENTERPRISE_TOOLS" },
  { href: "/admin/users", label: "Správa", srLabel: "Správa účtů a modulů", icon: UsersRound, permission: "manageUsers" },
];

/** Horní lišta: logo, přepínač závodu (údržba), navigace podle oprávnění účtu a přepínač účtu. */
export async function AppHeader() {
  // Nepřihlášený uživatel (stránka /login) vidí jen logo.
  if (!(await getAuthSession())) {
    return (
      <header className="border-b border-border bg-background/90">
        <div className="mx-auto flex min-h-14 w-full max-w-[1800px] items-center px-3 py-2 sm:px-6">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka">
            <Logo withTagline />
          </Link>
        </div>
      </header>
    );
  }
  const [account, accounts, plants, rememberedPlantId, modules] = await Promise.all([getCurrentAccount(), getAccountUsers(), getPlants(), getRememberedPlantId(), getModuleState()]);
  // Položky add-onů, které tenant nemá aktivní, se v navigaci vůbec nezobrazí.
  const links = NAV.filter(
    (item) => account.can(item.permission) && (!item.module || modules[item.module]) && !(item.hideInFieldView && account.definition.fieldView),
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-6">
        <Link href={APP_HOME} className="touch-target flex items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – rozcestník aplikace">
          <Logo withTagline />
        </Link>

        {account.definition.workflowRole === "MAINTENANCE" ? (
          <PlantSwitcher plants={plants} fallbackId={rememberedPlantId ?? plants[0]?.id} canCreate={account.can("studio") && modules.ENTERPRISE_TOOLS} />
        ) : (
          <span className="hidden text-sm text-muted-foreground md:inline">Všechny závody</span>
        )}

        {links.length ? (
          <nav aria-label="Hlavní navigace" className="flex flex-wrap items-center gap-1">
            {links.map(({ href, label, srLabel, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="touch-target flex items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden xl:inline">{label}</span>
                <span className="sr-only xl:hidden">{srLabel}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          <AccountSwitcher
            accounts={accounts.flatMap(({ id, name, title, accountType }) => (accountType ? [{ id, name, title, accountType }] : []))}
            currentId={account.user.id}
          />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
