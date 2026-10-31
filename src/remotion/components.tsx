import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { LogoMark } from "@/components/layout/Logo";

import { COLORS, FONT, MONO, sceneFade } from "./theme";

/** Pozadí aplikace: černá s jemnou technickou mřížkou a vinětou. */
export function Background({ children }: { children?: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        fontFamily: FONT,
        color: COLORS.text,
      }}
    >
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)" }} />
      {children}
    </AbsoluteFill>
  );
}

/** Obal scény: prolnutí na začátku a konci, aby scény plynule navazovaly. */
export function Scene({ duration, children }: { duration: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: sceneFade(frame, duration) }}>{children}</AbsoluteFill>;
}

/** Popisek scény vlevo nahoře (číslo kroku + text). */
export function Caption({ step, title, style }: { step: string; title: string; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: 96, top: 80, display: "flex", alignItems: "center", gap: 20, ...style }}>
      <span style={{ fontFamily: MONO, fontSize: 26, color: COLORS.amber, border: `2px solid ${COLORS.amber}`, borderRadius: 10, padding: "6px 14px" }}>{step}</span>
      <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: -0.5 }}>{title}</span>
    </div>
  );
}

/** Rámeček tabletu (zařízení údržbáře v hale). */
export function Tablet({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        borderRadius: 44,
        padding: 22,
        background: "linear-gradient(145deg, #2a2a2e, #111113)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.7), inset 0 0 0 2px #3f3f46",
        ...style,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 26, overflow: "hidden", background: COLORS.bg }}>{children}</div>
    </div>
  );
}

/** Lišta aplikace uvnitř zařízení (logo Eldock + text). */
export function AppBar({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, height: 64, padding: "0 24px", borderBottom: `1px solid ${COLORS.panelBorder}`, background: "rgba(24,24,27,0.95)" }}>
      <LogoMark style={{ width: 34, height: 34 }} />
      <span style={{ fontWeight: 800, fontSize: 22 }}>
        <span style={{ color: COLORS.amber }}>EL</span>DOCK
      </span>
      <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 18, color: COLORS.muted }}>{label}</span>
    </div>
  );
}

/** Odznak stavu (zelený / modrý / oranžový / červený). */
export function Badge({ color, children, style }: { color: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: `2px solid ${color}`, background: `${color}22`, color, padding: "6px 16px", fontSize: 22, fontWeight: 700, ...style }}>
      {children}
    </span>
  );
}
