import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilLine } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { equipmentHref } from "@/lib/routes";
import { getEquipmentDetail } from "@/server/queries/equipment";

export const metadata: Metadata = { title: "Zadat změnu" };

// Dočasná stránka – průvodce „Zadat změnu“ (zákres, fotky, poznámka) doplní fáze 8.
export default async function ChangeRequestPage({ params }: PageProps<"/equipment/[id]/change-request">) {
  const { id } = await params;
  const equipment = await getEquipmentDetail(id);
  if (!equipment) notFound();

  return (
    <EmptyState
      className="my-auto"
      icon={PencilLine}
      title={`Zadat změnu – ${equipment.tag}`}
      description="Průvodce zadáním změny (zákres prstem, fotky, hlasová poznámka) se objeví v další etapě vývoje."
      action={
        <Button asChild className="touch-target">
          <Link href={equipmentHref(equipment.id)}>Zpět na detail zařízení</Link>
        </Button>
      }
    />
  );
}
