import type { Metadata } from "next";
import Link from "next/link";

import { SectionTitle, anchorButton } from "@/components/landing/LandingSections";
import { Breadcrumbs, SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { ThermalPreview } from "@/components/landing/ThermalPreview";
import { Button } from "@/components/ui/button";
import { APP_HOME } from "@/lib/routes";
import { OG_IMAGE, SITE_URL, faqJsonLd, jsonLdScript } from "@/lib/seo";
import { SEO_LANDINGS, seoLanding, type SeoLandingId } from "@/lib/seo-landings";
import { breadcrumbJsonLd } from "@/lib/site-map";
import { hasShowcaseProject } from "@/server/queries/panel-builder";
import { getAuthSession } from "@/server/session";

/** Fáze 96: metadata SEO vstupní stránky – titulek, popis, klíčová slova, kanonická URL a OpenGraph (cs_CZ). */
export function seoLandingMetadata(id: SeoLandingId): Metadata {
  const landing = seoLanding(id);
  const url = `${SITE_URL}${landing.path}`;
  return {
    title: { absolute: landing.seoTitle },
    description: landing.seoDescription,
    keywords: landing.keywords,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "cs_CZ", siteName: "ELDOCK", url, title: landing.seoTitle, description: landing.seoDescription, images: [OG_IMAGE] },
  };
}

/**
 * Fáze 96: veřejná SEO vstupní stránka (Server Component, 200 bez přihlášení) – H1, úvod s tlačítky, sekce H2 / H3,
 * srovnávací tabulka, u oteplení interaktivní náhled výpočtu, časté dotazy (FAQPage) a odkazy na související stránky.
 */
export async function SeoLandingPage({ id }: { id: SeoLandingId }) {
  const landing = seoLanding(id);
  const [session, showcase] = await Promise.all([getAuthSession(), hasShowcaseProject()]);
  const clientZone = session ? { href: APP_HOME, label: "Vstoupit do aplikace" } : { href: "/login", label: "Klientská zóna / Přihlášení" };
  const crumbs = [
    { href: "/", label: "Úvod" },
    { href: landing.path, label: landing.label },
  ];
  const related = landing.related.map((relatedId) => SEO_LANDINGS.find((entry) => entry.id === relatedId)!);
  return (
    <div className="landing bg-blueprint flex flex-1 flex-col" data-testid={`seo-landing-${id}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript([breadcrumbJsonLd(crumbs), faqJsonLd(landing.faq, `${SITE_URL}${landing.path}`)]) }} />
      <SiteHeader clientZone={clientZone} showcase={showcase} current={landing.path} />
      <Breadcrumbs items={crumbs} />
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 pb-12 sm:px-6" data-testid="seo-hero">
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">{landing.h1}</h1>
          <p className="max-w-3xl text-lg text-pretty text-muted-foreground">{landing.lead}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className={anchorButton} data-testid="seo-cta">
              <Link href={landing.cta.href}>{landing.cta.label}</Link>
            </Button>
            <Button asChild variant="outline" className={anchorButton}>
              <Link href={landing.secondary.href}>{landing.secondary.label}</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Témata stránky">
            {landing.keywords.map((keyword) => (
              <li key={keyword} className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                {keyword}
              </li>
            ))}
          </ul>
        </section>

        {landing.sections.map((section, index) => (
          <section key={section.title} className={index % 2 ? "border-y border-border/60 bg-card/30" : undefined}>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6">
              <SectionTitle eyebrow={landing.label} title={section.title} text={section.intro} />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => (
                  <article key={item.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ))}

        {id === "vypocet-otepleni-rozvadece" ? (
          <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <ThermalPreview />
          </section>
        ) : null}

        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-balance">{landing.table.title}</h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full border-collapse text-sm" data-testid="seo-table">
              <thead>
                <tr className="border-b border-border bg-card/60 text-left">
                  {landing.table.head.map((cell) => (
                    <th key={cell} scope="col" className="p-3 font-semibold">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {landing.table.rows.map((row) => (
                  <tr key={row.join("|")} className="border-b border-border/60 last:border-0">
                    {row.map((cell, index) => (index === 0 ? <th key={index} scope="row" className="p-3 text-left font-medium">{cell}</th> : <td key={index} className="p-3 text-muted-foreground">{cell}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-t border-border/60 bg-card/30" aria-labelledby="faq">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-14 sm:px-6">
            <h2 id="faq" className="text-3xl font-bold tracking-tight">
              Časté dotazy elektrikářů a revizních techniků
            </h2>
            {landing.faq.map((item) => (
              <details key={item.question} className="group rounded-xl border border-border bg-card p-4" data-testid="seo-faq">
                <summary className="cursor-pointer list-none">
                  <h3 className="inline text-base font-semibold">{item.question}</h3>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-14 sm:px-6" aria-label="Související stránky">
          <h2 className="text-2xl font-bold tracking-tight">Mohlo by vás zajímat</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {related.map((entry) => (
              <Link key={entry.id} href={entry.path} className="rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/60">
                <span className="font-semibold">{entry.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{entry.seoDescription.slice(0, 140)}…</span>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild className={anchorButton}>
              <Link href={landing.cta.href}>{landing.cta.label}</Link>
            </Button>
            <Button asChild variant="outline" className={anchorButton}>
              <Link href="/panel-builder/catalog">Katalog přístrojů ABB, Eaton, OEZ, Schneider, Legrand, Hager</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter clientZone={clientZone} showcase={showcase} />
    </div>
  );
}
