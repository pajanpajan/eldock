import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";

import { LogoMark } from "@/components/layout/Logo";
import { logoutSuperadminAction } from "@/server/actions/superadmin";
import { isSuperadmin } from "@/server/superadmin-session";

export const metadata: Metadata = { title: { default: "Velín", template: "%s · Velín ELDOCK" }, robots: { index: false, follow: false } };

/** Velín /superadmin (fáze 50): vlastní lišta, bez navigace produktů. */
export default async function SuperadminLayout({ children }: LayoutProps<"/superadmin">) {
  const signedIn = await isSuperadmin();
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
            <form action={logoutSuperadminAction} className="ml-auto">
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
