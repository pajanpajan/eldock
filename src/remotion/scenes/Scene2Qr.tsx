import { QRCodeSVG } from "qrcode.react";
import { useMemo } from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";

import { LogoMark } from "@/components/layout/Logo";
import { renderSchematicSvg } from "@/lib/mock-graphics/schematic";

import { AppBar, Background, Badge, Caption, Scene, Tablet } from "../components";
import { COLORS, MONO, SCENES, pop, progress, svgUri } from "../theme";

const SCAN_START = 24;
const SCAN_END = 92;
const HIERARCHY = ["Závod Jablonec", "Budova Energetika", "1. NP – Trafostanice", "RH1 · Hlavní rozváděč"];

/** QR štítek Eldock nalepený na dvířkách rozváděče. */
function Label() {
  return (
    <div style={{ display: "flex", gap: 22, width: 560, height: 262, background: "#fff", color: "#000", borderRadius: 14, border: "5px solid #000", padding: 18 }}>
      <QRCodeSVG value="https://eldock.cz/equipment/eq-rh1?qr=A3F09C11B2" size={216} level="M" marginSize={0} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 26, borderBottom: "3px solid #000", paddingBottom: 6 }}>
          <LogoMark style={{ width: 34, height: 34 }} />
          ELDOCK
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 900, fontSize: 64, lineHeight: 1 }}>RH1</div>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Hlavní areálový rozváděč</div>
        <div style={{ fontFamily: MONO, fontSize: 18 }}>Revize do 03. 04. 2030</div>
      </div>
    </div>
  );
}

export function Scene2Qr() {
  const frame = useCurrentFrame();
  const { duration } = SCENES.qr;
  const schematic = useMemo(
    () => svgUri(renderSchematicSvg({ equipment: { tag: "RH1", name: "RH1 - Hlavní areálový rozváděč", ratedCurrent: "63 A" }, revision: { version: "v1.0", date: "29.10.2026", author: "Eldock CAE" } })),
    [],
  );

  const laser = interpolate(frame, [SCAN_START, (SCAN_START + SCAN_END) / 2, SCAN_END], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scanned = frame >= SCAN_END;
  const success = pop(frame, SCAN_END, 30, 10);
  const card = pop(frame, 168, 30, 16);

  return (
    <Scene duration={duration}>
      <Background>
        <Caption step="01" title="Naskenujte QR štítek – dokumentace je u stroje za 3 vteřiny" />

        <Tablet style={{ left: 120, top: 190, width: 980, height: 760 }}>
          <AppBar label="Skener QR" />
          {/* Pohled kamery: dvířka rozváděče se štítkem */}
          <div style={{ position: "absolute", inset: "64px 0 0 0", background: "linear-gradient(160deg, #3f4044 0%, #26272b 60%, #1b1c1f 100%)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 1 - card }}>
            <div style={{ position: "relative", transform: `scale(${1 + progress(frame, 0, SCAN_START) * 0.04})` }}>
              <Label />
              {/* rámeček zaměřovače */}
              <div style={{ position: "absolute", inset: -28, border: `5px solid ${scanned ? COLORS.green : COLORS.amber}`, borderRadius: 24, boxShadow: scanned ? `0 0 ${40 * success}px ${COLORS.green}` : "none" }} />
              {/* laserový paprsek */}
              {!scanned ? (
                <div
                  style={{
                    position: "absolute",
                    left: -40,
                    right: -40,
                    top: `${laser * 100}%`,
                    height: 6,
                    background: COLORS.red,
                    boxShadow: `0 0 24px 6px ${COLORS.red}`,
                    opacity: frame >= SCAN_START ? 1 : 0,
                  }}
                />
              ) : null}
            </div>
            {scanned ? (
              <div style={{ position: "absolute", bottom: 40, transform: `scale(${success})` }}>
                <Badge color={COLORS.green}>✓ Štítek RH1 načten</Badge>
              </div>
            ) : null}
          </div>

          {/* Karta zařízení s náhledem 1P schématu */}
          <div style={{ position: "absolute", inset: "64px 0 0 0", padding: 28, background: COLORS.bg, opacity: card, transform: `translateY(${(1 - card) * 80}px)` }}>
            <div style={{ fontFamily: MONO, fontSize: 18, color: COLORS.muted }}>Závod Jablonec › Energetika › 1. NP › RH1</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
              <span style={{ fontSize: 38, fontWeight: 800 }}>RH1 – Hlavní areálový rozváděč</span>
              <Badge color={COLORS.green}>Aktuální</Badge>
            </div>
            <div style={{ marginTop: 18, borderRadius: 16, overflow: "hidden", background: "#fff", border: `2px solid ${COLORS.panelBorder}` }}>
              <Img src={schematic} style={{ width: "100%", display: "block" }} />
            </div>
          </div>
        </Tablet>

        {/* Rozpad hierarchie */}
        <div style={{ position: "absolute", left: 1180, top: 300, display: "flex", flexDirection: "column", gap: 22 }}>
          {HIERARCHY.map((item, index) => {
            const enter = pop(frame, 100 + index * 16);
            const last = index === HIERARCHY.length - 1;
            return (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 18, opacity: enter, transform: `translateX(${(1 - enter) * 80}px)`, marginLeft: index * 44 }}>
                <span style={{ fontFamily: MONO, fontSize: 24, color: COLORS.amber }}>{index === 0 ? "▸" : "└"}</span>
                <span
                  style={{
                    fontSize: last ? 40 : 34,
                    fontWeight: last ? 800 : 600,
                    padding: "12px 24px",
                    borderRadius: 14,
                    border: `2px solid ${last ? COLORS.amber : COLORS.panelBorder}`,
                    background: last ? COLORS.amberSoft : COLORS.panel,
                  }}
                >
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </Background>
    </Scene>
  );
}
