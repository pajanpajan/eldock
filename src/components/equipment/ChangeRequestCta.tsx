import Link from "next/link";
import { MessageSquarePlus, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Hlavní akce údržby. Při otevřeném požadavku se mění na „Doplnit k otevřené změně“.
 * Na mobilu je přilepená ke spodnímu okraji (rukavice, jedna ruka).
 */
export function ChangeRequestCta({ href, openNumber, className }: { href: string; openNumber: string | null; className?: string }) {
  const Icon = openNumber ? MessageSquarePlus : PencilLine;
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0",
        className,
      )}
    >
      <Button asChild size="lg" className="h-12 w-full gap-2 px-5 text-base font-semibold sm:w-auto">
        <Link href={href}>
          <Icon className="size-5" />
          {openNumber ? `Doplnit k otevřené změně ${openNumber}` : "Zadat změnu"}
        </Link>
      </Button>
    </div>
  );
}
