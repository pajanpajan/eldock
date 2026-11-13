import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/PasswordForms";
import { Logo } from "@/components/layout/Logo";

export const metadata: Metadata = { title: "Zapomenuté heslo", robots: { index: false, follow: false } };

// Fáze 67: obnova hesla uživatele registrované firmy – odkaz e-mailem (bez SMTP ho vytvoří správce firmy).
export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* Fáze 111: logo ELDOCK vždy na úvodní rozcestník */}
        <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka">
          <Logo className="scale-125" withTagline />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Zapomenuté heslo</h1>
        <p className="text-sm text-muted-foreground">Pošleme odkaz na nastavení nového hesla. Účty obchodního dema mají společné heslo – to mění správce serveru.</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
