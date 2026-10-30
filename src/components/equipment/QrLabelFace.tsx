"use client";

import { QRCodeSVG } from "qrcode.react";

import { LogoMark } from "@/components/layout/Logo";
import { BRAND } from "@/lib/brand";
import { LABEL_SIZE_MM, formatQrToken } from "@/lib/qr-label";
import { cn } from "@/lib/utils";

export interface LabelData {
  url: string;
  tag: string;
  name: string;
  equipmentId: string;
  token: string | null;
  /** „Revize do 12. 3. 2027“ / „Bez revize“ */
  validity: string;
}

/**
 * Tvář fyzického štítku 62 × 29 mm (černobíle pro termotiskárny). Velikosti písma jsou v `cqw`,
 * takže náhled na obrazovce i tisk v milimetrech mají stejné proporce.
 */
export function QrLabelFace({ label, className }: { label: LabelData; className?: string }) {
  const shortName = label.name.replace(`${label.tag} - `, "");
  return (
    <div
      className={cn("qr-label @container flex overflow-hidden rounded-[1.5cqw] border-[0.5cqw] border-black bg-white text-black", className)}
      style={{ aspectRatio: `${LABEL_SIZE_MM.width} / ${LABEL_SIZE_MM.height}` }}
      data-testid="qr-label"
    >
      <div className="flex aspect-square h-full shrink-0 items-center justify-center p-[3cqw]">
        <QRCodeSVG value={label.url} level="M" marginSize={0} className="size-full" title={`QR kód – ${label.tag}`} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-[3cqw] pr-[3cqw]">
        <div className="flex items-center gap-[1.5cqw] border-b-[0.4cqw] border-black pb-[1cqw] text-[4.2cqw] font-extrabold tracking-wide">
          <LogoMark className="size-[6cqw]" />
          {BRAND.mark}
          <span className="ml-auto font-mono text-[3.2cqw] font-semibold">{BRAND.domain}</span>
        </div>
        <div className="truncate font-mono text-[9cqw] leading-none font-black">{label.tag}</div>
        <div className="line-clamp-2 text-[3.8cqw] leading-tight font-medium">{shortName}</div>
        <div className="flex flex-col font-mono text-[3.2cqw] leading-tight">
          <span className="truncate">ID {label.equipmentId}</span>
          <span className="truncate">{label.token ? `Kód ${formatQrToken(label.token)}` : "Kód –"}</span>
          <span className="truncate font-sans font-bold">{label.validity}</span>
        </div>
      </div>
    </div>
  );
}
