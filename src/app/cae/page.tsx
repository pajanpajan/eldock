import type { Metadata } from "next";
import { PencilRuler } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";

export const metadata: Metadata = { title: "CAE Back-Office" };

// Dočasná stránka – dashboard ticketů doplní fáze 9.
export default function CaeDashboardPage() {
  return (
    <>
      <PageHeader title="CAE Back-Office" description="Požadavky na změnu ze všech závodů." />
      <EmptyState
        icon={PencilRuler}
        title="Dashboard připravujeme"
        description="Přehled požadavků na změnu se objeví v další etapě vývoje."
      />
    </>
  );
}
