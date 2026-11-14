"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { grantProvisionalCreditsAction } from "@/server/actions/credits";

/**
 * Fáze 114: [ ✅ Zaplatil jsem QR kódem – aktivovat kredity ihned (předběžné připsání na 48 h) ] – zákazník, který zaplatil
 * večer nebo o víkendu, může dokončit a stáhnout zakázku hned; velín platbu potvrdí podle výpisu z banky, nebo kredity odečte.
 */
export function ProvisionalPayButton({ orderId, credits, className }: { orderId: string; credits: number; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      className={cn("touch-target h-auto min-h-10 w-fit max-w-full gap-2 bg-emerald-600 py-2 text-left leading-snug whitespace-normal text-white hover:bg-emerald-500", className)}
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!window.confirm("Zaplatili jste objednávku QR kódem / převodem? Kredity se připíšou hned předběžně – do 48 hodin zkontrolujeme výpis z banky (když platba nedorazí, kredity se odečtou).")) return;
          const result = await grantProvisionalCreditsAction(orderId);
          if (!result.ok) return void toast.error(result.error, { duration: 10_000 });
          toast.success(result.data.already ? "Kredity už jsou předběžně aktivní." : `✅ +${result.data.credits} kreditů aktivních ihned (předběžně do kontroly výpisu z banky).`);
          router.refresh();
        })
      }
      data-testid="provisional-pay"
    >
      {pending ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4 shrink-0" aria-hidden />}✅ Zaplatil jsem QR kódem – aktivovat kredity ihned (předběžné připsání na 48 h)
      <span className="sr-only">(+{credits} kreditů)</span>
    </Button>
  );
}
