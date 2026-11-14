"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOTO_ROLES } from "@/lib/legislation-2027";
import type { LotoPersons } from "@/lib/loto-persons";
import { updateLotoResponsibleAction } from "@/server/actions/passport";

const KEYS = { OOEZ: "ooez", "OPŘPČ": "oprpc" } as const;

/**
 * Fáze 116: „Odpovědné osoby (ČSN EN 50110-1 ed. 4)“ na kartě LOTO – OOEZ a OPŘPČ s telefonem, úprava jedním klikem
 * (✏️ Upravit odpovědné osoby → uložit).
 */
export function LotoResponsible({ equipmentId, persons, canEdit }: { equipmentId: string; persons: LotoPersons; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ooezName: persons.ooez?.name ?? "", ooezPhone: persons.ooez?.phone ?? "", oprpcName: persons.oprpc?.name ?? "", oprpcPhone: persons.oprpc?.phone ?? "" });
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateLotoResponsibleAction({
        equipmentId,
        ooez: form.ooezName.trim() ? { name: form.ooezName, phone: form.ooezPhone || null } : null,
        oprpc: form.oprpcName.trim() ? { name: form.oprpcName, phone: form.oprpcPhone || null } : null,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Odpovědné osoby uloženy.");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4" data-testid="loto-responsible">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Odpovědné osoby (ČSN EN 50110-1 ed. 4)</h3>
        {canEdit && !editing ? (
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setEditing(true)} data-testid="loto-responsible-edit">
            <Pencil className="size-3.5" aria-hidden /> ✏️ Upravit
          </Button>
        ) : null}
      </div>
      <dl className="space-y-2 text-sm">
        {LOTO_ROLES.map((role) => {
          const key = KEYS[role.code];
          const person = persons[key];
          return (
            <div key={role.code}>
              <dt className="font-medium">
                {role.label} <span className="font-mono text-yellow-300">({role.code})</span>
              </dt>
              {editing ? (
                <dd className="mt-1 grid gap-2 sm:grid-cols-[1fr_10rem]">
                  <Input value={key === "ooez" ? form.ooezName : form.oprpcName} onChange={(event) => setForm({ ...form, [key === "ooez" ? "ooezName" : "oprpcName"]: event.target.value })} placeholder="Jméno a příjmení" aria-label={`${role.code} – jméno`} data-testid={`loto-${key}-name`} />
                  <Input value={key === "ooez" ? form.ooezPhone : form.oprpcPhone} onChange={(event) => setForm({ ...form, [key === "ooez" ? "ooezPhone" : "oprpcPhone"]: event.target.value })} placeholder="Telefon" inputMode="tel" aria-label={`${role.code} – telefon`} />
                </dd>
              ) : (
                <dd className="text-muted-foreground" data-testid={`loto-${key}`}>
                  {person ? (
                    <span className="font-semibold text-foreground">
                      {person.name}
                      {person.phone ? (
                        <a href={`tel:${person.phone.replace(/\s/g, "")}`} className="ml-2 font-normal text-primary underline-offset-2 hover:underline">
                          📞 {person.phone}
                        </a>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-amber-300">Neurčeno – </span>
                  )}
                  <span className="block text-xs">{role.duty}</span>
                </dd>
              )}
            </div>
          );
        })}
      </dl>
      {editing ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" className="gap-1.5" onClick={save} disabled={pending} data-testid="loto-responsible-save">
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Uložit odpovědné osoby
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
            Zrušit
          </Button>
        </div>
      ) : null}
    </div>
  );
}
