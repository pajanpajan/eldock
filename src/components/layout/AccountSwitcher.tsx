"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AccountType } from "@/generated/prisma/enums";
import { ACCOUNT_TYPES } from "@/lib/accounts";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setAccount } from "@/server/actions/session";

export interface SwitcherAccount {
  id: string;
  name: string;
  title: string | null;
  accountType: AccountType;
}

/** Přepínač účtu: jméno, role, odznak oprávnění a výřez dat, který účet vidí. */
export function AccountSwitcher({ accounts, currentId }: { accounts: SwitcherAccount[]; currentId: string }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const current = accounts.find((account) => account.id === currentId) ?? accounts[0];

  function choose(id: string) {
    if (id === currentId) return;
    startTransition(async () => {
      try {
        await setAccount(id, pathname);
      } catch (error) {
        // `redirect()` v akci se do klienta propaguje jako speciální výjimka – tu nechat projít.
        if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
        toast.error("Účet se nepodařilo přepnout.");
      }
    });
  }

  if (!current) return null;
  const definition = ACCOUNT_TYPES[current.accountType];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="touch-target flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2 py-1 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`Účet: ${current.name} – ${definition.label}. Přepnout účet`}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-xs font-semibold">{pending ? <Loader2 className="size-4 animate-spin" /> : initials(current.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden leading-tight sm:block">
          <span className="block text-sm font-medium">{current.name}</span>
          <span className={cn("mt-0.5 inline-block rounded-full border px-1.5 text-[11px] font-medium", definition.badge)}>{definition.label}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,26rem)]">
        <DropdownMenuLabel>Přepnout účet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accounts.map((account) => {
          const item = ACCOUNT_TYPES[account.accountType];
          const active = account.id === currentId;
          return (
            <DropdownMenuItem key={account.id} onSelect={() => choose(account.id)} className="items-start gap-3 py-2.5" aria-label={`${account.name} – ${item.label}`}>
              <Avatar className="mt-0.5 size-8">
                <AvatarFallback className="bg-secondary text-xs font-semibold">{initials(account.name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{account.name}</span>
                  <span className={cn("rounded-full border px-1.5 text-[11px] font-medium", item.badge)}>{item.label}</span>
                </span>
                {account.title && account.title !== item.label ? <span className="block text-xs text-muted-foreground">{account.title}</span> : null}
                <span className="block text-xs text-muted-foreground">{item.scopeDescription}</span>
              </span>
              {active ? <Check className="mt-1 size-4 text-primary" aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
