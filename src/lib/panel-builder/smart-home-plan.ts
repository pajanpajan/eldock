// Fáze 61: zátěže chytré domácnosti z 2D půdorysu (všechna podlaží) → výpočet akčních členů (`planSmartHome`).
// Světlo = jeden výstup akčního členu (hvězda z rozváděče): stmívané → stmívací kanál, DALI → DALI brána, jinak
// spínací; žaluziové tlačítko = jeden žaluziový kanál; místnost s prostorovou jednotkou / termostatem = topná zóna.
// Fáze 77: LED 24 V PWM = kanály řadiče podle barvy (1 / 2 / 3 / 4 / 5), zakreslené motory žaluzií a hlavice = kanál
// na každý kus (místo odhadu podle tlačítek / termostatů), čidla oken a vody = binární vstupy, čidlo vody = navíc
// spínací výstup pro havarijní uzávěr vody.

import { floorsOf, lightControlOf, lightSpecOf, paletteItem, pwmChannels, type FloorplanDraft } from "./floorplan-editor";
import { lightRole, planSmartHome, smartSystemOf, type SmartLoad, type SmartPlan, type SmartSystemId } from "./smart-home";

export function smartLoadsOf(draft: FloorplanDraft): { loads: SmartLoad[]; busDevices: number } {
  const floors = floorsOf(draft);
  const multi = floors.length > 1;
  const loads: SmartLoad[] = [];
  let busDevices = 0;
  const all = floors.flatMap((floor) => floor.elements);
  const motorsDrawn = all.some((element) => paletteItem(element.item)?.kind === "blind_motor");
  const headsDrawn = all.some((element) => paletteItem(element.item)?.heatingHead);
  let water = false;
  for (const floor of floors) {
    const heated = new Set<string>();
    for (const element of floor.elements) {
      const item = paletteItem(element.item);
      if (!item) continue;
      const room = multi ? `${element.room} (${floor.name})` : element.room;
      if (item.bus) busDevices += 1;
      if (item.kind === "light") {
        const spec = lightSpecOf(element);
        const control = lightControlOf(element, item);
        if (control === "pwm") loads.push({ id: element.id, room, role: "pwm", powerW: spec.powerW, label: item.label, channels: pwmChannels(spec) });
        else loads.push({ id: element.id, room, role: control === "dali" ? "dali" : lightRole(spec), powerW: spec.powerW, load: spec.load, label: item.label });
      } else if (item.kind === "blind_motor") {
        loads.push({ id: element.id, room, role: "blind", powerW: 0, label: "Motor žaluzie / rolety" });
      } else if (item.heatingHead) {
        if (element.headDrive !== "wireless") loads.push({ id: element.id, room, role: "heating", powerW: 0, label: "Termostatická hlavice / servopohon" });
      } else if (item.sensor) {
        loads.push({ id: element.id, room, role: "input", powerW: 0, label: item.sensor === "water" ? "Čidlo úniku vody" : "Okenní / dveřní kontakt" });
        if (item.sensor === "water") water = true;
      } else if (item.kind === "switch" && item.control === "blind" && !motorsDrawn) {
        loads.push({ id: element.id, room, role: "blind", powerW: 0, label: "Žaluzie / roleta" });
      } else if (item.kind === "switch" && item.control === "thermostat" && !headsDrawn && !heated.has(element.room)) {
        heated.add(element.room);
        loads.push({ id: element.id, room, role: "heating", powerW: 0, label: "Topná zóna (termoelektrické hlavice)" });
      }
    }
  }
  // Fáze 77: čidlo úniku vody → spínací výstup pro havarijní elektromagnetický uzávěr hlavního přívodu vody
  if (water) loads.push({ id: "valve-water", room: "Technika", role: "switch", powerW: 10, label: "Havarijní uzávěr vody (elektromagnetický ventil)" });
  return { loads, busDevices };
}

/** Výpočet chytré domácnosti nad nákresem (jen sběrnicová úroveň instalace; jinak null). */
export function smartPlanOf(draft: FloorplanDraft): SmartPlan | null {
  if (draft.installation !== "bus_loxone") return null;
  const { loads, busDevices } = smartLoadsOf(draft);
  // Fáze 65: ručně přidané moduly na DIN lištu nad výpočet
  return planSmartHome({ system: smartSystemOf(draft.smartSystem as SmartSystemId).id, loads, busDevices, extras: draft.smartExtras });
}
