import Link from "next/link";
import { LogIn } from "lucide-react";

import { ConsentSettingsLink } from "@/components/consent/ConsentManager";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { COMPANY_INFO } from "@/lib/company";
import { footerSections, siteNav, type SiteLink } from "@/lib/site-map";
import { cn } from "@/lib/utils";
import { IP_NOTICE } from "@/lib/legal";

/**
 * Fáze 58: společná hlavička a patička veřejného webu – stejná navigace (Domovní elektroinstalace / Průmysl / Ukázka
 * / Novinky / Kontakt) a mapa webu v patičce na úvodní stránce, obou částech webu i na právních stránkách.
 */
export function SiteHeader({ clientZone, showcase, current }: { clientZone: SiteLink; showcase: boolean; current?: string }) {
  const nav = siteNav({ showcase });
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur" data-testid="site-header">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka" data-testid="logo-home">
          <Logo />
        </Link>
        <nav aria-label="Hlavní navigace" className="hidden items-center gap-0.5 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current === item.href ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                current === item.href ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Button asChild variant="outline" className="touch-target ml-auto h-9 px-3 text-sm">
          <Link href={clientZone.href}>
            <LogIn data-icon="inline-start" aria-hidden />
            <span className="hidden sm:inline">{clientZone.label}</span>
            <span className="sm:hidden">{clientZone.href === "/login" ? "Přihlášení" : "Aplikace"}</span>
          </Link>
        </Button>
        <LandingMobileNav items={nav} clientZone={clientZone} />
      </div>
    </header>
  );
}

export function SiteFooter({ clientZone, showcase }: { clientZone: SiteLink; showcase: boolean }) {
  return (
    <footer className="no-print border-t border-border bg-background/80" data-testid="site-footer">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 text-sm text-muted-foreground sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo withTagline />
          <p className="max-w-sm">{BRAND.description}.</p>
          <dl className="grid h-fit grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt>Provozovatel</dt>
            <dd className="text-foreground">{COMPANY_INFO.name}</dd>
            <dt>Sídlo</dt>
            <dd>{COMPANY_INFO.location}</dd>
            <dt>IČO / DIČ</dt>
            <dd>
              {COMPANY_INFO.ico} / {COMPANY_INFO.dic}
            </dd>
            <dt>E-mail</dt>
            <dd>
              <a href={`mailto:${COMPANY_INFO.email}`} className="hover:text-foreground">
                {COMPANY_INFO.email}
              </a>
            </dd>
          </dl>
        </div>
        {footerSections({ showcase }).map((section) => (
          <nav key={section.title} aria-label={`Mapa webu – ${section.title}`} className="flex flex-col gap-2">
            <span className="font-medium text-foreground">{section.title}</span>
            {section.links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
            {section.title === "Eldock" ? (
              <>
                <Link href={clientZone.href} className="hover:text-foreground">
                  {clientZone.label}
                </Link>
                <ConsentSettingsLink className="w-fit text-left hover:text-foreground" />
              </>
            ) : null}
          </nav>
        ))}
      </div>
      {/* Fáze 104: ochrana databáze prvků a autorských práv (zák. č. 121/2000 Sb.) */}
      <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6" data-testid="ip-notice">
        {IP_NOTICE}
      </p>
    </footer>
  );
}

/** Drobečková navigace části webu. */
export function Breadcrumbs({ items }: { items: SiteLink[] }) {
  return (
    <nav aria-label="Drobečková navigace" className="mx-auto w-full max-w-6xl px-4 pt-6 text-xs text-muted-foreground sm:px-6" data-testid="breadcrumbs">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-1">
            {index ? <span aria-hidden>›</span> : null}
            {index === items.length - 1 ? (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
