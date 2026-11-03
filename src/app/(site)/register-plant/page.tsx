import type { Metadata } from "next";
import Link from "next/link";

import { PlantRegistrationForm } from "@/components/companies/PlantRegistrationForm";
import { Logo } from "@/components/layout/Logo";

export const metadata: Metadata = { title: "Registrace výrobního závodu" };

/** Registrace druhého produktu – ELDOCK Průmyslový dok (Správa závodů, dokumentace a revizí). */
export default function RegisterPlantPage() {
  return (
    <div className="bg-blueprint flex flex-1 flex-col">
      <header className="border-b border-border bg-background/85">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka">
            <Logo />
          </Link>
          <Link href="/login" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
            Už máte účet? Přihlásit se
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">ELDOCK Průmyslový dok</p>
          <h1 className="text-3xl font-bold tracking-tight">Registrace výrobního závodu</h1>
          <p className="max-w-3xl text-muted-foreground">
            Po registraci vznikne firma, váš první závod s čistou mapou areálu a účet Technického ředitele. Rovnou můžete ve Studiu stavět budovy, nahrávat dokumentaci a řídit revize.
          </p>
        </div>
        <PlantRegistrationForm />
      </main>
    </div>
  );
}
