import Link from "next/link";
import { MapPinOff } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { APP_HOME } from "@/lib/routes";

// Kořenová 404 stojí mimo hlavičku aplikace i landing page → vlastní logo a dvě cesty zpět.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 py-6 sm:px-6">
      <Link href="/" className="self-start rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka">
        <Logo withTagline />
      </Link>
      <EmptyState
        className="my-auto"
        icon={MapPinOff}
        title="Stránka nenalezena"
        description="Tato adresa neexistuje nebo zařízení už není v systému."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild className="touch-target">
              <Link href={APP_HOME}>Zpět na mapu závodu</Link>
            </Button>
            <Button asChild variant="outline" className="touch-target">
              <Link href="/">Úvodní stránka</Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
