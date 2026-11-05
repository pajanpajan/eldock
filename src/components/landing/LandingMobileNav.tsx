"use client";

import Link from "next/link";
import { LogIn, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Fáze 54: navigace úvodní stránky na mobilu (desktop má odkazy přímo v hlavičce). Klik na odkaz menu zavře. */
export function LandingMobileNav({ items, clientZone }: { items: readonly { href: string; label: string }[]; clientZone: { href: string; label: string } }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="touch-target md:hidden" aria-label="Otevřít menu" data-testid="landing-menu">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">Sekce úvodní stránky a přihlášení</SheetDescription>
        </SheetHeader>
        <nav aria-label="Sekce stránky (mobil)" className="flex flex-col gap-1 px-4">
          {items.map((item) => (
            <SheetClose asChild key={item.href}>
              <a href={item.href} className="touch-target flex items-center rounded-md px-3 text-base text-foreground hover:bg-muted">
                {item.label}
              </a>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-2 border-t border-border px-4 pt-4">
          <SheetClose asChild>
            <Button asChild className="touch-target w-full">
              <Link href={clientZone.href}>
                <LogIn data-icon="inline-start" aria-hidden /> {clientZone.label}
              </Link>
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
