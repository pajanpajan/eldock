import Link from "next/link";
import { Building2, CircuitBoard, Coins, LogOut, Stamp } from "lucide-react";

import { LogoMark } from "@/components/layout/Logo";
import { logoutPanelCompanyAction } from "@/server/actions/companies";
import type { PanelCompany } from "@/server/panel-session";

const link = "touch-target flex items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Samostatná horní lišta produktu ELDOCK AI Panel Builder (fáze 41): logo, přihlášená firma s IČO,
 * zbývající testovací kredity, „Firemní údaje do razítka“ a odhlášení. Bez navigace správy závodů.
 */
export function PanelBuilderHeader({ company }: { company: Pick<PanelCompany, "companyName" | "ico" | "creditsRemaining"> | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur" data-testid="panel-builder-header">
      <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-6">
        <Link href={company ? "/panel-builder" : "/"} className="touch-target flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="ELDOCK AI Panel Builder">
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
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm" data-testid="panel-company">
                <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="leading-tight">
                  <span className="block max-w-56 truncate font-semibold">{company.companyName}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">IČO {company.ico}</span>
                </span>
              </div>
              <span
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-sm font-semibold text-primary"
                title="Testovací kredity: 1 kredit = 1 nový rozváděč"
                data-testid="panel-credits"
              >
                <Coins className="size-4" aria-hidden /> Kredity: {company.creditsRemaining}
              </span>
              <Link href="/panel-builder/company" className={`${link} border border-border bg-card/60`}>
                <Stamp className="size-4" aria-hidden /> Firemní údaje a razítko
              </Link>
              <form action={logoutPanelCompanyAction}>
                <button type="submit" className={`${link} border border-border bg-card/60`}>
                  <LogOut className="size-4" aria-hidden /> Odhlásit
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
