import Link from "next/link";
import { CalendarCheck, CalendarRange, FileCheck2, ScanLine } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { auditReportHref, inspectionsHref, plannerHref, rapidInspectionHref } from "@/lib/routes";
import { getPlants } from "@/server/queries/plant";
import { getCurrentRole, getCurrentUser, getRememberedPlantId } from "@/server/session";

import { Logo } from "./Logo";
import { PlantSwitcher } from "./PlantSwitcher";
import { RoleSwitcher } from "./RoleSwitcher";

/** Horní lišta: logo, přepínač závodu (jen v pohledu Údržba), přepínač pohledu a aktuální uživatel. */
export async function AppHeader() {
  const [role, user, plants, rememberedPlantId] = await Promise.all([
    getCurrentRole(),
    getCurrentUser(),
    getPlants(),
    getRememberedPlantId(),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-6">
        <Link href="/" className="touch-target flex items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Digitry – úvodní stránka">
          <Logo />
        </Link>

        {role === "MAINTENANCE" ? (
          <PlantSwitcher plants={plants} fallbackId={rememberedPlantId ?? plants[0]?.id} />
        ) : (
          <span className="hidden text-sm text-muted-foreground md:inline">Všechny závody</span>
        )}

        <nav aria-label="Revize" className="flex items-center gap-1">
          <Link
            href={inspectionsHref}
            className="touch-target flex items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CalendarCheck className="size-4" aria-hidden />
            <span className="hidden lg:inline">Revize</span>
            <span className="sr-only lg:hidden">Přehled revizí</span>
          </Link>
          <Link
            href={plannerHref}
            className="touch-target flex items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CalendarRange className="size-4" aria-hidden />
            <span className="hidden lg:inline">Plánovač</span>
            <span className="sr-only lg:hidden">Plánovač revizí</span>
          </Link>
          <Link
            href={rapidInspectionHref}
            className="touch-target flex items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ScanLine className="size-4" aria-hidden />
            <span className="hidden lg:inline">Rychlá revize</span>
            <span className="sr-only lg:hidden">Rychlá revize</span>
          </Link>
          <Link
            href={auditReportHref}
            className="touch-target flex items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <FileCheck2 className="size-4" aria-hidden />
            <span className="hidden xl:inline">Audit</span>
            <span className="sr-only xl:hidden">Auditní report</span>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <RoleSwitcher role={role} />
          <div className="hidden items-center gap-2 md:flex">
            <Avatar className="size-9">
              <AvatarFallback className="bg-secondary text-xs font-semibold">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.company}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
