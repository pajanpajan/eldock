import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { NewsletterSection } from "@/components/landing/LandingSections";
import { SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { OG_IMAGE, SEO_DESCRIPTION, SEO_KEYWORDS, SEO_TITLE, SITE_URL } from "@/lib/seo";
import { APP_HOME } from "@/lib/routes";
import { GATEWAY, type GatewaySection } from "@/lib/site-sections";
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

// Fáze 111: úvodní stránka = čistý dvoustranný rozcestník (Split-Screen Gateway). Vlevo Domovní instalace & Rozváděče,
// vpravo Průmysl, Budovy & Hlídač revizí – podrobné náhledy a popisy modulů jsou až v podsekcích /sekce/….
export default async function LandingPage() {
  const [session, showcase] = await Promise.all([getAuthSession(), hasShowcaseProject()]);
  const clientZone = session ? { href: APP_HOME, label: "Vstoupit do aplikace" } : { href: "/login", label: "Klientská zóna / Přihlášení" };

  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      <SiteHeader clientZone={clientZone} showcase={showcase} current="/" />

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-7xl flex-col justify-center gap-6 px-4 py-8 sm:px-6" aria-labelledby="gateway-title" data-testid="gateway">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 id="gateway-title" className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              <span className="text-primary">Eldock</span> – elektrodokumentace od rodinného domu po výrobní závod
            </h1>
            <p className="text-muted-foreground">Vyberte svou oblast – vše ostatní najdete uvnitř sekce.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2" data-testid="gateway-cards">
            <GatewayCard section={GATEWAY.elektroinstalace} accent="primary" />
            <GatewayCard section={GATEWAY["prumysl-a-revize"]} accent="cyan" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Nevíte, kde začít?{" "}
            <Link href="/kontakt" className="font-semibold text-primary underline-offset-4 hover:underline">
              Domluvte si nezávaznou ukázku
            </Link>{" "}
            · <Link href="/hlidac-revizi" className="font-semibold text-primary underline-offset-4 hover:underline">🛡️ Hlídač revizí</Link>
          </p>
        </section>

        <NewsletterSection source="homepage" />
      </main>

      <SiteFooter clientZone={clientZone} showcase={showcase} />
    </div>
  );
}

/** Polovina rozcestníku – celá karta vede do podsekce (detail až po rozkliknutí). */
function GatewayCard({ section, accent }: { section: GatewaySection; accent: "primary" | "cyan" }) {
  return (
    <Link
      href={section.path}
      className={cn(
        "group flex flex-col gap-4 rounded-3xl border-2 p-6 shadow-xl transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-8",
        accent === "primary" ? "border-primary/60 bg-gradient-to-br from-primary/15 via-card to-card hover:border-primary" : "border-cyan-400/50 bg-gradient-to-br from-cyan-500/10 via-card to-card hover:border-cyan-300",
      )}
      data-testid={`gateway-${section.side}`}
    >
      <span className="text-4xl leading-none" aria-hidden>
        {section.icon}
      </span>
      <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{section.title}</h2>
      <p className="text-sm">
        <b>Pro koho:</b> <span className="text-muted-foreground">{section.who}</span>
      </p>
      <ol className="flex flex-col gap-3 text-sm">
        {section.points.map((point, index) => (
          <li key={point.title} className="flex gap-3">
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold", accent === "primary" ? "bg-primary text-primary-foreground" : "bg-cyan-400 text-slate-950")}>{index + 1}</span>
            <span>
              <b>{point.title}</b> – <span className="text-muted-foreground">{point.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <span
        className={cn(
          "mt-auto inline-flex min-h-12 w-fit items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-transform group-hover:translate-x-0.5",
          accent === "primary" ? "bg-primary text-primary-foreground" : "bg-cyan-400 text-slate-950",
        )}
        data-testid={`gateway-cta-${section.side}`}
      >
        [ {section.cta.replace(/ →$/, "")} <ArrowRight className="size-4" aria-hidden /> ]
      </span>
    </Link>
  );
}
