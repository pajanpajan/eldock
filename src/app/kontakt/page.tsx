import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MonitorPlay, Users } from "lucide-react";

import { ContactForm } from "@/components/contact/ContactFeedbackModal";
import { Breadcrumbs, SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { COMPANY_INFO } from "@/lib/company";
import { CONTACT_CATEGORIES, MEETING_FORMS, PARTNER_TYPES, type ContactCategory } from "@/lib/contact";
import { APP_HOME } from "@/lib/routes";
import { OG_IMAGE, SITE_URL, jsonLdScript } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/site-map";
import { hasShowcaseProject } from "@/server/queries/panel-builder";
import { getAuthSession } from "@/server/session";

const SEO_TITLE = "Kontakt & Spolupráce – nahlášení chyby, ukázka, schůzka a partnerství | ELDOCK";
const DESCRIPTION =
  "Nahlaste chybu i s printscreenem, pošlete tip nebo chybějící přístroj, domluvte si osobní schůzku nebo 20minutovou online ukázku ELDOCKu, staňte se partnerem (výrobce rozváděčů, projektant, revizní technik) nebo poptejte QR štítky.";

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/kontakt` },
  openGraph: { type: "website", locale: "cs_CZ", siteName: "ELDOCK", url: `${SITE_URL}/kontakt`, title: SEO_TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
};

const isCategory = (value: unknown): value is ContactCategory => typeof value === "string" && CONTACT_CATEGORIES.some((category) => category.id === value);

// Fáze 107: veřejná stránka kontaktu – formulář se 7 kategoriemi naplno (Ctrl + V kdekoli na stránce) a přímé kontakty.
export default async function ContactPage({ searchParams }: PageProps<"/kontakt">) {
  const [session, showcase, params] = await Promise.all([getAuthSession(), hasShowcaseProject(), searchParams]);
  const clientZone = session ? { href: APP_HOME, label: "Vstoupit do aplikace" } : { href: "/login", label: "Klientská zóna / Přihlášení" };
  const requested = Array.isArray(params.kategorie) ? params.kategorie[0] : params.kategorie;
  const initialCategory = isCategory(requested?.toUpperCase()) ? (requested!.toUpperCase() as ContactCategory) : "MEETING";
  const crumbs = [
    { href: "/", label: "Úvod" },
    { href: "/kontakt", label: "Kontakt & Spolupráce" },
  ];
  const contactPage = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Kontakt & Spolupráce",
    url: `${SITE_URL}/kontakt`,
    mainEntity: { "@type": "Organization", name: "ELDOCK", url: SITE_URL, email: COMPANY_INFO.email, contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: COMPANY_INFO.email, availableLanguage: ["cs"], areaServed: "CZ" }] },
  };

  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript([breadcrumbJsonLd(crumbs), contactPage]) }} />
      <SiteHeader clientZone={clientZone} showcase={showcase} current="/kontakt" />
      <Breadcrumbs items={crumbs} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pt-8 pb-16 sm:px-6">
        <section className="flex flex-col gap-3" aria-labelledby="kontakt-title">
          <h1 id="kontakt-title" className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            💬 Kontakt & Spolupráce
          </h1>
          <p className="max-w-3xl text-lg text-pretty text-muted-foreground">
            Nahlaste chybu, pošlete tip na zlepšení, domluvte si osobní schůzku nebo online ukázku, nebo se staňte partnerem ELDOCKu. Formulář vyplníte do 20 vteřin – printscreen vložíte kdekoli na stránce přes{" "}
            <kbd className="rounded border border-border px-1 text-sm">Ctrl</kbd> + <kbd className="rounded border border-border px-1 text-sm">V</kbd>.
          </p>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-2xl border border-border bg-card/80 p-4 sm:p-6" aria-label="Kontaktní formulář" data-testid="kontakt-form-card">
            <ContactForm key={initialCategory} variant="page" initialCategory={initialCategory} />
          </section>

          <aside className="flex flex-col gap-4" data-testid="kontakt-details">
            <section className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card/80 p-5">
              <p className="font-mono text-xs tracking-widest text-primary uppercase">Přímý kontakt</p>
              <p className="text-lg font-bold" data-testid="kontakt-person">
                {COMPANY_INFO.contactPerson} · ELDOCK.cz
              </p>
              <p className="text-sm text-muted-foreground">Možnost osobní schůzky i online ukázky.</p>
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="size-4 text-primary" aria-hidden />
                  <a href={`mailto:${COMPANY_INFO.email}`} className="hover:text-primary">
                    {COMPANY_INFO.email}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" aria-hidden /> {COMPANY_INFO.location}
                </li>
                <li className="flex items-center gap-2">
                  <Users className="size-4 text-primary" aria-hidden /> Osobně: Liberec · Jablonec nad Nisou · Praha · u vás ve firmě
                </li>
                <li className="flex items-center gap-2">
                  <MonitorPlay className="size-4 text-primary" aria-hidden /> Online: Google Meet / Microsoft Teams – 20 min
                </li>
              </ul>
            </section>
            <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-5 text-sm">
              <p className="font-semibold">📅 Schůzka nebo ukázka</p>
              <ul className="flex flex-col gap-1 text-muted-foreground">
                {MEETING_FORMS.map((form) => (
                  <li key={form.id}>{form.label}</li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-5 text-sm">
              <p className="font-semibold">🤝 Hledáme partnery</p>
              <ul className="flex flex-col gap-1 text-muted-foreground">
                {PARTNER_TYPES.map((type) => (
                  <li key={type.id}>{type.label}</li>
                ))}
              </ul>
              <Link href="/kontakt?kategorie=PARTNER" className="font-semibold text-primary hover:underline">
                Chci spolupracovat →
              </Link>
            </section>
          </aside>
        </div>
      </main>

      <SiteFooter clientZone={clientZone} showcase={showcase} />
    </div>
  );
}
