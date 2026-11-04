import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Rocket } from "lucide-react";

import { Logo } from "@/components/layout/Logo";
import { DocumentationSheets } from "@/components/panel-builder/documentation/DocumentationSheets";
import { PrintButton } from "@/components/landing/PrintButton";
import { Button } from "@/components/ui/button";
import { DOCUMENT_SHEETS } from "@/lib/panel-builder/documentation";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";
import { buildDocumentationData } from "@/server/panel-documentation";
import { getShowcaseProject } from "@/server/queries/panel-builder";
import { requestOrigin } from "@/server/request-url";

const TITLE = "Vzorový 6listový elaborát rozváděče – AI Panel Builder";
const DESCRIPTION = "Ukázka výstupu ELDOCK AI Panel Builderu bez registrace: titulní list, 2D osazení, 1P schéma, kusovník, výpočet oteplení dle ČSN EN IEC 61439 a EU prohlášení o shodě se štítkem CE.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · ELDOCK` },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/ukazka-elaboratu` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/ukazka-elaboratu`, images: [OG_IMAGE] },
};

const PRINT_CSS = `
  @page { size: A4 portrait; margin: 8mm; }
  @media print {
    html, body { background: #fff !important; }
    .no-print { display: none !important; }
    .doc-sheets { display: block !important; gap: 0 !important; }
    .doc-sheet { max-width: none !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .doc-sheet:last-child { break-after: auto; }
  }
`;

// Veřejná ukázka výstupu AI Panel Builderu (fáze 48): vzorový projekt PB-001 jako 6 listů A4, bez přihlášení.
// `?embed=1` = bez hlavičky (náhled v modálním okně na úvodní stránce).
export default async function SampleElaboratePage({ searchParams }: PageProps<"/ukazka-elaboratu">) {
  const embed = (await searchParams).embed === "1";
  const [project, origin] = await Promise.all([getShowcaseProject(), requestOrigin()]);
  if (!project) notFound();
  const { data } = await buildDocumentationData(project, origin, { showcase: true });

  return (
    <div className="flex flex-1 flex-col bg-zinc-900">
      <style>{PRINT_CSS}</style>
      {embed ? null : (
        <header className="no-print sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex min-h-16 w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
            <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka">
              <Logo />
            </Link>
            <div className="ml-auto flex flex-wrap gap-2">
              <PrintButton />
              <Button asChild className="touch-target gap-1.5">
                <Link href="/panel-builder/auth">
                  <Rocket className="size-4" aria-hidden /> Vyzkoušet AI Panel Builder
                </Link>
              </Button>
            </div>
          </div>
        </header>
      )}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-2 py-6 sm:px-6">
        <div className="no-print space-y-2 px-2 text-zinc-200">
          <h1 className={embed ? "text-lg font-bold" : "text-2xl font-bold tracking-tight"}>📄 {TITLE}</h1>
          <p className="max-w-3xl text-sm text-zinc-400">
            Takto vypadá výstup z kroku 4 pro vzorový rozváděč <b className="text-zinc-200">{project.code}</b>. Každý projekt dostane stejných 6 listů s údaji vaší firmy v razítku:
          </p>
          <ol className="flex flex-wrap gap-1.5 text-xs" aria-label="Listy elaborátu">
            {DOCUMENT_SHEETS.map((sheet, index) => (
              <li key={sheet}>
                <a href={`#list-${index + 1}`} className="block rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-300 hover:border-primary hover:text-zinc-100">
                  {index + 1}. {sheet}
                </a>
              </li>
            ))}
          </ol>
        </div>
        <DocumentationSheets data={data} />
      </main>
    </div>
  );
}
