import { ImageResponse } from "next/og";

// Ikona aplikace Eldock (PWA, favicon, Apple) – stejná značka jako `LogoMark` v `components/layout/Logo`, vykreslená
// přes ImageResponse. Barvy: primární žlutá (yellow-400) a pozadí zinc-950.

export const BRAND_YELLOW = "#facc15";
export const BRAND_DARK = "#09090b";

/** `padded` = ikona s okrajem pro maskovatelné ikony (Android ořezává do kruhu). */
export function brandIcon(size: number, { padded = false }: { padded?: boolean } = {}) {
  const inner = padded ? Math.round(size * 0.72) : size;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: padded ? BRAND_YELLOW : "transparent",
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 32 32">
          <rect x={padded ? 0 : 1.5} y={padded ? 0 : 1.5} width={padded ? 32 : 29} height={padded ? 32 : 29} rx={padded ? 0 : 7} fill={BRAND_YELLOW} />
          <path d="M7 23V9.5h18V23" fill="none" stroke={BRAND_DARK} strokeWidth={2.6} strokeLinejoin="round" />
          <path d="M17.6 11.5 12.8 17.4h3.3l-1.4 4.2 4.9-6.1h-3.3z" fill={BRAND_DARK} />
          <rect x={4.5} y={23} width={23} height={4} rx={1} fill={BRAND_DARK} />
          <path d="M8 27l2.4-4M12.5 27l2.4-4M17 27l2.4-4M21.5 27l2.4-4" stroke={BRAND_YELLOW} strokeWidth={1.3} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
