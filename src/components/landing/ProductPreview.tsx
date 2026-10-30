import { QrCode } from "lucide-react";

import { LogoMark } from "@/components/layout/Logo";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";

const PINS = [
  { code: "RM1", x: 18, y: 30, status: "ACTIVE" },
  { code: "R-CNC-04", x: 56, y: 22, status: "PENDING_UPDATE" },
  { code: "R-LIS-02", x: 38, y: 64, status: "WAITING_APPROVAL" },
  { code: "R-VZT-01", x: 78, y: 58, status: "ACTIVE" },
] as const;

/** Náhled aplikace do hero sekce: půdorys patra se stavovými piny – čisté CSS, bez obrázků. */
export function ProductPreview() {
  return (
    <div className="relative rounded-2xl border border-border bg-card/80 p-3 shadow-2xl shadow-black/40 backdrop-blur" aria-hidden>
      <div className="flex items-center gap-2 border-b border-border px-1 pb-3">
        <LogoMark className="size-5" />
        <span className="font-mono text-[11px] text-muted-foreground">Závod Jablonec › Hala A – Lisovna › 1. NP</span>
        <QrCode className="ml-auto size-4 text-muted-foreground" />
      </div>

      <div className="bg-blueprint relative mt-3 aspect-[16/10] overflow-hidden rounded-lg border border-border bg-background">
        {/* stěny a pole hal */}
        <div className="absolute inset-[8%] rounded-sm border-2 border-zinc-600" />
        <div className="absolute top-[8%] bottom-[8%] left-[46%] border-l-2 border-dashed border-zinc-700" />
        <div className="absolute top-[48%] right-[8%] left-[46%] border-t-2 border-dashed border-zinc-700" />
        {PINS.map((pin) => {
          const style = EQUIPMENT_STATUS[pin.status];
          return (
            <div key={pin.code} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
              <span className={cn("size-3.5 rounded-full ring-4 ring-background", style.dot)} />
              <span className="rounded bg-background/90 px-1.5 py-0.5 font-mono text-[10px] text-foreground">{pin.code}</span>
            </div>
          );
        })}
      </div>

      <ul className="mt-3 grid gap-1.5 px-1 text-[11px] text-muted-foreground sm:grid-cols-3">
        {(["ACTIVE", "PENDING_UPDATE", "WAITING_APPROVAL"] as const).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", EQUIPMENT_STATUS[status].dot)} />
            {EQUIPMENT_STATUS[status].label}
          </li>
        ))}
      </ul>
    </div>
  );
}
