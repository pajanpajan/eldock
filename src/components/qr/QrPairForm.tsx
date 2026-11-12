"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { pairLabelAction } from "@/server/actions/switchboard-versions";

/** Fáze 103: spárování předtištěného štítku firmy (série z velínu) s rozváděčem AI Panel Builderu – z karty štítku. */
export function QrPairForm({ code, projects }: { code: string; projects: { id: string; code: string; name: string }[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  if (!projects.length) return <p className="text-sm text-muted-foreground">Ve firmě není rozváděč bez štítku – založte ho v AI Panel Builderu.</p>;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      data-testid="qr-pair-form"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await pairLabelAction(code, projectId);
          if (!result.ok) return void toast.error(result.error);
          toast.success(`Štítek ${result.data.serial} je spárovaný s rozváděčem.`, { description: "Po uzamčení verze se tu zobrazí platná dokumentace." });
          router.refresh();
        });
      }}
    >
      <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        Rozváděč firmy bez štítku
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-11 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" data-testid="qr-pair-project">
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} – {project.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" className="touch-target gap-2" disabled={pending || !projectId} data-testid="qr-pair-submit">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        Spárovat štítek s rozváděčem
      </Button>
    </form>
  );
}
