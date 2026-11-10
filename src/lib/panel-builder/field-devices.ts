// Fáze 77: stínící technika, čidla, vytápění a pokročilé osvětlení v 2D půdorysu – kabel LED 24 V, odznaky světla na plánu
// a souhrn potřeby modulů do rozváděče (stmívací kanály, účastníci DALI, kanály PWM a příkon LED 24 V, motory žaluzií,
// hlavice, binární vstupy). Sdílí ho výkaz kabeláže (`buildPlan`), chytrá domácnost (`smartLoadsOf`) i moduly klasické
// instalace. Čisté funkce.

import { ledCableLabel } from "@/engine/cable-routing";
import type { SmartBoardModule } from "@/engine/floorplan-bridge";

import { floorsOf, lightControlOf, lightSpecOf, paletteItem, pwmChannels, type EditorElement, type FloorplanDraft, type LightSpec, type PaletteItem } from "./floorplan-editor";
import { ledSupplies } from "./smart-home";

export { BLIND_DC_CABLE, HEAD_CABLE, SENSOR_CABLE } from "@/engine/cable-routing";
export { lightControlOf, pwmChannels } from "./floorplan-editor";

/** Kabel LED 24 V DC k pásku / svítidlu podle kanálů PWM (RGBW = 5 žil). */
export const ledCable = (spec: LightSpec) => ledCableLabel(pwmChannels(spec) + 1, spec.color ? spec.color.toUpperCase() : spec.cct ? "CCT" : "");

/** Odznaky u značky světla na plánu (DIM / CCT / RGB / RGBW / DALI / 24V). */
export function lightBadges(element: Pick<EditorElement, "light">, item: Pick<PaletteItem, "lightForm"> | null): string[] {
  const spec = lightSpecOf(element);
  const control = lightControlOf(element, item);
  return [
    spec.dimmable || spec.cct || spec.color ? "DIM" : null,
    spec.cct ? "CCT" : null,
    spec.color ? spec.color.toUpperCase() : null,
    control === "dali" ? "DALI" : control === "pwm" ? "24V" : null,
  ].filter((badge): badge is string => badge !== null);
}

/** Souhrn prvků půdorysu pro moduly do rozváděče (všechna podlaží). */
export interface FieldDemand {
  /** Stmívaná svítidla 230 V (fázové stmívání). */
  dimmed: { id: string; room: string; powerW: number }[];
  /** Svítidla DALI (účastníci na bráně / řadiči). */
  dali: { id: string; room: string; powerW: number }[];
  /** Svítidla / pásky 24 V DC PWM s počtem kanálů. */
  pwm: { id: string; room: string; powerW: number; channels: number }[];
  /** Motory žaluzií podle pohonu. */
  motors: { id: string; room: string; drive: "ac230" | "dc24" | "bus" }[];
  /** Termostatické hlavice (kanály akčního členu vytápění); bezdrátové bez kabelu. */
  heads: { id: string; room: string; wireless: boolean }[];
  /** Čidla na binární vstupy. */
  sensors: { id: string; room: string; kind: "window" | "water" }[];
}

export function fieldDemand(draft: FloorplanDraft): FieldDemand {
  const demand: FieldDemand = { dimmed: [], dali: [], pwm: [], motors: [], heads: [], sensors: [] };
  const floors = floorsOf(draft);
  const multi = floors.length > 1;
  for (const floor of floors) {
    for (const element of floor.elements) {
      const item = paletteItem(element.item);
      if (!item) continue;
      const room = multi ? `${element.room} (${floor.name})` : element.room;
      if (item.kind === "light") {
        const spec = lightSpecOf(element);
        const control = lightControlOf(element, item);
        if (control === "pwm") demand.pwm.push({ id: element.id, room, powerW: spec.powerW, channels: pwmChannels(spec) });
        else if (control === "dali") demand.dali.push({ id: element.id, room, powerW: spec.powerW });
        else if (spec.dimmable) demand.dimmed.push({ id: element.id, room, powerW: spec.powerW });
      } else if (item.kind === "blind_motor") demand.motors.push({ id: element.id, room, drive: element.drive ?? "ac230" });
      else if (item.heatingHead) demand.heads.push({ id: element.id, room, wireless: element.headDrive === "wireless" });
      else if (item.sensor) demand.sensors.push({ id: element.id, room, kind: item.sensor });
    }
  }
  return demand;
}

/** Příkon napájecího zdroje 24 V DC pro LED (součet pásků + 20 % rezerva) [W]. */
export const ledSupplyW = (demand: Pick<FieldDemand, "pwm">) => Math.ceil(demand.pwm.reduce((sum, light) => sum + light.powerW, 0) * 1.2);

const GENERIC_MAKER = "Obecný (doplňte výrobce)";
const generic = (role: string, label: string, typeCode: string, modules: number): SmartBoardModule => ({ role, label, manufacturer: GENERIC_MAKER, typeCode, articleNumber: null, modules });
/** Kanálů na obecný řadič LED 24 V PWM a adres DALI na řídicí jednotku. */
export const PWM_CHANNELS_PER_CONTROLLER = 4;
export const DALI_ADDRESSES = 64;

/**
 * Fáze 77: moduly do rozváděče u klasické instalace (bez sběrnice): řídicí jednotka DALI, zdroje 24 V a řadiče PWM pro LED
 * pásky, hlídač zaplavení s výstupem pro havarijní uzávěr vody (ventil do kusovníku). Stmívání 230 V řeší stmívače na stěně,
 * žaluzie žaluziové spínače (okruh B10), hlavice termostat místnosti – bez modulů na DIN liště.
 */
export function classicDeviceModules(demand: FieldDemand): { modules: SmartBoardModule[]; warnings: string[] } {
  const modules: SmartBoardModule[] = [];
  const warnings: string[] = [];
  if (demand.dali.length) {
    for (let index = 0; index < Math.ceil(demand.dali.length / DALI_ADDRESSES); index++) modules.push(generic("dali", "Řídicí jednotka DALI s napájením sběrnice (64 adres), tlačítkové vstupy", "DALI řadič 64", 4));
    warnings.push(`${demand.dali.length}× svítidlo DALI – řídicí jednotka DALI na DIN liště, k svítidlům kabel 5×1,5 (L, N, PE, DA+, DA−); typ jednotky doplňte podle ovládání.`);
  }
  if (demand.pwm.length) {
    const channels = demand.pwm.reduce((sum, light) => sum + light.channels, 0);
    for (const unit of ledSupplies(ledSupplyW(demand))) modules.push({ role: "psu_led", label: unit.label, manufacturer: "MEAN WELL", typeCode: unit.typeCode, articleNumber: unit.articleNumber, modules: unit.modules });
    for (let index = 0; index < Math.ceil(channels / PWM_CHANNELS_PER_CONTROLLER); index++) modules.push(generic("pwm", "Řadič LED 24 V DC PWM, 4 kanály (stmívání / CCT / RGBW), tlačítkové vstupy", "PWM 4× 24 V DC", 2));
    warnings.push(`LED 24 V: ${demand.pwm.length}× pásek / svítidlo, ${channels} ${channels === 1 ? "kanál" : channels <= 4 ? "kanály" : "kanálů"} PWM, zdroj ${ledSupplyW(demand)} W (vč. rezervy 20 %).`);
  }
  const lowVoltageMotors = demand.motors.filter((motor) => motor.drive !== "ac230").length;
  if (lowVoltageMotors) warnings.push(`${lowVoltageMotors}× pohon žaluzie 24 V DC / sběrnicový v klasické instalaci – potřebuje řídicí jednotku pohonů (zvolte sběrnicovou úroveň, nebo doplňte řadič výrobce pohonu).`);
  const windows = demand.sensors.filter((sensor) => sensor.kind === "window").length;
  if (windows) warnings.push(`${windows}× okenní / dveřní kontakt – v klasické instalaci je vyhodnotí ústředna zabezpečení (EZS) nebo řídicí systém; bez nich jen kabel ${"SYKFY 2×2×0,5"} do rozváděče.`);
  if (demand.sensors.some((sensor) => sensor.kind === "water")) {
    modules.push(generic("input", "Hlídač úniku vody (zaplavení) s výstupem pro havarijní uzávěr", "Hlídač zaplavení", 2));
    modules.push(generic("valve", "Elektromagnetický ventil – havarijní uzávěr hlavního přívodu vody (dle DN potrubí)", "Uzávěr vody", 0));
  }
  return { modules, warnings };
}
