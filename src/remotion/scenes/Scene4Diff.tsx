import { useMemo } from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";

import { renderSchematicSvg } from "@/lib/mock-graphics/schematic";

import { Background, Badge, Caption, Scene } from "../components";
import { COLORS, MONO, SCENES, pop, svgUri } from "../theme";

const EQUIPMENT = { tag: "RH1", name: "RH1 - Hlavní areálový rozváděč", ratedCurrent: "63 A" };
const SLIDE_START = 36;
const SLIDE_END = 200;

export function Scene4Diff() {
  const frame = useCurrentFrame();
  const { duration } = SCENES.diff;
  const [before, after] = useMemo(
    () => [
      svgUri(renderSchematicSvg({ equipment: EQUIPMENT, revision: { version: "v1.2", date: "12.03.2026", author: "Ing. Lucie Marková" } })),
      svgUri(
        renderSchematicSvg({
          equipment: EQUIPMENT,
          revision: { version: "v1.3", date: "31.10.2026", author: "Ing. Lucie Marková" },
          variant: {
            overrides: { K2: { description: "Stykač 3P 25 A, Siemens 3RT2026", partNumber: "3RT2026-1BB40" } },
            changed: ["K2"],
            changeNote: "Výměna stykače K2 za Siemens 3RT2026",
          },
        }),
      ),
    ],
    [],
  );

  const slide = interpolate(frame, [SLIDE_START, SLIDE_END], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const approved = pop(frame, SLIDE_END + 14, 30, 11);
  const ui = pop(frame, 4, 30, 16);

  return (
    <Scene duration={duration}>
      <Background>
        <Caption step="03" title="Vedoucí údržby schválí novou revizi výkresu za pár vteřin" />

        <div style={{ position: "absolute", left: 120, top: 190, width: 1680, opacity: ui, transform: `translateY(${(1 - ui) * 40}px)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
            <span style={{ fontSize: 34, fontWeight: 700 }}>Schválení revize · RH1</span>
            <Badge color={COLORS.red}>v1.2 stará</Badge>
            <span style={{ fontSize: 30, color: COLORS.muted }}>→</span>
            <Badge color={COLORS.green}>v1.3 nová</Badge>
            <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 22, color: COLORS.muted }}>Posuvník · Visual Diff</span>
          </div>

          <div style={{ position: "relative", width: 1090, aspectRatio: "1190 / 842", borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: "0 30px 90px rgba(0,0,0,0.6)" }}>
            {/* stará revize s červeným nádechem */}
            <AbsoluteFill>
              <Img src={before} style={{ width: "100%", height: "100%" }} />
              <AbsoluteFill style={{ background: "rgba(239,68,68,0.16)", mixBlendMode: "multiply" }} />
            </AbsoluteFill>
            {/* nová revize se zeleným nádechem – odkrývá ji posuvník zleva */}
            <AbsoluteFill style={{ clipPath: `inset(0 ${100 - slide}% 0 0)` }}>
              <Img src={after} style={{ width: "100%", height: "100%" }} />
              <AbsoluteFill style={{ background: "rgba(34,197,94,0.14)", mixBlendMode: "multiply" }} />
            </AbsoluteFill>
            {/* lišta posuvníku */}
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${slide}%`, width: 6, marginLeft: -3, background: COLORS.amber, boxShadow: `0 0 20px ${COLORS.amber}` }}>
              <div style={{ position: "absolute", top: "50%", left: -26, width: 58, height: 58, marginTop: -29, borderRadius: 999, background: COLORS.amber, color: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900 }}>⇆</div>
            </div>
          </div>
        </div>

        {/* Shrnutí změny a schválení */}
        <div style={{ position: "absolute", left: 1290, top: 300, width: 510, display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ padding: 26, borderRadius: 18, background: COLORS.panel, border: `2px solid ${COLORS.panelBorder}`, opacity: ui }}>
            <div style={{ fontFamily: MONO, fontSize: 20, color: COLORS.muted }}>Změna v revizi v1.3</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, lineHeight: 1.3 }}>Výměna stykače K2 za Siemens 3RT2026</div>
            <div style={{ fontSize: 22, color: COLORS.muted, marginTop: 10 }}>Ing. Lucie Marková · CAE</div>
          </div>
          <div
            style={{
              padding: "22px 26px",
              borderRadius: 18,
              background: approved > 0.05 ? COLORS.green : COLORS.amber,
              color: COLORS.bg,
              fontSize: 30,
              fontWeight: 800,
              textAlign: "center",
              transform: `scale(${1 + approved * 0.05})`,
              boxShadow: approved > 0.05 ? `0 0 ${50 * approved}px rgba(34,197,94,0.6)` : "none",
            }}
          >
            {approved > 0.05 ? "✓ Schváleno – v1.3 platí" : "Potvrdit a propsat do systému"}
          </div>
        </div>
      </Background>
    </Scene>
  );
}
