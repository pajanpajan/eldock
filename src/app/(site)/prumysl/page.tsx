import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  FileWarning,
  FolderSearch,
  GitPullRequestArrow,
  HardHat,
  LayoutDashboard,
  LogIn,
  Network,
  PencilRuler,
  PlugZap,
  ShieldCheck,
  Sheet,
  Smartphone,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { AudienceSection, ContactSection, CrossLink, NewsletterSection, SectionTitle, TrustPoints, anchorButton } from "@/components/landing/LandingSections";
import { Breadcrumbs, SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { Button } from "@/components/ui/button";
import { AUDIENCES, type AudienceId } from "@/lib/landing-audiences";
import { APP_HOME } from "@/lib/routes";
import { OG_IMAGE, SITE_URL, jsonLdScript } from "@/lib/seo";
import { SEGMENTS, breadcrumbJsonLd } from "@/lib/site-map";
import { hasShowcaseProject } from "@/server/queries/panel-builder";
import { getAuthSession } from "@/server/session";

const segment = SEGMENTS.prumysl;

export const metadata: Metadata = {
  title: { absolute: segment.seoTitle },
  description: segment.seoDescription,
  alternates: { canonical: `${SITE_URL}${segment.path}` },
  openGraph: { type: "website", locale: "cs_CZ", siteName: "ELDOCK", url: `${SITE_URL}${segment.path}`, title: segment.seoTitle, description: segment.seoDescription, images: [OG_IMAGE] },
};

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
  { icon: Network, title: "Digitální dvojče dokumentace", text: "Celý závod v přehledné hierarchii Závod → Budova → Patro → Zařízení s interaktivní mapou areálu a půdorysy.", points: ["QR štítek na každém rozváděči a stroji", "Okamžité načtení z mobilu i tabletu", "Stav dokumentace barevně přímo na mapě"] },
  { icon: GitPullRequestArrow, title: "Uzavřené změnové řízení", text: "Požadavek na změnu („červenka“) s fotkou a zákresem přímo od stroje, bez psaní a bez papíru.", points: ["Zákres prstem do schématu + foto + hlasová poznámka", "Zpracování CAE projektantem v ticketingu", "Schválení vedoucím údržby a archivace revize"] },
  { icon: CalendarClock, title: "Plánovač revizí a VTZ", text: "Automatické hlídání termínů pro vyhrazená technická zařízení i revize spotřebičů podle ČSN.", points: ["Upozornění na blížící se a propadlé termíny", "Pochůzkové listy a rychlá revize v hale", "Generování podkladů a auditních reportů"] },
  { icon: PlugZap, title: "Komplexní nasazení na klíč", text: "Nedodáváme jen prázdný software. V rámci implementace převedeme vaši dokumentaci do živého systému.", points: ["Vstupní audit a digitalizace papírových archivů", "Překreslení schémat v CAE", "Fyzické oštítkování rozváděčů QR kódy"] },
];

const ROLES: { icon: LucideIcon; role: string; benefit: string }[] = [
  { icon: LayoutDashboard, role: "Technický ředitel", benefit: "Přehled o rizicích, otevřených změnách a stavu revizí napříč závody – vždy připravený na audit." },
  { icon: ClipboardCheck, role: "Vedoucí údržby", benefit: "Kontrola nad každou změnou v rozváděčích: porovnání revizí a schválení jedním tlačítkem." },
  { icon: Wrench, role: "Směnový údržbář", benefit: "Schémata v kapse u stroje za 3 vteřiny. Změnu nahlásí fotkou a zákresem prstem." },
  { icon: HardHat, role: "Revizní technik VTZ", benefit: "Seznam zařízení k revizi, záznam závad a měření přímo v hale, podklady pro revizní zprávu." },
  { icon: Smartphone, role: "Technik revizí spotřebičů", benefit: "Rychlá revize spotřebičů podle ČSN 33 1600 – sken štítku, výsledek, další kus." },
  { icon: PencilRuler, role: "CAE projektant", benefit: "Jasné zadání v ticketingu bez šumu: zákres, fotky a poznámka z haly na jednom místě." },
];

const audience = (id: AudienceId) => AUDIENCES.find((item) => item.id === id)!;

// Fáze 58: část webu pro průmysl (technický ředitel, údržba, revizní technik) – dříve druhá polovina úvodní stránky.
export default async function IndustryPage() {
  const [session, showcase] = await Promise.all([getAuthSession(), hasShowcaseProject()]);
  const signedIn = Boolean(session);
  const clientZone = signedIn ? { href: APP_HOME, label: "Vstoupit do aplikace" } : { href: "/login", label: "Klientská zóna / Přihlášení" };
  const crumbs = [
    { href: "/", label: "Úvod" },
    { href: segment.path, label: segment.title },
  ];

  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(crumbs)) }} />
      <SiteHeader clientZone={clientZone} showcase={showcase} current={segment.path} />
      <Breadcrumbs items={crumbs} />

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 pb-10 sm:px-6" data-testid="segment-hero">
          <span className="font-mono text-xs tracking-widest text-primary uppercase">{segment.title}</span>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">Živá elektrodokumentace, revize a údržba výrobního závodu</h1>
          <p className="max-w-3xl text-lg text-pretty text-muted-foreground">{segment.who}. {segment.promise}</p>
          <nav aria-label="Pro koho v závodě" className="flex flex-wrap gap-2" data-testid="industry-roles">
            {(["technicky-reditel", "udrzba", "revizni-technik"] as const).map((id) => (
              <a key={id} href={`#${audience(id).anchor}`} className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm hover:border-primary/60">
                {audience(id).role}
              </a>
            ))}
          </nav>
          <div className="flex flex-wrap gap-3">
            <Button asChild className={anchorButton}>
              <a href="#kontakt">Domluvit ukázku v závodě</a>
            </Button>
            <Button asChild variant="outline" className={anchorButton}>
              <Link href="/register-plant">Registrovat výrobní závod</Link>
            </Button>
            {/* Fáze 111: samostatná sekce Hlídač revizí & Správa spotřebičů a zařízení */}
            <Button asChild variant="outline" className={anchorButton}>
              <Link href="/hlidac-revizi" data-testid="industry-hlidac-link">
                🛡️ Hlídač revizí & spotřebiče
              </Link>
            </Button>
          </div>
        </section>

        <AudienceSection audience={audience("technicky-reditel")} tone="band">
          <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6" data-testid="product-plant">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
              <Factory className="size-3.5" aria-hidden /> Celozávodní platforma
            </span>
            <h3 className="text-2xl font-bold tracking-tight text-balance">ELDOCK Průmyslový dok – Správa výrobních závodů, dokumentace a revizí</h3>
            <p className="text-muted-foreground">Mapa areálu, budovy a půdorysy se zařízeními, elektrodokumentace s historií verzí, červenky z haly do CAE, lhůtník a plánovač revizí VTZ, spotřebičů a nářadí.</p>
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
        <AudienceSection audience={audience("udrzba")} tone="plain" />
        <AudienceSection audience={audience("revizni-technik")} tone="band" />

        {/* PROBLÉM vs. ŘEŠENÍ */}
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
          <SectionTitle id="role-title" eyebrow="Role v závodě" title="Jeden systém pro celý závod" text="Šest rolí v symbióze – každá vidí přesně to, co potřebuje, a všechny pracují nad stejnou platnou dokumentací." />
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

        <CrossLink to="domov" />
        <TrustPoints />
        <NewsletterSection source="prumysl" />
        <ContactSection title="Ukážeme vám Eldock přímo ve vašem závodě" text="Domluvte si nezávaznou prezentaci – osobně u vás ve výrobě, nad vaším skutečným rozváděčem, nebo online. Pilotní nasazení začíná na jednom rozváděči." />
      </main>

      <SiteFooter clientZone={clientZone} showcase={showcase} />
    </div>
  );
}
