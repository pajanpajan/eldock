"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { HardHat, Loader2, PencilRuler } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AccountType } from "@/generated/prisma/enums";
import { ACCOUNT_TYPES } from "@/lib/accounts";
import { setAccountType } from "@/server/actions/session";

/** Výzva k přepnutí účtu – uživatel zůstane na stejné stránce. `role` = výchozí účet role. */
export function SwitchRoleButton({ role, account }: { role?: "MAINTENANCE" | "CAE_ENGINEER"; account?: AccountType }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const target: AccountType = account ?? (role === "CAE_ENGINEER" ? "CAE_ENGINEER" : "MAINTENANCE_LEAD");
  const Icon = target === "CAE_ENGINEER" ? PencilRuler : HardHat;
  return (
    <Button className="touch-target gap-2" disabled={pending} onClick={() => startTransition(() => setAccountType(target, pathname, pathname))}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      Přepnout na účet {ACCOUNT_TYPES[target].label}
    </Button>
  );
}
