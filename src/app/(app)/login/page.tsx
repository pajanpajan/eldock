import type { Metadata } from "next";
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
  const accounts = (await getAccountUsers()).flatMap(({ id, name, email, title, accountType }) => (accountType ? [{ id, name, email, title, accountType }] : []));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="scale-125" withTagline />
        <h1 className="text-2xl font-semibold tracking-tight">Přihlášení do Eldock</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Elektrodokumentace a údržba závodu. Vyberte svůj účet (nebo zadejte e-mail) a přístupové heslo / PIN závodu.
        </p>
      </div>
      <LoginForm accounts={accounts} next={next} />
    </div>
  );
}
