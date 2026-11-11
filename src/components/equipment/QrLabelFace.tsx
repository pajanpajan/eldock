"use client";

import { QRCodeSVG } from "qrcode.react";

import { LogoMark } from "@/components/layout/Logo";
import { BRAND } from "@/lib/brand";
import { LABEL_SIZE_MM, formatQrToken } from "@/lib/qr-label";
import { QR_LEGAL_NOTE } from "@/lib/legislation-2027";
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
        <div className="border-t-[0.3cqw] border-black pt-[0.6cqw] text-[2.15cqw] leading-tight" data-testid="qr-legal-note">
          {QR_LEGAL_NOTE}
        </div>
      </div>
    </div>
  );
}

/**
 * Fáze 92: čtvercový štítek na stroj 20 × 20 mm (QR a tag) nebo 40 × 40 mm (QR, tag a název) – stejný odkaz s kódem
 * štítku jako obdélníkový štítek 62 × 29 mm.
 */
export function QrSquareLabel({ label, size, className }: { label: LabelData; size: 20 | 40; className?: string }) {
  const shortName = label.name.replace(`${label.tag} - `, "");
  return (
    <div className={cn("qr-label @container flex aspect-square flex-col items-center justify-center overflow-hidden rounded-[2cqw] border-[1.2cqw] border-black bg-white text-black", size === 20 ? "gap-[2cqw] p-[5cqw]" : "gap-[1.5cqw] p-[5cqw]", className)} data-testid="qr-square-label" data-size={size}>
      <QRCodeSVG value={label.url} level="M" marginSize={0} className={size === 20 ? "size-[74cqw]" : "size-[62cqw]"} title={`QR kód – ${label.tag}`} />
      <div className={cn("max-w-full truncate font-mono leading-none font-black", size === 20 ? "text-[13cqw]" : "text-[11cqw]")}>{label.tag}</div>
      {size === 40 ? <div className="line-clamp-2 max-w-full text-center text-[6.5cqw] leading-tight font-medium">{shortName}</div> : null}
    </div>
  );
}
