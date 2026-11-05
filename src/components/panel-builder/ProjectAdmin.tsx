"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { refundsCredit } from "@/lib/panel-builder/project-admin";
import { SUPPLY_SYSTEMS, type SupplySystem } from "@/lib/panel-builder/supply";
import { cn } from "@/lib/utils";
import { deletePanelProjectsAction, updateProjectHeaderAction } from "@/server/actions/panel-projects";

import type { PanelProjectStatus } from "@/generated/prisma/enums";

// Správa projektu (fáze 48): smazání s potvrzením a rychlá úprava hlavičky.

export interface AdminProject {
  id: string;
  code: string;
  name: string;
  customerName: string | null;
  installationSite: string | null;
  status: PanelProjectStatus;
  /** Fáze 55: soustava přívodu (id ze `SUPPLY_SYSTEMS`) – jen v hlavičce detailu, kde je známá. */
  supplySystem?: SupplySystem["id"];
}

export const deleteQuestion = (project: Pick<AdminProject, "code" | "status">) =>
  `Opravdu chcete trvale smazat projekt ${project.code}? Smažou se všechny prvky i nahrané fotky.${refundsCredit(project) ? " Firmě se vrátí 1 kredit." : ""}`;

export function deletedMessage(result: { deleted: number; refunded: number; skipped: string[] }) {
  const parts = [`Smazáno ${result.deleted} ${result.deleted === 1 ? "projekt" : result.deleted <= 4 ? "projekty" : "projektů"}.`];
  if (result.refunded) parts.push(`Vráceno ${result.refunded} ${result.refunded === 1 ? "kredit" : result.refunded <= 4 ? "kredity" : "kreditů"}.`);
  if (result.skipped.length) parts.push(`Vzorový ${result.skipped.join(", ")} zůstal.`);
  return parts.join(" ");
}

/** 🗑️ Smazat projekt (ikonové tlačítko na kartě nebo plné tlačítko v hlavičce detailu). */
export function DeleteProjectButton({ project, variant = "icon", redirectTo }: { project: AdminProject; variant?: "icon" | "full"; redirectTo?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function remove() {
    if (!window.confirm(deleteQuestion(project))) return;
    startTransition(async () => {
      const result = await deletePanelProjectsAction([project.id]);
      if (!result.ok) return void toast.error(result.error);
      toast.success(deletedMessage(result.data));
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }
  const icon = pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />;
  if (variant === "full") {
    return (
      <Button type="button" variant="outline" className="touch-target gap-1.5 border-red-500/50 text-red-200 hover:bg-red-500/10" onClick={remove} disabled={pending} data-testid="delete-project">
        {icon} 🗑️ Smazat tento projekt
      </Button>
    );
  }
  return (
    <button type="button" onClick={remove} disabled={pending} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/15 hover:text-red-300" aria-label={`Smazat projekt ${project.code}`} title="🗑️ Smazat projekt">
      {icon}
    </button>
  );
}

/** ✏️ Přejmenovat / upravit hlavičku: název rozváděče, zákazník a místo instalace. */
export function EditProjectButton({ project }: { project: AdminProject }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit(form: FormData) {
    startTransition(async () => {
      const result = await updateProjectHeaderAction(project.id, {
        name: String(form.get("name") ?? ""),
        customerName: String(form.get("customer") ?? "") || null,
        installationSite: String(form.get("site") ?? "") || null,
        ...(project.supplySystem ? { supplySystem: String(form.get("supply") ?? project.supplySystem) as SupplySystem["id"] } : {}),
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Hlavička ${project.code} uložena.`);
      setOpen(false);
      router.refresh();
    });
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Upravit hlavičku projektu ${project.code}`} title="✏️ Přejmenovat / Upravit hlavičku">
        <Pencil className="size-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>✏️ Upravit hlavičku {project.code}</DialogTitle>
            <DialogDescription>Název, zákazník a místo instalace se propíšou i do dokumentace.</DialogDescription>
          </DialogHeader>
          <form action={submit} className="flex flex-col gap-3">
            <Field id={`h-name-${project.id}`} name="name" label="Název rozváděče" defaultValue={project.name} required />
            <Field id={`h-customer-${project.id}`} name="customer" label="Zákazník" defaultValue={project.customerName ?? ""} />
            <Field id={`h-site-${project.id}`} name="site" label="Místo instalace" defaultValue={project.installationSite ?? ""} placeholder="např. Liberec, Husova 5 – technická místnost" />
            {project.supplySystem ? <SupplySelect id={`h-supply-${project.id}`} name="supply" defaultValue={project.supplySystem} /> : null}
            <Button type="submit" className="touch-target" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Uložit hlavičku
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Fáze 55: soustava a počet fází přívodu (3f TN-C-S / TN-S / TT, 1f TN-S / TN-C-S). */
export function SupplySelect({ id, name, defaultValue, value, onChange }: { id: string; name?: string; defaultValue?: SupplySystem["id"]; value?: SupplySystem["id"]; onChange?: (value: SupplySystem["id"]) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Soustava a počet fází přívodu</Label>
      <select
        id={id}
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value as SupplySystem["id"]) : undefined}
        className="h-11 rounded-md border border-input bg-background px-2 text-sm"
        data-testid="supply-select"
      >
        <optgroup label="3f soustava (3× 230/400 V AC)">
          {SUPPLY_SYSTEMS.filter((supply) => supply.phases === 3).map((supply) => (
            <option key={supply.id} value={supply.id}>
              {supply.label} – {supply.detail}
            </option>
          ))}
        </optgroup>
        <optgroup label="1f soustava (1× 230 V AC)">
          {SUPPLY_SYSTEMS.filter((supply) => supply.phases === 1).map((supply) => (
            <option key={supply.id} value={supply.id}>
              {supply.label} – {supply.detail}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

function Field({ id, name, label, defaultValue, required = false, placeholder }: { id: string; name: string; label: string; defaultValue: string; required?: boolean; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} defaultValue={defaultValue} required={required} maxLength={120} placeholder={placeholder} className={cn(required && "font-medium")} />
    </div>
  );
}
