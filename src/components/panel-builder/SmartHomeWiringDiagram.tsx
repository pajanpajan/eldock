import type { ReactNode } from "react";

import type { CatalogProduct, WiringKind } from "@/lib/panel-builder/smart-catalog";
import { smartSystemOf, type SmartSystemId } from "@/lib/panel-builder/smart-home";

// Fáze 65: vektorové schéma zapojení svorek přístroje chytré domácnosti v technickém listu. Orientační schéma podle
// druhu připojení (sběrnice free@home / KNX / Loxone Tree / TapHome, akční člen do krabičky 230 V, akční člen na DIN
// lištu, zdroj sběrnice, systémový modul, Miniserver, bezdrátový prvek) – přesné označení svorek je v návodu výrobce.

const C = { L: "#92400e", N: "#2563eb", busPlus: "#dc2626", busMinus: "#27272a", tree: "#16a34a", v24: "#f97316", gnd: "#52525b", dali: "#7c3aed", lan: "#0ea5e9", radio: "#2563eb" };
const FONT = "Arial, Helvetica, sans-serif";

function Label({ x, y, children, anchor = "middle", size = 11, color = "#3f3f46", weight = 400 }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; size?: number; color?: string; weight?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={color} fontFamily={FONT} fontWeight={weight}>
      {children}
    </text>
  );
}

function Box({ x, y, w, h, title, sub }: { x: number; y: number; w: number; h: number; title: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="#f4f4f5" stroke="#52525b" strokeWidth={1.5} />
      <Label x={x + w / 2} y={y + 22} weight={700} size={12} color="#18181b">
        {title}
      </Label>
      {sub ? (
        <Label x={x + w / 2} y={y + 38} size={10} color="#52525b">
          {sub}
        </Label>
      ) : null}
    </g>
  );
}

function Terminal({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <g data-terminal={label}>
      <rect x={x - 13} y={y - 9} width={26} height={18} rx={3} fill="#fff" stroke={color} strokeWidth={1.6} />
      <Label x={x} y={y + 4} size={9} weight={700} color="#18181b">
        {label}
      </Label>
    </g>
  );
}

const Wire = ({ d, color, dashed = false }: { d: string; color: string; dashed?: boolean }) => <path d={d} fill="none" stroke={color} strokeWidth={2} strokeDasharray={dashed ? "6 4" : undefined} strokeLinejoin="round" />;

function Rail({ y, color, label, from = 30, to = 530 }: { y: number; color: string; label: string; from?: number; to?: number }) {
  return (
    <g>
      <path d={`M${from} ${y} H${to}`} stroke={color} strokeWidth={2.6} />
      <Label x={from} y={y - 6} anchor="start" size={10} color={color} weight={700}>
        {label}
      </Label>
    </g>
  );
}

function Lamp({ x, y, dim = false }: { x: number; y: number; dim?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill="#fff" stroke="#18181b" strokeWidth={1.5} />
      <path d={`M${x - 7.5} ${y - 7.5} L${x + 7.5} ${y + 7.5} M${x + 7.5} ${y - 7.5} L${x - 7.5} ${y + 7.5}`} stroke="#18181b" strokeWidth={1.3} />
      {dim ? <path d={`M${x + 12} ${y + 10} L${x + 22} ${y - 4} M${x + 17} ${y - 3} L${x + 22} ${y - 4} L${x + 21} ${y + 1}`} stroke="#18181b" strokeWidth={1.2} fill="none" /> : null}
    </g>
  );
}

function Load({ x, y, kind }: { x: number; y: number; kind: "lamp" | "dim" | "motor" | "valve" | "dali" }) {
  if (kind === "lamp" || kind === "dim") return <Lamp x={x} y={y} dim={kind === "dim"} />;
  const label = kind === "motor" ? "M" : kind === "valve" ? "TH" : "DALI";
  return (
    <g>
      {kind === "motor" ? <circle cx={x} cy={y} r={12} fill="#fff" stroke="#18181b" strokeWidth={1.5} /> : <rect x={x - 15} y={y - 10} width={30} height={20} rx={3} fill="#fff" stroke="#18181b" strokeWidth={1.5} />}
      <Label x={x} y={y + 4} size={kind === "dali" ? 8 : 11} weight={700} color="#18181b">
        {label}
      </Label>
    </g>
  );
}

/** Sběrnicový prvek: dvě (Loxone Tree a TapHome čtyři) svorky na sběrnici s pokračováním k dalšímu prvku. */
function BusDiagram({ title, terminals, cable }: { title: string; terminals: { label: string; color: string; rail: string }[]; cable: string }) {
  const spacing = 70;
  const start = 280 - ((terminals.length - 1) * spacing) / 2;
  return (
    <>
      <Box x={180} y={14} w={200} h={70} title={title} sub="svorky na zadní straně" />
      {terminals.map((terminal, index) => {
        const x = start + index * spacing;
        const y = 136 + index * 22;
        return (
          <g key={terminal.label}>
            <Wire d={`M${x} 92 V${y}`} color={terminal.color} />
            <Rail y={y} color={terminal.color} label={terminal.rail} />
            <circle cx={x} cy={y} r={3.5} fill={terminal.color} />
            <Terminal x={x} y={92} label={terminal.label} color={terminal.color} />
          </g>
        );
      })}
      <Label x={30} y={226} anchor="start" size={10}>
        ← od zdroje / předchozího prvku
      </Label>
      <Label x={530} y={226} anchor="end" size={10}>
        na další prvek →
      </Label>
      <Label x={280} y={226} size={10} weight={700} color="#18181b">
        {cable}
      </Label>
    </>
  );
}

/** Akční člen 230 V (do krabičky / vložka): fáze L a nulák N z přívodu, výstupy na zátěže. */
function MainsDiagram({ title, outputs, load }: { title: string; outputs: string[]; load: "lamp" | "dim" | "motor" }) {
  const terminals = ["L", "N", ...outputs];
  const spacing = 64;
  const start = 280 - ((terminals.length - 1) * spacing) / 2;
  const xOf = (label: string) => start + terminals.indexOf(label) * spacing;
  return (
    <>
      <Box x={170} y={14} w={220} h={64} title={title} sub="230 V AC" />
      <Rail y={120} color={C.L} label="L – fáze z jističe" />
      <Rail y={214} color={C.N} label="N – nulový vodič" />
      <Wire d={`M${xOf("L")} 86 V120`} color={C.L} />
      <circle cx={xOf("L")} cy={120} r={3.5} fill={C.L} />
      <Wire d={`M${xOf("N")} 86 V214`} color={C.N} />
      <circle cx={xOf("N")} cy={214} r={3.5} fill={C.N} />
      {load === "motor" ? (
        <g>
          {outputs.map((label) => (
            <Wire key={label} d={`M${xOf(label)} 86 V146 H${(xOf(outputs[0]) + xOf(outputs[outputs.length - 1])) / 2}`} color="#18181b" />
          ))}
          <Load x={(xOf(outputs[0]) + xOf(outputs[outputs.length - 1])) / 2} y={168} kind="motor" />
          <Wire d={`M${(xOf(outputs[0]) + xOf(outputs[outputs.length - 1])) / 2} 180 V214`} color={C.N} />
        </g>
      ) : (
        outputs.map((label) => (
          <g key={label}>
            <Wire d={`M${xOf(label)} 86 V156`} color="#18181b" />
            <Load x={xOf(label)} y={168} kind={load} />
            <Wire d={`M${xOf(label)} 179 V214`} color={C.N} />
          </g>
        ))
      )}
      {terminals.map((label) => (
        <Terminal key={label} x={xOf(label)} y={86} label={label} color={label === "L" ? C.L : label === "N" ? C.N : "#18181b"} />
      ))}
    </>
  );
}

/** Přístroj na DIN lištu: sběrnice nahoře, přívod L, výstupy na zátěže (nejvýš 4 kanály + „…“), N. */
function DinDiagram({ title, bus, channels, load, pair = false }: { title: string; bus: { plus: string; minus: string; label: string }; channels: number; load: "lamp" | "dim" | "motor" | "valve"; pair?: boolean }) {
  const shown = Math.min(4, channels);
  const outputs = Array.from({ length: shown }, (_, index) => (pair ? `▲▼${index + 1}` : `A${index + 1}`));
  const spacing = 76;
  const start = 330 - ((shown - 1) * spacing) / 2;
  return (
    <>
      <Rail y={12} color={C.busPlus} label={bus.label} from={30} to={530} />
      <Wire d="M90 12 V44" color={C.busPlus} />
      <Wire d="M120 12 V44" color={C.busMinus} />
      <Box x={60} y={40} w={460} h={58} title={title} sub={`${channels} ${channels === 1 ? "kanál" : channels <= 4 ? "kanály" : "kanálů"} · DIN lišta`} />
      <Terminal x={90} y={40} label={bus.plus} color={C.busPlus} />
      <Terminal x={120} y={40} label={bus.minus} color={C.busMinus} />
      <Rail y={130} color={C.L} label="L – přívod z jističe" from={30} to={170} />
      <Wire d="M150 106 V130" color={C.L} />
      <Terminal x={150} y={106} label="L" color={C.L} />
      <Rail y={216} color={C.N} label="N" />
      {outputs.map((label, index) => {
        const x = start + index * spacing;
        return (
          <g key={label}>
            <Wire d={`M${x} 106 V158`} color="#18181b" />
            <Load x={x} y={172} kind={load} />
            <Wire d={`M${x} ${load === "motor" ? 184 : 182} V216`} color={C.N} />
            <Terminal x={x} y={106} label={label} color="#18181b" />
          </g>
        );
      })}
      {channels > shown ? (
        <Label x={start + shown * spacing - 24} y={176} anchor="start" size={12} weight={700}>
          … {channels}
        </Label>
      ) : null}
    </>
  );
}

/** Zařízení s více porty (zdroj, systémový modul, Miniserver, rozšíření, rozhraní): port → popsaný cíl. */
function PortsDiagram({ title, sub, ports }: { title: string; sub?: string; ports: { label: string; color: string; target: string }[] }) {
  const spacing = 520 / ports.length;
  return (
    <>
      <Box x={40} y={14} w={480} h={64} title={title} sub={sub} />
      {ports.map((port, index) => {
        const x = 20 + spacing * (index + 0.5);
        return (
          <g key={port.label + index}>
            <Wire d={`M${x} 86 V150`} color={port.color} />
            <rect x={x - spacing / 2 + 6} y={150} width={spacing - 12} height={44} rx={5} fill="#fff" stroke={port.color} strokeWidth={1.4} />
            <Label x={x} y={168} size={10} weight={700} color="#18181b">
              {port.target.split("|")[0]}
            </Label>
            {port.target.includes("|") ? (
              <Label x={x} y={184} size={9} color="#52525b">
                {port.target.split("|")[1]}
              </Label>
            ) : null}
            <Terminal x={x} y={86} label={port.label} color={port.color} />
          </g>
        );
      })}
    </>
  );
}

function WirelessDiagram({ title, hub }: { title: string; hub: string }) {
  return (
    <>
      <Box x={40} y={60} w={190} h={70} title={title} sub="bez vodičů" />
      <g fill="none" stroke={C.radio} strokeWidth={2.2} strokeLinecap="round">
        <path d="M262 80 a22 22 0 0 1 0 30" />
        <path d="M282 68 a40 40 0 0 1 0 54" />
        <path d="M302 56 a58 58 0 0 1 0 78" />
      </g>
      <Box x={330} y={60} w={190} h={70} title={hub} sub="brána bezdrátových prvků" />
      <Label x={280} y={190} size={11}>
        Energie ze stisku / z baterie – žádná svorka ani kabel.
      </Label>
    </>
  );
}

const BUS = {
  abb_freeathome: { plus: "BUS+", minus: "BUS−", label: "Sběrnice free@home 24 V DC", cable: "J-Y(St)Y 2×2×0,8 (pár červená / černá)" },
  abb_knx: { plus: "KNX+", minus: "KNX−", label: "Sběrnice KNX TP 30 V DC", cable: "KNX J-Y(St)Y 2×2×0,8 (pár červená / černá)" },
  loxone: { plus: "Link+", minus: "Link−", label: "Loxone Link (k Miniserveru)", cable: "Loxone Tree / Link – kroucený pár" },
  taphome: { plus: "A", minus: "B", label: "Sběrnice TapHome", cable: "sběrnicový kabel TapHome" },
} as const;

/** Schéma zapojení výrobku podle druhu připojení. */
export function wiringContent(wiring: WiringKind, product: Pick<CatalogProduct, "label" | "typeCode" | "channels">, system: SmartSystemId): ReactNode {
  const bus = BUS[system];
  const name = product.typeCode || product.label.split(" (")[0].slice(0, 34);
  const channels = Math.max(1, product.channels ?? 1);
  switch (wiring) {
    case "bus-fah":
      return <BusDiagram title={name} cable={BUS.abb_freeathome.cable} terminals={[{ label: "BUS+", color: C.busPlus, rail: "BUS+ (červená)" }, { label: "BUS−", color: C.busMinus, rail: "BUS− (černá)" }]} />;
    case "bus-knx":
      return <BusDiagram title={name} cable={BUS.abb_knx.cable} terminals={[{ label: "KNX+", color: C.busPlus, rail: "KNX+ (červená)" }, { label: "KNX−", color: C.busMinus, rail: "KNX− (černá)" }]} />;
    case "tree":
      return (
        <BusDiagram
          title={name}
          cable="Loxone Tree kabel (napájení 24 V + sběrnice Tree)"
          terminals={[
            { label: "24V", color: C.v24, rail: "24 V DC" },
            { label: "GND", color: C.gnd, rail: "GND" },
            { label: "Tree L", color: C.tree, rail: "Tree L" },
            { label: "Tree H", color: "#65a30d", rail: "Tree H" },
          ]}
        />
      );
    case "bus-taphome":
      return (
        <BusDiagram
          title={name}
          cable="Sběrnice TapHome – označení svorek ověřte v návodu TapHome"
          terminals={[
            { label: "+24V", color: C.v24, rail: "napájení +24 V DC" },
            { label: "GND", color: C.gnd, rail: "GND" },
            { label: "A", color: C.tree, rail: "data A" },
            { label: "B", color: "#65a30d", rail: "data B" },
          ]}
        />
      );
    case "inbox-switch":
      return <MainsDiagram title={name} outputs={channels > 1 ? ["↑1", "↑2"] : ["↑1"]} load="lamp" />;
    case "inbox-dim":
      return <MainsDiagram title={name} outputs={["▲"]} load="dim" />;
    case "inbox-blind":
      return <MainsDiagram title={name} outputs={["▲", "▼"]} load="motor" />;
    case "flextronics":
      return <MainsDiagram title="Vložka ABB-flexTronics" outputs={["↑"]} load="lamp" />;
    case "wireless":
      return <WirelessDiagram title={name} hub={system === "loxone" ? "Miniserver / Air Base" : "System Access Point"} />;
    case "intercom":
      return <PortsDiagram title={name} sub="ABB-Welcome – vlastní dvoudrátová sběrnice" ports={[{ label: "a", color: C.busPlus, target: "Dveřní stanice|sběrnice Welcome" }, { label: "b", color: C.busMinus, target: "Systémový řadič|ABB-Welcome" }]} />;
    case "din-switch":
      return <DinDiagram title={name} bus={bus} channels={channels} load="lamp" />;
    case "din-dim":
      return <DinDiagram title={name} bus={bus} channels={channels} load="dim" />;
    case "din-blind":
      return <DinDiagram title={name} bus={bus} channels={channels} load="motor" pair />;
    case "din-heating":
      return <DinDiagram title={name} bus={bus} channels={channels} load="valve" />;
    case "din-dali":
      return (
        <PortsDiagram
          title={name}
          sub="DALI rozhraní na DIN lištu"
          ports={[
            { label: bus.plus, color: C.busPlus, target: bus.label.split(" (")[0] + "|+" },
            { label: bus.minus, color: C.busMinus, target: bus.label.split(" (")[0] + "|−" },
            { label: "L", color: C.L, target: "Přívod L|z jističe" },
            { label: "N", color: C.N, target: "N|nulový vodič" },
            { label: "DA+", color: C.dali, target: "DALI předřadníky|DA+ / DA−" },
            { label: "DA−", color: C.dali, target: "DALI předřadníky|max. dle typu" },
          ]}
        />
      );
    case "din-psu":
      return (
        <PortsDiagram
          title={name}
          sub="napájecí zdroj sběrnice s tlumivkou"
          ports={[
            { label: "L", color: C.L, target: "Přívod L|230 V z jističe" },
            { label: "N", color: C.N, target: "N|nulový vodič" },
            { label: bus.plus, color: C.busPlus, target: bus.label + "|+ (červená)" },
            { label: bus.minus, color: C.busMinus, target: bus.label + "|− (černá)" },
          ]}
        />
      );
    case "din-interface":
      return (
        <PortsDiagram
          title={name}
          sub="IP rozhraní"
          ports={[
            { label: bus.plus, color: C.busPlus, target: "Sběrnice KNX|+" },
            { label: bus.minus, color: C.busMinus, target: "Sběrnice KNX|−" },
            { label: "LAN", color: C.lan, target: "Síť LAN|ETS / vizualizace" },
          ]}
        />
      );
    case "controller":
      return system === "taphome" ? (
        <PortsDiagram title={name || "TapHome Core"} sub="řídicí jednotka" ports={[{ label: "+24V", color: C.v24, target: "Zdroj 24 V DC|napájení" }, { label: "BUS", color: C.tree, target: "Sběrnice TapHome|tlačítka a moduly" }, { label: "LAN", color: C.lan, target: "Síť LAN|aplikace" }]} />
      ) : (
        <PortsDiagram
          title={name}
          sub="systémový modul ABB-free@home"
          ports={[
            { label: "24V", color: C.v24, target: "Síťový adaptér|230 V AC / 24 V DC" },
            { label: "BUS+", color: C.busPlus, target: "Sběrnice free@home|+ (červená)" },
            { label: "BUS−", color: C.busMinus, target: "Sběrnice free@home|− (černá)" },
            { label: "LAN", color: C.lan, target: "Síť LAN / WLAN|aplikace, hlas" },
          ]}
        />
      );
    case "miniserver":
      return (
        <PortsDiagram
          title={name}
          sub="Loxone Miniserver – DIN lišta"
          ports={[
            { label: "24V", color: C.v24, target: "Zdroj 24 V DC|napájení" },
            { label: "GND", color: C.gnd, target: "GND|zdroj" },
            { label: "Tree", color: C.tree, target: "Větev Tree|tlačítka, čidla" },
            { label: "Link", color: C.busPlus, target: "Loxone Link|rozšíření" },
            { label: "LAN", color: C.lan, target: "Síť LAN|aplikace" },
            { label: "O1–8", color: "#18181b", target: "Reléové výstupy|8 zátěží" },
          ]}
        />
      );
    case "tree-extension":
      return (
        <PortsDiagram
          title={name}
          sub="rozšíření Tree – DIN lišta"
          ports={[
            { label: "24V", color: C.v24, target: "Zdroj 24 V DC|napájení" },
            { label: "GND", color: C.gnd, target: "GND|zdroj" },
            { label: "Link", color: C.busPlus, target: "Loxone Link|k Miniserveru" },
            { label: "Tree 1", color: C.tree, target: "Větev Tree 1|max. 50 prvků" },
            { label: "Tree 2", color: "#65a30d", target: "Větev Tree 2|max. 50 prvků" },
          ]}
        />
      );
  }
}

export function SmartHomeWiringDiagram({ product, system }: { product: CatalogProduct; system: SmartSystemId }) {
  return (
    <figure className="flex flex-col gap-1" data-testid="wiring-diagram" data-wiring={product.wiring}>
      <svg viewBox="0 0 560 236" className="w-full rounded-lg border border-border bg-white" role="img" aria-label={`Schéma zapojení: ${product.label}`}>
        {wiringContent(product.wiring, product, system)}
      </svg>
      <figcaption className="text-[11px] text-muted-foreground">
        Orientační schéma zapojení ({smartSystemOf(system).label}) – přesné označení a pořadí svorek podle návodu k montáži výrobce.
      </figcaption>
    </figure>
  );
}
