import Link from "next/link";
import { Building2, CircuitBoard, Coins, LogOut, Stamp } from "lucide-react";

import { LogoMark } from "@/components/layout/Logo";
import { logoutPanelCompanyAction } from "@/server/actions/companies";
import type { PanelCompany } from "@/server/panel-session";
import { trialRemainingText } from "@/lib/credits/entitlements";

import { DemoScenariosMenu } from "./DemoScenariosMenu";

const link = "touch-target flex items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Samostatná horní lišta produktu ELDOCK AI Panel Builder (fáze 41): logo, přihlášená firma s IČO,
 * zbývající testovací kredity, „Firemní údaje do razítka“ a odhlášení. Bez navigace správy závodů.
 */
export function PanelBuilderHeader({ company, demo = false }: { company: (Pick<PanelCompany, "companyName" | "ico" | "creditsRemaining"> & Partial<Pick<PanelCompany, "trialFloorplanUsed" | "trialSwitchboardUsed">>) | null; demo?: boolean }) {
  // Fáze 111: zbývající testovací projekt (zkušební půdorys / rozváděč) vedle kreditů; ukázková firma má vše zkušební zdarma
  const trial = demo ? "🎁 Ukázková firma: všechny projekty zkušební zdarma" : company && (company.trialFloorplanUsed === false || company.trialSwitchboardUsed === false) ? trialRemainingText({ trialFloorplanUsed: company.trialFloorplanUsed ?? true, trialSwitchboardUsed: company.trialSwitchboardUsed ?? true }) : null;
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur" data-testid="panel-builder-header">
      <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-6">
        {/* Fáze 111: logo ELDOCK vždy na úvodní rozcestník https://eldock.cz/ (přehled projektů = „Rozváděče“) */}
        <Link href="/" className="touch-target flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="ELDOCK – úvodní stránka" data-testid="logo-home">
          <LogoMark className="size-8" />
          <span className="leading-tight">
            <span className="block text-base font-black tracking-tight">ELDOCK</span>
            <span className="block text-xs font-semibold text-primary">AI Panel Builder</span>
          </span>
        </Link>
        {company ? (
          <>
            <nav className="flex items-center gap-1" aria-label="Navigace Panel Builderu">
              <Link href="/panel-builder" className={link}>
                <CircuitBoard className="size-4" aria-hidden /> Rozváděče
              </Link>
              <Link href="/panel-builder/catalog" className={link}>
                Katalog prvků
              </Link>
              <Link href="/panel-builder/floorplan" className={link}>
                📐 2D Půdorys & Kabeláž
              </Link>
            </nav>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* Fáze 99: živá ukázka na 1 klik pro prezentaci */}
              <DemoScenariosMenu />
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm" data-testid="panel-company">
                <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="leading-tight">
                  <span className="block max-w-40 truncate font-semibold 2xl:max-w-56">{company.companyName}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">IČO {company.ico}</span>
                </span>
              </div>
              <Link
                href="/panel-builder/credits"
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-sm font-semibold text-primary outline-none hover:bg-primary/20 focus-visible:ring-3 focus-visible:ring-ring/50"
                title="Rozváděč 15 kreditů, 2D půdorys 15 kreditů, celá zakázka 25 kreditů – dobít kredity nebo zvolit tarif"
                data-testid="panel-credits"
              >
                <Coins className="size-4" aria-hidden /> 🪙 Kredity: {company.creditsRemaining}
                <span className="sr-only 2xl:not-sr-only"> (+ Dobít kredity / Tarify)</span>
              </Link>
              {trial ? (
                <span className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200" title={trial} data-testid="panel-trial">
                  {/* Pod 1536 px jen 🎁 (celý text v bublině a pro čtečky) – lišta zůstane v jednom řádku */}
                  <span aria-hidden className="2xl:hidden">
                    🎁
                  </span>
                  <span className="sr-only 2xl:not-sr-only">{trial}</span>
                </span>
              ) : null}
              <Link href="/panel-builder/company" className={`${link} border border-border bg-card/60`}>
                {/* Fáze 99: pod 1536 px jen ikona (lišta v jednom řádku i na projektoru 1366 × 768) */}
                <Stamp className="size-4" aria-hidden /> <span className="sr-only 2xl:not-sr-only">Firemní údaje a razítko</span>
              </Link>
              <form action={logoutPanelCompanyAction}>
                <button type="submit" className={`${link} border border-border bg-card/60`}>
                  <LogOut className="size-4" aria-hidden /> <span className="sr-only 2xl:not-sr-only">Odhlásit</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <Link href="/" className={`${link} ml-auto`}>
            Úvodní stránka ELDOCK
          </Link>
        )}
      </div>
    </header>
  );
}
