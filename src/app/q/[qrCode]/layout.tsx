import Link from "next/link";

import { Logo } from "@/components/layout/Logo";

// Fáze 103: karta QR štítku ELDOCK – veřejná (technik u rozváděče na mobilu), bez navigace aplikace.
export default function QrCardLayout({ children }: LayoutProps<"/q/[qrCode]">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="no-print border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-3 px-4 py-2 sm:px-6">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka">
            <Logo />
          </Link>
          <span className="ml-auto text-xs text-muted-foreground">Karta QR štítku ELDOCK</span>
        </div>
      </header>
      {children}
    </div>
  );
}
