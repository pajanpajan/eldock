import { ImageResponse } from "next/og";

import { BRAND_DARK, BRAND_YELLOW } from "@/lib/brand-icon";
import { SEO_TITLE } from "@/lib/seo";

// Náhled odkazu https://eldock.cz (LinkedIn, Facebook, WhatsApp, Teams) – fáze 48. Černo-žlutý
// industriální design: výstražné šrafy, značka a čtyři hlavní výstupy AI Panel Builderu.

export const alt = SEO_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const POINTS = ["Rozváděč z fotky nebo od nuly", "Oteplení IEC TR 60890", "Dokumentace ČSN EN IEC 61439", "Štítek CE a prohlášení o shodě"];

export default function OpengraphImage() {
  const stripes = "repeating-linear-gradient(-45deg, #facc15 0 28px, #09090b 28px 56px)";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BRAND_DARK, color: "#fafafa" }}>
        <div style={{ height: 34, width: "100%", display: "flex", backgroundImage: stripes }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 72px", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <svg width={96} height={96} viewBox="0 0 32 32">
              <rect x={1.5} y={1.5} width={29} height={29} rx={7} fill={BRAND_YELLOW} />
              <path d="M7 23V9.5h18V23" fill="none" stroke={BRAND_DARK} strokeWidth={2.6} strokeLinejoin="round" />
              <path d="M17.6 11.5 12.8 17.4h3.3l-1.4 4.2 4.9-6.1h-3.3z" fill={BRAND_DARK} />
              <rect x={4.5} y={23} width={23} height={4} rx={1} fill={BRAND_DARK} />
            </svg>
            <div style={{ fontSize: 92, letterSpacing: -2, color: BRAND_YELLOW, display: "flex" }}>ELDOCK</div>
          </div>
          <div style={{ fontSize: 52, lineHeight: 1.12, display: "flex", maxWidth: 1050 }}>AI Panel Builder & Průmyslový dok dokumentace a revizí</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {POINTS.map((point) => (
              <div key={point} style={{ display: "flex", fontSize: 26, padding: "8px 18px", borderRadius: 10, border: `2px solid ${BRAND_YELLOW}`, color: "#fde68a" }}>
                {point}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 72px 30px", fontSize: 28, color: "#a1a1aa" }}>
          <span>eldock.cz</span>
          <span>Návrh rozváděčů · Revize ČSN 33 1500 · Pasportizace z fotky</span>
        </div>
        <div style={{ height: 16, width: "100%", display: "flex", backgroundImage: stripes }} />
      </div>
    ),
    size,
  );
}
