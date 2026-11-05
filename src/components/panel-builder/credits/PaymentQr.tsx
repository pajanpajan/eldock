"use client";

import { QRCodeSVG } from "qrcode.react";

/** Český QR kód platby (SPD 1.0) – pro mobilní bankovnictví. */
export function PaymentQr({ payload, size = 200 }: { payload: string; size?: number }) {
  return (
    <div className="inline-flex flex-col items-center gap-1 rounded-lg bg-white p-3 text-black" data-testid="payment-qr" data-spd={payload}>
      <QRCodeSVG value={payload} size={size} level="M" marginSize={0} />
      <span className="text-[10px] font-semibold tracking-wide">QR Platba</span>
    </div>
  );
}
