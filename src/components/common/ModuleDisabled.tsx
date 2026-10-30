import Link from "next/link";
import { Check, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FEATURES, MODULES, type FeatureKey } from "@/lib/modules";
import { APP_HOME } from "@/lib/routes";

/** Stránka funkce, kterou tenant nemá aktivní (přímé URL, stará záložka, QR na zamčenou stránku). */
export function ModuleDisabled({ feature, canManage }: { feature: FeatureKey; canManage: boolean }) {
  const definition = FEATURES[feature];
  const pack = MODULES[definition.module];
  return (
    <section className="mx-auto my-auto w-full max-w-xl rounded-2xl border border-primary/40 bg-card p-6 sm:p-8" data-testid="feature-locked">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Lock className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Modul Pro · {pack.label}</p>
          <h1 className="text-xl font-semibold">{definition.label} není ve vašem tarifu aktivní</h1>
        </div>
      </div>
      <p className="mt-4">{definition.benefit}</p>
      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        {pack.features.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        {canManage ? (
          <Button asChild className="touch-target">
            <Link href="/admin/modules">Přejít do správy modulů a aktivovat</Link>
          </Button>
        ) : (
          <p className="w-full text-sm text-muted-foreground">O aktivaci modulu požádejte technického ředitele nebo vedoucího údržby.</p>
        )}
        <Button asChild variant="outline" className="touch-target">
          <Link href={APP_HOME}>Zpět do aplikace</Link>
        </Button>
      </div>
    </section>
  );
}
