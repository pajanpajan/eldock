"use client";

import { QRCodeSVG } from "qrcode.react";

import { QR_LOGO_SVG, labelPurpose, qrUrl } from "@/lib/qr-label-registry";
import { cn } from "@/lib/utils";

/**
 * Fáze 103: QR kód štítku ELDOCK – korekce chyb H (30 %), uprostřed vektorové logo „EL“ v rámečku (22 % strany kódu,
 * moduly pod logem vynechané), černobíle pro termotransfer 300 DPI. Rozměr v mm (tisk 1:1) nebo v px (náhled).
 */
export function EldockQr({ code, className, title }: { code: string; className?: string; title?: string }) {
  return (
    <QRCodeSVG
      value={qrUrl(code)}
      level="H"
      marginSize={0}
      size={256}
      bgColor="#ffffff"
      fgColor="#000000"
      imageSettings={{ src: QR_LOGO_SVG, width: 56, height: 56, excavate: true }}
      className={cn("block size-full", className)}
      title={title ?? `QR štítek ${code} – ${qrUrl(code)}`}
      data-testid="eldock-qr"
    />
  );
}

/**
 * Tvář fyzického štítku v milimetrech (tisk 1:1 na kotouč Zebra ZD421t nebo na arch A4): QR kód s logem vlevo,
 * vpravo sériové číslo, ELDOCK.CZ, název firmy (rozváděč, stroj) a účel štítku.
 */
export function EldockLabelFace({ code, purpose, companyName }: { code: string; purpose: string; companyName?: string | null }) {
  const spec = labelPurpose(purpose);
  const qr = spec.heightMm - 2;
  const small = spec.id === "APPLIANCE";
  return (
    <div className="eldock-label flex items-center overflow-hidden bg-white text-black" style={{ width: `${spec.widthMm}mm`, height: `${spec.heightMm}mm`, padding: "1mm", gap: small ? "1mm" : "1.6mm" }} data-testid="eldock-label" data-code={code} data-purpose={spec.id}>
      <div className="shrink-0" style={{ width: `${qr}mm`, height: `${qr}mm` }}>
        <EldockQr code={code} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch leading-none">
        <span className="font-mono font-black tracking-tight" style={{ fontSize: small ? "2.6mm" : spec.id === "SWITCHBOARD" ? "3.6mm" : "4.6mm" }}>
          {code}
        </span>
        {!small && companyName ? (
          <span className="truncate font-semibold" style={{ fontSize: spec.id === "SWITCHBOARD" ? "2.3mm" : "2.8mm" }}>
            {companyName}
          </span>
        ) : null}
        {spec.id === "MACHINE" ? (
          <span className="flex flex-col gap-[0.8mm]" style={{ fontSize: "2.2mm" }}>
            <span className="border-b border-black pb-[0.4mm]">Stroj: </span>
            <span className="border-b border-black pb-[0.4mm]">Napájení: </span>
          </span>
        ) : null}
        <span className="font-black" style={{ fontSize: small ? "1.9mm" : "2.3mm" }}>
          {small ? "REVIZE ELDOCK.CZ" : `ELDOCK.CZ · ${spec.caption}`}
        </span>
      </div>
    </div>
  );
}
