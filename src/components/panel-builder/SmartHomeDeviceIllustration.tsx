import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { CatalogProduct } from "@/lib/panel-builder/smart-catalog";
import { smartSystemOf, type SmartSystemId } from "@/lib/panel-builder/smart-home";

// Fáze 65: vektorový náhled přístroje chytré domácnosti pro karty katalogu a technický list. Kreslí třídu přístroje
// (tlačítko v barvě řady s kolébkami a LED, bezrámečkový dotykový ovladač, termostat s displejem, panel 7", akční
// člen do krabičky se svorkovnicí, stropní senzor, systémový modul, přístroj na DIN lištu se svorkami a LED kanálů).
// Je to ilustrace třídy přístroje, ne fotografie konkrétního výrobku.

export interface DeviceTone {
  frame: string;
  insert: string;
}

const ABB_RED = "#ff000f";
const LOXONE_GREEN = "#69C350";
const dark = (hex: string) => {
  const value = Number.parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance < 0.5;
};

function Bulb({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round">
      <path d="M-3 2 a4.5 4.5 0 1 1 6 0 v2 h-6 z" />
      <path d="M-2 6 h4" />
    </g>
  );
}

function BlindArrows({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={color}>
      <path d="M0 -6 l4 4 h-8 z" />
      <path d="M0 6 l4 -4 h-8 z" />
    </g>
  );
}

/** Tlačítko / senzor v rámečku řady: kolébky podle násobnosti, LED proužek, symbol světla / žaluzie. */
function ButtonDevice({ gangs = 1, symbol = "light", tone }: { gangs?: number; symbol?: CatalogProduct["symbol"]; tone: DeviceTone }) {
  const cols = gangs >= 6 ? 3 : gangs >= 2 ? 2 : 1;
  const rows = gangs >= 4 ? 2 : 1;
  const inner = { x: 26, y: 26, w: 68, h: 68 };
  const gap = 3;
  const cw = (inner.w - gap * (cols - 1)) / cols;
  const ch = (inner.h - gap * (rows - 1)) / rows;
  const ink = dark(tone.insert) ? "#e4e4e7" : "#52525b";
  const rockers: ReactNode[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const x = inner.x + col * (cw + gap);
      const y = inner.y + row * (ch + gap);
      const index = row * cols + col;
      rockers.push(
        <g key={index}>
          <rect x={x} y={y} width={cw} height={ch} rx={3} fill={tone.insert} stroke={dark(tone.insert) ? "#52525b" : "#d4d4d8"} strokeWidth={0.8} />
          <rect x={x + cw * 0.3} y={y + 3} width={cw * 0.4} height={1.6} rx={0.8} fill={index === 0 ? "#22c55e" : dark(tone.insert) ? "#71717a" : "#a1a1aa"} />
          {symbol === "blind" ? <BlindArrows x={x + cw / 2} y={y + ch / 2 + 2} s={Math.min(cw, ch) / 26} color={ink} /> : <Bulb x={x + cw / 2} y={y + ch / 2} s={Math.min(cw, ch) / 26} color={ink} />}
        </g>,
      );
    }
  return (
    <svg viewBox="0 0 120 120">
      <rect x={8} y={8} width={104} height={104} rx={10} fill={tone.frame} stroke={dark(tone.frame) ? "#3f3f46" : "#a1a1aa"} strokeWidth={1.2} />
      <rect x={22} y={22} width={76} height={76} rx={5} fill={tone.insert} opacity={0.9} />
      {rockers}
    </svg>
  );
}

/** Bezrámečkový dotykový ovladač (Loxone Touch, TapHome): sklo / mat, dotykové body a piktogramy. */
function TouchDevice({ gangs = 5, tone, loxone }: { gangs?: number; tone: DeviceTone; loxone: boolean }) {
  const gradient = `touch-glass-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const glass = tone.insert;
  const ink = dark(glass) ? "#d4d4d8" : "#71717a";
  return (
    <svg viewBox="0 0 120 120">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={dark(glass) ? 0.12 : 0.6} />
          <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={14} y={14} width={92} height={92} rx={loxone ? 6 : 14} fill={glass} stroke={dark(glass) ? "#52525b" : "#d4d4d8"} strokeWidth={1.2} />
      <rect x={14} y={14} width={92} height={46} rx={loxone ? 6 : 14} fill={`url(#${gradient})`} />
      {loxone && gangs >= 5 ? (
        <g fill={ink}>
          <circle cx={60} cy={60} r={2.6} />
          <Bulb x={60} y={33} s={0.8} color={ink} />
          <BlindArrows x={60} y={88} s={0.7} color={ink} />
          <path d="M30 60 h8" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
          <path d="M82 60 h8 M86 56 v8" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={60} cy={60} r={9} fill="none" stroke={ink} strokeWidth={0.6} opacity={0.5} />
        </g>
      ) : (
        <g>
          {Array.from({ length: gangs }, (_, index) => {
            const cols = gangs >= 6 ? 2 : gangs >= 4 ? 2 : 1;
            const rows = Math.ceil(gangs / cols);
            const col = index % cols;
            const row = Math.floor(index / cols);
            const w = 92 / cols;
            const h = 92 / rows;
            return (
              <g key={index}>
                <circle cx={14 + w * (col + 0.5)} cy={14 + h * (row + 0.5)} r={Math.min(w, h) * 0.16} fill="none" stroke={ink} strokeWidth={1.2} />
                <circle cx={14 + w * (col + 0.5)} cy={14 + h * (row + 0.5) - Math.min(w, h) * 0.3} r={1.2} fill={index === 0 ? "#38bdf8" : ink} />
              </g>
            );
          })}
          {gangs > 1 ? <path d={gangs >= 4 ? "M60 18 V102 M18 60 H102" : "M60 18 V102"} stroke={ink} strokeWidth={0.5} opacity={0.4} /> : null}
        </g>
      )}
    </svg>
  );
}

function Display({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill="#0b1220" />
      <text x={x + w / 2} y={y + h * 0.56} textAnchor="middle" fontSize={h * 0.36} fontWeight={700} fill="#f8fafc" fontFamily="Arial, sans-serif">
        22,5 °C
      </text>
      <text x={x + w / 2} y={y + h * 0.84} textAnchor="middle" fontSize={h * 0.16} fill="#94a3b8" fontFamily="Arial, sans-serif">
        14:17
      </text>
    </g>
  );
}

/** Prostorový termostat s displejem a dotykovými ikonami topení / chlazení. */
function ThermostatDevice({ tone }: { tone: DeviceTone }) {
  return (
    <svg viewBox="0 0 120 120">
      <rect x={8} y={8} width={104} height={104} rx={10} fill={tone.frame} stroke={dark(tone.frame) ? "#3f3f46" : "#a1a1aa"} strokeWidth={1.2} />
      <rect x={22} y={22} width={76} height={76} rx={5} fill={tone.insert} />
      <Display x={30} y={30} w={60} h={38} />
      <path d="M44 86 c-4 -5 1 -8 0 -12 c5 3 6 8 2 12 z" fill="#f97316" />
      <g stroke="#38bdf8" strokeWidth={1.4} strokeLinecap="round">
        <path d="M76 74 v12 M70 77 l12 6 M70 83 l12 -6" />
      </g>
    </svg>
  );
}

/** Dotykový panel 7" s vizualizací (teplota, čas, dlaždice světel / žaluzií / topení). */
function PanelDevice() {
  const tile = (x: number, y: number, children: ReactNode) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width={30} height={22} rx={3} fill="#1e293b" />
      {children}
    </g>
  );
  return (
    <svg viewBox="0 0 160 110">
      <rect x={4} y={8} width={152} height={94} rx={8} fill="#18181b" stroke="#3f3f46" strokeWidth={1.2} />
      <rect x={12} y={16} width={136} height={78} rx={3} fill="#0b1220" />
      <text x={22} y={40} fontSize={16} fontWeight={700} fill="#f8fafc" fontFamily="Arial, sans-serif">
        22,5 °C
      </text>
      <text x={22} y={54} fontSize={8} fill="#94a3b8" fontFamily="Arial, sans-serif">
        14:17 · Obývák
      </text>
      {tile(22, 62, <Bulb x={15} y={10} s={0.9} color="#facc15" />)}
      {tile(58, 62, <BlindArrows x={15} y={11} s={0.8} color="#e2e8f0" />)}
      {tile(94, 62, <path d="M15 18 c-5 -6 1 -9 0 -13 c6 3 7 9 2 13 z" fill="#f97316" />)}
      {tile(106, 26, <circle cx={15} cy={11} r={5} fill="none" stroke="#22c55e" strokeWidth={1.5} />)}
    </svg>
  );
}

/** Akční člen do krabičky: šedé pouzdro, logo, QR kód, bezdrátový symbol, zelená svorkovnice. */
function InboxDevice({ terminals, manufacturer, wireless }: { terminals: string[]; manufacturer: string; wireless: boolean }) {
  const qr = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1];
  const width = 92 / terminals.length;
  return (
    <svg viewBox="0 0 120 120">
      <rect x={14} y={12} width={92} height={96} rx={10} fill="#d4d4d8" stroke="#a1a1aa" strokeWidth={1.2} />
      <text x={24} y={32} fontSize={11} fontWeight={800} fill={manufacturer === "ABB" ? ABB_RED : "#3f3f46"} fontFamily="Arial, sans-serif">
        {manufacturer}
      </text>
      <g transform="translate(70 20)">
        {qr.map((on, index) => (on ? <rect key={index} x={(index % 5) * 4} y={Math.floor(index / 5) * 4} width={4} height={4} fill="#27272a" /> : null))}
      </g>
      {wireless ? (
        <g fill="none" stroke="#2563eb" strokeWidth={1.8} strokeLinecap="round">
          <path d="M44 60 a10 10 0 0 1 14 0" />
          <path d="M39 55 a17 17 0 0 1 24 0" />
          <circle cx={51} cy={65} r={1.8} fill="#2563eb" />
        </g>
      ) : null}
      <rect x={14} y={80} width={92} height={28} rx={4} fill="#16a34a" />
      {terminals.map((label, index) => (
        <g key={label + index}>
          <rect x={16 + index * width} y={83} width={width - 4} height={12} rx={1.5} fill="#15803d" stroke="#14532d" strokeWidth={0.6} />
          <circle cx={14 + index * width + width / 2} cy={89} r={2.6} fill="#a1a1aa" stroke="#3f3f46" strokeWidth={0.5} />
          <text x={14 + index * width + width / 2} y={104} textAnchor="middle" fontSize={7} fontWeight={700} fill="#f0fdf4" fontFamily="Arial, sans-serif">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Stropní senzor přítomnosti: kruhová hlava s fazetovou multičočkou. */
function PresenceDevice({ tone }: { tone: DeviceTone }) {
  return (
    <svg viewBox="0 0 120 120">
      <circle cx={60} cy={60} r={50} fill={tone.insert} stroke={dark(tone.insert) ? "#52525b" : "#a1a1aa"} strokeWidth={1.4} />
      <circle cx={60} cy={60} r={26} fill="#e4e4e7" stroke="#a1a1aa" strokeWidth={1} />
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        return <path key={index} d={`M60 60 L${60 + Math.cos(angle) * 26} ${60 + Math.sin(angle) * 26}`} stroke="#a1a1aa" strokeWidth={0.6} />;
      })}
      <circle cx={60} cy={60} r={16} fill="none" stroke="#a1a1aa" strokeWidth={0.6} />
      <circle cx={60} cy={60} r={8} fill="#d4d4d8" stroke="#a1a1aa" strokeWidth={0.6} />
      <circle cx={60} cy={96} r={2} fill="#ef4444" />
    </svg>
  );
}

function SensorDevice({ tone }: { tone: DeviceTone }) {
  return (
    <svg viewBox="0 0 120 120">
      <rect x={20} y={20} width={80} height={80} rx={14} fill={tone.insert} stroke="#a1a1aa" strokeWidth={1.2} />
      {[0, 1, 2, 3, 4].map((index) => (
        <rect key={index} x={36} y={38 + index * 9} width={48} height={3} rx={1.5} fill="#a1a1aa" />
      ))}
      <circle cx={60} cy={88} r={2} fill="#22c55e" />
    </svg>
  );
}

function IntercomDevice() {
  return (
    <svg viewBox="0 0 120 120">
      <rect x={30} y={6} width={60} height={108} rx={8} fill="#27272a" stroke="#52525b" strokeWidth={1.2} />
      <rect x={36} y={14} width={48} height={40} rx={3} fill="#0b1220" />
      <circle cx={60} cy={34} r={9} fill="none" stroke="#94a3b8" strokeWidth={1.4} />
      <path d="M50 46 q10 -8 20 0" fill="none" stroke="#94a3b8" strokeWidth={1.4} />
      {[0, 1, 2].map((index) => (
        <rect key={index} x={38 + index * 15} y={66} width={13} height={10} rx={2} fill="#3f3f46" />
      ))}
      <circle cx={60} cy={96} r={7} fill="#3f3f46" stroke="#71717a" strokeWidth={1} />
    </svg>
  );
}

/** Systémový modul / řídicí jednotka (SysAP 3.0, TapHome Core): nástěnná skříňka s LED. */
function ControllerDevice({ manufacturer, label }: { manufacturer: string; label: string }) {
  return (
    <svg viewBox="0 0 120 120">
      <rect x={12} y={18} width={96} height={84} rx={10} fill="#f4f4f5" stroke="#a1a1aa" strokeWidth={1.2} />
      <text x={22} y={40} fontSize={12} fontWeight={800} fill={manufacturer === "ABB" ? ABB_RED : "#0f172a"} fontFamily="Arial, sans-serif">
        {manufacturer === "TapHome" ? "TapHome" : manufacturer}
      </text>
      <text x={22} y={56} fontSize={9} fill="#3f3f46" fontFamily="Arial, sans-serif">
        {label}
      </text>
      {[0, 1, 2, 3].map((index) => (
        <circle key={index} cx={26 + index * 10} cy={86} r={2.4} fill={index === 0 ? "#22c55e" : index === 1 ? "#38bdf8" : "#a1a1aa"} />
      ))}
      <rect x={78} y={76} width={20} height={14} rx={2} fill="#d4d4d8" stroke="#a1a1aa" strokeWidth={0.6} />
    </svg>
  );
}

/** Přístroj na DIN lištu: šířka podle modulů, svorky nahoře a dole, LED kanálů, typové označení, barvy výrobce. */
function DinDevice({ modules, channels, typeCode, manufacturer }: { modules: number; channels: number; typeCode: string; manufacturer: string }) {
  const unit = 18;
  const width = Math.max(2, modules) * unit;
  const loxone = manufacturer === "Loxone";
  const body = loxone ? "#3f3f46" : "#e4e4e7";
  const terminals = Math.max(2, Math.min(24, modules * 2));
  const leds = Math.max(1, Math.min(12, channels || modules));
  const pitch = width / terminals;
  return (
    <svg viewBox={`-8 -6 ${width + 16} 122`}>
      <rect x={0} y={0} width={width} height={110} rx={3} fill={body} stroke={loxone ? "#18181b" : "#a1a1aa"} strokeWidth={1.2} />
      {/* svorky nahoře a dole */}
      {[4, 92].map((y) => (
        <g key={y}>
          <rect x={2} y={y} width={width - 4} height={14} rx={2} fill={loxone ? "#27272a" : "#d4d4d8"} />
          {Array.from({ length: terminals }, (_, index) => (
            <g key={index}>
              <circle cx={pitch * (index + 0.5)} cy={y + 7} r={Math.min(4, pitch * 0.32)} fill="#a1a1aa" stroke="#52525b" strokeWidth={0.6} />
              <path d={`M${pitch * (index + 0.5) - 2} ${y + 7} h4`} stroke="#3f3f46" strokeWidth={0.8} />
            </g>
          ))}
        </g>
      ))}
      {/* čelo: barevný pruh výrobce, typ a LED kanálů */}
      <rect x={2} y={22} width={width - 4} height={66} rx={2} fill={loxone ? LOXONE_GREEN : "#f4f4f5"} />
      {!loxone && manufacturer !== "TapHome" ? <rect x={2} y={22} width={width - 4} height={5} fill={ABB_RED} /> : null}
      <text x={width / 2} y={42} textAnchor="middle" fontSize={Math.min(8, width / Math.max(6, typeCode.length) * 1.6)} fontWeight={700} fill={loxone ? "#0f172a" : "#27272a"} fontFamily="Arial, sans-serif">
        {typeCode}
      </text>
      {Array.from({ length: leds }, (_, index) => {
        const cols = Math.min(leds, Math.max(1, Math.floor(width / 10)));
        const col = index % cols;
        const row = Math.floor(index / cols);
        return <circle key={index} cx={(width / cols) * (col + 0.5)} cy={56 + row * 9} r={2.2} fill={index % 3 === 0 ? "#22c55e" : loxone ? "#18181b" : "#d4d4d8"} stroke={loxone ? "#14532d" : "#a1a1aa"} strokeWidth={0.4} />;
      })}
      <rect x={width / 2 - 8} y={78} width={16} height={6} rx={1} fill={loxone ? "#14532d" : "#d4d4d8"} />
      {/* DIN lišta */}
      <rect x={-8} y={50} width={width + 16} height={8} fill="#71717a" opacity={0.35} />
    </svg>
  );
}

/** Svorky akčního členu do krabičky (Katalog ABB 2026: „N ↓ C1 ↑1 L“). */
export function inboxTerminals(product: Pick<CatalogProduct, "wiring" | "channels">): string[] {
  if (product.wiring === "inbox-blind") return ["N", "▲", "▼", "L"];
  if (product.wiring === "inbox-dim") return ["N", "↓", "▲", "L"];
  if (product.wiring === "flextronics") return ["L", "N", "↑"];
  return (product.channels ?? 1) > 1 ? ["N", "↓", "↑1", "↑2", "L"] : ["N", "↓", "C1", "↑1", "L"];
}

export function SmartHomeDeviceIllustration({ product, system, tone, className }: { product: CatalogProduct; system: SmartSystemId; tone: DeviceTone; className?: string }) {
  const manufacturer = smartSystemOf(system).manufacturer;
  const dinModule = smartSystemOf(system).modules.find((unit) => unit.id === product.moduleId);
  const art = (() => {
    switch (product.kind) {
      case "button":
        return <ButtonDevice gangs={product.gangs} symbol={product.symbol} tone={tone} />;
      case "touch":
        return <TouchDevice gangs={product.gangs} tone={tone} loxone={manufacturer === "Loxone"} />;
      case "thermostat":
        return <ThermostatDevice tone={tone} />;
      case "panel":
        return <PanelDevice />;
      case "inbox":
        return <InboxDevice terminals={inboxTerminals(product)} manufacturer={manufacturer} wireless={product.noBus ?? false} />;
      case "presence":
        return <PresenceDevice tone={tone} />;
      case "sensor":
        return <SensorDevice tone={tone} />;
      case "intercom":
        return <IntercomDevice />;
      case "controller":
        return <ControllerDevice manufacturer={manufacturer} label={product.typeCode ?? ""} />;
      case "din":
        return <DinDevice modules={dinModule?.modules || 2} channels={dinModule?.channels ?? 0} typeCode={product.typeCode ?? ""} manufacturer={manufacturer} />;
    }
  })();
  return (
    <span className={cn("inline-flex items-center justify-center [&>svg]:size-full", className)} role="img" aria-label={`Náhled: ${product.label}`} data-testid="device-illustration" data-kind={product.kind}>
      {art}
    </span>
  );
}
