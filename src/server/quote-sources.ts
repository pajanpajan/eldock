import "server-only";

import type { QuoteSource } from "@/components/quoting/QuoteWizardModal";
import { analyzeDraft, parseDraft } from "@/lib/panel-builder/floorplan-editor";
import { compileFloorplanBom } from "@/lib/panel-builder/wiring-bom";
import { EMPTY_WORK, type QuoteMaterial, type QuoteWork } from "@/lib/quoting/quote-engine";
import { bomMaterials, floorplanQuoteWork, orderLinesOf } from "@/lib/quoting/quote-sources";
import { catalogEan } from "@/server/catalog-data";
import { listPrices } from "@/server/quote-data";
import type { PanelProjectDetail } from "@/server/queries/panel-builder";

// Fáze 105: podklady cenové nabídky v kroku 4 AI Panel Builderu – přístroje rozváděče z katalogu (ceníková cena kusu,
// pokud ji data výrobce mají), skříň a u rozváděče vygenerovaného z 2D půdorysu i domovní instalace (kusovník a výkaz
// kabeláže uložený u projektu). Ceny se dohledají tady na serveru (stránka je jen pro přihlášenou firmu).

const MULTI_POLE = /2P|3P|4P/;

export async function projectQuoteSource(project: PanelProjectDetail): Promise<QuoteSource> {
  const groups = new Map<string, QuoteMaterial>();
  let din1p = 0;
  let din3p = 0;
  let dinSmart = 0;
  let circuits = 0;
  for (const item of project.items) {
    const component = item.catalogComponent;
    const category = component?.category ?? "OTHER";
    if (category === "PLC" || category === "PSU") dinSmart += 1;
    else if (category === "TERMINAL" || category === "ENCLOSURE") {
      // svorky a skříň nejsou modulové přístroje k prodrátování
    } else if (MULTI_POLE.test(component?.poles ?? "") || ["RCD", "RCBO", "SPD", "MAIN_SWITCH"].includes(category)) din3p += 1;
    else din1p += 1;
    if (category === "MCB" || category === "RCBO") circuits += 1;
    const key = component?.articleNumber ?? item.customTypeCode ?? item.designation;
    const own = groups.get(key);
    if (own) {
      own.quantity += 1;
      continue;
    }
    groups.set(key, {
      key: `sb:${key}`,
      name: component ? `${component.manufacturer} ${component.typeCode} – ${component.description}`.slice(0, 160) : `${item.customTypeCode ?? item.designation}`,
      code: component?.articleNumber ?? null,
      quantity: 1,
      unit: "ks",
      section: "switchboard",
      listPriceCzk: component?.listPriceCzk ?? null,
      priceSource: component?.listPriceSource ?? null,
      priceKind: "device",
      ean: component?.ean ?? null,
      manufacturer: component?.manufacturer ?? null,
    });
  }
  const materials: QuoteMaterial[] = [...groups.values()];
  const enclosure = project.enclosure;
  if (enclosure || project.enclosureModel) {
    materials.unshift({ key: "sb:enclosure", name: enclosure ? `Skříň rozváděče ${enclosure.manufacturer} ${enclosure.model}` : `Skříň rozváděče ${project.enclosureModel}`, code: enclosure?.articleNumber ?? null, quantity: 1, unit: "ks", section: "switchboard", listPriceCzk: null, priceKind: "device", manufacturer: enclosure?.manufacturer ?? null });
  }
  const modules = enclosure ? enclosure.rows * enclosure.modulesPerRow : Math.max(12, Math.ceil((din1p + din3p * 2 + dinSmart * 4) * 1.2));
  let work: QuoteWork = { ...EMPTY_WORK, din1p, din3p, dinSmart, enclosureModules: [modules], circuits };

  // Rozváděč z 2D půdorysu: domovní instalace (kusovník, kabeláž, krabice) do kompletní zakázky
  const draft = project.floorplanJson ? parseDraft(project.floorplanJson) : null;
  if (draft) {
    const analysis = analyzeDraft(draft);
    const bom = compileFloorplanBom(draft, { installation: draft.installation, cables: analysis.summary.byCable, cableEnds: {}, ean: catalogEan });
    const floor = bomMaterials(bom);
    const prices = await listPrices(floor.map((item) => ({ key: item.key, kind: item.priceKind ?? "device", code: item.code ?? null, name: item.name })));
    for (const item of floor) {
      const price = prices[item.key];
      materials.push(price ? { ...item, listPriceCzk: price.priceCzk, priceSource: price.source } : item);
    }
    const elements = [...draft.elements, ...draft.otherFloors.flatMap((other) => other.elements)];
    const floorWork = floorplanQuoteWork({ elements, bom, byCable: analysis.summary.byCable, circuits: analysis.circuits.circuits });
    // Práce na rozváděči podle skutečných přístrojů projektu, domovní instalace podle půdorysu
    work = { ...floorWork, din1p, din3p, dinSmart, enclosureModules: [modules], circuits: Math.max(circuits, floorWork.circuits) };
  }
  // Ceny přístrojů rozváděče bez ceny v katalogu – ceníky z balíčků (ETIM data)
  const missing = materials.filter((item) => item.section === "switchboard" && item.listPriceCzk === null && item.code);
  if (missing.length) {
    const prices = await listPrices(missing.map((item) => ({ key: item.key, kind: "device" as const, code: item.code ?? null, name: item.name })));
    for (const [index, item] of materials.entries()) if (prices[item.key] && item.listPriceCzk === null) materials[index] = { ...item, listPriceCzk: prices[item.key].priceCzk, priceSource: prices[item.key].source };
  }
  return {
    title: `Rozváděč ${project.code}${project.name ? ` – ${project.name}` : ""}`,
    materials,
    work,
    defaultScope: draft ? "complete" : "switchboard",
    orderLines: orderLinesOf(materials),
    pricesKnown: true,
  };
}
