import type { Metadata } from "next";
import Link from "next/link";
import { CircuitBoard, Library } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { Button } from "@/components/ui/button";
import { PROJECT_STATUS, RECOGNITION } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import { getPanelProjects } from "@/server/queries/panel-builder";

export const metadata: Metadata = { title: "AI Panel Builder" };

// AI Panel Builder: projekty rozváděčů (pasportizace z fotky → strom → oteplení → dokumentace).
export default async function PanelBuilderPage() {
  const guard = await panelBuilderGuard("AI Panel Builder");
  if (guard) return guard;
  const projects = await getPanelProjects();

  return (
    <PageTransition>
      <PageHeader
        title="AI Panel Builder"
        description="Pasportizace a projekce rozváděčů z fotky: rozpoznání přístrojů, strom zapojení, výpočet oteplení dle ČSN EN 61439 a kompletní dokumentace s CE štítkem."
        actions={
          <Button asChild variant="outline" className="touch-target gap-2">
            <Link href="/panel-builder/catalog">
              <Library className="size-4" aria-hidden /> Katalog prvků
            </Link>
          </Button>
        }
      />
      {projects.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const counts = { VERIFIED: 0, PARTIAL: 0, UNRECOGNIZED: 0 };
            for (const item of project.items) counts[item.recognitionStatus]++;
            const status = PROJECT_STATUS[project.status];
            return (
              <li key={project.id}>
                <Link
                  href={`/panel-builder/${project.id}`}
                  className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-primary">{project.code}</p>
                      <h2 className="font-semibold text-balance">{project.name}</h2>
                      {project.customerName ? <p className="text-sm text-muted-foreground">{project.customerName}</p> : null}
                    </div>
                    <CircuitBoard className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                  <span className={cn("w-fit rounded-full border px-2 py-0.5 text-xs", status.badge)}>{status.label}</span>
                  <p className="mt-auto flex flex-wrap gap-3 text-xs">
                    <span>{project.items.length} přístrojů</span>
                    {(["VERIFIED", "PARTIAL", "UNRECOGNIZED"] as const).map((key) =>
                      counts[key] ? (
                        <span key={key} className={RECOGNITION[key].text}>
                          {counts[key]} × {RECOGNITION[key].label.toLowerCase()}
                        </span>
                      ) : null,
                    )}
                  </p>
                  {project.equipment ? <p className="text-xs text-muted-foreground">Karta zařízení: {project.equipment.name}</p> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={CircuitBoard} title="Zatím žádný projekt rozváděče" description="Založte projekt z fotky otevřeného rozváděče." />
      )}
    </PageTransition>
  );
}
