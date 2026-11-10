import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs, SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";
import { CopyInviteButton } from "@/components/tutorials/CopyInviteButton";
import { TutorialPlayer } from "@/components/tutorials/TutorialPlayer";
import { Button } from "@/components/ui/button";
import { APP_HOME } from "@/lib/routes";
import { OG_IMAGE, SITE_URL, absoluteUrl, jsonLdScript } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/site-map";
import { TUTORIALS, chapterText, formatClock, formatMegabytes, posterOf } from "@/lib/tutorials";
import { TUTORIAL_GENERATED_AT, TUTORIAL_MEDIA } from "@/lib/tutorials.generated";
import { hasShowcaseProject } from "@/server/queries/panel-builder";
import { getAuthSession } from "@/server/session";

const TITLE = "🎬 Video-návody ELDOCK: Od půdorysu po hotový rozváděč za pár minut";
const SEO_TITLE = "Video-návody ELDOCK – 2D půdorys, kabeláž a AI Panel Builder s českým komentářem";
const DESCRIPTION =
  "Dva krátké video-návody s českým komentářem pro elektrikáře: 2D půdorys s trasami kabelů a kusovníkem a AI Panel Builder – rozváděč z fotky nebo od nuly s oteplením, štítkem CE a 6listovým elaborátem.";

/** Náhled odkazu (WhatsApp, Messenger, e-mail): snímek z videa 1, obecný obrázek webu jako záloha. */
const PREVIEW = { url: posterOf(TUTORIALS[0].file), width: 1280, height: 720, alt: "Video-návod ELDOCK – 2D půdorys a kabeláž" };

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/navody` },
  openGraph: { type: "website", locale: "cs_CZ", siteName: "ELDOCK", url: `${SITE_URL}/navody`, title: SEO_TITLE, description: DESCRIPTION, images: [PREVIEW, OG_IMAGE] },
  twitter: { card: "summary_large_image", title: SEO_TITLE, description: DESCRIPTION, images: [PREVIEW.url] },
};

/** ISO 8601 délka videa pro vyhledávače (PT1M52S). */
const isoDuration = (seconds: number) => `PT${Math.floor(seconds / 60)}M${Math.round(seconds % 60)}S`;

/** Strukturovaná data videí (schema.org VideoObject) – jen pro vygenerovaná videa. */
function videosJsonLd() {
  return TUTORIALS.flatMap((tutorial) => {
    const media = TUTORIAL_MEDIA[tutorial.id];
    if (!media) return [];
    return [
      {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: `ELDOCK – ${tutorial.title}`,
        description: tutorial.description,
        inLanguage: "cs",
        thumbnailUrl: absoluteUrl(posterOf(tutorial.file)),
        contentUrl: absoluteUrl(tutorial.file),
        uploadDate: TUTORIAL_GENERATED_AT,
        duration: isoDuration(media.durationSec),
      },
    ];
  });
}

// Fáze 87: veřejná stránka s video-návody pro testery – odkaz, který elektrikář pošle kolegovi.
export default async function TutorialsPage() {
  const [session, showcase] = await Promise.all([getAuthSession(), hasShowcaseProject()]);
  const clientZone = session ? { href: APP_HOME, label: "Vstoupit do aplikace" } : { href: "/login", label: "Klientská zóna / Přihlášení" };
  const crumbs = [
    { href: "/", label: "Úvod" },
    { href: "/navody", label: "Video-návody" },
  ];

  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript([breadcrumbJsonLd(crumbs), ...videosJsonLd()]) }} />
      <SiteHeader clientZone={clientZone} showcase={showcase} current="/navody" />
      <Breadcrumbs items={crumbs} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 pt-8 pb-16 sm:px-6">
        <section className="flex flex-col gap-4" aria-labelledby="navody-title">
          <h1 id="navody-title" className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {TITLE}
          </h1>
          <p className="max-w-3xl text-lg text-pretty text-muted-foreground">
            Dvě krátká videa s českým komentářem ukážou celý postup na skutečné aplikaci – od nákresu místností a tras kabelů po rozváděč s výpočtem oteplení, štítkem CE a kompletní výrobní dokumentací. Kapitolu pustíte kliknutím pod videem, video si můžete stáhnout a poslat dál.
          </p>
          <CopyInviteButton url={absoluteUrl("/navody")} />
        </section>

        {TUTORIALS.map((tutorial, index) => {
          const media = TUTORIAL_MEDIA[tutorial.id];
          return (
            <section key={tutorial.id} id={tutorial.id} className="flex scroll-mt-20 flex-col gap-4" aria-labelledby={`navod-${tutorial.id}`} data-testid={`tutorial-section-${tutorial.id}`}>
              <div className="flex flex-col gap-1">
                <h2 id={`navod-${tutorial.id}`} className="text-2xl font-bold tracking-tight">
                  Video {index + 1}: {tutorial.heading}
                </h2>
                <p className="text-muted-foreground">
                  {tutorial.description}
                  {media ? <span className="font-mono text-xs"> · {formatClock(media.durationSec)} · Full HD · český komentář</span> : null}
                </p>
              </div>
              <TutorialPlayer tutorial={tutorial} media={media} />
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline" className="touch-target h-auto min-h-11 gap-2 px-5 py-2 whitespace-normal">
                  <a href={tutorial.file} download data-testid={`tutorial-download-${tutorial.id}`}>
                    ⬇️ Stáhnout video MP4 (pro WhatsApp){media ? ` · ${formatMegabytes(media.sizeBytes)}` : ""}
                  </a>
                </Button>
                <Button asChild className="touch-target h-auto min-h-11 gap-2 px-5 py-2 whitespace-normal">
                  <Link href={tutorial.tryHref} data-testid={`tutorial-try-${tutorial.id}`}>
                    {tutorial.tryLabel}
                  </Link>
                </Button>
              </div>
              <details className="rounded-xl border border-border bg-card/60 p-4 text-sm">
                <summary className="cursor-pointer font-semibold">Přepis komentáře</summary>
                <ol className="mt-3 flex flex-col gap-3">
                  {tutorial.chapters.map((chapter, chapterIndex) => (
                    <li key={chapter.id}>
                      <p className="font-semibold">
                        {chapterIndex + 1}. {chapter.title}
                        {media ? <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{formatClock(media.chapters[chapterIndex] ?? 0)}</span> : null}
                      </p>
                      <p className="text-muted-foreground">{chapterText(chapter)}</p>
                    </li>
                  ))}
                </ol>
              </details>
            </section>
          );
        })}
      </main>

      <SiteFooter clientZone={clientZone} showcase={showcase} />
    </div>
  );
}
