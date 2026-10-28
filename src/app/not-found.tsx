import Link from "next/link";
import { MapPinOff } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      className="my-auto"
      icon={MapPinOff}
      title="Stránka nenalezena"
      description="Tato adresa neexistuje nebo zařízení už není v systému."
      action={
        <Button asChild className="touch-target">
          <Link href="/">Zpět na mapu závodu</Link>
        </Button>
      }
    />
  );
}
