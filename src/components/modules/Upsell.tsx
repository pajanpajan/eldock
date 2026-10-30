"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Lock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FEATURES, MODULES, type FeatureKey } from "@/lib/modules";
import { cn } from "@/lib/utils";

/** Odznak „Modul Pro“ u zamčené funkce (režim Obchodní demo). */
export function ProBadge({ className }: { className?: string }) {
  return <span className={cn("rounded-full border border-primary/50 bg-primary/10 px-1.5 py-px text-[10px] font-bold tracking-wide text-primary uppercase", className)}>Modul Pro</span>;
}

/** Okno s přínosem funkce a cestou k aktivaci. */
export function UpsellDialog({ feature, canManage, open, onOpenChange }: { feature: FeatureKey; canManage: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const definition = FEATURES[feature];
  const pack = MODULES[definition.module];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="upsell-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden />
            {definition.label}
          </DialogTitle>
          <DialogDescription>
            Součást modulu <span className="font-semibold text-foreground">{pack.label}</span> · <ProBadge className="align-middle" />
          </DialogDescription>
        </DialogHeader>
        <p className="text-base">{definition.benefit}</p>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="mb-2 text-sm text-muted-foreground">{pack.description}</p>
          <ul className="space-y-1 text-sm">
            {pack.features.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          {canManage ? (
            <Button asChild className="touch-target gap-2">
              <Link href="/admin/modules" onClick={() => onOpenChange(false)}>
                Přejít do správy modulů a aktivovat
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">O aktivaci modulu požádejte technického ředitele nebo vedoucího údržby.</p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Zamčené tlačítko (vzhled běžné akce + zámek a odznak); klik otevře okno s přínosem. */
export function LockedButton({
  feature,
  canManage,
  children,
  variant = "outline",
  size,
  className,
}: {
  feature: FeatureKey;
  canManage: boolean;
  children: ReactNode;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} className={cn("touch-target gap-2 opacity-80", className)} onClick={() => setOpen(true)} data-locked-feature={feature}>
        <Lock className="size-4" aria-hidden />
        {children}
        <ProBadge />
      </Button>
      <UpsellDialog feature={feature} canManage={canManage} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Zamčená položka hlavní navigace (stejný vzhled jako odkaz, místo přechodu okno s přínosem). */
export function LockedNavItem({ feature, canManage, label, srLabel, icon }: { feature: FeatureKey; canManage: boolean; label: string; srLabel: string; icon: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="touch-target flex items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground/70 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`${srLabel} – zamčeno, Modul Pro`}
        data-locked-feature={feature}
      >
        {icon}
        <span className="hidden xl:inline">{label}</span>
        <Lock className="size-3.5 text-primary" aria-hidden />
      </button>
      <UpsellDialog feature={feature} canManage={canManage} open={open} onOpenChange={setOpen} />
    </>
  );
}
