import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { PricingOverview } from "@/components/credits/PricingOverview";
import { ContactSection, anchorButton } from "@/components/landing/LandingSections";
import { SampleElaborateDialog } from "@/components/landing/SampleElaborateDialog";
import { SectionModulePreview } from "@/components/landing/SectionPreviews";
import { Breadcrumbs, SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { LazyPromoVideo } from "@/components/lazy";
import { Button } from "@/components/ui/button";
import { APP_HOME } from "@/lib/routes";
import { OG_IMAGE, SITE_URL, jsonLdScript } from "@/lib/seo";
import { GATEWAY, GATEWAY_SIDES, type GatewaySide } from "@/lib/site-sections";
import { breadcrumbJsonLd } from "@/lib/site-map";
import { hasShowcaseProject } from "@/server/queries/panel-builder";
import { bankLine, operatorSummary } from "@/lib/operator";
import { getOperatorProfile } from "@/server/operator";
import { getAuthSession } from "@/server/session";

const isSide = (value: string): value is GatewaySide => (GATEWAY_SIDES as readonly string[]).includes(value);

export function generateStaticParams() {
  return GATEWAY_SIDES.map((side) => ({ side }));
}

export async function generateMetadata({ params }: PageProps<"/sekce/[side]">): Promise<Metadata> {
  const { side } = await params;
  if (!isSide(side)) return {};
  const section = GATEWAY[side];
  return {
    title: { absolute: section.seoTitle },
    description: section.seoDescription,
    alternates: { canonical: `${SITE_URL}${section.path}` },
    openGraph: { type: "website", locale: "cs_CZ", siteName: "ELDOCK", url: `${SITE_URL}${section.path}`, title: section.seoTitle, description: section.seoDescription, images: [OG_IMAGE] },
  };
}

// Fáze 111: podsekce rozcestníku – podrobné náhledy obrazovek, popis modulů a tlačítka pro spuštění (2D Půdorys,
// AI Panel Builder a nabídky vlevo; Hlídač revizí, Průmyslový závod a QR pasporty vpravo), ceník a kontakt.
export default async function GatewaySectionPage({ params }: PageProps<"/sekce/[side]">) {
  const { side } = await params;
  if (!isSide(side)) notFound();
  const section = GATEWAY[side];
  const [session, showcase] = await Promise.all([getAuthSession(), hasShowcaseProject()]);
  const clientZone = session ? { href: APP_HOME, label: "Vstoupit do aplikace" } : { href: "/login", label: "Klientská zóna / Přihlášení" };
  const crumbs = [
    { href: "/", label: "Úvod" },
    { href: section.path, label: section.title },
  ];
  const home = side === "elektroinstalace";
  // Fáze 114: ceník s dodavatelem (neplátce DPH, bankovní spojení) z velínu
  const operator = await getOperatorProfile();

  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(crumbs)) }} />
      <SiteHeader clientZone={clientZone} showcase={showcase} current={section.path} />
      <Breadcrumbs items={crumbs} />

      <main className="flex flex-1 flex-col" data-testid={`section-${side}`}>
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-8 pb-10 sm:px-6">
          <span className="text-4xl leading-none" aria-hidden>
            {section.icon}
          </span>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">{section.title}</h1>
          <p className="max-w-3xl text-lg text-pretty text-muted-foreground">
            <b className="text-foreground">Pro koho:</b> {section.who}
          </p>
          <div className="flex flex-wrap gap-3">
            {section.modules.map((module, index) => (
              <Button key={module.id} asChild variant={index ? "outline" : "default"} className={anchorButton}>
                <Link href={module.launch.href as "/"}>{module.launch.label}</Link>
              </Button>
            ))}
            {home && showcase ? <SampleElaborateDialog /> : null}
            {home ? (
              <Button asChild variant="outline" className={anchorButton}>
                <Link href="/navody" data-testid="tutorials-link">
                  🎬 Video-návody
                </Link>
              </Button>
            ) : null}
          </div>
        </section>

        {section.modules.map((module, index) => (
          <section key={module.id} id={module.id} className={index % 2 ? "scroll-mt-20 border-y border-border bg-background/60" : "scroll-mt-20"} data-testid={`section-module-${module.id}`}>
            <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
              <div className={index % 2 ? "lg:order-2" : undefined}>
                <SectionModulePreview id={module.id} />
              </div>
              <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  <span aria-hidden>{module.icon}</span> {module.title}
                </h2>
                <p className="text-muted-foreground">{module.text}</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {module.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {feature}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className={anchorButton}>
                    <Link href={module.launch.href as "/"} data-testid={`section-launch-${module.id}`}>
                      {module.launch.label} <ArrowRight data-icon="inline-end" aria-hidden />
                    </Link>
                  </Button>
                  {module.links.map((link) => (
                    <Button key={link.href} asChild variant="outline" className={anchorButton}>
                      <Link href={link.href as "/"}>{link.label}</Link>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}

        {!home ? (
          <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6" aria-label="Eldock za 45 sekund">
            <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-zinc-950 shadow-2xl ring-1 ring-primary/10" data-testid="promo-video">
              <LazyPromoVideo />
            </div>
            <p className="mt-3 text-center font-mono text-xs text-muted-foreground">Eldock za 45 sekund – od QR kódu na rozváděči po protokol o revizi</p>
          </section>
        ) : null}

        <section id="cenik" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6" data-testid="section-pricing">
          <PricingOverview audience={home ? "installer" : "buildings"} vatPayer={operator.vatPayer} supplier={`${operatorSummary(operator)} · ${bankLine(operator)}`} />
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
          <Link href={section.overview.href as "/"} className="inline-flex items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline" data-testid="section-overview">
            {section.overview.label} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>

        <ContactSection
          title={home ? "Ukážeme vám návrh rozváděče na vaší zakázce" : "Ukážeme vám Hlídač revizí ve vaší budově nebo závodě"}
          text={home ? "Online ukázka nad vaším skutečným rozváděčem nebo půdorysem – od fotky po vytištěnou dokumentaci." : "Online nebo osobně – od nakreslení pater a spotřebičů po identifikační štítky a měsíční report revizí."}
        />
      </main>

      <SiteFooter clientZone={clientZone} showcase={showcase} />
    </div>
  );
}
