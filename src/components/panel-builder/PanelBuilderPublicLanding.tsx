import Link from "next/link";
import { BookOpenCheck, Camera, ClipboardCheck, FileText, Gauge, Library, ListTree, PencilRuler, Thermometer, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SEO_LANDINGS } from "@/lib/seo-landings";

const FEATURES = [
  { icon: Camera, title: "Rozváděč z fotky", text: "AI Vision rozpozná jističe, chrániče a další modulární přístroje i s typovým označením a sestaví DIN lišty." },
  { icon: PencilRuler, title: "Návrh od nuly a z půdorysu", text: "Přístroje z katalogu výrobců, soupis místností nebo 2D půdorys elektroinstalace s výkazem kabelů." },
  { icon: ListTree, title: "Strom zapojení a fáze", text: "Hlavní vypínač, chrániče a jističe ve stromu, vyvážení L1 / L2 / L3, PE a N svorky automaticky." },
  { icon: ClipboardCheck, title: "Elektro-linter ČSN 33 2130 ed. 4", text: "Kontrola chráničů, jištění, průřezů a počtu zásuvek na okruh s opravou jedním klikem." },
  { icon: Thermometer, title: "Výpočet oteplení IEC TR 60890", text: "Ztrátové výkony z katalogu výrobců, chladicí plocha skříně a teplota uvnitř rozváděče." },
  { icon: FileText, title: "Dokumentace dle ČSN EN IEC 61439", text: "6 listů PDF: výkres osazení, 1P schéma, kusovník, oteplení, kusová zkouška, prohlášení o shodě a štítek CE." },
] as const;

const STEPS = ["Rozpoznání nebo návrh přístrojů", "Strom zapojení", "Skříň a krytí", "Oteplení", "Dokumentace a štítek CE"];

/**
 * Fáze 96: veřejná vstupní stránka AI Panel Builderu (bez přihlášené firmy, 200 i pro roboty vyhledávačů) – ukázka,
 * trenažér a katalog; přihlášení vyžaduje až uložení vlastního projektu do cloudu a tisk s razítkem firmy.
 */
export function PanelBuilderPublicLanding() {
  return (
    <div className="flex flex-col gap-12 py-4" data-testid="panel-builder-public">
      <section className="flex flex-col gap-5">
        <span className="font-mono text-xs tracking-widest text-primary uppercase">ELDOCK AI Panel Builder</span>
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">AI Panel Builder – návrh rozváděče online z fotky i od nuly</h1>
        <p className="max-w-3xl text-lg text-pretty text-muted-foreground">
          Pasportizace stávajícího rozváděče z fotky, návrh nového podle ČSN 33 2130 ed. 4, výpočet oteplení a kompletní výrobní dokumentace dle ČSN EN IEC 61439 – v prohlížeči, bez instalace. Vyzkoušejte si ukázku, trenažér a katalog přístrojů; přihlášení firmy potřebujete až pro uložení vlastního projektu a tisk s razítkem.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="touch-target gap-2" data-testid="panel-builder-public-register">
            <Link href="/panel-builder/auth">
              <Zap className="size-4" aria-hidden /> ⚡ Vyzkoušet AI Panel Builder zdarma
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="touch-target gap-2">
            <Link href="/ukazka-elaboratu">
              <BookOpenCheck className="size-4" aria-hidden /> Ukázka 6listového elaborátu
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="touch-target gap-2">
            <Link href="/panel-builder/auth?next=%2Fpanel-builder%2Ffloorplan%2Ftrenazer">
              <Gauge className="size-4" aria-hidden /> 🎯 Trenažér 2D půdorysu (45 s)
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="touch-target gap-2">
            <Link href="/panel-builder/catalog">
              <Library className="size-4" aria-hidden /> Katalog přístrojů
            </Link>
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-6" aria-labelledby="pb-features">
        <h2 id="pb-features" className="text-3xl font-bold tracking-tight">
          Co AI Panel Builder umí
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
              <Icon className="size-6 text-primary" aria-hidden />
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="pb-steps">
        <h2 id="pb-steps" className="text-3xl font-bold tracking-tight">
          Pět kroků od fotky k dokumentaci
        </h2>
        <ol className="grid gap-3 md:grid-cols-5">
          {STEPS.map((step, index) => (
            <li key={step} className="rounded-xl border border-border bg-card/60 p-4">
              <span className="font-mono text-2xl font-bold text-primary">{index + 1}</span>
              <h3 className="mt-1 font-semibold">{step}</h3>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="pb-guides">
        <h2 id="pb-guides" className="text-3xl font-bold tracking-tight">
          Návody a nástroje
        </h2>
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {SEO_LANDINGS.map((landing) => (
            <li key={landing.id}>
              <Link href={landing.path} className="block h-full rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/60">
                <span className="font-semibold">{landing.h1}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{landing.lead.slice(0, 150)}…</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
