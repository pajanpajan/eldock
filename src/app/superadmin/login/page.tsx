import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SuperadminLoginForm } from "@/components/superadmin/SuperadminControls";
import { isSuperadmin } from "@/server/superadmin-session";

export const metadata: Metadata = { title: "Přihlášení" };

export default async function SuperadminLoginPage() {
  if (await isSuperadmin()) redirect("/superadmin");
  return (
    <div className="mx-auto mt-16 flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <h1 className="text-xl font-bold">Přihlášení do velínu</h1>
      <p className="text-sm text-muted-foreground">Obchodní a technický velín ELDOCK – firmy, kredity, objednávky a hlášení chyb AI.</p>
      <SuperadminLoginForm />
    </div>
  );
}
