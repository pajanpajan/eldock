import Link from "next/link";
import { Blocks, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/users", label: "Podúčty a oprávnění", icon: UsersRound },
  { href: "/admin/modules", label: "Moduly a tarif", icon: Blocks },
] as const;

/** Záložky administrace závodu (technický ředitel). */
export function AdminTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Administrace" className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={href === current ? "page" : undefined}
          className={cn(
            "touch-target flex items-center gap-2 rounded-lg px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            href === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
