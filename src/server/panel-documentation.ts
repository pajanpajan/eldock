import "server-only";

import type { DocumentationData } from "@/components/panel-builder/documentation/DocumentationSheets";
import { formatDate } from "@/lib/format";
import { isMix } from "@/lib/panel-builder/catalog";
import { componentsList, partsList, technicalData } from "@/lib/panel-builder/documentation";
import { MAIN_BOARD } from "@/engine/floorplan-bridge";
import { drawingSymbolOf, renderPanelDrawingSvg, renderSingleLineDiagramSvg, type DrawingItem, type HotspotSink } from "@/lib/panel-builder/drawings";
import { enclosureMpn, enclosureOrderText, enclosureSummary } from "@/lib/panel-builder/enclosure-choice";
import { symbolKindOf, symbolLegend } from "@/lib/panel-builder/iec-symbols";
import { LEGAL_FRAMEWORK, externalInfluencesProtocol, isFlushEnclosure } from "@/lib/panel-builder/external-influences";
import { legalFrameworkFor } from "@/lib/panel-builder/occupancy";
import { analyzeDraft, floorsOf, parseCableReport, parseDraft, switchFloor, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { planScaleFor } from "@/lib/panel-builder/plan-sheet";
import { displayRoutes } from "@/lib/panel-builder/route-display";
import { compileFloorplanBom } from "@/lib/panel-builder/wiring-bom";
import { catalogEan } from "@/server/catalog-data";
import { parseManufacturerInfo } from "@/lib/panel-builder/project";
import { companyManufacturer } from "@/lib/registered-company";
import { isConnected, proposeTree, readingOrder, treeNodeFrom } from "@/lib/panel-builder/tree";
import { supplyOf } from "@/lib/panel-builder/supply";
import { busbarPartsRows, planBusbars } from "@/lib/panel-builder/pe-n-busbars";
import { combParts, combRuns } from "@/lib/panel-builder/comb-busbars";
import { parseRailLayout } from "@/lib/panel-builder/rail-layout";
import { equipmentHref } from "@/lib/routes";
import { parseRoutineTest, standardEditionOf } from "@/lib/legislation-2027";
import { getBlankCovers, getEnclosureComponent, getLinkedBoards, getProjectEnclosure, type PanelProjectDetail } from "@/server/queries/panel-builder";
import { blankCoverFor, blankingPartsRow, blankingPlan, freeModules, usedModules } from "@/lib/panel-builder/hdo";
import { railCapacities } from "@/lib/panel-builder/rails";
import { parseFeederInfo } from "@/server/services/panel-projects";
import { documentationState } from "@/server/services/panel-builder";

// Sestavení 6listového elaborátu rozváděče (krok 5) – sdílí ho dokumentace projektu i veřejná
// ukázka vzorového PB-001 na úvodní stránce (fáze 48).

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const n = (value: number, digits = 2) => value.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export async function buildDocumentationData(project: PanelProjectDetail, origin: string, options: { showcase?: boolean } = {}) {
  const [enclosureRow, picked, covers] = await Promise.all([getEnclosureComponent(project.enclosureModel), getProjectEnclosure(project.enclosureId), getBlankCovers()]);
  const { thermal, docItems, blockers } = documentationState(project);
  // Skříň vybraná z katalogu rozvodnic (fáze 43) má přednost před dohledáním podle názvu modelu
  const enclosure = picked
    ? {
        // Fáze 85: objednací číslo jen z katalogu výrobce – orientační skříň Eldocku (STD-…) = ověřte
        articleNumber: enclosureMpn(picked) ?? "ověřte u výrobce",
        typeCode: picked.model,
        manufacturer: picked.manufacturer,
        description: `Skříň rozváděče ${picked.model}, ${picked.rows}× ${picked.modulesPerRow} M, ${picked.heightMm} × ${picked.widthMm} × ${picked.depthMm} mm, ${picked.ipRating}${enclosureMpn(picked) ? "" : " – orientační typ, objednací číslo ověřte v katalogu výrobce"}`,
        category: "ENCLOSURE" as const,
      }
    : enclosureRow
    ? { articleNumber: enclosureRow.articleNumber, typeCode: enclosureRow.typeCode, manufacturer: enclosureRow.manufacturer, description: enclosureRow.description, category: enclosureRow.category }
    : null;
  const capacities = railCapacities(project);
  const blanking = blankingPartsRow(blankingPlan(freeModules(capacities, usedModules(project.items, capacities.length)), blankCoverFor(picked?.manufacturer ?? enclosure?.manufacturer, covers)));
  const drawingItems: DrawingItem[] = project.items.map((item) => ({
    id: item.id,
    designation: item.designation,
    typeCode: item.customTypeCode ?? item.catalogComponent?.typeCode ?? "?",
    manufacturer: item.catalogComponent?.manufacturer ?? null,
    category: item.catalogComponent?.category ?? null,
    poles: item.catalogComponent?.poles ?? null,
    dinRailIndex: item.dinRailIndex,
    positionOnRail: item.positionOnRail,
    modulesWidth: item.modulesWidth,
    parentItemId: item.parentItemId,
    fedFromIncomer: item.fedFromIncomer,
    phaseAssignment: item.phaseAssignment,
    circuitLabel: item.circuitLabel,
    // Fáze 58: značka dle ČSN EN 60617 podle kategorie a podtypu katalogového prvku
    symbol: symbolKindOf(item.catalogComponent ?? { category: null }),
  }));
  // Fáze 55: veřejná ukázka má vždy úplný strom – nezapojené prvky dostanou navržené zapojení jen pro vykreslení
  // (List 2 spojnice, List 3 jednopólové schéma bez „Nezapojeno ve stromu“); databáze se nemění.
  if (options.showcase) {
    const nodes = project.items.map(treeNodeFrom);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    if (!nodes.every((node) => isConnected(node.id, byId))) {
      const proposal = proposeTree(nodes, null, { supplyPhases: supplyOf(project).phases });
      for (const item of drawingItems) Object.assign(item, proposal.get(item.id));
    }
  }
  const main = project.items.find((item) => item.catalogComponent?.category === "MAIN_SWITCH" && !item.parentItemId)?.catalogComponent ?? null;
  const date = project.releasedAt ?? project.updatedAt;
  const manufacturers = [...new Set(project.items.map((item) => item.catalogComponent?.manufacturer).filter(Boolean))];
  // Fáze 55: vodiče přívodu podle soustavy (1f / 3f, TN-C-S = PEN)
  const supply = supplyOf(project);
  const incomer = supply.conductors;
  const busbars = planBusbars(drawingItems, supply);
  // Fáze 115: propojovací hřebeny (úseky po skupinách chráničů, volba lišty) a koncové krytky do kusovníku
  const combs = combParts(combRuns(drawingItems, drawingItems, parseRailLayout(project.railLayoutJson, capacities.length).combs ?? {}, supply.phases), drawingItems);

  // Fáze 55: kusovník domovní instalace z uloženého nákresu 2D půdorysu (projekt z půdorysu)
  const cableReport = parseCableReport(project.cableReportJson);
  const draft = project.floorplanJson ? parseDraft(safeJson(project.floorplanJson)) : null;
  // Fáze 104: EAN z celých importů ETIM / KOPOS jen na serveru
  const homeBom = draft ? compileFloorplanBom(draft, { installation: draft.installation, cables: cableReport?.byCable ?? [], ean: catalogEan }) : [];
  const edition = standardEditionOf(project.standardEdition);
  const routineTest = parseRoutineTest(project.routineTestJson);
  // Fáze 75: chytré PDF – klikací přístroje ve výkresech, příloha s půdorysem a propojené rozváděče
  const panelHotspots: HotspotSink = { hotspots: [], width: 0, height: 0 };
  const sldHotspots: HotspotSink = { hotspots: [], width: 0, height: 0 };
  const floorplanSheets = draft ? floorplanAnnex(draft, project.boardCode) : undefined;
  const boards = project.boardCode ? await linkedBoardsOf(project, origin) : undefined;
  const data: DocumentationData = {
    // Fáze 111: zkušební projekt (1. testovací projekt / ukázková firma) – zkušební označení listů
    trial: project.license === "TRIAL",
    panelHotspots,
    sldHotspots,
    ...(floorplanSheets?.length ? { floorplanSheets } : {}),
    ...(boards ? { boards } : {}),
    code: project.code,
    name: project.name,
    customerName: project.customerName,
    installationSite: project.installationSite,
    cableReport,
    // Fáze 52: legislativní rámec (vyhl. 131/2024 Sb.) a protokol o určení vnějších vlivů z prostředí instalace
    // Fáze 93: typ objektu (BD4 / zdravotnictví) doplní normy a třídy vnějších vlivů
    legalFramework: legalFrameworkFor(LEGAL_FRAMEWORK, project.occupancy),
    influences: externalInfluencesProtocol(project.environment, project.occupancy),
    fullCover: isFlushEnclosure([project.enclosureModel, enclosure?.description].filter(Boolean).join(" ")),
    norm: edition.short,
    edition,
    routineTest,
    enclosure: [project.enclosureModel, `${project.heightMm} × ${project.widthMm} × ${project.depthMm} mm`, project.ipRating].filter(Boolean).join(" · "),
    // Registrovaná firma = výrobce rozváděče (vždy aktuální „Firemní údaje do razítka“), jinak údaje projektu
    manufacturer: project.company ? companyManufacturer(project.company) : parseManufacturerInfo(project.manufacturerInfoJson),
    date: formatDate(date),
    year: String(date.getFullYear()),
    panelDrawingSvg: renderPanelDrawingSvg(project, drawingItems, project.enclosureModel, { plan: busbars, position: project.incomerFrom === "BOTTOM" ? "BOTTOM" : "TOP" }, panelHotspots),
    singleLineSvg: renderSingleLineDiagramSvg(drawingItems, { incomer, network: project.networkSystem }, sldHotspots),
    symbolLegend: symbolLegend(drawingItems.map(drawingSymbolOf)).map(({ info, svg }) => ({ label: info.label, norm: info.norm, svg })),
    functions: readingOrder(project.items).map((item) => ({ designation: item.designation, label: item.circuitLabel })),
    // Fáze 55: sběrnice PE / N0 / N-FIx a propojka PEN v kusovníku (List 4)
    // Fáze 112: krycí záslepky neobsazených modulů všech lišt (objednací číslo jen z katalogu výrobce skříně)
    // Fáze 115: hřebenové přípojnice ABB PS a koncové krytky PS-END podle úseků hřebenů na lištách
    parts: [...partsList(docItems, enclosure), ...busbarPartsRows(busbars), ...combs.map((part) => ({ articleNumber: part.articleNumber, typeCode: part.typeCode, manufacturer: part.manufacturer, description: part.description, quantity: part.quantity })), ...(blanking ? [blanking] : [])],
    components: componentsList(docItems, enclosure),
    homeBom,
    wiring: project.items.flatMap((item) =>
      item.wiringDevices.map((row) => ({
        designation: item.designation,
        circuit: item.circuitLabel,
        room: row.room,
        quantity: row.quantity,
        articleNumber: row.wiringDevice.articleNumber.replace(/^[A-Z]+:/, ""),
        title: row.wiringDevice.title,
      })),
    ),
    thermal,
    ambientTempC: project.ambientTempC,
    singlePhase: supply.phases === 1,
    technical: technicalData(project, thermal, main?.ratedCurrentA ?? null),
    label: {
      operatingVoltage: project.networkSystem,
      operatingCurrent: `${n(thermal.operatingCurrentA)} A`,
      shortCircuit: `${n(project.shortCircuitKa, 0)} kA`,
      ipRating: project.ipRating,
      mainBreaker: main ? `${n(main.ratedCurrentA, 0)} A` : "–",
      type: enclosure?.typeCode ?? (project.enclosureModel || "–"),
      deviceManufacturer: manufacturers.join(", ") || (isMix(project.dominantManufacturer) ? "Různí výrobci" : project.dominantManufacturer),
    },
    logoUrl: project.company?.logoUrl ?? null,
    stampUrl: project.company?.stampUrl ?? null,
    // Fáze 103: rozváděč se štítkem z registru → karta https://eldock.cz/q/EL-… (aktuální uzamčená verze v cloudu)
    qrUrl: project.qrSerial ? `${origin}/q/${project.qrSerial}` : project.equipmentId ? `${origin}${equipmentHref(project.equipmentId)}` : `${origin}/panel-builder/${project.id}/documentation`,
  };

  if (options.showcase) {
    // Veřejná ukázka: bez nahraných log a razítek (soubory jsou jen pro přihlášené), QR na ukázku
    data.logoUrl = null;
    data.stampUrl = null;
    data.qrUrl = `${origin}/ukazka-elaboratu`;
  }
  // Fáze 85: karta „Zvolená rozvodnice a skříň“ – popis, MPN, objednací údaje a náhled čela s dvířky
  const enclosureCard = picked
    ? {
        summary: enclosureSummary(picked),
        orderText: enclosureOrderText(picked, { code: project.code, name: project.name }),
        doorSvg: renderPanelDrawingSvg(project, drawingItems, project.enclosureModel, { plan: busbars, position: project.incomerFrom === "BOTTOM" ? "BOTTOM" : "TOP" }, undefined, { door: enclosureSummary(picked).door }),
      }
    : null;
  return { data, blockers, edition, routineTest, enclosureCard };
}

/**
 * Fáze 75: příloha dokumentace – půdorys každého podlaží s trasami okruhů tohoto rozváděče (hlavní rozváděč = okruhy
 * RH včetně přívodů podružných rozváděčů a sběrnice, podružný rozváděč = jen jeho okruhy). Chybný nákres přílohu vynechá.
 */
function floorplanAnnex(draft: FloorplanDraft, boardCode: string | null): NonNullable<DocumentationData["floorplanSheets"]> {
  try {
    const analysis = analyzeDraft(draft);
    const board = boardCode ?? MAIN_BOARD;
    return floorsOf(draft)
      .map((floor) => {
        const onFloor = switchFloor(draft, floor.id);
        const routes = displayRoutes(onFloor, analysis);
        return {
          floorId: floor.id,
          floorName: floor.name,
          scale: planScaleFor(onFloor, 190, 175),
          draft: onFloor,
          routes: { circuits: routes.circuits.filter((circuit) => circuit.board === board), bus: board === MAIN_BOARD ? routes.bus : null },
        };
      })
      .filter((sheet) => sheet.routes.circuits.length > 0);
  } catch {
    return [];
  }
}

/**
 * Fáze 103: samostatný dokument vydané verze „Prováděcí 2D půdorys a kabelové trasy“ z uloženého nákresu – všechna
 * podlaží se všemi okruhy (bez filtru rozváděče), kusovník domovní instalace a metry kabelů podle typu. Chybný nákres → null.
 */
export function floorplanDocument(json: string): FloorplanDocument | null {
  const draft = parseDraft(safeJson(json));
  if (!draft) return null;
  try {
    const analysis = analyzeDraft(draft);
    const sheets = floorsOf(draft).map((floor) => {
      const onFloor = switchFloor(draft, floor.id);
      const routes = displayRoutes(onFloor, analysis);
      return { floorId: floor.id, floorName: floor.name, scale: planScaleFor(onFloor, 190, 175), draft: onFloor, routes: { circuits: routes.circuits, bus: routes.bus } };
    });
    const bom = compileFloorplanBom(draft, { installation: draft.installation, cables: analysis.summary.byCable, cableEnds: {}, ean: catalogEan });
    return { sheets, bom, cables: analysis.summary.byCable.map((row) => ({ cable: row.cable, meters: Math.round(row.meters * 10) / 10 })) };
  } catch {
    return null;
  }
}

export interface FloorplanDocument {
  sheets: NonNullable<DocumentationData["floorplanSheets"]>;
  bom: ReturnType<typeof compileFloorplanBom>;
  cables: { cable: string; meters: number }[];
}

/** Fáze 74: propojené rozváděče z jednoho půdorysu pro titulní list (odkazy na jejich dokumentaci). */
async function linkedBoardsOf(project: PanelProjectDetail, origin: string): Promise<DocumentationData["boards"]> {
  const { parent, children } = await getLinkedBoards(project);
  const feeder = parseFeederInfo(project.feederJson);
  return {
    code: project.boardCode ?? MAIN_BOARD,
    parent: parent ? { code: parent.boardCode ?? MAIN_BOARD, projectCode: parent.code, url: `${origin}/panel-builder/${parent.id}/documentation`, feeder } : null,
    children: children.map((child) => ({ code: child.boardCode ?? "RP", projectCode: child.code, name: child.name, url: `${origin}/panel-builder/${child.id}/documentation`, feeder: parseFeederInfo(child.feederJson) })),
  };
}
