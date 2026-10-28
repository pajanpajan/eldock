import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface Props {
  title: ReactNode;
  description?: ReactNode;
  /** Drobečková navigace nad nadpisem. */
  breadcrumb?: ReactNode;
  /** Štítky vedle nadpisu (např. StatusBadge). */
  badges?: ReactNode;
  /** Akce vpravo (tlačítka). */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, breadcrumb, badges, actions, className }: Props) {
  return (
    <header className={cn("flex flex-col gap-3 pb-6", className)}>
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
            {badges}
          </div>
          {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
