import { useMemo } from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";

import { renderEquipmentPhotoSvg } from "@/lib/mock-graphics/equipment-photo";

import { AppBar, Background, Badge, Caption, Scene, Tablet } from "../components";
import { COLORS, MONO, SCENES, pop, progress, svgUri } from "../theme";

// Kroužek kolem řady stykačů na „fotce“ rozváděče (souřadnice fotky 800 × 600).
const RING = { cx: 372, cy: 216, rx: 92, ry: 52 };
const DRAW_START = 44;
const DRAW_END = 128;

export function Scene3Redline() {
  const frame = useCurrentFrame();
  const { duration } = SCENES.redline;
  const photo = useMemo(() => svgUri(renderEquipmentPhotoSvg("switchboard", "RH1")), []);

  const press = interpolate(frame, [14, 20, 28], [1, 0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const editor = pop(frame, 26, 30, 16);
  const draw = progress(frame, DRAW_START, DRAW_END);
  // Mírně nepravidelný kroužek „prstem“ (přes 1,1 otáčky, aby se konce překryly).
  const angle = draw * Math.PI * 2.2;
  const pen = { x: RING.cx + RING.rx * Math.cos(angle) * (1 + 0.03 * Math.sin(angle * 3)), y: RING.cy + RING.ry * Math.sin(angle) };
  const perimeter = 2 * Math.PI * Math.sqrt((RING.rx ** 2 + RING.ry ** 2) / 2) * 1.1;
  const bubble = pop(frame, DRAW_END + 8, 30, 12);
  const sent = pop(frame, 196, 30, 14);

  return (
    <Scene duration={duration}>
      <Background>
        <Caption step="02" title="Červenka z haly: zakroužkujte změnu přímo do fotky" />

        <Tablet style={{ left: 120, top: 190, width: 1180, height: 790 }}>
          <AppBar label="RH1 · Nahlásit změnu" />
          <div style={{ position: "absolute", inset: "64px 0 0 0", padding: 24 }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "800 / 600", maxHeight: 640, borderRadius: 16, overflow: "hidden", border: `2px solid ${COLORS.panelBorder}` }}>
              <Img src={photo} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              <svg viewBox="0 0 800 600" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: editor }}>
                <ellipse
                  cx={RING.cx}
                  cy={RING.cy}
                  rx={RING.rx}
                  ry={RING.ry}
                  fill="none"
                  stroke={COLORS.red}
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeDasharray={perimeter}
                  strokeDashoffset={perimeter * (1 - draw)}
                  style={{ filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))" }}
                />
                {draw > 0 && draw < 1 ? (
                  <g transform={`translate(${pen.x} ${pen.y})`}>
                    <circle r={16} fill="rgba(239,68,68,0.25)" />
                    <circle r={7} fill={COLORS.red} />
                  </g>
                ) : null}
              </svg>
              {/* textová bublina */}
              <div
                style={{
                  position: "absolute",
                  left: "58%",
                  top: "10%",
                  maxWidth: 420,
                  padding: "16px 20px",
                  borderRadius: 16,
                  background: COLORS.red,
                  color: "#fff",
                  fontSize: 28,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                  transform: `scale(${bubble})`,
                  transformOrigin: "left bottom",
                }}
              >
                Výměna stykače K2
                <div style={{ fontSize: 22, fontWeight: 500, marginTop: 6 }}>→ posláno CAE projektantovi</div>
              </div>
            </div>
          </div>
          {/* Tlačítko Nahlásit změnu (před otevřením editoru) */}
          <div style={{ position: "absolute", inset: "64px 0 0 0", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(9,9,11,0.82)", opacity: 1 - editor }}>
            <div style={{ transform: `scale(${press})`, padding: "26px 48px", borderRadius: 18, background: COLORS.amber, color: COLORS.bg, fontSize: 40, fontWeight: 800 }}>✎ Nahlásit změnu</div>
          </div>
        </Tablet>

        {/* Ticket odeslaný do CAE */}
        <div style={{ position: "absolute", left: 1360, top: 380, width: 460, opacity: sent, transform: `translateX(${(1 - sent) * 120}px)` }}>
          <div style={{ padding: 28, borderRadius: 20, background: COLORS.panel, border: `2px solid ${COLORS.panelBorder}` }}>
            <div style={{ fontFamily: MONO, fontSize: 22, color: COLORS.muted }}>CAE Back-Office</div>
            <div style={{ fontSize: 40, fontWeight: 800, marginTop: 6 }}>ZM-2026-0043</div>
            <div style={{ fontSize: 24, color: COLORS.muted, marginTop: 6 }}>RH1 · fotka se zákresem + poznámka</div>
            <div style={{ marginTop: 18 }}>
              <Badge color="#f97316">Čeká na aktualizaci</Badge>
            </div>
          </div>
        </div>
      </Background>
    </Scene>
  );
}
