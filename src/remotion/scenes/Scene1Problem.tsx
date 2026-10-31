import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { LogoMark } from "@/components/layout/Logo";

import { Background, Scene } from "../components";
import { COLORS, MONO, SCENES, pop, progress } from "../theme";

const LINES = ["Ztracená schémata v šanonech?", "Drahé prostoje při poruše?"];
const REVEAL = 118; // záblesk a nástup značky

/** Papírové výkresy, které padají a otáčejí se (chaos v šanonech). */
function FallingSheet({ index, frame }: { index: number; frame: number }) {
  const x = 140 + ((index * 271) % 1640);
  const y = interpolate(frame, [0, REVEAL], [-260 - index * 40, 1100 + (index % 3) * 60]);
  const rotate = interpolate(frame, [0, REVEAL], [-25 + index * 13, 30 + index * 9]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 150,
        height: 200,
        transform: `rotate(${rotate}deg)`,
        background: "#e4e4e7",
        opacity: 0.16,
        borderRadius: 6,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
      }}
    >
      {[0, 1, 2, 3, 4].map((line) => (
        <div key={line} style={{ height: 6, margin: "22px 18px 0", background: "#52525b", width: `${60 + ((line * 17 + index * 7) % 30)}%` }} />
      ))}
    </div>
  );
}

export function Scene1Problem() {
  const frame = useCurrentFrame();
  const { duration } = SCENES.problem;
  // Varovné pulzování (červený svit) před příchodem Eldocku.
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  const problemOut = 1 - progress(frame, REVEAL - 10, REVEAL);
  const flash = interpolate(frame, [REVEAL - 6, REVEAL, REVEAL + 14], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logo = pop(frame, REVEAL, 30, 11);
  const tagline = progress(frame, REVEAL + 28, REVEAL + 50);
  const bolt = 0.6 + 0.4 * Math.sin((frame - REVEAL) / 5);

  return (
    <Scene duration={duration}>
      <Background>
        {Array.from({ length: 9 }, (_, index) => (
          <FallingSheet key={index} index={index} frame={frame} />
        ))}

        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36, opacity: problemOut }}>
          {LINES.map((line, index) => {
            const enter = pop(frame, 8 + index * 34);
            return (
              <div
                key={line}
                style={{
                  fontSize: 92,
                  fontWeight: 800,
                  letterSpacing: -1.5,
                  transform: `translateY(${(1 - enter) * 60}px)`,
                  opacity: enter,
                  textShadow: `0 0 ${30 + pulse * 40}px rgba(239, 68, 68, ${0.35 + pulse * 0.45})`,
                }}
              >
                {line}
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: MONO, fontSize: 30, color: COLORS.red, opacity: progress(frame, 70, 85) }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: COLORS.red, opacity: 0.4 + pulse * 0.6, boxShadow: `0 0 ${20 * pulse}px ${COLORS.red}` }} />
            STROJ STOJÍ · HLEDÁ SE PLATNÝ VÝKRES
          </div>
        </AbsoluteFill>

        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, opacity: frame >= REVEAL ? 1 : 0 }}>
          <div style={{ position: "relative", transform: `scale(${0.3 + logo * 0.7})` }}>
            <div style={{ position: "absolute", inset: -60, borderRadius: 999, background: `radial-gradient(circle, rgba(234,179,8,${0.35 * bolt}) 0%, transparent 70%)` }} />
            <LogoMark style={{ width: 260, height: 260, position: "relative" }} />
          </div>
          <div style={{ fontSize: 150, fontWeight: 900, letterSpacing: interpolate(logo, [0, 1], [40, -2]), opacity: logo }}>
            <span style={{ color: COLORS.amber }}>EL</span>DOCK
          </div>
          <div style={{ fontSize: 48, color: COLORS.muted, opacity: tagline, transform: `translateY(${(1 - tagline) * 20}px)` }}>Průmyslový dok dokumentace a revizí</div>
        </AbsoluteFill>

        <AbsoluteFill style={{ background: COLORS.amber, opacity: flash * 0.85, mixBlendMode: "screen" }} />
      </Background>
    </Scene>
  );
}
