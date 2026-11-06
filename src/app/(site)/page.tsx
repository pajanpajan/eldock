import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Factory, FileCheck2, Home, Rocket, ShieldCheck, Timer } from "lucide-react";

import { ContactSection, NewsletterSection, TrustPoints, anchorButton } from "@/components/landing/LandingSections";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { SampleElaborateDialog } from "@/components/landing/SampleElaborateDialog";
import { SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { LazyPromoVideo } from "@/components/lazy";
import { Button } from "@/components/ui/button";
import { OG_IMAGE, SEO_DESCRIPTION, SEO_KEYWORDS, SEO_TITLE, SITE_URL, jsonLdScript, landingJsonLd } from "@/lib/seo";
import { SEGMENTS } from "@/lib/site-map";
import { APP_HOME } from "@/lib/routes";
import { hasShowcaseProject } from "@/server/queries/panel-builder";
import { getAuthSession } from "@/server/session";

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  alternates: { canonical: SITE_URL },
  openGraph: { type: "website", locale: "cs_CZ", siteName: "ELDOCK", url: SITE_URL, title: SEO_TITLE, description: SEO_DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: SEO_TITLE, description: SEO_DESCRIPTION, images: [OG_IMAGE.url] },
};

/** Co Eldock lidem přináší (fáze 58 – obecný úvod nad rozcestníkem). */
const VALUES = [
  { icon: Timer, title: "Méně papírování", text: "Dokumentace rozváděče a domovní instalace vznikne z fotky nebo z půdorysu. Večery nad výkresy po montáži odpadají." },
  { icon: ShieldCheck, title: "Jistota u norem", text: "Výpočty, protokoly a dokumenty podle platných ČSN – normový registr hlídá jejich vydání i změny." },
  { icon: FileCheck2, title: "Vždy platné podklady", text: "QR štítek na rozváděči, historie verzí a auditní stopa – stejná dokumentace u stroje i v kanceláři." },
];

// Fáze 58: úvodní stránka = proč Eldock vznikl a co přináší + rozcestník Domovní elektroinstalace (vlevo) / Průmysl (vpravo).
export default async function LandingPage() {
  const [session, showcase] = await Promise.all([getAuthSession(), hasShowcaseProject()]);
  const signedIn = Boolean(session);
  const clientZone = signedIn ? { href: APP_HOME, label: "Vstoupit do aplikace" } : { href: "/login", label: "Klientská zóna / Přihlášení" };

  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      {/* Strukturovaná data pro vyhledávače (SoftwareApplication + Organization) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(landingJsonLd()) }} />
      <SiteHeader clientZone={clientZone} showcase={showcase} current="/" />

      <main className="flex flex-1 flex-col">
        {/* PROČ ELDOCK VZNIKL */}
        <section id="proc-eldock" className="mx-auto grid w-full max-w-6xl scroll-mt-20 items-center gap-12 px-4 pt-14 pb-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
              <Building2 className="size-3.5" aria-hidden /> Návrh · Dokumentace · Revize · Údržba
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              <span className="text-primary">Eldock</span> – elektrodokumentace od rodinného domu po výrobní závod
            </h1>
            <div className="flex max-w-xl flex-col gap-3 text-pretty text-muted-foreground" data-testid="mission">
              <p className="text-lg">
                Elektroinstalace se dnes navrhuje, reviduje a udržuje s dokumentací rozházenou po šanonech, e-mailech a tabulkách. Výkresy se dokreslují ručně po montáži, změny v rozváděčích se nedostanou do schémat a revizní lhůty hlídá jeden člověk v Excelu.
              </p>
              <p>
                <b className="text-foreground">Eldock vznikl, aby každá elektroinstalace měla platnou a dohledatelnou dokumentaci podle aktuálních norem</b> – a aby lidé, kteří ji navrhují, revidují a udržují, trávili méně času papírováním a víc prací, které rozumí.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className={anchorButton}>
                <a href="#vyberte-oblast">
                  Vyberte svou oblast <ArrowRight data-icon="inline-end" aria-hidden />
                </a>
              </Button>
              <Button asChild variant="outline" className={anchorButton}>
                <a href="#kontakt">Domluvit nezávaznou ukázku</a>
              </Button>
            </div>
          </div>
          <div className="hidden md:block">
            <ProductPreview />
          </div>
        </section>

        {/* CO PŘINÁŠÍ */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6" aria-labelledby="hodnoty-title">
          <h2 id="hodnoty-title" className="sr-only">
            Co Eldock přináší
          </h2>
          <ul className="grid gap-4 md:grid-cols-3" data-testid="values">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-2xl border border-border bg-card/60 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ROZCESTNÍK: vlevo domovní elektroinstalace, vpravo průmysl */}
        <section id="vyberte-oblast" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-6" aria-labelledby="oblast-title">
          <h2 id="oblast-title" className="mb-5 text-2xl font-bold tracking-tight sm:text-3xl">
            Kde Eldock použijete?
          </h2>
          <div className="grid gap-5 lg:grid-cols-2" data-testid="segment-chooser">
            <SegmentCard segment="domov" icon={<Home className="size-6" aria-hidden />} accent>
              {showcase ? <SampleElaborateDialog /> : null}
            </SegmentCard>
            <SegmentCard segment="prumysl" icon={<Factory className="size-6" aria-hidden />} />
          </div>
        </section>

        {/* Produktové video (45 s, bez zvuku) */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6" aria-label="Eldock za 45 sekund">
          <div className="relative" data-testid="promo-video">
            <div aria-hidden className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-primary/15 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-zinc-950 shadow-2xl ring-1 ring-primary/10">
              <LazyPromoVideo />
            </div>
            <p className="mt-3 text-center font-mono text-xs text-muted-foreground">Eldock za 45 sekund – od QR kódu na rozváděči po protokol o revizi</p>
          </div>
        </section>

        <TrustPoints />
        <NewsletterSection source="homepage" />
        <ContactSection
          title="Ukážeme vám Eldock na vaší zakázce nebo ve vašem závodě"
          text="Domluvte si nezávaznou prezentaci – elektrikářům a revizním technikům online nad skutečným rozváděčem, výrobním závodům osobně ve výrobě nebo online."
        />
      </main>

      <SiteFooter clientZone={clientZone} showcase={showcase} />
    </div>
  );
}

/** Karta části webu v rozcestníku – celá karta vede na stránku části. */
function SegmentCard({ segment, icon, accent, children }: { segment: "domov" | "prumysl"; icon: React.ReactNode; accent?: boolean; children?: React.ReactNode }) {
  const data = SEGMENTS[segment];
  return (
    <article className={accent ? "flex flex-col gap-4 rounded-3xl border-2 border-primary/60 bg-gradient-to-br from-primary/15 via-card to-card p-7 shadow-xl" : "flex flex-col gap-4 rounded-3xl border-2 border-border bg-card p-7"} data-testid={`segment-${segment}`}>
      <div className="flex items-center gap-3">
        <span className={accent ? "flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground" : "flex size-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary"}>{icon}</span>
        <div>
          <h3 className="text-2xl font-bold tracking-tight">{data.title}</h3>
          <p className="text-sm text-muted-foreground">{data.who}</p>
        </div>
      </div>
      <p>{data.promise}</p>
      <ul className="flex flex-col gap-2 text-sm">
        {data.points.map((point) => (
          <li key={point} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {point}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap gap-3 pt-2">
        <Button asChild variant={accent ? "default" : "outline"} className={anchorButton}>
          <Link href={data.path} data-testid={`segment-link-${segment}`}>
            {accent ? <Rocket data-icon="inline-start" aria-hidden /> : <Factory data-icon="inline-start" aria-hidden />} {data.cta}
          </Link>
        </Button>
        {children}
      </div>
    </article>
  );
}
