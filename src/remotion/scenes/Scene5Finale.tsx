import { AbsoluteFill, useCurrentFrame } from "remotion";

import { LogoMark } from "@/components/layout/Logo";

import { Background, Badge, Caption, Scene } from "../components";
import { COLORS, MONO, SCENES, pop, progress } from "../theme";

const PACKSHOT = 160;
const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
/** Dny s revizí v listopadu 2026 (1. 11. je neděle → posun o 6). */
const INSPECTION_DAYS = new Map([
  [4, COLORS.green],
  [11, COLORS.green],
  [17, COLORS.amber],
  [24, COLORS.green],
  [26, COLORS.red],
]);

function Calendar({ frame }: { frame: number }) {
  return (
    <div style={{ width: 760, padding: 30, borderRadius: 24, background: COLORS.panel, border: `2px solid ${COLORS.panelBorder}` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <span style={{ fontSize: 34, fontWeight: 800 }}>Plánovač revizí</span>
        <span style={{ fontFamily: MONO, fontSize: 24, color: COLORS.muted }}>listopad 2026</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
        {DAYS.map((day) => (
          <div key={day} style={{ fontFamily: MONO, fontSize: 18, color: COLORS.muted, textAlign: "center" }}>
            {day}
          </div>
        ))}
        {Array.from({ length: 42 }, (_, cell) => {
          const day = cell - 5;
          const valid = day >= 1 && day <= 30;
          const mark = valid ? INSPECTION_DAYS.get(day) : undefined;
          const enter = pop(frame, 6 + cell * 0.8, 30, 18);
          const highlight = day === 4 ? 0.5 + 0.5 * Math.sin(frame / 5) : 0;
          return (
            <div
              key={cell}
              style={{
                height: 58,
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontSize: 24,
                fontWeight: 600,
                opacity: valid ? enter : 0,
                background: mark ? `${mark}22` : "rgba(255,255,255,0.03)",
                border: `2px solid ${mark ? mark : "transparent"}`,
                boxShadow: highlight ? `0 0 ${24 * highlight}px ${COLORS.green}` : "none",
              }}
            >
              {valid ? day : ""}
              {mark ? <span style={{ width: 10, height: 10, borderRadius: 999, background: mark }} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Protocol({ frame }: { frame: number }) {
  const sheet = pop(frame, 40, 30, 16);
  const stamp = pop(frame, 112, 30, 9);
  const rows = [
    ["Odpor ochranného vodiče R_PE", "0,12 Ω", "≤ 0,5 Ω"],
    ["Izolační odpor R_iso", "250 MΩ", "≥ 1 MΩ"],
    ["Unikající proud I_PE", "0,4 mA", "≤ 3,5 mA"],
    ["Funkční zkouška", "vyhovuje", "bez závad"],
  ];
  return (
    <div style={{ position: "relative", width: 620, height: 820, padding: 40, background: "#fff", color: "#000", borderRadius: 10, boxShadow: "0 40px 100px rgba(0,0,0,0.7)", opacity: sheet, transform: `translateY(${(1 - sheet) * 140}px) rotate(${(1 - sheet) * 4}deg)` }}>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#52525b" }}>NV 190/2022 SB. · ČSN 33 1500 · ČSN 33 2000-6</div>
      <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, borderBottom: "3px solid #000", paddingBottom: 12 }}>Zpráva o revizi elektrického zařízení</div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 18px", fontSize: 18, marginTop: 18 }}>
        <span style={{ color: "#52525b" }}>Zařízení</span>
        <b>RH1 – Hlavní areálový rozváděč</b>
        <span style={{ color: "#52525b" }}>Druh revize</span>
        <b>Pravidelná revize</b>
        <span style={{ color: "#52525b" }}>Revizní technik</span>
        <b>Ing. Jiří Kovář · TIČR E-2210/2019</b>
      </div>
      <div style={{ marginTop: 24, border: "2px solid #a1a1aa" }}>
        {rows.map(([label, value, limit], index) => (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 0.8fr", fontSize: 17, borderTop: index ? "1px solid #d4d4d8" : "none", padding: "10px 12px", opacity: progress(frame, 64 + index * 10, 74 + index * 10) }}>
            <span>{label}</span>
            <b style={{ fontFamily: MONO }}>{value}</b>
            <span style={{ fontFamily: MONO, color: "#52525b" }}>{limit}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, border: "3px solid #000", padding: "14px 16px", fontSize: 22, fontWeight: 800, opacity: progress(frame, 100, 110) }}>Zařízení je schopno bezpečného provozu.</div>
      <div
        style={{
          position: "absolute",
          right: 50,
          bottom: 60,
          width: 210,
          height: 210,
          borderRadius: 999,
          border: `6px double ${COLORS.green}`,
          color: COLORS.green,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 28,
          textAlign: "center",
          opacity: stamp,
          transform: `rotate(-14deg) scale(${2 - stamp})`,
        }}
      >
        SCHVÁLENO
        <span style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>Revizní technik</span>
      </div>
    </div>
  );
}

export function Scene5Finale() {
  const frame = useCurrentFrame();
  const { duration } = SCENES.finale;
  const content = 1 - progress(frame, PACKSHOT - 14, PACKSHOT);
  const valid = pop(frame, 30, 30, 10);
  const logo = pop(frame, PACKSHOT, 30, 12);
  const claim = progress(frame, PACKSHOT + 22, PACKSHOT + 44);
  const domain = pop(frame, PACKSHOT + 46, 30, 10);
  const glow = 0.6 + 0.4 * Math.sin(frame / 6);

  return (
    <Scene duration={duration}>
      <Background>
        <AbsoluteFill style={{ opacity: content }}>
          <Caption step="04" title="Revize VTZ pod kontrolou – protokol do PDF jedním klikem" />
          <div style={{ position: "absolute", left: 120, top: 210, display: "flex", flexDirection: "column", gap: 28 }}>
            <Calendar frame={frame} />
            <div style={{ transform: `scale(${valid})`, transformOrigin: "left center" }}>
              <Badge color={COLORS.green} style={{ fontSize: 32, padding: "12px 26px" }}>
                ✓ VTZ revize platná · RH1 do 03. 04. 2030
              </Badge>
            </div>
          </div>
          <div style={{ position: "absolute", left: 1100, top: 190 }}>
            <Protocol frame={frame} />
          </div>
        </AbsoluteFill>

        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34, opacity: frame >= PACKSHOT ? 1 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 36, transform: `scale(${0.6 + logo * 0.4})`, opacity: logo }}>
            <LogoMark style={{ width: 180, height: 180 }} />
            <span style={{ fontSize: 140, fontWeight: 900, letterSpacing: -2 }}>
              <span style={{ color: COLORS.amber }}>EL</span>DOCK
            </span>
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, opacity: claim, transform: `translateY(${(1 - claim) * 24}px)` }}>Konec chaosu v papírových výkresech</div>
          <div
            style={{
              marginTop: 18,
              padding: "18px 64px",
              borderRadius: 999,
              border: `4px solid ${COLORS.amber}`,
              color: COLORS.amber,
              fontFamily: MONO,
              fontSize: 96,
              fontWeight: 800,
              transform: `scale(${domain})`,
              boxShadow: `0 0 ${60 * glow}px rgba(234,179,8,0.45)`,
            }}
          >
            eldock.cz
          </div>
          <div style={{ fontFamily: MONO, fontSize: 28, color: COLORS.muted, opacity: progress(frame, PACKSHOT + 70, PACKSHOT + 90) }}>Elektrodokumentace · Revize · Údržba</div>
        </AbsoluteFill>
      </Background>
    </Scene>
  );
}
