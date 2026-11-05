import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ConsentSettingsLink } from "@/components/consent/ConsentManager";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import type { LegalSection } from "@/lib/legal";

/** Fáze 54: společný vzhled veřejných právních stránek (zásady zpracování osobních údajů, obchodní podmínky). */
export function LegalPage({ title, version, intro, sections }: { title: string; version: string; intro?: string; sections: LegalSection[] }) {
  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka">
            <Logo />
          </Link>
          <Button asChild variant="outline" className="touch-target ml-auto h-9 px-3 text-sm">
            <Link href="/">
              <ArrowLeft data-icon="inline-start" aria-hidden /> Úvodní stránka
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-balance">{title}</h1>
          <p className="font-mono text-xs text-muted-foreground">Verze {version}</p>
          {intro ? <p className="text-muted-foreground">{intro}</p> : null}
        </div>
        {sections.map((section) => (
          <section key={section.title} id={section.id} className="scroll-mt-20 space-y-2">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
            {section.list ? (
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        <p className="border-t border-border pt-4 text-sm text-muted-foreground">
          <ConsentSettingsLink className="text-primary underline-offset-2 hover:underline" />
        </p>
      </main>
    </div>
  );
}
