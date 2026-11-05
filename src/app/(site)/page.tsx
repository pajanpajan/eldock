import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircuitBoard,
  ClipboardCheck,
  Factory,
  FileWarning,
  FolderSearch,
  GitPullRequestArrow,
  HardHat,
  LayoutDashboard,
  LogIn,
  Mail,
  MapPin,
  MonitorPlay,
  Network,
  PencilRuler,
  PlugZap,
  QrCode,
  Rocket,
  ShieldCheck,
  Sheet,
  Smartphone,
  UserRound,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { ConsentSettingsLink } from "@/components/consent/ConsentManager";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { NewsletterSignup } from "@/components/landing/NewsletterSignup";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { SampleElaborateDialog } from "@/components/landing/SampleElaborateDialog";
import { LazyPromoVideo } from "@/components/lazy";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { COMPANY_INFO } from "@/lib/company";
import { AUDIENCES, TRUST_POINTS, type Audience, type AudienceId } from "@/lib/landing-audiences";
import { OG_IMAGE, SEO_DESCRIPTION, SEO_KEYWORDS, SEO_TITLE, SITE_URL, jsonLdScript, landingJsonLd } from "@/lib/seo";
import { APP_HOME } from "@/lib/routes";
import { cn } from "@/lib/utils";
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

// Fáze 56: navigace podle toho, kdo stránku čte (elektrikář, revizní technik, průmysl), + novinky a kontakt
const NAV = [
  { href: "#elektrikar", label: "Pro elektrikáře" },
  { href: "#revizni-technik", label: "Pro revizní techniky" },
  { href: "#prumysl", label: "Pro průmysl" },
  { href: "#novinky", label: "Novinky" },
  { href: "#kontakt", label: "Kontakt" },
];

const AUDIENCE_ICON: Record<AudienceId, LucideIcon> = { elektrikar: Zap, "revizni-technik": HardHat, "technicky-reditel": LayoutDashboard, udrzba: Wrench };

const BEFORE: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: FolderSearch, title: "Hledání schémat při odstávce", text: "Stroj stojí a údržba listuje šanony nebo hledá ve sdílené složce, která verze výkresu je ta platná." },
  { icon: FileWarning, title: "Ztracené papírové „červenky“", text: "Ruční zákresy změn zůstanou v rozváděči nebo v kapse a do projekce se nikdy nedostanou." },
  { icon: Sheet, title: "Excel s termíny revizí", text: "Termíny VTZ a revizí spotřebičů se hlídají v tabulkách, které má v hlavě jediný člověk." },
  { icon: ShieldCheck, title: "Riziko při auditu", text: "Chybí doložitelná historie: kdo co změnil, kdo to schválil a jaká dokumentace platila v daný den." },
];

const AFTER: { title: string; text: string }[] = [
  { title: "Okamžitá dostupnost u stroje", text: "Naskenujete QR štítek na rozváděči a platné schéma, kusovník i historie revizí jsou na tabletu do 3 vteřin." },
  { title: "Řízené schvalovací workflow", text: "Změna z haly → zpracování CAE projektantem → potvrzení vedoucím údržby. Každý ví, v jakém stavu je dokumentace." },
  { title: "100% auditní stopa", text: "Každá revize, závada i schválení má autora, datum a přílohy. Auditní report vygenerujete jedním kliknutím." },
];

const PILLARS: { icon: LucideIcon; title: string; text: string; points: string[] }[] = [
  {
    icon: Network,
    title: "Digitální dvojče dokumentace",
    text: "Celý závod v přehledné hierarchii Závod → Budova → Patro → Zařízení s interaktivní mapou areálu a půdorysy.",
    points: ["QR štítek na každém rozváděči a stroji", "Okamžité načtení z mobilu i tabletu", "Stav dokumentace barevně přímo na mapě"],
  },
  {
    icon: GitPullRequestArrow,
    title: "Uzavřené změnové řízení",
    text: "Požadavek na změnu („červenka“) s fotkou a zákresem přímo od stroje, bez psaní a bez papíru.",
    points: ["Zákres prstem do schématu + foto + hlasová poznámka", "Zpracování CAE projektantem v ticketingu", "Schválení vedoucím údržby a archivace revize"],
  },
  {
    icon: CalendarClock,
    title: "Plánovač revizí a VTZ",
    text: "Automatické hlídání termínů pro vyhrazená technická zařízení i revize spotřebičů podle ČSN.",
    points: ["Upozornění na blížící se a propadlé termíny", "Pochůzkové listy a rychlá revize v hale", "Generování podkladů a auditních reportů"],
  },
  {
    icon: PlugZap,
    title: "Komplexní nasazení na klíč",
    text: "Nedodáváme jen prázdný software. V rámci implementace převedeme vaši dokumentaci do živého systému.",
    points: ["Vstupní audit a digitalizace papírových archivů", "Překreslení schémat v CAE", "Fyzické oštítkování rozváděčů QR kódy"],
  },
];

const ROLES: { icon: LucideIcon; role: string; benefit: string }[] = [
  { icon: LayoutDashboard, role: "Technický ředitel", benefit: "Přehled o rizicích, otevřených změnách a stavu revizí napříč závody – vždy připravený na audit." },
  { icon: ClipboardCheck, role: "Vedoucí údržby", benefit: "Kontrola nad každou změnou v rozváděčích: porovnání revizí a schválení jedním tlačítkem." },
  { icon: Wrench, role: "Směnový údržbář", benefit: "Schémata v kapse u stroje za 3 vteřiny. Změnu nahlásí fotkou a zákresem prstem." },
  { icon: HardHat, role: "Revizní technik VTZ", benefit: "Seznam zařízení k revizi, záznam závad a měření přímo v hale, podklady pro revizní zprávu." },
  { icon: Smartphone, role: "Technik revizí spotřebičů", benefit: "Rychlá revize spotřebičů podle ČSN 33 1600 – sken štítku, výsledek, další kus." },
  { icon: PencilRuler, role: "CAE projektant", benefit: "Jasné zadání v ticketingu bez šumu: zákres, fotky a poznámka z haly na jednom místě." },
];

// Fáze 54: tlačítka se na úzkém displeji zalamují místo přetékání karty
const anchorButton = "touch-target h-auto min-h-11 shrink whitespace-normal px-5 py-2 text-left text-sm";

const audience = (id: AudienceId) => AUDIENCES.find((item) => item.id === id)!;

export default async function LandingPage() {
  const [session, showcase] = await Promise.all([getAuthSession(), hasShowcaseProject()]);
  const signedIn = Boolean(session);
  const clientZone = signedIn ? { href: APP_HOME, label: "Vstoupit do aplikace" } : { href: "/login", label: "Klientská zóna / Přihlášení" };

  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      {/* Strukturovaná data pro vyhledávače (SoftwareApplication + Organization) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(landingJsonLd()) }} />
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka">
            <Logo />
          </Link>
          <nav aria-label="Sekce stránky" className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                {item.label}
              </a>
            ))}
          </nav>
          <Button asChild variant="outline" className="touch-target ml-auto h-9 px-3 text-sm">
            <Link href={clientZone.href}>
              <LogIn data-icon="inline-start" aria-hidden />
              <span className="hidden sm:inline">{clientZone.label}</span>
              <span className="sm:hidden">{signedIn ? "Aplikace" : "Přihlášení"}</span>
            </Link>
          </Button>
          <LandingMobileNav items={NAV} clientZone={clientZone} />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* HERO – jedna věta pro všechny čtyři skupiny, dvě hlavní cesty */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-14 pb-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
              <Building2 className="size-3.5" aria-hidden /> Návrh · Dokumentace · Revize · Údržba
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              <span className="text-primary">Eldock</span> – elektrodokumentace od rodinného domu po výrobní závod
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              Elektrikáři navrhnou rozváděč a domovní instalaci i s kompletní dokumentací. Revizní technici mají lhůty a měření na jednom místě. Údržba a technické vedení pracují nad vždy platnou dokumentací závodu.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className={anchorButton}>
                <Link href="/panel-builder/auth">
                  <Rocket data-icon="inline-start" aria-hidden /> Navrhnout rozváděč
                </Link>
              </Button>
              <Button asChild variant="outline" className={anchorButton}>
                <a href="#kontakt">
                  Domluvit nezávaznou ukázku <ArrowRight data-icon="inline-end" aria-hidden />
                </a>
              </Button>
            </div>
            <dl className="mt-2 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
              {[
                ["3 min", "dokumentace rozváděče z fotky"],
                ["3 s", "ke schématu přes QR"],
                ["100 %", "auditní stopa"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="font-mono text-2xl font-semibold text-foreground">{value}</dd>
                  <dd className="text-xs text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          {/* Na telefonu rovnou rozcestník „Jsem…“ – ukázka aplikace až od tabletu */}
          <div className="hidden md:block">
            <ProductPreview />
          </div>
        </section>

        {/* ROZCESTNÍK „Jsem…“ – každá skupina rovnou ke svému */}
        <section id="pro-koho" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6" aria-labelledby="pro-koho-title">
          <h2 id="pro-koho-title" className="mb-4 font-mono text-xs tracking-widest text-primary uppercase">
            Jsem…
          </h2>
          <nav aria-label="Vyberte, kdo jste" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="audience-chooser">
            {AUDIENCES.map((item) => {
              const Icon = AUDIENCE_ICON[item.id];
              return (
                <a key={item.id} href={`#${item.anchor}`} className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <span className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-lg font-semibold">{item.role}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{item.promise}</span>
                  <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
                    Co pro mě Eldock dělá <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </a>
              );
            })}
          </nav>
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

        {/* ELEKTRIKÁŘ – AI Panel Builder a domovní instalace */}
        <AudienceSection audience={audience("elektrikar")} tone="plain">
          <article className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border-2 border-primary/60 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-xl" data-testid="product-panel-builder">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-3 py-1 font-mono text-xs font-bold text-primary-foreground">
              <CircuitBoard className="size-3.5" aria-hidden /> Samostatný produkt
            </span>
            <h3 className="text-2xl font-bold tracking-tight text-balance">ELDOCK AI Panel Builder – Výrobní dokumentace, oteplení a CE štítek rozváděče z fotky za 3 minuty</h3>
            <p className="text-muted-foreground">
              Vyfoťte osazený rozváděč, AI rozpozná přístroje, navrhne zapojení, spočítá oteplení dle IEC TR 60890 a připraví 6 listů dokumentace s vaší firmou v razítku, prohlášením o shodě a výrobním štítkem CE.
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

        {/* REVIZNÍ TECHNIK */}
        <AudienceSection audience={audience("revizni-technik")} tone="band" />

        {/* PRŮMYSL – technický ředitel a údržba nad jednou dokumentací závodu */}
        <AudienceSection audience={audience("technicky-reditel")} tone="plain">
          <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6" data-testid="product-plant">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
              <Factory className="size-3.5" aria-hidden /> Celozávodní platforma
            </span>
            <h3 className="text-2xl font-bold tracking-tight text-balance">ELDOCK Průmyslový dok – Správa výrobních závodů, dokumentace a revizí</h3>
            <p className="text-muted-foreground">
              Mapa areálu, budovy a půdorysy se zařízeními, elektrodokumentace s historií verzí, červenky z haly do CAE, lhůtník a plánovač revizí VTZ, spotřebičů a nářadí.
            </p>
            <div className="mt-auto flex flex-wrap gap-3">
              <Button asChild className={anchorButton}>
                <Link href="/register-plant">Registrovat výrobní závod</Link>
              </Button>
              <Button asChild variant="outline" className={anchorButton}>
                <Link href={clientZone.href}>
                  <LogIn data-icon="inline-start" aria-hidden /> {signedIn ? clientZone.label : "Přihlásit se / Demo závodu"}
                </Link>
              </Button>
            </div>
          </article>
        </AudienceSection>

        <AudienceSection audience={audience("udrzba")} tone="band" />

        {/* PROBLÉM vs. ŘEŠENÍ (průmysl) */}
        <section id="reseni" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="Proč Eldock v závodě" title="Od šanonů a Excelu k živé dokumentaci" />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card/50 p-6">
              <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Dnes v mnoha závodech</h3>
              <ul className="mt-5 flex flex-col gap-5">
                {BEFORE.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">
                      <Icon className="size-4.5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-medium">{title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/40 bg-primary/[0.06] p-6">
              <h3 className="font-mono text-xs tracking-widest text-primary uppercase">S Eldockem</h3>
              <ul className="mt-5 flex flex-col gap-6">
                {AFTER.map(({ title, text }) => (
                  <li key={title} className="flex gap-4">
                    <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="text-lg font-semibold">{title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* PILÍŘE */}
        <section id="jak-to-funguje" className="scroll-mt-20 border-y border-border bg-background/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <SectionTitle eyebrow="Jak to funguje" title="Čtyři pilíře systému" text="Software, procesy a implementace v jednom balíčku – od prvního auditu po QR štítek na posledním rozváděči." />
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {PILLARS.map(({ icon: Icon, title, text, points }, index) => (
                <article key={title} className="group rounded-2xl border border-border bg-card/60 p-6 transition-colors hover:border-primary/50">
                  <div className="flex items-center gap-4">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{text}</p>
                  <ul className="mt-4 flex flex-col gap-2 text-sm">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ROLE V ZÁVODĚ */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="role-title">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className="font-mono text-xs tracking-widest text-primary uppercase">Role v závodě</span>
            <h2 id="role-title" className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Jeden systém pro celý závod
            </h2>
            <p className="text-muted-foreground">Šest rolí v symbióze – každá vidí přesně to, co potřebuje, a všechny pracují nad stejnou platnou dokumentací.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map(({ icon: Icon, role, benefit }) => (
              <div key={role} className="rounded-xl border border-border bg-card/50 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <h3 className="font-semibold">{role}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{benefit}</p>
              </div>
            ))}
          </div>
        </section>

        {/* NORMY A DATA – důvěra pro všechny skupiny */}
        <section className="border-y border-border bg-background/60" aria-labelledby="normy-title">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center">
            <h2 id="normy-title" className="shrink-0 text-sm font-semibold">
              Postavené na platných normách
              <span className="block text-xs font-normal text-muted-foreground">Normový registr hlídá vydání i změny.</span>
            </h2>
            <ul className="flex flex-wrap gap-2" data-testid="trust-points">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* NOVINKY – měsíční newsletter */}
        <section id="novinky" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6">
          <div className="grid gap-8 rounded-3xl border border-border bg-card/60 p-8 sm:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
            <div className="flex flex-col gap-3">
              <span className="font-mono text-xs tracking-widest text-primary uppercase">Novinky</span>
              <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">Jednou měsíčně, k věci</h2>
              <p className="text-muted-foreground">Změny norem a předpisů, nové funkce Eldocku a praktické tipy pro návrh, revize a údržbu. Žádný spam, odhlášení jedním kliknutím.</p>
            </div>
            <NewsletterSignup source="homepage" />
          </div>
        </section>

        {/* KONTAKT */}
        <section id="kontakt" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="grid gap-10 overflow-hidden rounded-3xl border border-primary/40 bg-card/70 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-5">
              <span className="font-mono text-xs tracking-widest text-primary uppercase">Kontakt</span>
              <h2 className="text-3xl font-bold tracking-tight text-balance">Ukážeme vám Eldock přímo ve vašem závodě</h2>
              <p className="text-muted-foreground">
                Domluvte si nezávaznou prezentaci – osobně u vás ve výrobě, nad vaším skutečným rozváděčem, nebo online. Elektrikářům a revizním technikům ukážeme návrh rozváděče i revize online.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className={anchorButton}>
                  <a href={`mailto:${COMPANY_INFO.email}?subject=${encodeURIComponent("Ukázka systému Eldock")}`}>
                    <Mail data-icon="inline-start" aria-hidden /> Domluvit ukázku e-mailem
                  </a>
                </Button>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Building2 className="size-4 text-primary" aria-hidden /> Prezentace v závodě
                </li>
                <li className="flex items-center gap-2">
                  <MonitorPlay className="size-4 text-primary" aria-hidden /> Online ukázka
                </li>
                <li className="flex items-center gap-2">
                  <QrCode className="size-4 text-primary" aria-hidden /> Pilot na jednom rozváděči
                </li>
              </ul>
            </div>
            <dl className="flex flex-col gap-4 rounded-2xl border border-border bg-background/70 p-6 text-sm">
              <ContactRow icon={Building2} label="Společnost" value={COMPANY_INFO.name} />
              <ContactRow icon={UserRound} label="Kontaktní osoba" value={COMPANY_INFO.contactPerson} />
              <ContactRow icon={Mail} label="E-mail" value={<a href={`mailto:${COMPANY_INFO.email}`} className="text-primary hover:underline">{COMPANY_INFO.email}</a>} />
              <ContactRow icon={MapPin} label="Sídlo" value={COMPANY_INFO.location} />
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background/80">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 text-sm text-muted-foreground sm:px-6 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo withTagline />
            <p className="max-w-sm">{BRAND.description}.</p>
          </div>
          <nav aria-label="Pro koho" className="flex flex-col gap-2">
            <span className="font-medium text-foreground">Pro koho</span>
            {AUDIENCES.map((item) => (
              <a key={item.id} href={`#${item.anchor}`} className="hover:text-foreground">
                {item.role}
              </a>
            ))}
          </nav>
          <dl className="grid h-fit grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt>Provozovatel</dt>
            <dd className="text-foreground">{COMPANY_INFO.name}</dd>
            <dt>Sídlo</dt>
            <dd>{COMPANY_INFO.location}</dd>
            <dt>IČO</dt>
            <dd>{COMPANY_INFO.ico}</dd>
            <dt>DIČ</dt>
            <dd>{COMPANY_INFO.dic}</dd>
            <dt>E-mail</dt>
            <dd>
              <a href={`mailto:${COMPANY_INFO.email}`} className="hover:text-foreground">{COMPANY_INFO.email}</a>
            </dd>
          </dl>
          <div className="flex flex-col gap-2">
            <Link href={clientZone.href} className="hover:text-foreground">{clientZone.label}</Link>
            <a href="#novinky" className="hover:text-foreground">Odběr novinek</a>
            <Link href="/obchodni-podminky" className="hover:text-foreground">Obchodní podmínky</Link>
            <Link href="/ochrana-osobnich-udaju" className="hover:text-foreground">Ochrana osobních údajů</Link>
            <ConsentSettingsLink className="w-fit text-left hover:text-foreground" />
            <span>© {new Date().getFullYear()} {BRAND.name}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Sekce jedné cílové skupiny: bolest → co Eldock dělá → co dostanete → tlačítka (+ volitelně produktová karta). */
function AudienceSection({ audience, tone, children }: { audience: Audience; tone: "plain" | "band"; children?: React.ReactNode }) {
  const Icon = AUDIENCE_ICON[audience.id];
  return (
    <section id={audience.anchor} className={cn("scroll-mt-20", tone === "band" ? "border-y border-border bg-background/60" : "")} data-testid={`audience-${audience.id}`}>
      <div className={cn("mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6", children ? "lg:grid-cols-[1.1fr_1fr]" : "lg:grid-cols-[1.3fr_1fr]")}>
        <div className="flex flex-col gap-5">
          <span className="flex items-center gap-2 font-mono text-xs tracking-widest text-primary uppercase">
            <Icon className="size-4" aria-hidden /> {audience.eyebrow}
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{audience.title}</h2>
          <p className="text-muted-foreground">{audience.pain}</p>
          <ul className="flex flex-col gap-3">
            {audience.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            {audience.ctas.map((cta) => (
              <Button key={cta.label} asChild variant={cta.primary ? "default" : "outline"} className={anchorButton}>
                {cta.href.startsWith("#") ? <a href={cta.href}>{cta.label}</a> : <Link href={cta.href}>{cta.label}</Link>}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {children}
          <div className="rounded-2xl border border-border bg-card/50 p-6">
            <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Co dostanete</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {audience.deliverables.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <span className="font-mono text-xs tracking-widest text-primary uppercase">{eyebrow}</span>
      <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {text ? <p className="text-muted-foreground">{text}</p> : null}
    </div>
  );
}

function ContactRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}
