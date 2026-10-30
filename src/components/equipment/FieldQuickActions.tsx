import Link from "next/link";
import { FileText, MessageSquarePlus, PencilLine, QrCode } from "lucide-react";

import { cn } from "@/lib/utils";

const tile =
  "touch-target flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-center text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Terénní pohled směnového údržbáře: tři velké akce hned pod hlavičkou – schéma, QR štítek
 * a nahlášení změny (nebo doplnění k otevřené změně).
 */
export function FieldQuickActions({ basePath, changeHref, openNumber, canSubmit }: { basePath: string; changeHref: string; openNumber: string | null; canSubmit: boolean }) {
  const ChangeIcon = openNumber ? MessageSquarePlus : PencilLine;
  return (
    <nav aria-label="Rychlé akce" className="grid grid-cols-3 gap-2" data-testid="field-quick-actions">
      <Link href={`${basePath}?tab=schema#dokumentace`} scroll={false} className={cn(tile, "border-border bg-card hover:bg-muted")}>
        <FileText className="size-6 text-primary" aria-hidden />
        Schéma
      </Link>
      <a href="#qr-stitek" className={cn(tile, "border-border bg-card hover:bg-muted")}>
        <QrCode className="size-6 text-primary" aria-hidden />
        QR štítek
      </a>
      {canSubmit ? (
        <Link href={changeHref} className={cn(tile, "border-primary bg-primary text-primary-foreground hover:bg-primary/85")}>
          <ChangeIcon className="size-6" aria-hidden />
          {openNumber ? `Doplnit ke změně ${openNumber}` : "Nahlásit změnu"}
        </Link>
      ) : null}
    </nav>
  );
}
