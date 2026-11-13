import { QrCode } from "lucide-react";

import { ProductPreview } from "@/components/landing/ProductPreview";
import { LogoMark } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";

// Fáze 111: náhledy obrazovek modulů v podsekcích /sekce/… – čisté CSS, bez obrázků (stejně jako ProductPreview).

const frame = "relative overflow-hidden rounded-xl border border-border bg-card/80 p-3 shadow-xl shadow-black/30";

function FloorplanPreview() {
  const symbols = [
    { x: 18, y: 22, t: "⏚" },
    { x: 42, y: 18, t: "◐" },
    { x: 70, y: 30, t: "⏚" },
    { x: 30, y: 62, t: "⊗" },
    { x: 62, y: 66, t: "⊗" },
    { x: 84, y: 58, t: "▣" },
  ];
  return (
    <div className={frame} aria-hidden>
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">2D půdorys · fáze 3 – zásuvky a spotřebiče</p>
      <div className="bg-blueprint relative aspect-[16/9] rounded-md border border-border bg-background">
        <div className="absolute inset-[7%] border-2 border-zinc-500" />
        <div className="absolute top-[7%] bottom-[7%] left-[52%] border-l-2 border-zinc-500" />
        <div className="absolute top-[48%] right-[7%] left-[7%] border-t-2 border-zinc-500" />
        <svg viewBox="0 0 100 56" className="absolute inset-0 size-full">
          <path d="M84 33 H70 V17 H42 V12 H18" fill="none" stroke="#fb923c" strokeWidth="0.8" strokeDasharray="2 1" />
          <path d="M84 33 V37 H62 V35 H30" fill="none" stroke="#facc15" strokeWidth="0.8" strokeDasharray="2 1" />
        </svg>
        {symbols.map((symbol, index) => (
          <span key={index} className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-zinc-900 px-1 text-xs text-amber-300" style={{ left: `${symbol.x}%`, top: `${symbol.y}%` }}>
            {symbol.t}
          </span>
        ))}
      </div>
    </div>
  );
}

function SwitchboardPreview() {
  const field = (low: boolean) => (
    <div className={cn("flex flex-1 flex-col gap-1.5 rounded-md border p-1.5", low ? "border-cyan-400/50" : "border-amber-400/50")}>
      <span className={cn("font-mono text-[9px] font-bold", low ? "text-cyan-300" : "text-amber-300")}>{low ? "Pole B – Slaboproud / Smart Home" : "Pole A – Silnoproud 230/400 V"}</span>
      {[0.9, 0.85, 0.8, 0.7].map((fill, index) => (
        <div key={index} className="flex h-5 items-center rounded-sm bg-zinc-800 px-0.5">
          <div className={cn("h-3.5 rounded-sm", low ? "bg-cyan-500/70" : "bg-amber-400/80")} style={{ width: `${(low ? fill - 0.15 : fill) * 100}%` }} />
        </div>
      ))}
    </div>
  );
  return (
    <div className={frame} aria-hidden>
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">AI Panel Builder · 📐 Dvoupolová skříň (2 × 12 M)</p>
      <div className="flex gap-2 rounded-md border border-border bg-zinc-950 p-2">
        {field(false)}
        <div className="w-1 rounded bg-zinc-600" />
        {field(true)}
      </div>
    </div>
  );
}

function QuotePreview() {
  const rows = [
    ["Montáž zásuvky pod omítku", "12 ks", "4 080 Kč"],
    ["Kabel CYKY-J 3×2,5", "148 m", "3 552 Kč"],
    ["Rozváděč RH1 – osazení", "1 ks", "18 900 Kč"],
  ];
  return (
    <div className={frame} aria-hidden>
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">Cenová nabídka · normohodiny + ceník velkoobchodu</p>
      <table className="w-full text-[11px]">
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-border/60">
              <td className="py-1">{row[0]}</td>
              <td className="py-1 text-right text-muted-foreground">{row[1]}</td>
              <td className="py-1 text-right font-mono">{row[2]}</td>
            </tr>
          ))}
          <tr>
            <td className="pt-1.5 font-bold" colSpan={2}>
              Celkem bez DPH
            </td>
            <td className="pt-1.5 text-right font-mono font-bold text-primary">26 532 Kč</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AppliancesPreview() {
  return (
    <div className={frame} aria-hidden>
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">Hlídač revizí · 2. NP – Kancelář 204</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <ul className="flex flex-col gap-1 text-[11px]">
          {["🖥️ Monitor Dell 27″ · třída I · E", "🔌 Prodlužovačka 5× · třída I · E", "☕ Rychlovarná konvice · třída I · E", "🖨️ Tiskárna · třída I · E"].map((row) => (
            <li key={row} className="rounded border border-border bg-background/70 px-1.5 py-1">
              {row}
            </li>
          ))}
        </ul>
        <div className="flex w-28 flex-col gap-1 rounded-md border-2 border-black bg-white p-1.5 text-black">
          <span className="flex items-center gap-1 text-[8px] font-black">
            <LogoMark className="size-2.5" /> ELDOCK · EL-000042
          </span>
          <QrCode className="size-9" />
          <span className="text-[8px] leading-tight font-bold">Monitor Dell U2723QE</span>
          <span className="font-mono text-[7px] leading-tight">S/N: CN-0892K1-74210</span>
          <span className="text-[7px] leading-tight">Revize do 3/2027</span>
        </div>
      </div>
    </div>
  );
}

function PassportPreview() {
  return (
    <div className={frame} aria-hidden>
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">QR pasport RH1 · verze v1.0 → v1.1</p>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1 rounded-md border border-border bg-background/70 p-2 text-[11px]">
          <span className="font-semibold">🔒 Vydaná dokumentace v1.1</span>
          <span className="text-muted-foreground">Červenka: -F12 B16 → C16 (schváleno)</span>
          <span className="text-muted-foreground">Revize podepsána · pečeť SHA-256</span>
          <span className="text-emerald-300">✓ Měsíční report TIČR odeslán</span>
        </div>
        <div className="flex size-20 items-center justify-center rounded-md border-2 border-zinc-400 bg-zinc-100 text-zinc-900">
          <QrCode className="size-14" />
        </div>
      </div>
    </div>
  );
}

/** Náhled obrazovky modulu podle jeho id. */
export function SectionModulePreview({ id }: { id: string }) {
  switch (id) {
    case "pudorys":
      return <FloorplanPreview />;
    case "panel-builder":
      return <SwitchboardPreview />;
    case "nabidky":
      return <QuotePreview />;
    case "hlidac":
      return <AppliancesPreview />;
    case "mapa":
      return <ProductPreview />;
    default:
      return <PassportPreview />;
  }
}
