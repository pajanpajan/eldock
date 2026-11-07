// Fáze 61: zátěže chytré domácnosti z 2D půdorysu (všechna podlaží) → výpočet akčních členů (`planSmartHome`).
// Světlo = jeden výstup akčního členu (hvězda z rozváděče): stmívané → stmívací kanál, DALI → DALI brána, jinak
// spínací; žaluziové tlačítko = jeden žaluziový kanál; místnost s prostorovou jednotkou / termostatem = topná zóna.

import { floorsOf, lightSpecOf, paletteItem, type FloorplanDraft } from "./floorplan-editor";
import { lightRole, planSmartHome, smartSystemOf, type SmartLoad, type SmartPlan, type SmartSystemId } from "./smart-home";

export function smartLoadsOf(draft: FloorplanDraft): { loads: SmartLoad[]; busDevices: number } {
  const floors = floorsOf(draft);
  const multi = floors.length > 1;
  const loads: SmartLoad[] = [];
  let busDevices = 0;
  for (const floor of floors) {
    const heated = new Set<string>();
    for (const element of floor.elements) {
      const item = paletteItem(element.item);
      if (!item) continue;
      const room = multi ? `${element.room} (${floor.name})` : element.room;
      if (item.bus) busDevices += 1;
      if (item.kind === "light") {
        const spec = lightSpecOf(element);
        loads.push({ id: element.id, room, role: lightRole(spec), powerW: spec.powerW, load: spec.load, label: item.label });
      } else if (item.kind === "switch" && item.control === "blind") {
        loads.push({ id: element.id, room, role: "blind", powerW: 0, label: "Žaluzie / roleta" });
      } else if (item.kind === "switch" && item.control === "thermostat" && !heated.has(element.room)) {
        heated.add(element.room);
        loads.push({ id: element.id, room, role: "heating", powerW: 0, label: "Topná zóna (termoelektrické hlavice)" });
      }
    }
  }
  return { loads, busDevices };
}

/** Výpočet chytré domácnosti nad nákresem (jen sběrnicová úroveň instalace; jinak null). */
export function smartPlanOf(draft: FloorplanDraft): SmartPlan | null {
  if (draft.installation !== "bus_loxone") return null;
  const { loads, busDevices } = smartLoadsOf(draft);
  // Fáze 65: ručně přidané moduly na DIN lištu nad výpočet
  return planSmartHome({ system: smartSystemOf(draft.smartSystem as SmartSystemId).id, loads, busDevices, extras: draft.smartExtras });
}
