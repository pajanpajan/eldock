"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { EquipmentPhotoCard } from "@/components/equipment/EquipmentPhotoCard";
import { NameplateCard } from "@/components/equipment/NameplateCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDeviceSlotsAction, type DeviceSlots } from "@/server/actions/hlidac";

/**
 * Fáze 111: detail zařízení / spotřebiče v dialogu (Hlídač revizí, detail podlaží, Rychlá revize) – slot 1 „📸 Fotka
 * zařízení“, slot 2 „🏷️ Fotka výrobního štítku + AI čtení údajů“ a identifikační štítek EL-xxxxxx k tisku.
 * `open(id)` data nejdřív načte (server action), dialog se otevře až s nimi.
 */
export function useDeviceDetail() {
  const [device, setDevice] = useState<DeviceSlots | null>(null);
  const [loading, startLoading] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function open(equipmentId: string) {
    setLoadingId(equipmentId);
    startLoading(async () => {
      const result = await getDeviceSlotsAction(equipmentId);
      setLoadingId(null);
      if (!result.ok) return void toast.error(result.error);
      setDevice(result.data);
    });
  }

  /** Po uložení fotky / údajů znovu načíst (dialog zůstane otevřený). */
  function reload() {
    if (device) open(device.id);
  }

  const dialog = (
    <Dialog open={device !== null} onOpenChange={(value) => (!value ? setDevice(null) : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl" data-testid="device-detail">
        {device ? (
          <>
            <DialogHeader>
              <DialogTitle>
                <span className="font-mono text-primary">{device.tag}</span> – {device.current.title}
              </DialogTitle>
              <DialogDescription>{device.location}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2" data-testid="device-slot-photo">
                <p className="text-sm font-semibold">📸 Fotka zařízení (celkový pohled / umístění)</p>
                <EquipmentPhotoCard equipmentId={device.id} tag={device.tag} name={device.name} type={device.type} photoUrl={device.photoUrl} inspection={device.inspection} documentStatus={null} canEdit={device.canEdit} onChanged={reload} />
              </div>
              <div data-testid="device-slot-nameplate">
                <NameplateCard key={`${device.nameplatePhotoUrl}-${device.label.serial}-${device.current.serialNumber}-${device.readAt}`} equipmentId={device.id} tag={device.tag} photoUrl={device.nameplatePhotoUrl} readAt={device.readAt} reading={device.reading} current={device.current} label={device.label} canEdit={device.canEdit} onSaved={reload} />
              </div>
            </div>
            <Button asChild variant="outline" className="self-start">
              <Link href={`/equipment/${device.id}`}>Otevřít celou kartu zařízení</Link>
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  return { open, dialog, loadingId: loading ? loadingId : null };
}
