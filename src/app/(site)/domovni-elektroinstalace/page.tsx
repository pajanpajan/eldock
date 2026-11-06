import type { Metadata } from "next";
import Link from "next/link";
import { Camera, CircuitBoard, FileText, PencilRuler, Printer, Rocket, ScanSearch, type LucideIcon } from "lucide-react";

import { AudienceSection, ContactSection, CrossLink, NewsletterSection, SectionTitle, TrustPoints, anchorButton } from "@/components/landing/LandingSections";
import { SampleElaborateDialog } from "@/components/landing/SampleElaborateDialog";
import { Breadcrumbs, SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { Button } from "@/components/ui/button";
import { AUDIENCES } from "@/lib/landing-audiences";
import { APP_HOME } from "@/lib/routes";
import { OG_IMAGE, SITE_URL, jsonLdScript } from "@/lib/seo";
import { SEGMENTS, breadcrumbJsonLd } from "@/lib/site-map";
import { hasShowcaseProject } from "@/server/queries/panel-builder";
import { getAuthSession } from "@/server/session";

const segment = SEGMENTS.domov;

export const metadata: Metadata = {
  title: { absolute: segment.seoTitle },
  description: segment.seoDescription,
  alternates: { canonical: `${SITE_URL}${segment.path}` },
  openGraph: { type: "website", locale: "cs_CZ", siteName: "ELDOCK", url: `${SITE_URL}${segment.path}`, title: segment.seoTitle, description: segment.seoDescription, images: [OG_IMAGE] },
};

/** 2D půdorys a kabeláž – jen to, co editor skutečně umí (fáze 49–57). */
const FLOORPLAN: string[] = [
  "Podklad z PDF nebo obrázku: otočení o 90°, zoom, ořez a kalibrace měřítka s ověřením druhou kótou",
  "Značky zásuvek, vypínačů a svítidel dle ČSN EN 60617-11, řazení vypínače podle párování se světly",
  "Klasická instalace, sběrnicová Smart Home (KNX / Loxone) i retrofit s moduly – paleta ovládání podle úrovně",
  "Výkaz kabeláže ve 3 režimech vedení (spodem / vrchem / optimalizovaně) s rezervou v % a úbytkem napětí",
  "Okruhy, jištění a chrániče dle ČSN 33 2130 ed. 4 a rozváděč z půdorysu na jeden klik",
  "Kusovník domovních přístrojů s objednacími čísly zvolené řady a barvy",
];

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Camera, title: "Fotka nebo půdorys", text: "Vyfoťte osazený rozváděč, nahrajte půdorys domu, nebo začněte s prázdnou rozvodnicí." },
  { icon: ScanSearch, title: "Přístroje a okruhy", text: "AI rozpozná přístroje z fotky, z půdorysu vzniknou okruhy, jištění a chrániče podle ČSN 33 2130 ed. 4." },
  { icon: PencilRuler, title: "Kontrola a výpočty", text: "Zkontrolujete zapojení, výpočet oteplení dle IEC TR 60890 a prostředí dle ČSN 33 2000-5-51 ed. 3." },
  { icon: Printer, title: "Dokumentace", text: "Vytisknete 6 listů dokumentace s vaší firmou v razítku, prohlášením o shodě a štítkem CE." },
];

// Fáze 58: část webu pro domovní elektroinstalace (elektrikáři, montážní firmy, projektanti rodinných domů a bytů).
export default async function HomeInstallationsPage() {
  const [session, showcase] = await Promise.all([getAuthSession(), hasShowcaseProject()]);
  const clientZone = session ? { href: APP_HOME, label: "Vstoupit do aplikace" } : { href: "/login", label: "Klientská zóna / Přihlášení" };
  const crumbs = [
    { href: "/", label: "Úvod" },
    { href: segment.path, label: segment.title },
  ];
  const electrician = AUDIENCES.find((audience) => audience.id === "elektrikar")!;

  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(crumbs)) }} />
      <SiteHeader clientZone={clientZone} showcase={showcase} current={segment.path} />
      <Breadcrumbs items={crumbs} />

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 pb-10 sm:px-6" data-testid="segment-hero">
          <span className="font-mono text-xs tracking-widest text-primary uppercase">{segment.title}</span>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">Návrh, kabeláž a dokumentace domovní elektroinstalace na jednom místě</h1>
          <p className="max-w-3xl text-lg text-pretty text-muted-foreground">{segment.who}. {segment.promise}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className={anchorButton}>
              <Link href="/panel-builder/auth">
                <Rocket data-icon="inline-start" aria-hidden /> Založit první rozváděč
              </Link>
            </Button>
            {showcase ? <SampleElaborateDialog /> : null}
            <Button asChild variant="outline" className={anchorButton}>
              <a href="#kontakt">Domluvit ukázku</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Registrace firmy je zdarma s 5 testovacími kredity (1 kredit = 1 nový rozváděč). Údaje firmy doplníme z registru ARES podle IČO.</p>
        </section>

        {/* Elektrikář + produkt AI Panel Builder */}
        <AudienceSection audience={electrician} tone="band">
          <article id="panel-builder" className="relative flex scroll-mt-20 flex-col gap-4 overflow-hidden rounded-2xl border-2 border-primary/60 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-xl" data-testid="product-panel-builder">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-3 py-1 font-mono text-xs font-bold text-primary-foreground">
              <CircuitBoard className="size-3.5" aria-hidden /> Samostatný produkt
            </span>
            <h3 className="text-2xl font-bold tracking-tight text-balance">ELDOCK AI Panel Builder – výrobní dokumentace, oteplení a CE štítek rozváděče z fotky za 3 minuty</h3>
            <p className="text-muted-foreground">
              Vyfoťte osazený rozváděč, AI rozpozná přístroje, navrhne zapojení, spočítá oteplení dle IEC TR 60890 a připraví 6 listů dokumentace s vaší firmou v razítku, prohlášením o shodě a výrobním štítkem CE. U každého přístroje vidíte jeho značku dle ČSN EN 60617 a náhled datasheetu.
            </p>
            <div className="mt-auto flex flex-wrap gap-3">
              <Button asChild className={anchorButton}>
                <Link href="/panel-builder/auth">
                  <Rocket data-icon="inline-start" aria-hidden /> Spustit AI Panel Builder (registrace / přihlášení)
                </Link>
              </Button>
              {showcase ? <SampleElaborateDialog /> : null}
            </div>
          </article>
        </AudienceSection>

        {/* 2D půdorys a kabeláž */}
        <section id="pudorys" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6" data-testid="segment-floorplan">
          <SectionTitle eyebrow="2D půdorys & kabeláž" title="Od půdorysu domu k rozváděči a výkazu kabelů" text="Nahrajte PDF od architekta, zkalibrujte měřítko a osaďte zásuvky, světla a ovládání. Eldock z toho spočítá okruhy, kabeláž i rozváděč." />
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {FLOORPLAN.map((feature) => (
              <li key={feature} className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-4 text-sm">
                <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {feature}
              </li>
            ))}
          </ul>
        </section>

        {/* Jak to funguje */}
        <section id="jak-to-funguje" className="scroll-mt-20 border-y border-border bg-background/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <SectionTitle eyebrow="Jak to funguje" title="Čtyři kroky k hotové dokumentaci" />
            <ol className="mt-10 grid gap-4 md:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5">
                  <span className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                  </span>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <CrossLink to="prumysl" />
        <TrustPoints />
        <NewsletterSection source="domovni-elektroinstalace" />
        <ContactSection title="Ukážeme vám návrh rozváděče na vaší zakázce" text="Online ukázka nad vaším skutečným rozváděčem nebo půdorysem – od fotky po vytištěnou dokumentaci." />
      </main>

      <SiteFooter clientZone={clientZone} showcase={showcase} />
    </div>
  );
}
