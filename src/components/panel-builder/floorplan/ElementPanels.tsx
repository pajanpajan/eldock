"use client";

import type { ReactNode } from "react";
import { CheckCircle2, LayoutGrid, Link2, RotateCw, Sparkles, Trash2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mountHeight } from "@/engine/floorplan-bridge";
import {
  ROOM_NAME_CHIPS,
  controllersOf,
  controlsLights,
  effectiveSwitchNo,
  isWiredSwitch,
  paletteItem,
  roomDimensions,
  switchingFor,
  applyLightOption,
  lightSpecOf,
  type EditorElement,
  type EditorRoom,
  type FloorplanDraft,
  type LightSpec,
  type PaletteItem,
} from "@/lib/panel-builder/floorplan-editor";
import { frameGangs, frameOf, isFrameable } from "@/lib/panel-builder/floorplan-frames";
import { DESIGN_BRANDS, appearanceLabel, colorForSeries, seriesColors } from "@/lib/panel-builder/wiring-designs";
import { cn } from "@/lib/utils";

import { AddToFrameControl, SaveTemplateControl } from "./FrameAssemblyPalette";
import { DeviceControls, LightOptions } from "./LightOptions";
import { FixtureControls } from "./FixtureShape";
import type { BasinZone } from "@/lib/panel-builder/fixtures";
import { protectionLabel, type ApplianceSpec } from "@/lib/panel-builder/appliances";

/** Měřítko značky v detailu prvku (1 = 300 mm v půdorysu). */
const SCALE_OPTIONS = [0.5, 0.75, 1, 1.5, 2, 3];

// Fáze 64: podkomponenty editoru 2D půdorysu oddělené z FloorplanEditor.tsx – tlačítko nástroje, plovoucí lišta
// vybrané značky, detail prvku (úroveň, výška, svítidlo, ovládání, vzhled, spotřebič, předmět), živé kóty a detail místnosti.

export function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} aria-pressed={active} className="gap-1.5" onClick={onClick}>
      {icon} {label}
    </Button>
  );
}

/** Fáze 77: rychlé volby svítidla v plovoucí liště – stmívání, CCT a cyklus barvy (bez → RGBW → RGB → bez). */
export interface LightQuickOptions {
  spec: LightSpec;
  item: PaletteItem;
  onChange: (spec: LightSpec) => void;
}

/** Plovoucí lišta nad vybranou značkou (velikost drží stejnou na obrazovce i při zoomu). */
export function ElementToolbar({ x, y, unit, onRotate, onScale, onDelete, onPair, onAddToFrame, light }: { x: number; y: number; unit: number; onRotate: () => void; onScale: (factor: number) => void; onDelete: () => void; onPair?: () => void; onAddToFrame?: () => void; light?: LightQuickOptions }) {
  const size = unit * 1.15;
  const set = (patch: Partial<LightSpec>) => light && light.onChange(applyLightOption(light.spec, patch, light.item));
  const colorful = Boolean(light && (light.spec.cct || light.spec.color));
  const buttons: { label: string; text: string; fill: string; onClick: () => void; font?: number; pressed?: boolean }[] = [
    ...(onPair ? [{ label: "Přiřadit vypínač ke světlu", text: "🔗", fill: "#166534", onClick: onPair }] : []),
    ...(light
      ? [
          { label: "Stmívatelné svítidlo", text: "🔆", fill: light.spec.dimmable || colorful ? "#a16207" : "#27272a", pressed: light.spec.dimmable || colorful, onClick: () => !colorful && set({ dimmable: !light.spec.dimmable }) },
          { label: "Změna chromatičnosti CCT", text: "🌡️", fill: light.spec.cct ? "#0369a1" : "#27272a", pressed: Boolean(light.spec.cct), onClick: () => set({ cct: !light.spec.cct }) },
          {
            label: `Změna barvy RGB / RGBW${light.spec.color ? ` (${light.spec.color.toUpperCase()})` : ""}`,
            text: "🌈",
            fill: light.spec.color ? "#a21caf" : "#27272a",
            pressed: Boolean(light.spec.color),
            onClick: () => set({ color: !light.spec.color ? "rgbw" : light.spec.color === "rgbw" ? "rgb" : undefined }),
          },
        ]
      : []),
    // Fáze 62: stejný přístroj vedle do víceramečku (zásuvka → 2R → 3R …)
    ...(onAddToFrame ? [{ label: "Přidat stejný přístroj vedle do rámečku", text: "▦+", fill: "#a16207", onClick: onAddToFrame, font: 0.5 }] : []),
    { label: "Otočit značku o 90°", text: "⟳", fill: "#27272a", onClick: onRotate },
    { label: "Zmenšit značku", text: "−", fill: "#27272a", onClick: () => onScale(1 / 1.25) },
    { label: "Zvětšit značku", text: "+", fill: "#27272a", onClick: () => onScale(1.25) },
    { label: "Smazat značku", text: "🗑", fill: "#dc2626", onClick: onDelete },
  ];
  const width = buttons.length * (size + unit * 0.15) + unit * 0.15;
  return (
    <g transform={`translate(${x - width / 2} ${y - size - unit * 0.3})`} data-testid="element-toolbar">
      <rect width={width} height={size + unit * 0.3} rx={unit * 0.25} fill="#18181b" stroke="#38bdf8" strokeWidth={unit / 16} />
      {buttons.map((button, index) => (
        <g
          key={button.label}
          transform={`translate(${unit * 0.15 + index * (size + unit * 0.15)} ${unit * 0.15})`}
          className="cursor-pointer"
          role="button"
          aria-label={button.label}
          aria-pressed={button.pressed}
          data-testid={button.pressed !== undefined ? `quick-${button.text === "🔆" ? "dim" : button.text === "🌈" ? "color" : "cct"}` : undefined}
          onPointerDown={(event) => {
            event.stopPropagation();
            button.onClick();
          }}
        >
          <rect width={size} height={size} rx={unit * 0.2} fill={button.fill} />
          <text x={size / 2} y={size / 2} fontSize={unit * (button.font ?? 0.7)} textAnchor="middle" dominantBaseline="central" fill="#fafafa" pointerEvents="none">
            {button.text}
          </text>
        </g>
      ))}
    </g>
  );
}

export function ElementDetail({
  draft,
  element,
  pairing,
  onPair,
  onChange,
  onRotate,
  onDelete,
  onAutoPair,
  usedGangs,
  onAddToFrame,
  onFrame,
  display,
  appliance,
  onRotateStep,
  onEditAppliances,
  socketCircuit,
  board,
  onBasinZone,
  onSaveTemplate,
}: {
  draft: FloorplanDraft;
  element: EditorElement;
  pairing: boolean;
  onPair: () => void;
  onChange: (patch: Partial<EditorElement>) => void;
  onRotate: () => void;
  onDelete: () => void;
  onAutoPair: () => void;
  /** Fáze 62: obsazené pozice rámečku prvku a přidání dalšího přístroje do rámečku. */
  usedGangs: number;
  onAddToFrame: (item: string) => void;
  onFrame: { moveLeft: () => void; moveRight: () => void; rotate: () => void; leave: () => void; dissolve: () => void };
  /** Fáze 63: zobrazovaná položka (spotřebič z knihovny, výrobek), zadání spotřebiče, otočení po 45° a úprava spotřebičů. */
  display: PaletteItem;
  appliance: ApplianceSpec | null;
  onRotateStep: (step: number) => void;
  onEditAppliances: () => void;
  /** Fáze 65: okruh zásuvky (jen jedno- / dvojzásuvky). */
  socketCircuit?: ReactNode;
  /** Fáze 74: rozváděč prvku (výběr) / údaje podružného rozváděče. */
  board?: ReactNode;
  /** Fáze 74: ochranná zóna umyvadla (volba nákresu). */
  onBasinZone?: (zone: BasinZone) => void;
  /** Fáze 78: víceramček jako šablona firmy (chyba jako text, jinak null). */
  onSaveTemplate?: (members: string[], label: string) => string | null;
}) {
  const item = paletteItem(element.item)!;
  const isPanel = item.kind === "panel" || item.kind === "riser" || item.kind === "fixture";
  const defaultHeight = isPanel ? draft.profile.switchboardHeightMm : (appliance?.heightMm ?? item.heightMm ?? mountHeight({ kind: item.kind as Exclude<typeof item.kind, "panel" | "riser" | "fixture">, variant: item.variant, tag: item.tag }, draft.profile));
  const light = item.kind === "light" ? lightSpecOf(element) : null;
  const frame = frameOf(draft, element.id);
  const legacyFrameable = !frame && !item.wireless && !item.sensor && !item.heatingHead && (item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket" || item.kind === "switch");
  const rooms = [...new Set([...draft.rooms.map((room) => room.name), ...draft.elements.map((other) => other.room)])];
  const everything = [...draft.elements, ...draft.otherFloors.flatMap((floor) => floor.elements)];
  const lights = everything.filter((other) => element.controls.includes(other.id));
  const controllers = everything.filter((other) => other.controls.includes(element.id));
  const floorName = (id: string) => (draft.elements.some((other) => other.id === id) ? null : (draft.otherFloors.find((floor) => floor.elements.some((other) => other.id === id))?.name ?? null));
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-sky-500/50 bg-card p-3 text-sm" aria-label="Detail vybraného prvku" data-testid="element-detail">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          <span className="mr-1.5 rounded bg-muted px-1 font-mono text-xs">{display.symbol}</span>
          {display.label}
        </h3>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={onRotate} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Otočit prvek o 90°" title="Otočit o 90° (R)">
            <RotateCw className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={onDelete} className="rounded p-1 text-muted-foreground hover:bg-red-500/15 hover:text-red-300" aria-label="Smazat prvek">
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      {socketCircuit}
      {board}
      {/* Fáze 57: měřítko značky (násobek velikosti značek nákresu) */}
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" role="radiogroup" aria-label="Měřítko značky">
        Měřítko značky:
        {SCALE_OPTIONS.map((value) => (
          <button key={value} type="button" role="radio" aria-checked={(element.scale ?? 1) === value} onClick={() => onChange({ scale: value === 1 ? null : value })} className={cn("rounded border px-1.5 py-0.5", (element.scale ?? 1) === value ? "border-primary bg-primary/20 text-foreground" : "border-border")}>
            {Math.round(value * 100)} %
          </button>
        ))}
      </div>
      {item.kind === "fixture" ? (
        // Fáze 63: přesný rozměr X × Y a natočení po 90° / 45°
        <FixtureControls element={element} onChange={onChange} onRotate={onRotateStep} basinZone={draft.basinZone} onBasinZone={onBasinZone} />
      ) : isPanel ? (
        <p className="text-xs text-muted-foreground">
          {item.kind === "riser"
            ? "Průchod kabelů do jiného podlaží – trasy z tohoto podlaží vedou k rozváděči přes toto místo (svislá délka = rozdíl výšek podlaží)."
            : `Výchozí bod všech tras. Výška rozváděče se nastavuje v horní liště (${draft.profile.switchboardHeightMm} mm).`}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Montážní výška [mm]
              <Input type="number" min={0} max={6000} step={50} value={element.mountHeightMm ?? ""} placeholder={String(defaultHeight)} onChange={(event) => onChange({ mountHeightMm: event.target.value === "" ? null : Number(event.target.value) })} aria-label="Montážní výška [mm]" className="h-8" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Místnost
              <Input value={element.room} list="fp-rooms" maxLength={40} onChange={(event) => onChange({ room: event.target.value })} aria-label="Místnost" className="h-8" />
              <datalist id="fp-rooms">
                {rooms.map((room) => (
                  <option key={room} value={room} />
                ))}
              </datalist>
            </label>
          </div>
          {/* Fáze 63: samostatný spotřebič – jištění, chránič a kabel z knihovny spotřebičů */}
          {appliance ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-500/40 bg-orange-500/5 p-2 text-xs" data-testid="appliance-detail">
              <span>
                {appliance.powerW.toLocaleString("cs-CZ")} W · {protectionLabel(appliance)}
                {appliance.custom ? " · vlastní spotřebič" : ""}
              </span>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onEditAppliances}>
                ✎ Upravit spotřebiče
              </Button>
            </div>
          ) : null}
          {/* Fáze 59: víceramček – pořadí, otočení, vyjmutí a rozdělení */}
          {frame ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs" data-testid="frame-detail">
              <p className="font-semibold text-amber-200">
                <LayoutGrid className="mr-1 inline size-3.5" aria-hidden />
                Víceramček {frameGangs(draft, frame)}R · pozice {frame.members.indexOf(element.id) + 1} z {frame.members.length}
              </p>
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={onFrame.moveLeft} disabled={frame.members.indexOf(element.id) === 0}>
                  ◀ Posunout
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={onFrame.moveRight} disabled={frame.members.indexOf(element.id) === frame.members.length - 1}>
                  Posunout ▶
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={onFrame.rotate}>
                  ⟳ Otočit rámeček
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={onFrame.leave}>
                  Vyjmout z rámečku
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-red-300" onClick={onFrame.dissolve} data-testid="frame-dissolve">
                  Rozdělit rámeček
                </Button>
              </div>
              <AddToFrameControl level={draft.installation} defaultItem={element.item} gangs={usedGangs} onAdd={onAddToFrame} />
              {/* Fáze 78: osazený víceramček jako šablona firmy (pořadí pozic zleva) */}
              {onSaveTemplate ? <SaveTemplateControl members={frame.members.map((id) => draft.elements.find((other) => other.id === id)?.item).filter((id): id is string => Boolean(id))} onSave={onSaveTemplate} /> : null}
            </div>
          ) : legacyFrameable ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground" role="radiogroup" aria-label="Počet kusů v rámečku">
                Stejné kusy v rámečku:
                {[1, 2, 3, 4, 5].map((units) => (
                  <button key={units} type="button" role="radio" aria-checked={element.frameUnits === units} onClick={() => onChange({ frameUnits: units })} className={cn("rounded border px-2 py-0.5", element.frameUnits === units ? "border-primary bg-primary/20 text-foreground" : "border-border")}>
                    {units}R
                  </button>
                ))}
              </div>
              {isFrameable(element) ? (
                <>
                  <AddToFrameControl level={draft.installation} defaultItem={element.item} gangs={usedGangs} onAdd={onAddToFrame} />
                  <p className="text-[11px] text-muted-foreground">Celou sestavu vložíte i z palety (▦ Sestavy ve víceramečku), již osazené přístroje spojíte Shift + klikem a „Vložit do víceramečku“.</p>
                </>
              ) : null}
            </div>
          ) : null}
          {/* Fáze 77: vývod motoru žaluzie, čidla a hlavice nemají designovou řadu (skryté za překladem / u okna) */}
          {item.kind !== "appliance" && item.kind !== "light" && item.kind !== "blind_motor" && !item.sensor && !item.heatingHead ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Designová řada
                <select value={element.series ?? ""} onChange={(event) => onChange({ series: event.target.value || null, ...(element.color ? { color: colorForSeries(event.target.value || draft.series, element.color) } : {}) })} className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" aria-label="Designová řada prvku">
                  <option value="">podle nákresu</option>
                  {DESIGN_BRANDS.map((brand) => (
                    <optgroup key={brand.manufacturer} label={brand.label}>
                      {brand.series.map((option) => (
                        <option key={option.name} value={`${brand.manufacturer}|${option.name}`}>
                          {brand.label} {option.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Barva klapky / krytu
                <select value={element.color ?? ""} onChange={(event) => onChange({ color: event.target.value || null })} className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" aria-label="Barva prvku">
                  <option value="">podle nákresu</option>
                  {/* Fáze 55: jen barvy řady prvku (ABB 2026 s kódy), jinak obecné skupiny */}
                  {seriesColors(element.series ?? draft.series).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {/* Fáze 74: barva rámečku zvlášť (výchozí podle nákresu / stejná jako klapka) */}
              <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">
                Barva rámečku
                <select
                  value={element.frameColor ?? ""}
                  onChange={(event) => onChange({ frameColor: event.target.value || undefined })}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30"
                  aria-label="Barva rámečku prvku"
                  data-testid="element-frame-color"
                >
                  <option value="">podle nákresu ({draft.frameColor ? "vlastní barva rámečku" : "stejná jako klapka"})</option>
                  {seriesColors(element.series ?? draft.series).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="col-span-2 text-[11px] text-muted-foreground" data-testid="element-appearance">
                {appearanceLabel(element.series ?? draft.series, element.color ?? draft.color, element.frameColor ?? draft.frameColor ?? element.color ?? draft.color)}
              </p>
            </div>
          ) : null}
          {controlsLights(item) ? (
            <div className="flex flex-col gap-1.5">
              {/* Fáze 62: párování se ukončuje tlačítkem „Hotovo“ nad půdorysem, ne v bočním panelu */}
              {pairing ? (
                <p className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200" data-testid="pairing-note">
                  🔗 Párování běží – klikejte na svítidla v půdorysu, ukončíte ho tlačítkem Hotovo nad půdorysem (Esc).
                </p>
              ) : (
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onPair} data-testid="pair-switch">
                  <Link2 className="size-4" aria-hidden /> 🔗 Přiřadit ke světlu
                </Button>
              )}
              <p className="text-xs text-muted-foreground" data-testid="switch-controls">
                {lights.length
                  ? `Ovládá: ${lights.map((light) => `${paletteItem(light.item)?.label} (${light.room}${floorName(light.id) ? `, ${floorName(light.id)}` : ""})${isWiredSwitch(item) ? ` – řazení ${switchingFor(controllersOf(draft, light.id))}` : ""}`).join(", ")}`
                  : "Zatím neovládá žádné svítidlo."}
              </p>
              {isWiredSwitch(item) && lights.length ? (
                <p className="flex items-center gap-1 text-xs text-emerald-300" data-testid="switch-number">
                  <CheckCircle2 className="size-3" aria-hidden /> Značka kreslena jako řazení č. {effectiveSwitchNo(draft, element)}
                </p>
              ) : null}
            </div>
          ) : null}
          {/* Fáze 77: blind / termostat ↔ motory žaluzií / hlavice – pohon a párování */}
          <DeviceControls element={element} item={item} everything={everything} pairing={pairing} onPair={onPair} onChange={onChange} />
          {/* Fáze 61 + 77: svítidlo – stmívání, CCT, barva, technologie řízení, příkon a zátěž (všechny úrovně instalace) */}
          {light ? <LightOptions element={element} item={item} onChange={(next) => onChange({ light: next })} /> : null}
          {item.kind === "light" ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground" data-testid="light-switching">
                Ovládací místa: {controllersOf(draft, element.id)} · řazení {switchingFor(controllersOf(draft, element.id))}
                {controllers.length ? ` · ${controllers.map((controller) => `${paletteItem(controller.item)?.symbol} (${controller.room}${floorName(controller.id) ? `, ${floorName(controller.id)}` : ""})`).join(", ")}` : ""}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pairing ? (
                  <p className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200" data-testid="pairing-note">
                    🔗 Párování běží – klikejte na vypínače v půdorysu, ukončíte ho tlačítkem Hotovo nad půdorysem (Esc).
                  </p>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onPair} data-testid="pair-light">
                    <Link2 className="size-4" aria-hidden /> 🔗 Přiřadit vypínač
                  </Button>
                )}
                {!controllers.length ? (
                  <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={onAutoPair}>
                    <Sparkles className="size-4" aria-hidden /> Nejbližší vypínač v místnosti
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Zap className="size-3" aria-hidden /> Poloha {(element.x / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} / {(element.y / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} m · otočení {element.rotation}°
      </p>
    </section>
  );
}

/** Živé kóty obdélníku: X u horní hrany, Y u pravé hrany, uprostřed rozměr a plocha. */
export function Dimensions({ x, y, w, h, symbol }: { x: number; y: number; w: number; h: number; symbol: number }) {
  if (w <= 0 || h <= 0) return null;
  const dims = roomDimensions(w, h);
  const font = symbol * 0.62;
  const tag = (cx: number, cy: number, text: string, id: string) => (
    <g data-testid={id} pointerEvents="none">
      <rect x={cx - (text.length * font * 0.3 + font * 0.4)} y={cy - font * 0.8} width={text.length * font * 0.6 + font * 0.8} height={font * 1.3} rx={font * 0.25} fill="#facc15" />
      <text x={cx} y={cy + font * 0.1} fontSize={font} fontWeight={700} textAnchor="middle" fill="#09090b">
        {text}
      </text>
    </g>
  );
  return (
    <>
      {tag(x + w / 2, y - font * 0.2, `X: ${dims.x}`, "dim-x")}
      {tag(x + w + font * 3.2, y + h / 2, `Y: ${dims.y}`, "dim-y")}
      {tag(x + w / 2, y + h / 2, dims.label, "dim-area")}
    </>
  );
}

/** Detail vybrané místnosti: název s rychlými štítky, rozměr X × Y v metrech a smazání. */
export function RoomDetail({ room, onChange, onDelete }: { room: EditorRoom; onChange: (patch: Partial<Pick<EditorRoom, "name" | "w" | "h">>) => void; onDelete: () => void }) {
  const toM = (mm: number) => Math.round(mm) / 1000;
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-yellow-400/60 bg-card p-3 text-sm" aria-label="Detail vybrané místnosti" data-testid="room-detail">
      <h3 className="font-semibold">🏠 Místnost</h3>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Název místnosti
        <Input value={room.name} maxLength={40} onChange={(event) => onChange({ name: event.target.value })} aria-label="Název místnosti" className="h-8" />
      </label>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Rychlé názvy místností">
        {ROOM_NAME_CHIPS.map((name) => (
          <button key={name} type="button" onClick={() => onChange({ name })} className={cn("rounded-md border px-1.5 py-0.5 text-[11px]", room.name === name ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Šířka X [m]
          <Input type="number" min={0.5} max={200} step={0.05} defaultValue={toM(room.w)} key={`w${room.w}`} onBlur={(event) => Number(event.target.value) > 0 && onChange({ w: Math.round(Number(event.target.value) * 1000) })} onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} aria-label="Šířka X [m]" className="h-8" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Hloubka Y [m]
          <Input type="number" min={0.5} max={200} step={0.05} defaultValue={toM(room.h)} key={`h${room.h}`} onBlur={(event) => Number(event.target.value) > 0 && onChange({ h: Math.round(Number(event.target.value) * 1000) })} onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} aria-label="Hloubka Y [m]" className="h-8" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="room-area">
        {roomDimensions(room.w, room.h).label}
      </p>
      <Button type="button" variant="destructive" size="sm" className="gap-1.5" onClick={onDelete}>
        <Trash2 className="size-4" aria-hidden /> 🗑️ Smazat místnost
      </Button>
    </section>
  );
}
