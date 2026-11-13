import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { Logo } from "@/components/layout/Logo";
import { safeNextPath } from "@/lib/auth";
import { APP_HOME } from "@/lib/routes";
import { getAccountUsers } from "@/server/queries/accounts";
import { getAuthSession } from "@/server/session";

export const metadata: Metadata = { title: "Přihlášení" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  if (await getAuthSession()) redirect(next ?? APP_HOME);
  const accounts = (await getAccountUsers({ demoOnly: true })).flatMap(({ id, name, email, title, accountType }) => (accountType ? [{ id, name, email, title, accountType }] : []));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* Fáze 111: logo ELDOCK vždy na úvodní rozcestník */}
        <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Eldock – úvodní stránka">
          <Logo className="scale-125" withTagline />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Přihlášení do Eldock</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Elektrodokumentace a údržba závodu. Zaměstnanci firem se přihlašují e-mailem a vlastním heslem, obchodní demo výběrem účtu a heslem dema.
        </p>
      </div>
      {params.heslo === "nastaveno" ? (
        <p role="status" className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Heslo je nastavené. Přihlaste se e-mailem, novým heslem a kódem z aplikace Authenticator.
        </p>
      ) : null}
      <LoginForm accounts={accounts} next={next} />
    </div>
  );
}
