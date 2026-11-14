// Fáze 114: věrná vektorová grafika příslušenství na DIN liště – rozbočovací svorkovnice HLAK s barevnými komorami
// L1 / L2 / L3 / N / PE a mosaznými svorkovými tělesy, řadová svorka (profil s klecovými svorkami, popisovým štítkem
// a můstkovou drážkou), měděná hřebenová lišta, žlutá koncovka hřebenu, pomocný kontakt, vypínací a podpěťová spoušť,
// pojistkový odpínač s vložkou 10 × 38, zásuvka na DIN, LED signálka a krycí záslepka. Čisté SVG bez stavu.

import type { ReactNode } from "react";

import { busbarPhases, hlakChambers, hlakText, indicatorLeds, rowTerminalConductor, type AccessoryKind } from "@/lib/panel-builder/accessory-symbols";
import type { VectorDevice } from "@/lib/panel-builder/vector-symbols";
import type { Rect } from "@/lib/panel-builder/vector-layout";

const FONT = "ui-sans-serif, system-ui, Arial, sans-serif";
const BRASS = "#d4a72c";
const BRASS_EDGE = "#8a6d1a";
const COPPER = "#c2410c";

export interface AccessoryColors {
  body: string;
  band: string;
  stroke: string;
  text: string;
  muted: string;
  screw: string;
  lever: string;
}

/** Text zúžený do šířky (nikdy nepřeteče do souseda). */
function Fit({ x, y, text, size, max, anchor = "middle", weight, fill, testId }: { x: number; y: number; text: string; size: number; max: number; anchor?: "start" | "middle" | "end"; weight?: number; fill: string; testId?: string }) {
  if (!text) return null;
  const estimated = text.length * size * 0.58;
  return (
    <text x={x} y={y} fontSize={size} fontFamily={FONT} fontWeight={weight} fill={fill} textAnchor={anchor} {...(estimated > max ? { textLength: Math.max(4, max), lengthAdjust: "spacingAndGlyphs" } : {})} data-testid={testId}>
      {text}
    </text>
  );
}

function Screw({ cx, cy, r, color, stroke }: { cx: number; cy: number; r: number; color: string; stroke: string }) {
  return (
    <g data-screw="">
      <circle cx={cx} cy={cy} r={r} fill={color} stroke={stroke} strokeWidth={1} />
      <line x1={cx - r * 0.65} y1={cy + r * 0.65} x2={cx + r * 0.65} y2={cy - r * 0.65} stroke={stroke} strokeWidth={1} />
    </g>
  );
}

/** Tělo modulového přístroje se šroubovými svorkami nahoře a dole (pomocný kontakt, spouště, pojistka, zásuvka, signálka). */
function ModuleBody({ x, y, w, h, colors, terminals }: { x: number; y: number; w: number; h: number; colors: AccessoryColors; terminals: [string, string] | null }) {
  const count = Math.max(1, Math.round(w / 40));
  const r = Math.max(2, Math.min(6, w / count / 2 - 3));
  const screws = (cy: number) => Array.from({ length: count }, (_, index) => <Screw key={index} cx={x + 1 + ((w - 2) * (index + 0.5)) / count} cy={cy} r={r} color={colors.screw} stroke={colors.stroke} />);
  return (
    <>
      <rect x={x + 1} y={y} width={w - 2} height={h} rx={3} fill={colors.body} stroke={colors.stroke} strokeWidth={1.2} />
      <rect x={x + 1} y={y} width={w - 2} height={18} rx={3} fill={colors.band} stroke={colors.stroke} strokeWidth={0.8} />
      <rect x={x + 1} y={y + h - 18} width={w - 2} height={18} rx={3} fill={colors.band} stroke={colors.stroke} strokeWidth={0.8} />
      {screws(y + 9)}
      {screws(y + h - 9)}
      {terminals ? (
        <g data-terminal-numbers={terminals.join("/")}>
          <Fit x={x + w / 2} y={y + 25} text={terminals[0]} size={6.5} max={w - 4} weight={700} fill={colors.muted} />
          <Fit x={x + w / 2} y={y + 100} text={terminals[1]} size={6.5} max={w - 4} weight={700} fill={colors.muted} />
        </g>
      ) : null}
    </>
  );
}

/** Rozbočovací svorkovnice HLAK (2M–4M): izolační komory vedle sebe, v každé mosazné těleso se 2 velkými a 2–4 malými zdířkami. */
function Hlak({ device, x, y, w, colors }: { device: VectorDevice; x: number; y: number; w: number; colors: AccessoryColors }) {
  const chambers = hlakChambers(device.modulesWidth, device.poles);
  const inner = w - 6;
  const cw = inner / chambers.length;
  const small = Math.max(2, Math.min(4, Math.floor(cw / 7)));
  return (
    <g data-terminal="hlak" data-chambers={chambers.length}>
      {/* izolační základna */}
      <rect x={x + 1} y={y} width={w - 2} height={100} rx={4} fill={colors.band} stroke={colors.stroke} strokeWidth={1.2} />
      <Fit x={x + 5} y={y + 12} text={device.designation} size={10} max={inner * 0.42} anchor="start" weight={800} fill={colors.text} testId="symbol-designation" />
      <Fit x={x + w - 5} y={y + 12} text={hlakText(device.typeCode)} size={7.5} max={inner * 0.56} anchor="end" weight={700} fill={colors.text} testId="symbol-hlak" />
      {chambers.map((chamber, index) => {
        const cx = x + 3 + cw * index;
        const mid = cx + cw / 2;
        const bodyW = Math.max(6, cw - 8);
        const big = Math.max(2.2, Math.min(5.5, bodyW * 0.22));
        return (
          <g key={chamber.conductor} data-chamber={chamber.conductor} data-fill={chamber.fill}>
            <rect x={cx + 1} y={y + 17} width={cw - 2} height={81} rx={3} fill={chamber.fill} stroke="#0f172a" strokeWidth={0.8} />
            {chamber.stripe ? <rect x={cx + 1.5} y={y + 17.5} width={Math.max(2, (cw - 3) * 0.28)} height={80} rx={2} fill={chamber.stripe} data-stripe="" /> : null}
            <Fit x={mid} y={y + 27} text={chamber.conductor} size={7.5} max={cw - 3} weight={800} fill={chamber.text} />
            {/* mosazné svorkové těleso: 2 velké zdířky / šrouby přívodu a 2–4 menší zdířky vývodů */}
            <rect x={mid - bodyW / 2} y={y + 31} width={bodyW} height={63} rx={2} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={0.8} data-brass="" />
            {[y + 41, y + 53].map((cy) => (
              <Screw key={cy} cx={mid} cy={cy} r={big} color="#a16207" stroke="#422006" />
            ))}
            {Array.from({ length: small }, (_, hole) => (
              <circle key={hole} cx={mid} cy={y + 64 + hole * (26 / Math.max(1, small))} r={Math.max(1.2, big * 0.5)} fill="#422006" data-outlet="" />
            ))}
          </g>
        );
      })}
    </g>
  );
}

/** Řadová svorka 0,5–1M: profil s horní a spodní klecovou svorkou, popisový štítek uprostřed a můstková drážka. */
function RowTerminal({ device, x, y, w, colors }: { device: VectorDevice; x: number; y: number; w: number; colors: AccessoryColors }) {
  const conductor = rowTerminalConductor([device.typeCode, device.label].filter(Boolean).join(" "));
  const bw = Math.max(12, Math.min(w - 4, 26));
  const x0 = x + (w - bw) / 2;
  const clamp = (cy: number) => (
    <g data-cage-clamp="">
      <rect x={x0 + bw * 0.18} y={cy - 5} width={bw * 0.64} height={10} rx={1.5} fill="#0f172a" stroke={colors.stroke} strokeWidth={0.6} />
      <rect x={x0 + bw * 0.3} y={cy - 2.5} width={bw * 0.4} height={5} fill="#94a3b8" />
    </g>
  );
  return (
    <g data-terminal="row" data-conductor={conductor.conductor}>
      {/* profil svorky – užší hlava a pata, širší střed na liště */}
      <path
        d={`M${x0 + bw * 0.12} ${y + 2} H${x0 + bw * 0.88} L${x0 + bw} ${y + 22} V${y + 78} L${x0 + bw * 0.88} ${y + 98} H${x0 + bw * 0.12} L${x0} ${y + 78} V${y + 22} Z`}
        fill={conductor.fill}
        stroke="#0f172a"
        strokeWidth={0.9}
      />
      {conductor.stripe ? <rect x={x0 + bw * 0.42} y={y + 3} width={bw * 0.16} height={94} fill={conductor.stripe} data-stripe="" /> : null}
      {clamp(y + 11)}
      <Screw cx={x0 + bw / 2} cy={y + 27} r={Math.min(4, bw * 0.2)} color={colors.screw} stroke={colors.stroke} />
      {/* můstková drážka (propojky) */}
      <rect x={x0 + bw * 0.2} y={y + 35} width={bw * 0.6} height={4} rx={1} fill="#0f172a" data-bridge-slot="" />
      {/* popisový štítek */}
      <rect x={x0 + 1.5} y={y + 43} width={bw - 3} height={14} rx={1} fill="#f8fafc" stroke="#0f172a" strokeWidth={0.5} data-marker="" />
      <Fit x={x0 + bw / 2} y={y + 53} text={device.designation} size={7} max={bw - 5} weight={800} fill="#0f172a" testId="symbol-designation" />
      <Screw cx={x0 + bw / 2} cy={y + 73} r={Math.min(4, bw * 0.2)} color={colors.screw} stroke={colors.stroke} />
      {clamp(y + 89)}
    </g>
  );
}

/** Hřebenová propojovací lišta: šedobílý izolační profil, měděná přípojnice s vidličkami a potisk fází. */
function Busbar({ device, x, y, w, colors }: { device: VectorDevice; x: number; y: number; w: number; colors: AccessoryColors }) {
  const phases = busbarPhases(device.poles, device.typeCode);
  const teeth = Math.max(1, Math.round(device.modulesWidth)) * Math.min(phases.length, 3);
  const pitch = (w - 6) / teeth;
  return (
    <g data-busbar="" data-phases={phases.join(",")}>
      <Fit x={x + 4} y={y + 14} text={device.designation} size={10} max={w - 8} anchor="start" weight={800} fill={colors.text} testId="symbol-designation" />
      {/* vidličky do svorek přístrojů */}
      {Array.from({ length: teeth }, (_, index) => {
        const cx = x + 3 + pitch * (index + 0.5);
        return (
          <g key={index} data-tooth={phases[index % phases.length]}>
            <rect x={cx - Math.min(3, pitch * 0.25)} y={y + 64} width={Math.min(6, pitch * 0.5)} height={28} fill={COPPER} stroke="#7c2d12" strokeWidth={0.6} />
            <rect x={cx - 0.6} y={y + 80} width={1.2} height={12} fill="#1c1917" />
          </g>
        );
      })}
      {/* izolační profil s měděnou přípojnicí */}
      <rect x={x + 1} y={y + 30} width={w - 2} height={36} rx={4} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={1} />
      <rect x={x + 3} y={y + 34} width={w - 6} height={5} rx={1} fill={COPPER} data-copper="" />
      <Fit x={x + w / 2} y={y + 55} text={`${phases.join(" · ")} · 10/16 mm²`} size={7.5} max={w - 8} weight={700} fill="#111827" testId="symbol-busbar-text" />
    </g>
  );
}

/** Koncovka hřebenu: žlutá izolační krytka nasazená na bok měděné lišty. */
function EndCap({ device, x, y, w, colors }: { device: VectorDevice; x: number; y: number; w: number; colors: AccessoryColors }) {
  return (
    <g data-end-cap="">
      <Fit x={x + w / 2} y={y + 14} text={device.designation} size={9} max={w - 3} weight={800} fill={colors.text} testId="symbol-designation" />
      <rect x={x} y={y + 40} width={w * 0.55} height={18} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={0.8} />
      <rect x={x} y={y + 43} width={w * 0.5} height={4} fill={COPPER} />
      <rect x={x + w * 0.3} y={y + 30} width={w * 0.66} height={40} rx={5} fill="#facc15" stroke="#a16207" strokeWidth={1.2} data-cap="" />
      <Fit x={x + w * 0.63} y={y + 82} text="KDN / PS-END" size={6} max={w - 2} weight={700} fill={colors.muted} />
    </g>
  );
}

/** Mechanika podtypu na modulovém těle. */
function ModuleMechanics({ kind, device, x, y, w, colors }: { kind: AccessoryKind; device: VectorDevice; x: number; y: number; w: number; colors: AccessoryColors }): ReactNode {
  const cx = x + w / 2;
  switch (kind) {
    case "AUX_CONTACT":
      return (
        <g data-mechanics="aux-contact">
          <rect x={cx - 3} y={y + 40} width={6} height={16} rx={1.5} fill="#9ca3af" stroke={colors.stroke} strokeWidth={0.7} data-lever="" />
          <rect x={cx - Math.min(7, w / 2 - 2)} y={y + 62} width={Math.min(14, w - 4)} height={12} rx={1.5} fill="#0f172a" stroke={colors.stroke} strokeWidth={0.6} data-window="" />
          <rect x={cx - Math.min(6, w / 2 - 3)} y={y + 64} width={Math.min(6, w / 2 - 3)} height={8} fill="#22c55e" />
          <rect x={cx} y={y + 64} width={Math.min(6, w / 2 - 3)} height={8} fill="#ef4444" />
        </g>
      );
    case "SHUNT_TRIP":
      return (
        <g data-mechanics="shunt-trip">
          {/* mechanický unašeč do jističe vlevo */}
          <rect x={x - 3} y={y + 55} width={8} height={5} rx={1} fill="#f97316" stroke="#7c2d12" strokeWidth={0.6} data-coupler="" />
          <circle cx={cx} cy={y + 50} r={Math.min(8, w / 2 - 4)} fill="#dc2626" stroke="#7f1d1d" strokeWidth={1} data-trip-disc="" />
          <text x={cx} y={y + 53.5} fontSize={9} fontWeight={800} fontFamily={FONT} fill="#ffffff" textAnchor="middle">
            ⚡
          </text>
          <rect x={cx - 4} y={y + 64} width={8} height={18} rx={1.6} fill="#dc2626" stroke={colors.stroke} strokeWidth={0.8} data-lever="" />
        </g>
      );
    case "UNDERVOLTAGE_TRIP":
      return (
        <g data-mechanics="undervoltage-trip">
          <rect x={x + 4} y={y + 40} width={(w - 8) / 2} height={16} rx={2} fill="#facc15" />
          <rect x={x + 4 + (w - 8) / 2} y={y + 40} width={(w - 8) / 2} height={16} rx={2} fill="#2563eb" />
          <Fit x={cx} y={y + 51.5} text="U <" size={9} max={w - 8} weight={900} fill="#0f172a" testId="symbol-uv-mark" />
          <rect x={cx - 4} y={y + 62} width={8} height={20} rx={1.6} fill={colors.lever} stroke={colors.stroke} strokeWidth={0.8} data-lever="" />
        </g>
      );
    case "FUSE_LINK": {
      const dw = Math.max(10, w - 10);
      return (
        <g data-mechanics="fuse-link">
          {/* výklopný šuplík odpínače s okénkem a válcovou vložkou 10 × 38 */}
          <rect x={cx - dw / 2} y={y + 36} width={dw} height={56} rx={3} fill={colors.band} stroke={colors.stroke} strokeWidth={1} data-drawer="" />
          <rect x={cx - dw / 2 + 2} y={y + 38} width={dw - 4} height={5} rx={1.5} fill={colors.lever} />
          <rect x={cx - Math.min(6, dw / 3)} y={y + 47} width={Math.min(12, (dw * 2) / 3)} height={34} rx={4} fill="#f5f5f4" stroke="#a8a29e" strokeWidth={0.8} data-fuse="" />
          <rect x={cx - Math.min(6, dw / 3)} y={y + 47} width={Math.min(12, (dw * 2) / 3)} height={6} rx={2} fill="#a1a1aa" />
          <rect x={cx - Math.min(6, dw / 3)} y={y + 75} width={Math.min(12, (dw * 2) / 3)} height={6} rx={2} fill="#a1a1aa" />
          <Fit x={cx} y={y + 89} text="10×38 gG" size={6} max={dw - 2} weight={700} fill={colors.muted} />
        </g>
      );
    }
    case "DIN_SOCKET": {
      const r = Math.max(10, Math.min(26, w * 0.32));
      return (
        <g data-mechanics="din-socket">
          <circle cx={cx} cy={y + 60} r={r} fill={colors.band} stroke={colors.stroke} strokeWidth={1.2} data-socket-face="" />
          <circle cx={cx} cy={y + 60} r={r * 0.78} fill="#0b1220" stroke={colors.stroke} strokeWidth={0.6} />
          <circle cx={cx - r * 0.38} cy={y + 62} r={Math.max(1.5, r * 0.12)} fill="#e2e8f0" data-pin-hole="" />
          <circle cx={cx + r * 0.38} cy={y + 62} r={Math.max(1.5, r * 0.12)} fill="#e2e8f0" data-pin-hole="" />
          {/* ochranný kolík PE */}
          <rect x={cx - Math.max(1.5, r * 0.09)} y={y + 60 - r * 0.72} width={Math.max(3, r * 0.18)} height={r * 0.36} rx={1} fill="#facc15" stroke="#a16207" strokeWidth={0.5} data-pe-pin="" />
          <Fit x={cx} y={y + 97} text="230 V / 16 A" size={6.5} max={w - 4} weight={700} fill={colors.muted} />
        </g>
      );
    }
    case "INDICATOR": {
      const leds = indicatorLeds(device.poles, device.modulesWidth, device.typeCode);
      const pitch = (w - 6) / leds.length;
      const r = Math.max(3, Math.min(8, pitch * 0.32));
      return (
        <g data-mechanics="indicator" data-leds={leds.length}>
          {leds.map((led, index) => {
            const lx = x + 3 + pitch * (index + 0.5);
            return (
              <g key={led.label} data-led={led.fill}>
                <circle cx={lx} cy={y + 58} r={r + 1.5} fill="#0f172a" />
                <circle cx={lx} cy={y + 58} r={r} fill={led.fill} stroke="#0f172a" strokeWidth={0.6} />
                <circle cx={lx - r * 0.3} cy={y + 58 - r * 0.3} r={r * 0.3} fill="#ffffff" opacity={0.7} />
                <Fit x={lx} y={y + 78} text={led.label} size={6.5} max={pitch - 1} weight={700} fill={colors.muted} />
              </g>
            );
          })}
        </g>
      );
    }
    default:
      return null;
  }
}

/** Krycí záslepka výřezu: hladký plastový pás s naznačenými 1M odlamovacími segmenty. */
function BlankCover({ device, x, y, w, colors }: { device: VectorDevice; x: number; y: number; w: number; colors: AccessoryColors }) {
  const segments = Math.max(1, Math.round(device.modulesWidth));
  return (
    <g data-blank-cover="" data-segments={segments}>
      <rect x={x + 1} y={y + 18} width={w - 2} height={82} rx={3} fill="#d4d4d8" stroke="#71717a" strokeWidth={1} />
      {Array.from({ length: segments - 1 }, (_, index) => (
        <line key={index} x1={x + (w * (index + 1)) / segments} y1={y + 20} x2={x + (w * (index + 1)) / segments} y2={y + 98} stroke="#71717a" strokeWidth={0.8} strokeDasharray="3 2" data-segment="" />
      ))}
      <Fit x={x + w / 2} y={y + 14} text={device.designation} size={9} max={w - 4} weight={800} fill={colors.text} testId="symbol-designation" />
      <Fit x={x + w / 2} y={y + 62} text="Záslepka" size={7.5} max={w - 6} weight={700} fill="#3f3f46" />
    </g>
  );
}

const TERMINALS: Partial<Record<AccessoryKind, [string, string]>> = {
  AUX_CONTACT: ["13 · 21", "14 · 22"],
  SHUNT_TRIP: ["C1", "C2"],
  UNDERVOLTAGE_TRIP: ["D1", "D2"],
  FUSE_LINK: ["1", "2"],
  DIN_SOCKET: ["L · N", "PE"],
  INDICATOR: ["L", "N"],
};

/** Horní část symbolu příslušenství (y … y + 100); štítek funkce obvodu kreslí `VectorModuleSymbol`. */
export function AccessoryBody({ kind, device, rect, colors }: { kind: AccessoryKind; device: VectorDevice; rect: Rect; colors: AccessoryColors }) {
  const { x, y, w } = rect;
  if (kind === "TERMINAL_BLOCK") return device.modulesWidth >= 2 ? <Hlak device={device} x={x} y={y} w={w} colors={colors} /> : <RowTerminal device={device} x={x} y={y} w={w} colors={colors} />;
  if (kind === "BUSBAR") return <Busbar device={device} x={x} y={y} w={w} colors={colors} />;
  if (kind === "BUSBAR_END_CAP") return <EndCap device={device} x={x} y={y} w={w} colors={colors} />;
  if (kind === "BLANK_COVER") return <BlankCover device={device} x={x} y={y} w={w} colors={colors} />;
  return (
    <>
      <ModuleBody x={x} y={y} w={w} h={rect.h} colors={colors} terminals={TERMINALS[kind] ?? null} />
      <Fit x={x + w / 2} y={y + 34} text={device.designation} size={w < 30 ? 8 : 10} max={w - 4} weight={800} fill={colors.text} testId="symbol-designation" />
      <ModuleMechanics kind={kind} device={device} x={x} y={y} w={w} colors={colors} />
    </>
  );
}
