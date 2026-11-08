import Link from "next/link";
import { Blocks, DatabaseZap, Smartphone, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/users", label: "Podúčty a oprávnění", icon: UsersRound, key: "users" },
  { href: "/admin/modules", label: "Moduly a tarif", icon: Blocks, key: "modules" },
  // Fáze 69: export a výmaz dat registrované firmy
  { href: "/admin/data", label: "Data firmy", icon: DatabaseZap, key: "data" },
  // Fáze 70: aplikace pro Windows, iOS a Android
  { href: "/admin/devices", label: "Zařízení", icon: Smartphone, key: "devices" },
] as const;

/** Záložky administrace závodu – jen ty, na které má účet oprávnění. */
export function AdminTabs({
  current,
  canUsers,
  canModules,
  canData = false,
  canDevices = canData,
}: {
  current: (typeof TABS)[number]["href"];
  canUsers: boolean;
  canModules: boolean;
  canData?: boolean;
  canDevices?: boolean;
}) {
  const allowed = { users: canUsers, modules: canModules, data: canData, devices: canDevices } as const;
  const tabs = TABS.filter((tab) => allowed[tab.key]);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Administrace" className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
      {tabs.map(({ href, label, icon: Icon }) => (
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
