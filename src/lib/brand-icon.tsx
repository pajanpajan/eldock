import { ImageResponse } from "next/og";

// Ikona aplikace (PWA, favicon, Apple) – stejná značka jako `components/layout/Logo`, vykreslená
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
          <path d="M9 8v16M9 8h5.5a8 8 0 0 1 0 16H9" fill="none" stroke={BRAND_DARK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={23.5} cy={8.5} r={2} fill={BRAND_DARK} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
