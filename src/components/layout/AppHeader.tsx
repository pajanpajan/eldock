import Link from "next/link";
import { Blocks, CalendarCheck, CalendarRange, CircuitBoard, FileCheck2, Inbox, PencilRuler, ScanLine, UsersRound, type LucideIcon } from "lucide-react";

import type { Permission } from "@/lib/accounts";
import { LockedNavItem } from "@/components/modules/Upsell";
import type { FeatureKey } from "@/lib/modules";
import { APP_HOME, auditReportHref, inspectionsHref, plannerHref, rapidInspectionHref } from "@/lib/routes";
import { getFeatures } from "@/server/modules";
import { getAccountUsers } from "@/server/queries/accounts";
import { getPlants } from "@/server/queries/plant";
import { getAuthSession, getCurrentAccount, getRememberedPlantId } from "@/server/session";

import { AccountSwitcher } from "./AccountSwitcher";
import { LogoutButton } from "./LogoutButton";
import { Logo } from "./Logo";
import { PlantSwitcher } from "./PlantSwitcher";

const NAV: { href: string; label: string; srLabel: string; icon: LucideIcon; permission: Permission; feature?: FeatureKey; hideInFieldView?: boolean }[] = [
  { href: "/cae", label: "Back-Office", srLabel: "CAE Back-Office", icon: Inbox, permission: "caeOffice", feature: "cae.ticketing" },
  { href: inspectionsHref, label: "Revize", srLabel: "Přehled revizí", icon: CalendarCheck, permission: "inspections", hideInFieldView: true },
  { href: plannerHref, label: "Plánovač", srLabel: "Plánovač revizí", icon: CalendarRange, permission: "planner", feature: "inspections.planner" },
  { href: rapidInspectionHref, label: "Rychlá revize", srLabel: "Rychlá revize", icon: ScanLine, permission: "rapid", feature: "inspections.planner" },
  { href: auditReportHref, label: "Audit", srLabel: "Auditní report", icon: FileCheck2, permission: "audit", feature: "inspections.audit" },
  { href: "/studio", label: "Studio", srLabel: "Studio výstavby závodu", icon: PencilRuler, permission: "studio", feature: "enterprise.studio" },
  { href: "/panel-builder", label: "Panel Builder", srLabel: "AI Panel Builder", icon: CircuitBoard, permission: "panelBuilder", feature: "enterprise.ai_panel_builder" },
  { href: "/admin/modules", label: "Moduly", srLabel: "Správa modulů a tarifů", icon: Blocks, permission: "manageModules" },
  { href: "/admin/users", label: "Účty", srLabel: "Správa podúčtů", icon: UsersRound, permission: "manageUsers" },
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
  const [account, accounts, plants, rememberedPlantId, features] = await Promise.all([getCurrentAccount(), getAccountUsers(), getPlants(), getRememberedPlantId(), getFeatures()]);
  // Vypnuté funkce: v režimu Čisté pracoviště zmizí, v Obchodním demu zůstanou se zámkem.
  const links = NAV.filter(
    (item) => account.can(item.permission) && (!item.feature || features.show(item.feature)) && !(item.hideInFieldView && account.definition.fieldView),
  );
  const canManageModules = account.can("manageModules");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-6">
        <Link href={APP_HOME} className="touch-target flex items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – rozcestník aplikace">
          <Logo withTagline />
        </Link>

        {account.definition.workflowRole === "MAINTENANCE" ? (
          <PlantSwitcher plants={plants} fallbackId={rememberedPlantId ?? plants[0]?.id} canCreate={account.can("studio") && features.on("enterprise.studio")} />
        ) : (
          <span className="hidden text-sm text-muted-foreground md:inline">Všechny závody</span>
        )}

        {links.length ? (
          <nav aria-label="Hlavní navigace" className="flex flex-wrap items-center gap-1">
            {links.map(({ href, label, srLabel, icon: Icon, feature }) =>
              feature && !features.on(feature) ? (
                <LockedNavItem key={href} feature={feature} canManage={canManageModules} label={label} srLabel={srLabel} icon={<Icon className="size-4" aria-hidden />} />
              ) : (
              <Link
                key={href}
                href={href}
                className="touch-target flex items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden xl:inline">{label}</span>
                <span className="sr-only xl:hidden">{srLabel}</span>
              </Link>
              ),
            )}
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
