// Standardizované mechanické vektorové symboly modulových přístrojů (fáze 42): šroubové svorky
// nahoře a dole (1 šroubek na modul), mechanika podle kategorie (páčky, červená páčka odpínače,
// testovací tlačítko [ T ], kazety SPD …) a dynamické texty – IEC značení, výrobce, klíčová
// hodnota, typ a spodní štítek funkce obvodu. Čisté SVG bez stavu (sdílí krok 1 i krok 2).

import type { ReactNode } from "react";

import { leverCount, screwCount, symbolTexts, type VectorDevice } from "@/lib/panel-builder/vector-symbols";
import type { Rect } from "@/lib/panel-builder/vector-layout";

export type VectorTheme = "dark" | "print";

/** Barvy obou režimů: „Tmavý editor (CAD Dark)“ a „Výkres osazení“ (černobílý CAD, modré spojnice). */
export const VECTOR_THEMES: Record<VectorTheme, { bg: string; rail: string; railStroke: string; body: string; band: string; stroke: string; text: string; muted: string; screw: string; lever: string; strip: string; stripText: string; wire: string; grid: string }> = {
  dark: {
    bg: "#0b1220",
    rail: "#334155",
    railStroke: "#64748b",
    body: "#1e293b",
    band: "#172033",
    stroke: "#94a3b8",
    text: "#e2e8f0",
    muted: "#94a3b8",
    screw: "#475569",
    lever: "#0a0a0a",
    strip: "#0f172a",
    stripText: "#cbd5e1",
    wire: "#3b82f6",
    grid: "rgba(148,163,184,0.08)",
  },
  print: {
    bg: "#ffffff",
    rail: "#e5e7eb",
    railStroke: "#111111",
    body: "#ffffff",
    band: "#f4f4f5",
    stroke: "#111111",
    text: "#111111",
    muted: "#444444",
    screw: "#ffffff",
    lever: "#111111",
    strip: "#f4f4f5",
    stripText: "#111111",
    wire: "#1d4ed8",
    grid: "rgba(0,0,0,0.04)",
  },
};

const FONT = "ui-sans-serif, system-ui, Arial, sans-serif";
const BAND = 18;

/** Text, který se do šířky symbolu nevejde, se zúží (textLength) – nikdy nepřeteče do souseda. */
function FitText({ x, y, text, size, max, anchor = "middle", weight, fill, testId }: { x: number; y: number; text: string; size: number; max: number; anchor?: "start" | "middle"; weight?: number; fill: string; testId?: string }) {
  if (!text) return null;
  const estimated = text.length * size * 0.58;
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontFamily={FONT}
      fontWeight={weight}
      fill={fill}
      textAnchor={anchor}
      {...(estimated > max ? { textLength: Math.max(4, max), lengthAdjust: "spacingAndGlyphs" } : {})}
      data-testid={testId}
    >
      {text}
    </text>
  );
}

function Screws({ x, y, w, count, color, stroke }: { x: number; y: number; w: number; count: number; color: string; stroke: string }) {
  const r = Math.max(2, Math.min(6, w / count / 2 - 3));
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const cx = x + (w * (index + 0.5)) / count;
        const cy = y + BAND / 2;
        return (
          <g key={index} data-screw="">
            <circle cx={cx} cy={cy} r={r} fill={color} stroke={stroke} strokeWidth={1} />
            <line x1={cx - r * 0.65} y1={cy + r * 0.65} x2={cx + r * 0.65} y2={cy - r * 0.65} stroke={stroke} strokeWidth={1} />
          </g>
        );
      })}
    </>
  );
}

/** Ovládací páčka (s hrazdičkou u vícepólových). */
function Levers({ x, y, w, count, color, stroke, linked }: { x: number; y: number; w: number; count: number; color: string; stroke: string; linked: boolean }) {
  const centers = Array.from({ length: count }, (_, index) => x + (w * (index + 0.5)) / count);
  return (
    <g data-mechanics="levers">
      {linked && count > 1 ? <rect x={centers[0] - 4} y={y + 2} width={centers[centers.length - 1] - centers[0] + 8} height={3.5} rx={1.5} fill={color} stroke={stroke} strokeWidth={0.6} data-tie-bar="" /> : null}
      {centers.map((cx, index) => (
        <rect key={index} x={cx - 4} y={y + 3} width={8} height={20} rx={1.6} fill={color} stroke={stroke} strokeWidth={0.8} data-lever="" />
      ))}
    </g>
  );
}

function TestButton({ x, y, fill, text }: { x: number; y: number; fill: string; text: string }) {
  return (
    <g data-test-button="">
      <rect x={x} y={y} width={13} height={12} rx={2} fill={fill} stroke={text === "#ffffff" ? fill : "#111111"} strokeWidth={0.8} />
      <text x={x + 6.5} y={y + 9} fontSize={8} fontWeight={800} fontFamily={FONT} fill={text} textAnchor="middle">
        T
      </text>
    </g>
  );
}

function Bolt({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return <path d={`M${cx + 1.5} ${cy - 6} L${cx - 3} ${cy + 0.5} L${cx} ${cy + 0.5} L${cx - 1.5} ${cy + 6} L${cx + 3} ${cy - 0.5} L${cx} ${cy - 0.5} Z`} fill={color} />;
}

/** Střední mechanická část podle kategorie. */
function Mechanics({ device, x, y, w, theme }: { device: VectorDevice; x: number; y: number; w: number; theme: VectorTheme }) {
  const colors = VECTOR_THEMES[theme];
  const modules = Math.max(1, Math.round(device.modulesWidth));
  switch (device.category) {
    case "MCB":
      return <Levers x={x} y={y} w={w} count={leverCount(device.poles, device.modulesWidth)} color={colors.lever} stroke={colors.stroke} linked={device.poles !== "2x1P"} />;
    case "MAIN_SWITCH":
      return (
        <g data-mechanics="red-lever">
          <rect x={x + Math.min(6, w * 0.15)} y={y + 2} width={Math.max(8, w - Math.min(12, w * 0.3))} height={22} rx={3} fill="#dc2626" stroke="#7f1d1d" strokeWidth={1} />
          <text x={x + w / 2} y={y + 16.5} fontSize={8} fontWeight={800} fontFamily={FONT} fill="#ffffff" textAnchor="middle">
            I – O
          </text>
        </g>
      );
    case "RCD": {
      const lever = x + Math.min(w * 0.3, 16);
      return (
        <g data-mechanics="rcd">
          <rect x={lever - 4} y={y + 3} width={8} height={20} rx={1.6} fill={colors.lever} stroke={colors.stroke} strokeWidth={0.8} data-lever="" />
          <TestButton x={x + w - 17} y={y + 2} fill={theme === "dark" ? "#e5e7eb" : "#ffffff"} text="#111111" />
          {/* okénko indikace vybavení */}
          <rect x={x + w - 17} y={y + 16} width={13} height={7} rx={1} fill="#16a34a" stroke={colors.stroke} strokeWidth={0.6} data-indicator="" />
        </g>
      );
    }
    case "RCBO": {
      const lever = x + Math.min(w * 0.3, 12);
      return (
        <g data-mechanics="rcbo">
          <rect x={lever - 4} y={y + 3} width={8} height={20} rx={1.6} fill={colors.lever} stroke={colors.stroke} strokeWidth={0.8} data-lever="" />
          <TestButton x={x + w - 15.5} y={y + 7} fill="#2563eb" text="#ffffff" />
        </g>
      );
    }
    case "SPD":
      return (
        <g data-mechanics="spd">
          {Array.from({ length: modules }, (_, index) => {
            const cw = w / modules;
            const cx = x + cw * index;
            return (
              <g key={index} data-cartridge="">
                <rect x={cx + 3} y={y} width={cw - 6} height={25} rx={2} fill={colors.band} stroke={colors.stroke} strokeWidth={0.8} />
                <circle cx={cx + cw / 2} cy={y + 6} r={3} fill="#22c55e" stroke="#14532d" strokeWidth={0.6} data-status-flag="" />
                <Bolt cx={cx + cw / 2} cy={y + 17} color={theme === "dark" ? "#facc15" : "#111111"} />
              </g>
            );
          })}
        </g>
      );
    case "CONTACTOR":
      return (
        <g data-mechanics="contactor">
          <rect x={x + w / 2 - 11} y={y + 2} width={22} height={14} fill="none" stroke={colors.stroke} strokeWidth={1.2} />
          <line x1={x + w / 2 - 11} y1={y + 16} x2={x + w / 2 + 11} y2={y + 2} stroke={colors.stroke} strokeWidth={0.8} />
          <text x={x + w / 2} y={y + 25} fontSize={6.5} fontFamily={FONT} fill={colors.muted} textAnchor="middle">
            A1 A2
          </text>
        </g>
      );
    case "RELAY":
      return (
        <g data-mechanics="relay">
          <circle cx={x + w / 2} cy={y + 12} r={8} fill="none" stroke={colors.stroke} strokeWidth={1.2} />
          <line x1={x + w / 2} y1={y + 12} x2={x + w / 2 + 5} y2={y + 7} stroke={colors.stroke} strokeWidth={1.2} />
        </g>
      );
    case "PSU":
      return (
        <text x={x + w / 2} y={y + 17} fontSize={11} fontWeight={700} fontFamily={FONT} fill={colors.text} textAnchor="middle" data-mechanics="psu">
          ~ / =
        </text>
      );
    case null:
      return (
        <text x={x + w / 2} y={y + 21} fontSize={22} fontWeight={800} fontFamily={FONT} fill="#ef4444" textAnchor="middle" data-mechanics="unknown">
          ?
        </text>
      );
    default:
      return (
        <g data-mechanics="module">
          <rect x={x + w / 2 - 9} y={y + 5} width={18} height={14} rx={2} fill={colors.band} stroke={colors.stroke} strokeWidth={0.8} />
          <circle cx={x + w / 2 - 3} cy={y + 12} r={1.8} fill="#22c55e" />
          <circle cx={x + w / 2 + 3} cy={y + 12} r={1.8} fill="#f59e0b" />
        </g>
      );
  }
}

/**
 * Jeden přístroj na vektorové DIN liště. `outline` zvýrazní výběr / cíl přetažení / stav
 * (nerozpoznáno, nezapojeno); `children` = interaktivní vrstva volajícího (tlačítka nad symbolem).
 */
export function VectorModuleSymbol({
  device,
  rect,
  theme,
  outline,
  dashed,
  glow,
  dimmed,
  children,
}: {
  device: VectorDevice;
  rect: Rect;
  theme: VectorTheme;
  outline?: string | null;
  dashed?: boolean;
  glow?: boolean;
  dimmed?: boolean;
  children?: ReactNode;
}) {
  const colors = VECTOR_THEMES[theme];
  const { x, y, w, h } = rect;
  const texts = symbolTexts(device);
  const inner = w - 6;
  const screws = screwCount(device.modulesWidth);
  return (
    <g data-symbol={device.category ?? "UNKNOWN"} data-designation={device.designation} opacity={dimmed ? 0.45 : 1}>
      <rect x={x + 1} y={y} width={w - 2} height={h} rx={3} fill={colors.body} stroke={colors.stroke} strokeWidth={1.2} />
      {/* horní a spodní pás šroubových svorek */}
      <rect x={x + 1} y={y} width={w - 2} height={BAND} rx={3} fill={colors.band} stroke={colors.stroke} strokeWidth={0.8} />
      <rect x={x + 1} y={y + h - BAND} width={w - 2} height={BAND} rx={3} fill={colors.band} stroke={colors.stroke} strokeWidth={0.8} />
      <Screws x={x + 1} y={y} w={w - 2} count={screws} color={colors.screw} stroke={colors.stroke} />
      <Screws x={x + 1} y={y + h - BAND} w={w - 2} count={screws} color={colors.screw} stroke={colors.stroke} />

      {/* 1) IEC značení vlevo pod horními šroubky */}
      <FitText x={x + 4} y={y + 31} text={device.designation} size={11} max={inner} anchor="start" weight={800} fill={colors.text} testId="symbol-designation" />
      {/* 2) výrobce, výrazná klíčová hodnota a drobný typ */}
      <FitText x={x + w / 2} y={y + 43} text={texts.manufacturer} size={8} max={inner} fill={colors.muted} testId="symbol-manufacturer" />
      <FitText x={x + w / 2} y={y + 57} text={texts.value} size={12.5} max={inner} weight={800} fill={colors.text} testId="symbol-value" />
      <FitText x={x + w / 2} y={y + 68} text={texts.detail} size={7} max={inner} fill={colors.muted} testId="symbol-detail" />

      <Mechanics device={device} x={x + 1} y={y + 75} w={w - 2} theme={theme} />

      {/* 3) spodní štítek – funkce obvodu (dvojklik = úprava) */}
      <rect x={x + 3} y={y + 103} width={w - 6} height={16} rx={1.5} fill={colors.strip} stroke={colors.stroke} strokeWidth={0.6} data-label-strip="" />
      <FitText x={x + w / 2} y={y + 114} text={device.label} size={7.5} max={w - 10} weight={600} fill={colors.stripText} testId="symbol-label" />

      {outline ? (
        <rect
          x={x - 1}
          y={y - 2}
          width={w + 2}
          height={h + 4}
          rx={4}
          fill="none"
          stroke={outline}
          strokeWidth={glow ? 3.5 : 2.5}
          strokeDasharray={dashed ? "6 4" : undefined}
          style={glow ? { filter: `drop-shadow(0 0 6px ${outline})` } : undefined}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </g>
  );
}
