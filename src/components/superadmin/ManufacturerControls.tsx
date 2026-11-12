"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { REGIONS } from "@/lib/panel-builder/turnkey-manufacturing";
import { createManufacturerAction, setManufacturerActiveAction } from "@/server/actions/manufacturing";

/** Fáze 106: nový zasmluvněný výrobce – přístupový kód se ukáže jen jednou. */
export function ManufacturerForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", region: REGIONS[6] as string, ico: "", phone: "", leadDays: "7" });
  const [issued, setIssued] = useState<{ name: string; email: string; code: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2 text-sm sm:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await createManufacturerAction({ ...form, leadDays: Number(form.leadDays) });
          if (!result.ok) return void toast.error(result.error);
          setIssued(result.data);
          router.refresh();
        });
      }}
      data-testid="manufacturer-form"
    >
      {(
        [
          ["name", "Název výrobce"],
          ["email", "E-mail (přihlášení)"],
          ["ico", "IČO"],
          ["phone", "Telefon"],
          ["leadDays", "Termín výroby [prac. dnů]"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex flex-col gap-0.5">
          {label}
          <input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="h-9 rounded-md border border-input bg-transparent px-2" data-testid={`manufacturer-form-${key}`} />
        </label>
      ))}
      <label className="flex flex-col gap-0.5">
        Kraj působnosti
        <select value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} className="h-9 rounded-md border border-input bg-transparent px-2 dark:bg-input/30" data-testid="manufacturer-form-region">
          {REGIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={pending} className="w-fit" data-testid="manufacturer-form-submit">
        Uložit výrobce a vydat přístupový kód
      </Button>
      {issued ? (
        <p className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 p-2 text-xs sm:col-span-3" data-testid="manufacturer-code-issued">
          Přístupový kód pro {issued.name} ({issued.email}): <b className="font-mono text-base">{issued.code}</b> – ukáže se jen teď, předejte ho výrobci.
        </p>
      ) : null}
    </form>
  );
}

export function ManufacturerToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(async () => void (await setManufacturerActiveAction(id, !active), router.refresh()))}>
      {active ? "Aktivní – deaktivovat" : "Neaktivní – aktivovat"}
    </Button>
  );
}
