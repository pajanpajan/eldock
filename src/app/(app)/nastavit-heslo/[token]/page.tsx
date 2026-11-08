import type { Metadata } from "next";
import Link from "next/link";

import { SetPasswordForm } from "@/components/auth/PasswordForms";
import { Logo } from "@/components/layout/Logo";
import { prisma } from "@/lib/prisma";
import { findPasswordLink } from "@/server/services/account-security";

export const metadata: Metadata = { title: "Nastavení hesla", robots: { index: false, follow: false } };

// Fáze 67: nastavení hesla z pozvánky zaměstnance nebo z odkazu na obnovu (jednorázový odkaz, v DB jen SHA-256).
export default async function SetPasswordPage({ params }: PageProps<"/nastavit-heslo/[token]">) {
  const { token } = await params;
  const link = await findPasswordLink(prisma, token);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="scale-125" withTagline />
        <h1 className="text-2xl font-semibold tracking-tight">{link?.kind === "INVITE" ? "Vítejte v Eldocku" : "Nastavení hesla"}</h1>
        {link ? (
          <p className="text-sm text-muted-foreground">
            {link.user.name} · {link.user.email} – zvolte heslo, kterým se budete přihlašovat. Delší věta nebo několik slov je bezpečnější než krátké složité heslo.
          </p>
        ) : null}
      </div>
      {link ? (
        <SetPasswordForm token={token} email={link.user.email} name={link.user.name} />
      ) : (
        <div role="alert" className="grid gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm" data-testid="password-link-invalid">
          <p>Odkaz vypršel, už byl použit, nebo je účet zablokovaný.</p>
          <p className="text-muted-foreground">Požádejte správce účtů své firmy o nový odkaz, případně si pošlete odkaz na obnovu hesla.</p>
          <Link href="/zapomenute-heslo" className="font-medium text-primary underline-offset-4 hover:underline">
            Zapomenuté heslo
          </Link>
        </div>
      )}
    </div>
  );
}
