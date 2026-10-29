"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountType } from "@/generated/prisma/enums";
import { ACCOUNT_ORDER, ACCOUNT_TYPES } from "@/lib/accounts";
import { MAP_LAYERS, type LayerKey } from "@/lib/map-layers";
import { cn } from "@/lib/utils";
import { createSubAccountAction } from "@/server/actions/accounts";

/** Formulář „Přidat podúčet“: osoba, typ účtu a případně vlastní výřez kategorií zařízení. */
export function CreateSubAccountForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("MAINTENANCE_TECH");
  const [layers, setLayers] = useState<ReadonlySet<LayerKey>>(new Set(ACCOUNT_TYPES.MAINTENANCE_TECH.layers));
  const valid = name.trim().length >= 3 && email.includes("@") && layers.size > 0;

  function chooseType(type: AccountType) {
    setAccountType(type);
    setLayers(new Set(ACCOUNT_TYPES[type].layers));
  }

  function submit() {
    startTransition(async () => {
      const result = await createSubAccountAction({ name, email, title: title || null, accountType, layers: [...layers] });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Podúčet ${result.data.name} založen.`, { description: "Najdete ho v přepínači účtů v hlavičce." });
      setName("");
      setEmail("");
      setTitle("");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="new-account" className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 id="new-account" className="flex items-center gap-2 text-lg font-semibold">
        <UserPlus className="size-5 text-primary" aria-hidden />
        Přidat podúčet
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="account-name">Jméno a příjmení</Label>
          <Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-email">E-mail</Label>
          <Input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={200} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-title">Funkce (nepovinné)</Label>
          <Input id="account-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder={ACCOUNT_TYPES[accountType].label} className="h-11" />
        </div>
      </div>
      <div className="space-y-2">
        <Label id="account-type">Typ účtu (oprávnění)</Label>
        <div role="radiogroup" aria-labelledby="account-type" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ACCOUNT_ORDER.map((type) => {
            const definition = ACCOUNT_TYPES[type];
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={accountType === type}
                onClick={() => chooseType(type)}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  accountType === type ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
                )}
              >
                <span className={cn("rounded-full border px-1.5 text-xs font-medium", definition.badge)}>{definition.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{definition.scopeDescription}</span>
              </button>
            );
          })}
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Přiřazené kategorie zařízení</legend>
        <div className="flex flex-wrap gap-2">
          {MAP_LAYERS.map((layer) => (
            <label key={layer.key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={layers.has(layer.key)}
                onChange={() =>
                  setLayers((current) => {
                    const next = new Set(current);
                    if (next.has(layer.key)) next.delete(layer.key);
                    else next.add(layer.key);
                    return next;
                  })
                }
              />
              {layer.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Button className="touch-target gap-2" onClick={submit} disabled={pending || !valid}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
        Založit podúčet
      </Button>
    </section>
  );
}
