import { describe, expect, it } from "vitest";

import { buildSwitchboardFromCircuits, type SmartBoardModule } from "@/engine/floorplan-bridge";

import { ABB_2026_COMPONENTS } from "../../../prisma/seed-abb-2026";
import { readCatalog } from "../../../scripts/smart-device-specs";
import { DEVICE_BRANDS } from "./brands";
import { configFields, configFromComponent, defaultConfig, matchConfig, withManufacturer, type CatalogLike } from "./configurator";
import { emptyDraft, parseDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { PRODUCT_FAMILIES, productById, productsOfTab } from "./smart-catalog";
import { isCatalogModule, smartCatalogArticle, smartDinComponents, smartDinProfile } from "./smart-din-catalog";
import { SMART_SYSTEMS, planSmartHome } from "./smart-home";
import { panelBomRows, withVariant } from "./smart-panels";
import { compileFloorplanBom } from "./wiring-bom";

const el = (id: string, item: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x: 1000, y: 1000, room: "Obývák", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const catalog = readCatalog();
const inCatalog = (manufacturer: string, mpn: string) => catalog.find((entry) => entry.manufacturer === manufacturer && entry.mpn === mpn) ?? null;

describe("fáze 81 – dotykové panely a displejové ovladače chytré domácnosti", () => {
  it("ABB-free@home: IP TOUCH 7\" / 10\", SmartTouch 10\", OneTouch 7\", RoomTouch 4\" a Trevion 2,4\" v obou záložkách s barvami a ověřenými čísly", () => {
    const fah = PRODUCT_FAMILIES.find((family) => family.id === "abb-fah")!;
    const panels = productsOfTab(fah, "panels").map((product) => product.id);
    const controls = productsOfTab(fah, "controls").map((product) => product.id);
    expect(panels).toEqual(expect.arrayContaining(["fah-ip-touch-10", "fah-ip-touch-7", "fah-smarttouch-10", "fah-onetouch-7"]));
    expect(controls).toEqual(expect.arrayContaining(["fah-roomtouch-4", "fah-trevion"]));
    const ipTouch = productById("fah-ip-touch-10")!;
    expect(ipTouch.variants?.map((variant) => variant.label)).toEqual(["Bílá", "Černá", "Stříbrná", "Zlatá"]);
    expect(productById("fah-ip-touch-7")!.variants).toHaveLength(4);
    expect(productById("fah-smarttouch-10")!.variants?.map((variant) => variant.mpn)).toEqual(["2TMA310051W0001", "2TMA310051B0001"]);
    expect(productById("fah-onetouch-7")!.variants?.map((variant) => variant.typeCode)).toEqual(["M2249-2W", "M2249-2B"]);
    expect(productById("fah-roomtouch-4")!.variants?.map((variant) => variant.mpn)).toEqual(["2TMA310011B0003", "2TMA310011W0001"]);
    // Každé uvedené objednací číslo (panel, krabice, mezirámeček) je v katalogu výrobců; bez záznamu = null (ověřte)
    const abb = PRODUCT_FAMILIES.flatMap((family) => family.groups.flatMap((group) => group.products)).filter((product) => product.panel && product.catalog?.manufacturer === "ABB");
    for (const product of abb) {
      for (const variant of product.variants ?? []) for (const mpn of [variant.mpn, variant.mpn63]) if (mpn) expect(inCatalog("ABB", mpn), `${product.id} ${mpn}`).not.toBeNull();
      for (const box of product.boxes ?? []) for (const mpn of Object.values(box.mpn)) expect(inCatalog("ABB", mpn), `${product.id} ${mpn}`).not.toBeNull();
      for (const adapter of product.adapters ?? []) for (const mpn of Object.values(adapter.mpn)) expect(inCatalog("ABB", mpn)?.name_cs, mpn).toContain("ZONI");
    }
    // Čísla ze zadání, která katalog vede jako jiné výrobky, se nepoužijí (2CKA006136A0212 = krabice, 0875 = ovládač Tenton)
    expect(inCatalog("ABB", "2CKA006136A0212")?.name_cs).toContain("Krabice");
    expect(abb.flatMap((product) => product.variants ?? []).map((variant) => variant.mpn)).not.toContain("2CKA006220A0875");
    // Stříbrná / zlatá IP TOUCH v katalogu nejsou → bez čísla, technický list bez údajů jiné barvy
    const silver = withVariant(ipTouch, "silver");
    expect(silver.articleNumber).toBeNull();
    expect(silver.catalog).toBeUndefined();
    expect(withVariant(ipTouch, "black")).toMatchObject({ articleNumber: "2TMA130050B0054", typeCode: "H8237-4B", catalog: { mpn: "2TMA130050B0054" } });
  });

  it("Loxone Wall Display 10\" a Touch Pure Display, TapHome Ovladač s displejem ve 3 variantách × 4 barvách", () => {
    const wall = productById("lox-wall-display-10")!;
    expect(wall).toMatchObject({ panel: "wall-display", tab: "panels", catalog: { manufacturer: "LOXONE", mpn: "100891" } });
    expect(inCatalog("LOXONE", "100891")?.type_designation).toBe('Wall Display 10"');
    expect(wall.variants?.map((variant) => variant.label)).toEqual(["Antracit", "Bílá"]);
    expect(productById("lox-touch-pure-display")).toMatchObject({ panel: "pure-display", wiring: "tree" });
    const tap = ["tap-display-multi", "tap-display-single", "tap-display-thermo"].map((id) => productById(id)!);
    expect(tap.map((product) => product.keys)).toEqual([["∧", "≡", "∨"], ["∧", "∨"], ["+", "−"]]);
    expect(tap[0].favorite).toBe(true);
    for (const product of tap) expect(product.variants?.map((variant) => variant.label)).toEqual(["Bílá", "Antracit", "Černá", "Béžová"]);
    expect(tap[2].item).toBe("bus-room");
  });

  it("kusovník: panel v barvě varianty, krabice panelu místo přístrojové, mezirámeček Zoni a Trevion 63 × 63 v řadě future linear", () => {
    const draft = (elements: EditorElement[], series = "ABB|Zoni"): FloorplanDraft => ({ ...emptyDraft(), installation: "bus_loxone", smartSystem: "abb_freeathome", series, elements });
    const rows = compileFloorplanBom(draft([el("p1", "bus-display", { product: "fah-ip-touch-10", productVariant: "black" })]));
    expect(rows.find((row) => row.mpn === "2TMA130050B0054")).toMatchObject({ category: "Sběrnicové prvky", quantity: 1, verified: true });
    expect(rows.find((row) => row.mpn === "2TMA130160B0132")).toMatchObject({ category: "Instalační krabice", quantity: 1 });
    // Panel má vlastní krabici – přístrojová krabice KOPOS se za něj nepočítá
    expect(rows.find((row) => row.mpn === "KPR 68")).toBeUndefined();
    // Povrchová krabice SmartTouch v barvě panelu
    const surface = compileFloorplanBom(draft([el("p2", "bus-display", { product: "fah-smarttouch-10", productVariant: "white", productBox: "surface" })]));
    expect(surface.map((row) => row.mpn)).toEqual(expect.arrayContaining(["2TMA310051W0001", "2TMA310161W0001"]));
    // Trevion v řadě Zoni: displej + mezirámeček 55 × 55 + rámeček řady
    const trevion = compileFloorplanBom(draft([el("t1", "bus-room", { product: "fah-trevion", productVariant: "black" })]));
    expect(trevion.map((row) => row.mpn)).toEqual(expect.arrayContaining(["2TMA310011B0001", "2CHT010011B4509"]));
    expect(trevion.some((row) => row.category === "Rámečky" && /Rámeček 1násobný/.test(row.name))).toBe(true);
    expect(panelBomRows(productById("fah-trevion")!, { variant: "black", seriesName: "future linear" })[0].mpn).toBe("2TMA310011B0002");
    // Volba varianty a krabice přežije uložení; neplatná se zahodí
    const saved = parseDraft(JSON.parse(JSON.stringify(draft([el("p3", "bus-display", { product: "fah-ip-touch-7", productVariant: "gold", productBox: "surface" }), el("p4", "bus-display", { product: "fah-ip-touch-7", productVariant: "red" as string })]))))!;
    expect(saved.elements.map((element) => [element.productVariant, element.productBox])).toEqual([["gold", "surface"], [undefined, undefined]]);
  });
});

describe("fáze 81 – akční členy na DIN lištu jako kusy katalogu prvků", () => {
  it("každý modul z půdorysu (DIN lišta) má řádek seedu se stejnou kategorií, šířkou a Pv; Loxone s předponou, TapHome s klíčem typu", () => {
    const seed = new Map(ABB_2026_COMPONENTS.map((row) => [row.articleNumber, row]));
    for (const system of SMART_SYSTEMS) {
      for (const unit of system.modules.filter(isCatalogModule)) {
        const row = seed.get(smartCatalogArticle(system.id, unit));
        expect(row, `${system.id}/${unit.id}`).toBeDefined();
        expect(row!.modulesCount, unit.id).toBe(unit.modules);
        expect(row!.category, unit.id).toBe(unit.role === "psu" ? "PSU" : "PLC");
        if (unit.lossW !== undefined && unit.lossW !== null) expect(row!.powerLossWatts, unit.id).toBe(unit.lossW);
        expect(row!.ownCatalog, unit.id).toBe(true);
      }
    }
    expect(seed.get("LOXONE:100335")).toMatchObject({ typeCode: "Miniserver", modulesCount: 9, powerLossWatts: 6.7, lossEstimated: false });
    expect(seed.get("LOXONE:100512")).toMatchObject({ typeCode: "Miniserver Compact", modulesCount: 6 });
    expect(seed.get("TAPHOME:6DO")).toMatchObject({ manufacturer: "TapHome", modulesCount: 6, powerLossWatts: 4.5, lossEstimated: true });
    expect(seed.get("2CKA006200A0871")).toMatchObject({ modulesCount: 6, category: "PLC" });
    // Ruční řádky Katalogu ABB 2026 zůstávají (popis, zdroj), Pv a datasheet z rešerše výrobce
    // Fáze 115: Pv a datasheet z produktové stránky ABB (new.abb.com)
    expect(seed.get("2CDG510025R0011")).toMatchObject({ powerLossWatts: 4, lossEstimated: false, datasheetUrl: "https://new.abb.com/products/2CDG510025R0011" });
    expect(seed.get("2CDG510026R0011")).toMatchObject({ powerLossWatts: 8, lossEstimated: false });
    expect(seed.get("2CDG510028R0011")!.powerLossWatts).toBe(1.5);
  });

  it("šířka a Pv ověřených kusů odpovídají katalogu výrobců (Loxone p_loss_w, šířky ABB)", () => {
    for (const row of smartDinComponents()) {
      const [maker, mpn] = row.articleNumber.includes(":") ? row.articleNumber.split(":") : ["ABB", row.articleNumber];
      const entry = inCatalog(maker, mpn);
      if (!entry) continue;
      if (entry.width_modules && !row.typeCode.includes("SAP")) expect(row.modulesCount, row.typeCode).toBe(entry.width_modules);
      if (entry.p_loss_w && !row.lossEstimated) expect(row.powerLossWatts, row.typeCode).toBe(entry.p_loss_w);
    }
    // Zadání uvádí jiná čísla – platí katalog výrobců
    expect(inCatalog("LOXONE", "100512")?.type_designation).toBe("Miniserver Compact");
    expect(inCatalog("LOXONE", "100283")?.type_designation).toBe("DI Extension");
    expect(inCatalog("ABB", "2CDG510028R0011")?.type_designation).toBe("BA-M-4.230.1.1");
  });

  it("profil kusu pro kaskádu a symbol: funkce, kanály a barevný štítek (i řádky importu katalogu výrobců)", () => {
    expect(smartDinProfile({ manufacturer: "ABB", typeCode: "SA-M-8.16.2.2", articleNumber: "2CDG510026R0011" })).toMatchObject({ system: "abb_freeathome", role: "switch", channels: 8, label: "SPÍNACÍ 8×16A" });
    expect(smartDinProfile({ manufacturer: "ABB", typeCode: "JRA/S 4.230.2.1" })).toMatchObject({ system: "abb_knx", role: "blind", label: "ŽALUZIOVÝ 4×" });
    expect(smartDinProfile({ manufacturer: "ABB", typeCode: "SA/S4.16.2.2" })?.label).toBe("SPÍNACÍ 4×16A");
    expect(smartDinProfile({ manufacturer: "ABB", typeCode: "DA/M.4.210.2.1" })?.label).toBe("STMÍVACÍ 4×");
    expect(smartDinProfile({ manufacturer: "ABB", typeCode: "HA-M-0.6.1" })?.label).toBe("TOPENÍ 6×");
    expect(smartDinProfile({ manufacturer: "ABB", typeCode: "DG-M-1.16.1" })?.label).toBe("DALI");
    expect(smartDinProfile({ manufacturer: "ABB", typeCode: "SA-M-0.4.1" })).toMatchObject({ role: "switch", channels: 4 });
    expect(smartDinProfile({ manufacturer: "ABB", typeCode: "SA-M-8.8.1", ratedCurrentA: 6 })?.label).toBe("SPÍNACÍ 8×6A");
    expect(smartDinProfile({ manufacturer: "Loxone", typeCode: "Relay Extension", articleNumber: "LOXONE:100038" })).toMatchObject({ role: "switch", channels: 14 });
    expect(smartDinProfile({ manufacturer: "TapHome", typeCode: "6DO", articleNumber: "TAPHOME:6DO" })).toMatchObject({ system: "taphome", role: "switch", channels: 6 });
    expect(smartDinProfile({ manufacturer: "ABB", typeCode: "S201-B16" })).toBeNull();
    expect(smartDinProfile({ manufacturer: "Eaton", typeCode: "Relay Extension" })).toBeNull();
  });

  it("kaskáda Kroku 1: kategorie Chytrá domácnost s filtrem řady u ABB a přesným kusem podle funkce a kanálů", () => {
    const rows: CatalogLike[] = smartDinComponents().map((row, index) => ({
      id: `c${index}`,
      manufacturer: row.manufacturer,
      typeCode: row.typeCode,
      articleNumber: row.articleNumber,
      category: row.category,
      poles: row.poles,
      ratedCurrentA: row.ratedCurrentA,
      trippingCurve: null,
      breakingCapacityKa: null,
      rcdType: null,
      rcdSensitivityMa: null,
      spdType: null,
      surgeCurrentKa: null,
      contactConfig: null,
      coilVoltage: null,
      relaySubtype: null,
      moduleSubtype: row.moduleSubtype,
      modulesCount: row.modulesCount,
    }));
    const abb = defaultConfig("SMART_HOME", { manufacturer: "ABB", modules: 4 });
    expect(configFields(abb)[0].options.map((option) => option.label)).toEqual(["Vše", "ABB-free@home® (SA-M, BA-M, DA/M, HA-M, SysAP)", "ABB i-bus® KNX (SA/S, JRA/S, UD/S, SV/S)"]);
    expect(configFields({ ...abb, manufacturer: "Loxone" }).map((field) => field.key)).toEqual(["smartRole", "channels"]);
    const pick = (patch: Partial<typeof abb>) => matchConfig(rows, { ...abb, ...patch })?.typeCode ?? null;
    expect(pick({ smartSystem: "abb_freeathome", smartRole: "switch", channels: 8 })).toBe("SA-M-8.16.2.2");
    expect(pick({ smartSystem: "abb_knx", smartRole: "switch", channels: 8 })).toBe("SA/S 8.16.2.2");
    expect(pick({ smartSystem: "abb_knx", smartRole: "blind", channels: 4 })).toBe("JRA/S 4.230.5.1");
    // Řádek importu katalogu výrobců se stejnými parametry má nižší pořadí než kus výpočtu
    rows.push({ ...rows.find((row) => row.typeCode === "JRA/S 8.230.5.1")!, id: "external", typeCode: "JRA/S 8.230.1.1", articleNumber: "2CDG110131R0011" });
    expect(pick({ smartSystem: "abb_knx", smartRole: "blind", channels: 8, modules: 8 })).toBe("JRA/S 8.230.5.1");
    expect(pick({ smartSystem: "abb_freeathome", smartRole: "psu" })).toBe("PS-M-64.1.1");
    expect(pick({ manufacturer: "Loxone", smartRole: "system", modules: 9 })).toBe("Miniserver");
    expect(pick({ manufacturer: "TapHome", smartRole: "dim" })).toBe("Dimmer 4CH");
    // Po změně výrobce ABB → Loxone se systém KNX zahodí (jinak by kaskáda nenašla Miniserver – zachytil E2E)
    expect(pick({ manufacturer: "Loxone", smartSystem: "abb_knx", smartRole: "system", modules: 9 })).toBe("Miniserver");
    expect(withManufacturer({ ...abb, smartSystem: "abb_knx" }, "Loxone").smartSystem).toBeNull();
    expect(withManufacturer({ ...abb, smartSystem: "abb_knx" }, "ABB").smartSystem).toBe("abb_knx");
    // Kus z katalogu → konfigurace kategorie Chytrá domácnost (funkce, systém, kanály)
    expect(configFromComponent(rows.find((row) => row.typeCode === "BA-M-8.230.1.1")!)).toMatchObject({ category: "SMART_HOME", smartRole: "blind", smartSystem: "abb_freeathome", channels: 8, modules: 8 });
    expect(DEVICE_BRANDS.map((brand) => brand.value)).toContain("TapHome");
  });

  it("výpočet: alternativy jen ručně, SysAP na DIN liště nahradí nástěnný, TapHome už má akční členy", () => {
    const loads = [
      { id: "l1", room: "Obývák", role: "switch" as const, powerW: 60, label: "Světlo" },
      { id: "b1", room: "Obývák", role: "blind" as const, powerW: 0, label: "Žaluzie" },
    ];
    const knx = planSmartHome({ system: "abb_knx", loads, busDevices: 4 });
    expect(knx.modules.map((unit) => unit.typeCode)).not.toContain("JRA/S 4.230.2.1");
    const sysap = planSmartHome({ system: "abb_freeathome", loads, busDevices: 4, extras: { "fah-sap-din": 1 } });
    expect(sysap.modules.filter((unit) => unit.role === "system").map((unit) => [unit.id, unit.modules, unit.manual])).toEqual([["fah-sap-din", 6, true]]);
    const tap = planSmartHome({ system: "taphome", loads: [...loads, { id: "d1", room: "Obývák", role: "dim", powerW: 40, label: "Stmívané světlo" }], busDevices: 3 });
    expect(tap.warnings.filter((warning) => warning.includes("nemá v databázi"))).toEqual([]);
    expect(tap.modules.map((unit) => unit.typeCode)).toEqual(expect.arrayContaining(["Core", "6DO", "4DO", "Dimmer 4CH", "PSU 24 V DC / 60 W"]));
  });

  it("rozváděč: akční členy chytré domácnosti na vyhrazené liště s Pv modulu a klíčem katalogu", () => {
    const circuit = (id: string) => ({ id, label: `Zásuvky ${id}`, kind: "sockets", phases: 1, designW: 2000, rcd: "group", protection: { device: "MCB", poles: "1P", ratedA: 16, curve: "B" } });
    const plan = { circuits: [circuit("c1"), circuit("c2"), circuit("c3")], io: { di: 0, do: 0, impulseRelays: 0, treeDevices: 0 }, bom: [] } as unknown as Parameters<typeof buildSwitchboardFromCircuits>[0];
    const smart: SmartBoardModule[] = [
      { role: "system", label: "Miniserver", manufacturer: "Loxone", series: "Loxone", typeCode: "Miniserver", articleNumber: "100335", modules: 9, catalogArticle: "LOXONE:100335", powerLossW: 6.7, lossVerified: true },
      { role: "switch", label: "Relay Extension", manufacturer: "Loxone", series: "Loxone", typeCode: "Relay Extension", articleNumber: "100038", modules: 9, catalogArticle: "LOXONE:100038", powerLossW: 11, lossVerified: true },
    ];
    const board = buildSwitchboardFromCircuits(plan, { mode: "bus_loxone", enclosures: [], railModules: 24, smart });
    const mini = board.devices.find((device) => device.article?.typeCode === "Miniserver")!;
    expect(mini.article).toMatchObject({ catalogArticle: "LOXONE:100335", lossVerified: true });
    expect(mini.powerLossW).toBe(6.7);
    // Vyhrazená lišta: řídicí jistič a moduly začínají na nové liště (předchozí lišta má jen jističe a chrániče)
    const smartRail = board.rails.find((rail) => rail.devices.includes(mini))!;
    expect(smartRail.devices[0].label).toBe("Ovládání a řídicí obvody");
    expect(board.rails.filter((rail) => rail.index < smartRail.index).flatMap((rail) => rail.devices).some((device) => device.article)).toBe(false);
  });
});
