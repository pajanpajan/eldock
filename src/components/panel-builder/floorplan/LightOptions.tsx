"use client";

import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BLIND_DRIVES,
  DEFAULT_LIGHT,
  HEAD_DRIVES,
  LIGHT_CONTROLS,
  LIGHT_LOADS,
  applyLightOption,
  lightControlOf,
  pairNoun,
  paletteItem,
  pwmChannels,
  type EditorElement,
  type LightControl,
  type LightSpec,
  type PaletteItem,
} from "@/lib/panel-builder/floorplan-editor";
import { cn } from "@/lib/utils";

/**
 * Fáze 77: volby svítidla – 🔆 stmívání, 🌡️ změna chromatičnosti (CCT), 🌈 změna barvy (RGB / RGBW) a technologie řízení
 * (fázové stmívání 230 V, DALI / DALI-2, 24 V DC PWM). CCT a barva fázovým stmíváním nejdou – přepnou na DALI (LED pásek
 * na PWM). Plovoucí lišta u světla má rychlé přepínače 🔆 / 🌡️ / 🌈 (`ElementToolbar`).
 */
export function LightOptions({ element, item, onChange }: { element: Pick<EditorElement, "light">; item: PaletteItem; onChange: (light: LightSpec) => void }) {
  const light = element.light ?? DEFAULT_LIGHT;
  const control = lightControlOf(element, item);
  const colorful = Boolean(light.cct || light.color);
  // CCT / barva potřebují DALI DT8 nebo PWM – u fázového stmívání se technologie přepne (applyLightOption)
  const set = (patch: Partial<LightSpec>) => onChange(applyLightOption(light, patch, item));
  const setControl = (value: LightControl) => set({ control: value });
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs" data-testid="light-spec">
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={light.dimmable || colorful} disabled={colorful} onChange={(event) => set({ dimmable: event.target.checked })} aria-label="Stmívané svítidlo" data-testid="light-dim" /> 🔆 Stmívatelné (0–100 %)
      </label>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={Boolean(light.cct)} onChange={(event) => set({ cct: event.target.checked })} aria-label="Změna chromatičnosti CCT" data-testid="light-cct" /> 🌡️ Změna chromatičnosti (Tunable White – CCT)
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={Boolean(light.color)} onChange={(event) => set({ color: event.target.checked ? "rgbw" : undefined })} aria-label="Změna barvy RGB / RGBW" data-testid="light-color" /> 🌈 Změna barvy
        </label>
        {light.color ? (
          <span className="flex gap-1" role="radiogroup" aria-label="Barevné provedení">
            {(["rgb", "rgbw"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={light.color === value}
                onClick={() => set({ color: value })}
                className={cn("rounded border px-1.5 py-0.5 font-mono text-[11px]", light.color === value ? "border-fuchsia-400 bg-fuchsia-500/20 text-foreground" : "border-border text-muted-foreground")}
                data-testid={`light-color-${value}`}
              >
                {value.toUpperCase()}
              </button>
            ))}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Technologie řízení svítidla">
        {LIGHT_CONTROLS.map((option) => {
          const blocked = option.id === "phase" && colorful;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={control === option.id}
              disabled={blocked}
              title={blocked ? "CCT a barva jen přes DALI DT8 nebo 24 V PWM" : undefined}
              onClick={() => setControl(option.id)}
              className={cn("rounded-md border px-2 py-1 text-left", control === option.id ? "border-emerald-400 bg-emerald-500/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground", blocked && "opacity-40")}
              data-testid={`light-control-${option.id}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-muted-foreground">
          Příkon [W]
          <Input
            type="number"
            min={1}
            max={3000}
            value={light.powerW}
            onChange={(event) =>
              set({
                powerW: Math.min(3000, Math.max(1, Math.round(Number(event.target.value) || DEFAULT_LIGHT.powerW))),
              })
            }
            aria-label="Příkon svítidla [W]"
            className="h-8"
          />
        </label>
        <label className="flex flex-col gap-1 text-muted-foreground">
          Zátěž
          <select
            value={light.load}
            onChange={(event) => set({ load: event.target.value as LightSpec["load"] })}
            className="h-8 rounded-md border border-input bg-transparent px-1.5 text-foreground dark:bg-input/30"
            aria-label="Druh zátěže svítidla"
          >
            {LIGHT_LOADS.map((load) => (
              <option key={load.id} value={load.id}>
                {load.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground" data-testid="light-tech-note">
        {control === "dali"
          ? "DALI: okruh svítidel kabelem 5×1,5 (L, N, PE, DA+, DA−), v rozváděči DALI brána / řídicí jednotka."
          : control === "pwm"
            ? `24 V DC PWM: ${pwmChannels(light)} ${pwmChannels(light) === 1 ? "kanál" : pwmChannels(light) <= 4 ? "kanály" : "kanálů"} řadiče, kabel ${pwmChannels(light) + 1}×1,5 ze zdroje 24 V v rozváděči (příkon + 20 %).`
            : light.dimmable
              ? "Fázové stmívání 230 V – stmívač na stěně (klasika) nebo stmívací akční člen v rozváděči (sběrnice)."
              : "Spínané svítidlo 230 V."}
      </p>
    </div>
  );
}

/**
 * Fáze 77: pohon motoru žaluzie / hlavice a párování s ovladačem (žaluziový spínač → motory, termostat → hlavice) –
 * u ovladače seznam spárovaných motorů / hlavic, u motoru / hlavice jeho ovladače.
 */
export function DeviceControls({
  element,
  item,
  everything,
  pairing,
  onPair,
  onChange,
}: {
  element: EditorElement;
  item: PaletteItem;
  everything: readonly EditorElement[];
  pairing: boolean;
  onPair: () => void;
  onChange: (patch: Partial<EditorElement>) => void;
}) {
  const controller = item.kind === "switch" && (item.control === "blind" || item.control === "thermostat") && !item.sensor && !item.heatingHead;
  const target = item.kind === "blind_motor" || Boolean(item.heatingHead);
  if (!controller && !target) return null;
  const linked = controller ? everything.filter((other) => element.controls.includes(other.id)) : everything.filter((other) => other.controls.includes(element.id));
  const names = linked.map((other) => `${paletteItem(other.item)?.symbol ?? other.item} (${other.room})`).join(", ");
  return (
    <div className="flex flex-col gap-1.5 text-xs" data-testid="device-controls">
      {item.kind === "blind_motor" ? (
        <label className="flex flex-col gap-1 text-muted-foreground">
          Pohon žaluzie / rolety
          <select
            value={element.drive ?? "ac230"}
            onChange={(event) => onChange({ drive: event.target.value as EditorElement["drive"] })}
            className="h-8 rounded-md border border-input bg-transparent px-1.5 text-sm text-foreground dark:bg-input/30"
            aria-label="Pohon žaluzie"
            data-testid="blind-drive"
          >
            {BLIND_DRIVES.map((drive) => (
              <option key={drive.id} value={drive.id}>
                {drive.label}
              </option>
            ))}
          </select>
          <span className="text-[11px]">
            {(element.drive ?? "ac230") === "ac230" ? "Kabel CYKY-J 5×1,5 (L, N, PE, ↑, ↓) od žaluziového spínače / aktoru, napájení z žaluziového okruhu B10." : "Kabel SYKFY / CAT7 (24 V DC / sběrnice) z řídicí jednotky v rozváděči."}
          </span>
        </label>
      ) : null}
      {item.heatingHead ? (
        <label className="flex flex-col gap-1 text-muted-foreground">
          Pohon hlavice
          <select
            value={element.headDrive ?? "dc24"}
            onChange={(event) =>
              onChange({
                headDrive: event.target.value as EditorElement["headDrive"],
              })
            }
            className="h-8 rounded-md border border-input bg-transparent px-1.5 text-sm text-foreground dark:bg-input/30"
            aria-label="Pohon hlavice"
            data-testid="head-drive"
          >
            {HEAD_DRIVES.map((drive) => (
              <option key={drive.id} value={drive.id}>
                {drive.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {pairing ? (
        <p className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200" data-testid="pairing-note">
          🔗 Párování běží – klikejte v půdorysu {controller ? (item.control === "blind" ? "na motory žaluzií" : "na hlavice") : item.kind === "blind_motor" ? "na žaluziové spínače" : "na termostat"}, ukončíte ho tlačítkem Hotovo nad
          půdorysem (Esc).
        </p>
      ) : (
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onPair} data-testid="pair-device">
          <Link2 className="size-4" aria-hidden /> 🔗 {controller ? (item.control === "blind" ? "Přiřadit motory žaluzií" : "Přiřadit hlavice") : item.kind === "blind_motor" ? "Přiřadit žaluziový spínač" : "Přiřadit termostat místnosti"}
        </Button>
      )}
      <p className="text-muted-foreground" data-testid="device-links">
        {controller
          ? linked.length
            ? `Ovládá ${pairNoun(item, linked.length)}: ${names}`
            : `Zatím neovládá ${item.control === "blind" ? "žádný motor žaluzie" : "žádnou hlavici"}.`
          : linked.length
            ? `${linked.length === 1 ? "Ovladač" : "Ovladače"}: ${names}`
            : "Zatím bez ovladače."}
      </p>
    </div>
  );
}
