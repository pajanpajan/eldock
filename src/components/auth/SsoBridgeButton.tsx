"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { continueWithPanelAccountAction, linkAccountsAction, openPanelBuilderAction } from "@/server/actions/sso";

/**
 * Fáze 114: jedno kliknutí místo druhé registrace – „🔄 Pokračovat pod mým účtem z Panel Builderu (firma / e-mail)“
 * do Hlídače revizí / Správy závodů, nebo opačně do AI Panel Builderu. Server najde (nebo bezpečně založí) spárovaný účet,
 * přihlásí a přesměruje; cizí účet se stejným e-mailem vyžaduje jedno přihlášení heslem (hláška).
 */
export function SsoBridgeButton({ direction, label, next, className, testId = "sso-bridge" }: { direction: "to-plant" | "to-panel"; label: string; next?: string; className?: string; testId?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      className={cn("touch-target h-auto min-h-10 justify-start gap-2 py-2 text-left leading-snug whitespace-normal", className)}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = direction === "to-plant" ? await continueWithPanelAccountAction(next) : await openPanelBuilderAction(next);
          if (result && !result.ok) toast.error(result.error, { duration: 12_000 });
        })
      }
      data-testid={testId}
    >
      {pending ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}

/** 🔗 Propojit účty – přihlášený v obou produktech (správce firmy ve Správě závodů). */
export function LinkAccountsButton({ panelName }: { panelName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="touch-target h-auto min-h-10 justify-start gap-2 py-2 text-left leading-snug whitespace-normal"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await linkAccountsAction();
          if (!result.ok) return void toast.error(result.error, { duration: 10_000 });
          toast.success(`🔗 Účty propojené s AI Panel Builderem (${panelName}) – příště stačí jedno přihlášení.`);
          router.refresh();
        })
      }
      data-testid="sso-link-accounts"
    >
      {pending ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <Link2 className="size-4 shrink-0" aria-hidden />}
      🔗 Propojit s účtem AI Panel Builderu ({panelName})
    </Button>
  );
}
