import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";

import { LogoMark } from "@/components/layout/Logo";
import { prisma } from "@/lib/prisma";
import { contactUnreadCount } from "@/server/services/contact";
import { logoutSuperadminAction } from "@/server/actions/superadmin";
import { isSuperadmin } from "@/server/superadmin-session";

export const metadata: Metadata = { title: { default: "Velín", template: "%s · Velín ELDOCK" }, robots: { index: false, follow: false } };

/** Velín /superadmin (fáze 50): vlastní lišta, bez navigace produktů. */
export default async function SuperadminLayout({ children }: LayoutProps<"/superadmin">) {
  const signedIn = await isSuperadmin();
  // Fáze 107: nepřečtené zprávy kontaktního hubu – červený odznak v horní liště velínu
  const unread = signedIn ? await contactUnreadCount(prisma) : 0;
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] items-center gap-3 px-4 py-2 sm:px-6">
          <Link href="/superadmin" className="flex items-center gap-2.5" aria-label="Velín ELDOCK">
            <LogoMark className="size-8" />
            <span className="leading-tight">
              <span className="block text-base font-black tracking-tight">ELDOCK</span>
              <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                <ShieldCheck className="size-3" aria-hidden /> SuperAdmin velín
              </span>
            </span>
          </Link>
          {signedIn ? (
            <Link href="/superadmin?tab=zpravy" className="ml-auto flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="superadmin-inbox">
              📬 Zprávy
              {unread ? (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white" aria-label={`${unread} nepřečtených zpráv`}>
                  {unread}
                </span>
              ) : null}
            </Link>
          ) : null}
          {signedIn ? (
            <form action={logoutSuperadminAction}>
              <button type="submit" className="touch-target flex items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground">
                <LogOut className="size-4" aria-hidden /> Odhlásit velín
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
