import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Factory, HardHat, Home, LayoutDashboard, Mail, MapPin, MonitorPlay, QrCode, UserRound, Wrench, Zap, type LucideIcon } from "lucide-react";

import { NewsletterSignup } from "@/components/landing/NewsletterSignup";
import { Button } from "@/components/ui/button";
import { COMPANY_INFO } from "@/lib/company";
import { TRUST_POINTS, type Audience, type AudienceId } from "@/lib/landing-audiences";
import { SEGMENTS } from "@/lib/site-map";
import { cn } from "@/lib/utils";

// Fáze 58: sekce sdílené úvodní stránkou a oběma částmi webu (domovní elektroinstalace / průmysl).

/** Fáze 54: tlačítka se na úzkém displeji zalamují místo přetékání karty. */
export const anchorButton = "touch-target h-auto min-h-11 shrink whitespace-normal px-5 py-2 text-left text-sm";

export const AUDIENCE_ICON: Record<AudienceId, LucideIcon> = { elektrikar: Zap, "revizni-technik": HardHat, "technicky-reditel": LayoutDashboard, udrzba: Wrench };

/** Sekce jedné cílové skupiny: bolest → co Eldock dělá → co dostanete → tlačítka (+ volitelně produktová karta). */
export function AudienceSection({ audience, tone, children }: { audience: Audience; tone: "plain" | "band"; children?: React.ReactNode }) {
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

export function SectionTitle({ eyebrow, title, text, id }: { eyebrow: string; title: string; text?: string; id?: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <span className="font-mono text-xs tracking-widest text-primary uppercase">{eyebrow}</span>
      <h2 id={id} className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {text ? <p className="text-muted-foreground">{text}</p> : null}
    </div>
  );
}

/** Normy a data – důvěra pro všechny skupiny. */
export function TrustPoints() {
  return (
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
  );
}

/** Novinky – měsíční newsletter. */
export function NewsletterSection({ source }: { source: string }) {
  return (
    <section id="novinky" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6">
      <div className="grid gap-8 rounded-3xl border border-border bg-card/60 p-8 sm:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-xs tracking-widest text-primary uppercase">Novinky</span>
          <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">Jednou měsíčně, k věci</h2>
          <p className="text-muted-foreground">Změny norem a předpisů, nové funkce Eldocku a praktické tipy pro návrh, revize a údržbu. Žádný spam, odhlášení jedním kliknutím.</p>
        </div>
        <NewsletterSignup source={source} />
      </div>
    </section>
  );
}

/** Kontakt – nezávazná ukázka (text podle části webu). */
export function ContactSection({ title, text }: { title: string; text: string }) {
  return (
    <section id="kontakt" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="grid gap-10 overflow-hidden rounded-3xl border border-primary/40 bg-card/70 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-5">
          <span className="font-mono text-xs tracking-widest text-primary uppercase">Kontakt</span>
          <h2 className="text-3xl font-bold tracking-tight text-balance">{title}</h2>
          <p className="text-muted-foreground">{text}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className={anchorButton}>
              <a href={`mailto:${COMPANY_INFO.email}?subject=${encodeURIComponent("Ukázka systému Eldock")}`}>
                <Mail data-icon="inline-start" aria-hidden /> Domluvit ukázku e-mailem
              </a>
            </Button>
            {/* Fáze 107: formulář schůzky / online ukázky se 7 kategoriemi */}
            <Button asChild variant="outline" className={anchorButton}>
              <Link href="/kontakt?kategorie=MEETING" data-testid="landing-contact-meeting">
                📅 Sjednat schůzku / online ukázku
              </Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" aria-hidden /> Prezentace u vás
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
          <ContactRow
            icon={Mail}
            label="E-mail"
            value={
              <a href={`mailto:${COMPANY_INFO.email}`} className="text-primary hover:underline">
                {COMPANY_INFO.email}
              </a>
            }
          />
          <ContactRow icon={MapPin} label="Sídlo" value={COMPANY_INFO.location} />
        </dl>
      </div>
    </section>
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

/** Odkaz do druhé části webu. */
export function CrossLink({ to }: { to: "domov" | "prumysl" }) {
  const target = SEGMENTS[to];
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6" aria-label={`Přejít na ${target.title}`}>
      <Link href={target.path} className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-6 transition-colors hover:border-primary/60 sm:flex-row sm:items-center sm:justify-between" data-testid={`cross-link-${to}`}>
        <span className="flex items-center gap-3">
          {to === "prumysl" ? <Factory className="size-6 text-primary" aria-hidden /> : <Home className="size-6 text-primary" aria-hidden />}
          <span>
            <span className="block font-semibold">{to === "prumysl" ? "Pracujete ve výrobním závodě?" : "Navrhujete domovní elektroinstalace?"}</span>
            <span className="text-sm text-muted-foreground">{target.promise}</span>
          </span>
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-primary">
          {target.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    </section>
  );
}
