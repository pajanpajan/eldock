"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { pairLabelWithEquipmentAction } from "@/server/actions/qr-labels";

/** Fáze 103: spárování štítku firmy se strojem, spotřebičem nebo rozváděčem závodu (Správa závodů) z karty štítku. */
export function QrPairEquipmentForm({ code, equipment }: { code: string; equipment: { id: string; tag: string; name: string }[] }) {
  const router = useRouter();
  const [equipmentId, setEquipmentId] = useState(equipment[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  if (!equipment.length) return <p className="text-sm text-muted-foreground">V závodě zatím není žádné zařízení – založte ho ve Studiu nebo importem.</p>;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      data-testid="qr-pair-equipment-form"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await pairLabelWithEquipmentAction(code, equipmentId);
          if (!result.ok) return void toast.error(result.error);
          toast.success(`Štítek ${result.data.serial} je spárovaný se zařízením.`);
          router.refresh();
        });
      }}
    >
      <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        Stroj, spotřebič nebo rozváděč závodu
        <select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} className="h-11 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" data-testid="qr-pair-equipment">
          {equipment.map((item) => (
            <option key={item.id} value={item.id}>
              {item.tag} – {item.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" className="touch-target gap-2" disabled={pending || !equipmentId} data-testid="qr-pair-equipment-submit">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        Spárovat se zařízením
      </Button>
    </form>
  );
}
