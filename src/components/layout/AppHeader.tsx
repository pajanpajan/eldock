import Link from "next/link";
import { CalendarCheck, Map as MapIcon, PencilRuler, Settings, UserRoundCog, Zap, type LucideIcon } from "lucide-react";

import { isAccountSwitcherLocked } from "@/lib/auth";
import { LockedNavItem } from "@/components/modules/Upsell";
import { industryNav, type NavSectionId } from "@/lib/industry-nav";
import { plantHref } from "@/lib/routes";
import { getFeatures } from "@/server/modules";
import { getAccountUsers } from "@/server/queries/accounts";
import { getPlants } from "@/server/queries/plant";
import { getAuthSession, getCurrentAccount, getRememberedPlantId } from "@/server/session";

import { PlantDemoMenu } from "@/components/plant/PlantDemoMenu";
import { PlantGuideButton } from "@/components/plant/PlantGuideButton";

import { AccountSwitcher } from "./AccountSwitcher";
import { LogoutButton } from "./LogoutButton";
import { Logo } from "./Logo";
import { PlantSwitcher } from "./PlantSwitcher";
import { SectionNav, type SectionNavSection } from "./SectionNav";

/** Fáze 115: ikony 5 sekcí horní navigace. */
const SECTION_ICONS: Record<NavSectionId, LucideIcon> = { areal: MapIcon, stroje: Zap, schemata: PencilRuler, revize: CalendarCheck, sprava: Settings };

/** Horní lišta: logo, přepínač závodu (údržba), navigace podle oprávnění účtu a přepínač účtu. */
export async function AppHeader() {
  // Nepřihlášený uživatel (stránka /login) vidí jen logo.
  if (!(await getAuthSession())) {
    return (
      <header className="border-b border-border bg-background/90">
        <div className="mx-auto flex min-h-14 w-full max-w-[1800px] items-center px-3 py-2 sm:px-6">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka" data-testid="logo-home">
            <Logo withTagline />
          </Link>
        </div>
      </header>
    );
  }
  const [account, accounts, plants, rememberedPlantId, features] = await Promise.all([getCurrentAccount(), getAccountUsers(), getPlants(), getRememberedPlantId(), getFeatures()]);
  const canManageModules = account.can("manageModules");
  // Fáze 92: 🧭 Průvodce závodem (založení haly a stroje / mise noční poruchy) v naposledy otevřeném závodě
  const guidePlant = plants.find((plant) => plant.id === rememberedPlantId)?.id ?? plants[0]?.id ?? null;
  // Fáze 115: 5 sekcí místo 11 položek. Vypnuté funkce: v režimu Čisté pracoviště zmizí, v Obchodním demu zůstanou se
  // zámkem; sekce bez dostupné stránky se nezobrazí (terénní pohled směnového údržbáře lištu nemá).
  const sections: SectionNavSection[] = industryNav(guidePlant).flatMap((section) => {
    const Icon = SECTION_ICONS[section.id];
    const items = section.links
      .filter((link) => (link.permission === null || account.can(link.permission)) && (!link.feature || features.show(link.feature)) && !(link.hideInFieldView && account.definition.fieldView) && (!link.company || Boolean(account.user.companyId)))
      .map((link) =>
        link.feature && !features.on(link.feature)
          ? { kind: "locked" as const, key: link.href, node: <LockedNavItem feature={link.feature} canManage={canManageModules} label={link.label} srLabel={link.srLabel} icon={null} showLabel /> }
          : { kind: "link" as const, href: link.href, label: link.label, hint: link.hint },
      );
    return items.length ? [{ id: section.id, label: `${section.emoji} ${section.label}`, srLabel: section.srLabel, icon: <Icon className="size-4" aria-hidden />, match: section.match, items }] : [];
  });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-6">
        {/* Fáze 111: logo ELDOCK vždy na úvodní rozcestník https://eldock.cz/ */}
        <Link href="/" className="touch-target flex items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka" data-testid="logo-home">
          <Logo withTagline />
        </Link>

        {account.definition.workflowRole === "MAINTENANCE" ? (
          <PlantSwitcher plants={plants} fallbackId={rememberedPlantId ?? plants[0]?.id} canCreate={account.can("studio") && features.on("enterprise.studio")} />
        ) : (
          <span className="hidden text-sm text-muted-foreground md:inline">Všechny závody</span>
        )}

        {sections.length ? <SectionNav sections={sections} /> : null}

        <div className="ml-auto flex items-center gap-3">
          {/* Fáze 99: živá ukázka průmyslového závodu na 1 klik (agendy naposledy otevřeného závodu) */}
          {guidePlant ? <PlantDemoMenu plantHref={plantHref(guidePlant)} /> : null}
          {guidePlant ? <PlantGuideButton href={`${plantHref(guidePlant)}?pruvodce=1`} /> : null}
          <AccountSwitcher
            accounts={accounts.flatMap(({ id, name, title, accountType }) => (accountType ? [{ id, name, title, accountType }] : []))}
            currentId={account.user.id}
            locked={isAccountSwitcherLocked()}
          />
          {account.user.companyId ? (
            <Link
              href="/ucet"
              className="touch-target flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Můj účet – heslo, zařízení a dvoufázové ověření"
            >
              <UserRoundCog className="size-4" aria-hidden />
              <span className="hidden lg:inline">Můj účet</span>
            </Link>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
