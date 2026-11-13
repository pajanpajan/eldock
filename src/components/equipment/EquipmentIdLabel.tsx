"use client";

import { QRCodeSVG } from "qrcode.react";

import { LogoMark } from "@/components/layout/Logo";
import { idLabelSize, type IdLabelData, type IdLabelSize } from "@/lib/equipment-id-label";
import { cn } from "@/lib/utils";

/**
 * Fáze 111: identifikační štítek zařízení ELDOCK pro kotouč Zebra ZD421t (30 × 15 mm / 50 × 25 mm), černobíle pro
 * termotransfer. QR kód s logem ELDOCK uprostřed vede na kartu štítku EL-xxxxxx. Písmo v `cqw` – náhled i tisk
 * v milimetrech mají stejné proporce.
 */
export function EquipmentIdLabel({ label, size = "50x25", className }: { label: IdLabelData; size?: IdLabelSize; className?: string }) {
  const spec = idLabelSize(size);
  const small = spec.id === "30x15";
  return (
    <div
      className={cn("id-label @container flex overflow-hidden rounded-[1.5cqw] border-[0.6cqw] border-black bg-white text-black", className)}
      style={{ aspectRatio: `${spec.widthMm} / ${spec.heightMm}` }}
      data-testid="equipment-id-label"
      data-size={spec.id}
    >
      <div className="relative flex aspect-square h-full shrink-0 items-center justify-center p-[2.4cqw]">
        {label.qrUrl ? (
          <QRCodeSVG value={label.qrUrl} level="H" marginSize={0} className="size-full" title={`QR kód – ${label.serial}`} />
        ) : (
          <span className="flex size-full items-center justify-center border border-dashed border-black text-center text-[4cqw] leading-tight">QR přidělí tisk</span>
        )}
        {label.qrUrl ? (
          <span className="absolute flex size-[22%] items-center justify-center rounded-[1cqw] bg-white p-[0.4cqw]">
            <LogoMark className="size-full" />
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-[2.4cqw] pr-[2.4cqw]">
        <div className="flex items-baseline justify-between gap-[1cqw] border-b-[0.35cqw] border-black pb-[0.6cqw]">
          <span className="font-mono text-[4.6cqw] leading-none font-black" data-testid="id-label-serial">
            {label.serial ?? "EL-……"}
          </span>
          <span className="truncate font-mono text-[3.4cqw] leading-none font-bold">{label.tag}</span>
        </div>
        <div className={cn("leading-tight font-black", small ? "line-clamp-1 text-[6cqw]" : "line-clamp-2 text-[5.4cqw]")} data-testid="id-label-title">
          {label.title}
        </div>
        {label.brandModel ? <div className="truncate text-[3.8cqw] leading-tight font-semibold">{label.brandModel}</div> : null}
        <div className="truncate font-mono text-[3.8cqw] leading-tight font-bold" data-testid="id-label-sn">
          S/N: {label.serialNumber ?? "–"}
        </div>
        {!small ? <div className="truncate text-[3.2cqw] leading-tight">{label.location}</div> : null}
        {/* Třída a skupina ČSN 33 1600 a termín příští revize – každý na vlastním řádku, aby se neořezaly */}
        {label.classGroup && !small ? <div className="truncate text-[3cqw] leading-tight" data-testid="id-label-class">{label.classGroup}</div> : null}
        <div className={cn("truncate leading-tight font-bold", small ? "text-[3.4cqw]" : "text-[3.2cqw]")} data-testid="id-label-revision">
          {label.nextRevision}
        </div>
      </div>
    </div>
  );
}
