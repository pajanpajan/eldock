"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPoolDesignerAction, setPoolDesignerActiveAction } from "@/server/actions/pool-portal";

/** Fáze 103: nový schválený projektant ELDOCK Poolu – přístupový kód do portálu se zobrazí jen jednou. */
export function PoolDesignerForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issued, setIssued] = useState<{ name: string; email: string; code: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        data-testid="pool-designer-form"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await createPoolDesignerAction({ name, email });
            if (!result.ok) return void toast.error(result.error);
            setIssued(result.data);
            setName("");
            setEmail("");
            router.refresh();
          });
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Jméno a příjmení projektanta
          <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="h-10" data-testid="pool-designer-name" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          E-mail projektanta
          <Input type="email" value={email} maxLength={160} onChange={(event) => setEmail(event.target.value)} className="h-10" data-testid="pool-designer-email" />
        </label>
        <Button type="submit" className="h-10" disabled={pending} data-testid="pool-designer-submit">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Schválit projektanta a vydat kód
        </Button>
      </form>
      {issued ? (
        <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm" data-testid="pool-designer-code">
          ✅ {issued.name} ({issued.email}) – přístupový kód do portálu: <strong className="font-mono text-base">{issued.code}</strong>. Předejte ho projektantovi bezpečnou cestou – znovu se už nezobrazí (nové vydání kód změní).
        </p>
      ) : null}
    </div>
  );
}

export function PoolDesignerToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setPoolDesignerActiveAction(id, !active);
          if (!result.ok) return void toast.error(result.error);
          router.refresh();
        })
      }
    >
      {active ? "Vyřadit z poolu" : "Vrátit do poolu"}
    </Button>
  );
}
