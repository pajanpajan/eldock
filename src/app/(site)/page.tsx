import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
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
  ShieldCheck,
  Sheet,
  Smartphone,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { ProductPreview } from "@/components/landing/ProductPreview";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { COMPANY_INFO } from "@/lib/company";
import { APP_HOME } from "@/lib/routes";
import { getAuthSession } from "@/server/session";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} – ${BRAND.tagline}` },
  description:
    "Digitální dvojče elektrodokumentace výrobního závodu: schémata u stroje přes QR kód, řízené změnové řízení s CAE projekcí, plánovač revizí VTZ a auditní stopa.",
};

const NAV = [
  { href: "#reseni", label: "Řešení" },
  { href: "#jak-to-funguje", label: "Jak to funguje" },
  { href: "#pro-koho", label: "Pro koho" },
  { href: "#kontakt", label: "Kontakt" },
];

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

const anchorButton = "touch-target h-11 px-5 text-sm";

export default async function LandingPage() {
  const signedIn = Boolean(await getAuthSession());
  const clientZone = signedIn ? { href: APP_HOME, label: "Vstoupit do aplikace" } : { href: "/login", label: "Klientská zóna / Přihlášení" };

  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka">
            <Logo />
          </Link>
          <nav aria-label="Sekce stránky" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                {item.label}
              </a>
            ))}
          </nav>
          <Button asChild variant="outline" className="touch-target ml-auto h-9 px-3 text-sm">
            <Link href={clientZone.href}>
              <LogIn data-icon="inline-start" aria-hidden />
              {clientZone.label}
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* HERO */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
              <Building2 className="size-3.5" aria-hidden /> Elektrodokumentace · Revize · Údržba
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              <span className="text-primary">Eldock</span> – Průmyslový dok dokumentace a revizí
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              Konec chaosu v papírových šanonech a neaktuálních výkresech. Propojte údržbu v provozu, CAE projekci a správu revizí do jednoho živého cloudového ekosystému.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className={anchorButton}>
                <a href="#kontakt">
                  Domluvit nezávaznou ukázku <ArrowRight data-icon="inline-end" aria-hidden />
                </a>
              </Button>
              <Button asChild variant="outline" className={anchorButton}>
                <a href="#jak-to-funguje">Jak systém funguje</a>
              </Button>
            </div>
            <dl className="mt-2 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
              {[
                ["3 s", "ke schématu přes QR"],
                ["6 rolí", "v jednom systému"],
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
          <ProductPreview />
        </section>

        {/* PROBLÉM vs. ŘEŠENÍ */}
        <section id="reseni" className="scroll-mt-20 border-y border-border bg-background/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <SectionTitle eyebrow="Proč Eldock" title="Od šanonů a Excelu k živé dokumentaci" />
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
          </div>
        </section>

        {/* PILÍŘE */}
        <section id="jak-to-funguje" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
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
        </section>

        {/* ROLE */}
        <section id="pro-koho" className="scroll-mt-20 border-y border-border bg-background/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <SectionTitle eyebrow="Pro koho" title="Jeden systém pro celý závod" text="Šest rolí v symbióze – každá vidí přesně to, co potřebuje, a všechny pracují nad stejnou platnou dokumentací." />
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
          </div>
        </section>

        {/* KONTAKT */}
        <section id="kontakt" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="grid gap-10 overflow-hidden rounded-3xl border border-primary/40 bg-card/70 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-5">
              <span className="font-mono text-xs tracking-widest text-primary uppercase">Kontakt</span>
              <h2 className="text-3xl font-bold tracking-tight text-balance">Ukážeme vám Eldock přímo ve vašem závodě</h2>
              <p className="text-muted-foreground">
                Domluvte si nezávaznou prezentaci – osobně u vás ve výrobě, nad vaším skutečným rozváděčem, nebo online. Za 45 minut projdeme celou cestu od QR štítku po schválenou revizi.
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
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <Logo withTagline />
            <p className="max-w-sm">{BRAND.description}.</p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
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
            <span>© {new Date().getFullYear()} {BRAND.name}</span>
          </div>
        </div>
      </footer>
    </div>
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
