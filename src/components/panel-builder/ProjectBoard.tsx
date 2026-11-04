"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, CircuitBoard, Loader2, MapPin, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_FILTERS, filterProjects, isSampleProject, refundsCredit, type StatusFilter } from "@/lib/panel-builder/project-admin";
import { PROJECT_STATUS, RECOGNITION } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import { deletePanelProjectsAction } from "@/server/actions/panel-projects";

import { DeleteProjectButton, EditProjectButton, deletedMessage, type AdminProject } from "./ProjectAdmin";

export interface BoardProject extends AdminProject {
  items: number;
  recognition: { VERIFIED: number; PARTIAL: number; UNRECOGNIZED: number };
  equipmentName: string | null;
}

/** Přehled projektů (fáze 48): hledání, filtr stavu, hromadný výběr se smazáním, úpravy na kartě. */
export function ProjectBoard({ projects }: { projects: BoardProject[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const visible = filterProjects(projects, query, status);
  // Výběr jen z existujících projektů (po smazání / refreshi)
  const chosen = projects.filter((project) => selected.has(project.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function removeSelected() {
    const refunds = chosen.filter(refundsCredit).length;
    if (!window.confirm(`Opravdu chcete trvale smazat ${chosen.length} vybraných projektů? Smažou se všechny prvky i nahrané fotky.${refunds ? ` Firmě se vrátí ${refunds} kr.` : ""}`)) return;
    startTransition(async () => {
      const result = await deletePanelProjectsAction(chosen.map((project) => project.id), true);
      if (!result.ok) return void toast.error(result.error);
      toast.success(deletedMessage(result.data));
      setSelected(new Set());
      setSelecting(false);
      router.refresh();
    });
  }

  if (!projects.length) return <EmptyState icon={CircuitBoard} title="Zatím žádný projekt rozváděče" description="Založte návrh od nuly, ze soupisu místností nebo z fotky otevřeného rozváděče." />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Hledání projektů">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="🔍 Hledat projekt podle kódu, názvu nebo zákazníka..." aria-label="Hledat projekt" className="h-10 pl-9" />
        </div>
        <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Stav projektu">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={status === option.value}
              onClick={() => setStatus(option.value)}
              className={cn("rounded-md px-3 py-1.5 text-sm", status === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant={selecting ? "default" : "outline"}
          className="h-10 gap-1.5"
          aria-pressed={selecting}
          onClick={() => {
            setSelecting(!selecting);
            setSelected(new Set());
          }}
        >
          <CheckSquare className="size-4" aria-hidden /> ☑️ Hromadný výběr
        </Button>
      </div>

      {visible.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="project-list">
          {visible.map((project) => {
            const statusInfo = PROJECT_STATUS[project.status];
            const sample = isSampleProject(project);
            const checked = selected.has(project.id);
            return (
              <li key={project.id} className="relative" data-testid={`project-${project.code}`}>
                {selecting ? (
                  <label className={cn("absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-md bg-background/90 px-1.5 py-1 text-xs", sample && "opacity-60")} title={sample ? "Vzorový projekt je chráněný před hromadným smazáním" : undefined}>
                    <input type="checkbox" className="size-4 accent-primary" checked={checked} disabled={sample} onChange={() => toggle(project.id)} aria-label={`Vybrat projekt ${project.code}`} />
                  </label>
                ) : null}
                <Link
                  href={`/panel-builder/${project.id}`}
                  onClick={(event) => {
                    if (!selecting) return;
                    event.preventDefault();
                    if (!sample) toggle(project.id);
                  }}
                  className={cn(
                    "flex h-full flex-col gap-3 rounded-xl border bg-card p-5 transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                    checked ? "border-red-500/70 ring-2 ring-red-500/30" : "border-border",
                    selecting && "pl-11",
                  )}
                >
                  <div className="min-w-0 pr-24">
                    <p className="font-mono text-xs text-primary">{project.code}</p>
                    <h2 className="font-semibold text-balance">{project.name}</h2>
                    {project.customerName ? <p className="text-sm text-muted-foreground">{project.customerName}</p> : null}
                    {project.installationSite ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" aria-hidden /> {project.installationSite}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={cn("w-fit rounded-full border px-2 py-0.5 text-xs", statusInfo.badge)}>{statusInfo.label}</span>
                    {sample ? <span className="w-fit rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">Vzorový projekt</span> : null}
                  </div>
                  <p className="mt-auto flex flex-wrap gap-3 text-xs">
                    <span>{project.items} přístrojů</span>
                    {(["VERIFIED", "PARTIAL", "UNRECOGNIZED"] as const).map((key) =>
                      project.recognition[key] ? (
                        <span key={key} className={RECOGNITION[key].text}>
                          {project.recognition[key]} × {RECOGNITION[key].label.toLowerCase()}
                        </span>
                      ) : null,
                    )}
                  </p>
                  {project.equipmentName ? <p className="text-xs text-muted-foreground">Karta zařízení: {project.equipmentName}</p> : null}
                </Link>
                <div className="absolute top-3 right-3 flex items-center gap-0.5">
                  <EditProjectButton project={project} />
                  <DeleteProjectButton project={project} />
                  <CircuitBoard className="ml-1 size-6 shrink-0 text-muted-foreground" aria-hidden />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Žádný projekt neodpovídá hledání.</p>
      )}

      {selecting ? (
        <div className="sticky bottom-4 z-30 mx-auto flex w-fit items-center gap-2 rounded-xl border border-border bg-popover p-2 shadow-2xl shadow-black/50" role="toolbar" aria-label="Hromadné akce">
          <span className="px-2 text-sm text-muted-foreground">Vybráno {chosen.length}</span>
          <Button type="button" variant="destructive" className="gap-1.5" disabled={!chosen.length || pending} onClick={removeSelected} data-testid="bulk-delete">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} 🗑️ Smazat vybrané projekty ({chosen.length})
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Zrušit hromadný výběr" onClick={() => setSelecting(false)}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
