"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCopy, PackageSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { EnclosureSummary } from "@/lib/panel-builder/enclosure-choice";
import { cn } from "@/lib/utils";

/**
 * Fáze 85: „🗄️ Zvolená rozvodnice a skříň“ v posledním kroku – náhled čela s dvířky i bez nich (DIN lišty
 * a přístroje), technický popis, typové označení, objednací číslo (MPN, u orientační skříně „ověřte“), zkopírování
 * objednacích údajů a odkaz na kusovník.
 */
export function ChosenEnclosureCard({
  projectId,
  summary,
  fallbackModel,
  orderText,
  openSvg,
  doorSvg,
  fixed,
}: {
  projectId: string;
  summary: EnclosureSummary | null;
  /** Skříň zadaná jen názvem (bez výběru z katalogu skříní). */
  fallbackModel: string;
  orderText: string | null;
  openSvg: string;
  doorSvg: string | null;
  fixed: boolean;
}) {
  const [door, setDoor] = useState(false);
  const svg = door && doorSvg ? doorSvg : openSvg;

  async function copy() {
    if (!orderText) return;
    try {
      await navigator.clipboard.writeText(orderText);
      toast.success("Objednací údaje rozvodnice jsou ve schránce.");
    } catch {
      toast.error("Schránka není dostupná – údaje označte a zkopírujte ručně.");
    }
  }

  return (
    <section className="no-print flex flex-col gap-4 rounded-xl border border-border bg-card p-4" aria-label="Zvolená rozvodnice a skříň" data-testid="chosen-enclosure">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">🗄️ Zvolená rozvodnice a skříň</h2>
        {fixed ? (
          <span className="rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-xs text-primary" data-testid="chosen-enclosure-fixed">
            🔒 zvoleno při zakládání projektu
          </span>
        ) : null}
      </div>
      {summary ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <div className="flex gap-1" role="group" aria-label="Náhled skříně">
              {[
                { value: false, label: "Bez dvířek" },
                { value: true, label: "S dvířky" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={door === option.value}
                  onClick={() => setDoor(option.value)}
                  disabled={option.value && !doorSvg}
                  className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", door === option.value ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:border-primary/60")}
                  data-testid={option.value ? "enclosure-door-on" : "enclosure-door-off"}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {/* Vlastní vektorový výkres čela (bez vstupů uživatele) */}
            <div className="rounded-lg bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" data-testid="chosen-enclosure-render" data-door={door ? summary.door : "none"} dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="text-[11px] text-muted-foreground">Náhled čela s DIN lištami a přístroji návrhu; dvířka jsou orientační ({summary.door === "transparent" ? "kouřová průhledná" : "plná"}).</p>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-sm" data-testid="chosen-enclosure-description">
              <b>Technický popis:</b> {summary.description}
            </p>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Výrobce · řada</dt>
              <dd>
                {summary.manufacturer} · {summary.series}
              </dd>
              <dt className="text-muted-foreground">Typové označení</dt>
              <dd className="font-semibold" data-testid="chosen-enclosure-type">
                {summary.typeDesignation}
              </dd>
              <dt className="text-muted-foreground">Objednací číslo (MPN)</dt>
              <dd data-testid="chosen-enclosure-mpn">
                {summary.mpn ? (
                  <span className="font-mono font-bold">{summary.mpn}</span>
                ) : (
                  <span className="rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-200">ověřte v katalogu výrobce (orientační typ)</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Rozložení</dt>
              <dd>{summary.layout}</dd>
              <dt className="text-muted-foreground">Rozměry</dt>
              <dd>{summary.dimensions}</dd>
              <dt className="text-muted-foreground">Provedení</dt>
              <dd>{summary.execution}</dd>
            </dl>
            <p className="text-xs text-muted-foreground" data-testid="chosen-enclosure-source">
              {summary.source}
              {summary.sourceUrl ? (
                <>
                  {" "}
                  <a href={summary.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground" data-testid="chosen-enclosure-source-link">
                    Stránka výrobce ↗
                  </a>
                </>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="gap-1.5" onClick={() => void copy()} disabled={!orderText} data-testid="copy-enclosure-order">
                <ClipboardCopy className="size-4" aria-hidden /> [ 📋 Zkopírovat objednací údaje rozvodnice ]
              </Button>
              <Button asChild variant="outline" className="gap-1.5">
                <a href="#list-4" data-testid="enclosure-bom-link">
                  <PackageSearch className="size-4" aria-hidden /> Kusovník (List 4)
                </a>
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/panel-builder/${projectId}/enclosure`}>Změnit skříň (krok 3)</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground" data-testid="chosen-enclosure-empty">
            {fallbackModel ? (
              <>
                Skříň <b className="text-foreground">{fallbackModel}</b> je zadaná jen názvem – pro objednací číslo a náhled ji vyberte z katalogu skříní.
              </>
            ) : (
              "Skříň zatím není vybraná z katalogu – vyberte ji podle velikosti návrhu."
            )}
          </p>
          <Button asChild variant="outline">
            <Link href={`/panel-builder/${projectId}/enclosure`}>🗄️ Vybrat skříň (krok 3)</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
