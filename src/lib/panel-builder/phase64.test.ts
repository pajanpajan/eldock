import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { builtinAppliance } from "./appliances";
import { COALESCE_MS, HISTORY_LIMIT, TIMED_GROUP, canRedo, canUndo, initHistory, recordChange, redo, undo, type History } from "./draft-history";
import { addFloor, emptyDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { LEGACY_DRAFT_KEY, backupKey, bootDraft, clearBackup, defaultFloorplanName, hasContent, readBackup, readLegacyDraft, writeBackup } from "./floorplan-storage";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Kuchyně", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const withElements = (...elements: EditorElement[]): FloorplanDraft => ({ ...emptyDraft(), elements });

/** Paměťové localStorage pro testy zálohy v prohlížeči. */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("fáze 64 – Zpět / Znovu: historie úprav nákresu", () => {
  const step = (state: History<string>, next: string, group: string, now = 0) => recordChange(state, next, { group, now });

  it("každá samostatná úprava je krok; Zpět a Znovu vracejí stavy v pořadí", () => {
    let state = initHistory("a");
    state = step(state, "b", "c1");
    state = step(state, "c", "c2");
    expect(state.past).toEqual(["a", "b"]);
    expect(canUndo(state)).toBe(true);
    expect(canRedo(state)).toBe(false);
    state = undo(state);
    expect(state.present).toBe("b");
    state = undo(state);
    expect(state.present).toBe("a");
    expect(canUndo(state)).toBe(false);
    expect(undo(state)).toBe(state);
    state = redo(state);
    expect(state.present).toBe("b");
    expect(state.future).toEqual(["c"]);
    state = redo(state);
    expect(state.present).toBe("c");
    expect(redo(state)).toBe(state);
  });

  it("celé tažení (jedno gesto ukazatele) je jeden krok – Zpět vrátí stav před tažením", () => {
    let state = initHistory("start");
    for (let index = 1; index <= 40; index++) state = step(state, `posun ${index}`, "g7", index * 16);
    expect(state.present).toBe("posun 40");
    expect(state.past).toEqual(["start"]);
    expect(undo(state).present).toBe("start");
    // Další gesto = další krok
    state = step(state, "otočení", "g8", 5_000);
    expect(state.past).toEqual(["start", "posun 40"]);
  });

  it("rychlá série úprav z klávesnice / formuláře se slučuje, pauza delší než 700 ms začne nový krok", () => {
    let state = initHistory("");
    state = step(state, "K", TIMED_GROUP, 0);
    state = step(state, "Ku", TIMED_GROUP, 200);
    state = step(state, "Kuch", TIMED_GROUP, 200 + COALESCE_MS);
    expect(state.past).toEqual([""]);
    state = step(state, "Kuchyně", TIMED_GROUP, 200 + COALESCE_MS * 2 + 1);
    expect(state.past).toEqual(["", "Kuch"]);
    // Po Zpět se další úprava neslučuje s krokem, který už byl vrácen
    state = undo(state);
    state = step(state, "Koupelna", TIMED_GROUP, 200 + COALESCE_MS * 2 + 50);
    expect(state.past).toEqual(["", "Kuch"]);
    expect(state.present).toBe("Koupelna");
  });

  it("nová úprava po Zpět smaže Znovu; stejný stav krok nevytvoří; drží nejvýš 100 kroků", () => {
    let state = step(step(initHistory("a"), "b", "c1"), "c", "c2");
    state = undo(state);
    expect(state.future).toEqual(["c"]);
    state = step(state, "x", "c3");
    expect(state.future).toEqual([]);
    expect(step(state, state.present, "c4")).toBe(state);
    let long = initHistory(0);
    for (let index = 1; index <= HISTORY_LIMIT + 50; index++) long = recordChange(long, index, { group: `c${index}`, now: index });
    expect(long.past).toHaveLength(HISTORY_LIMIT);
    expect(long.past[0]).toBe(50);
    let back = long;
    for (let index = 0; index < HISTORY_LIMIT; index++) back = undo(back);
    expect(back.present).toBe(50);
    expect(canUndo(back)).toBe(false);
  });
});

describe("fáze 64 – start editoru: uložený půdorys, záloha v prohlížeči, starý jediný slot", () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
  });
  afterEach(() => vi.unstubAllGlobals());

  const server = withElements(el("z1", "socket", 1000, 1000), el("s1", "ceiling-light", 2000, 1000));
  const stored = (version: number, draft: FloorplanDraft = server) => ({ id: "fp1", version, draftJson: JSON.stringify(draft) });

  it("nový půdorys bez zálohy začne prázdný a nic se neukládá, dokud se nezačne kreslit", () => {
    const boot = bootDraft(null, null);
    expect(boot.initial.elements).toEqual([]);
    expect(boot.initialSaved).toBe(boot.initial);
    expect(boot.restored).toBe(false);
    expect(boot.staleBackup).toBeNull();
  });

  it("uložený půdorys začne nákresem ze serveru; odlišná knihovna spotřebičů se převezme a uloží", () => {
    const plain = bootDraft(stored(3), null);
    expect(plain.initial.elements.map((element) => element.id)).toEqual(["z1", "s1"]);
    expect(plain.initialSaved).toBe(plain.initial);
    const library = [{ ...builtinAppliance("wallbox")!, label: "Wallbox garáž" }];
    const merged = bootDraft(stored(3), library);
    expect(merged.initial.appliances[0]?.label).toBe("Wallbox garáž");
    expect(merged.initialSaved).not.toBe(merged.initial);
  });

  it("neuložené změny ze stejné verze (zavřené okno před uložením) se obnoví a hned uloží", () => {
    const changed = withElements(...server.elements, el("z2", "socket", 3000, 1000));
    writeBackup("fp1", { baseVersion: 3, draft: changed, at: 1 });
    const boot = bootDraft(stored(3), null);
    expect(boot.restored).toBe(true);
    expect(boot.initial.elements).toHaveLength(3);
    expect(boot.initialSaved?.elements).toHaveLength(2);
    expect(boot.staleBackup).toBeNull();
  });

  it("záloha ze starší verze (půdorys se mezitím uložil jinde) editor nepřepíše – nabídne se do historie verzí", () => {
    const old = withElements(el("z9", "socket", 500, 500));
    writeBackup("fp1", { baseVersion: 2, draft: old, at: 7 });
    const boot = bootDraft(stored(3), null);
    expect(boot.restored).toBe(false);
    expect(boot.initial.elements.map((element) => element.id)).toEqual(["z1", "s1"]);
    expect(boot.staleBackup?.at).toBe(7);
    expect(boot.staleBackup?.draft.elements[0].id).toBe("z9");
  });

  it("poškozený nákres na serveru: editor začne prázdný a nic nepřepíše", () => {
    const boot = bootDraft({ id: "fp1", version: 4, draftJson: "{poškozeno" }, null);
    expect(boot.corrupted).toBe(true);
    expect(boot.initialSaved).toBe(boot.initial);
  });

  it("nový půdorys převezme zálohu nedokončeného prvního uložení a uloží ji", () => {
    writeBackup(null, { baseVersion: null, draft: server, at: 3 });
    expect(storage.getItem(backupKey(null))).not.toBeNull();
    const boot = bootDraft(null, null);
    expect(boot.restored).toBe(true);
    expect(boot.initialSaved).toBeNull();
    clearBackup(null);
    expect(readBackup(null)).toBeNull();
  });

  it("starý jediný slot z fáze 63: prázdný nákres se nepřebírá, nakreslený ano; obsah i na jiném podlaží", () => {
    storage.setItem(LEGACY_DRAFT_KEY, JSON.stringify(emptyDraft()));
    expect(readLegacyDraft()).toBeNull();
    storage.setItem(LEGACY_DRAFT_KEY, JSON.stringify(server));
    expect(readLegacyDraft()?.elements).toHaveLength(2);
    storage.setItem(LEGACY_DRAFT_KEY, "{rozbité");
    expect(readLegacyDraft()).toBeNull();
    const twoFloors = addFloor(emptyDraft(), { name: "2. NP", levelMm: 3000 });
    expect(hasContent(twoFloors)).toBe(false);
    const upstairs = { ...twoFloors, otherFloors: twoFloors.otherFloors.map((floor) => ({ ...floor, elements: [el("z5", "socket", 100, 100)] })) };
    expect(hasContent(upstairs)).toBe(true);
    expect(defaultFloorplanName(new Date(2026, 10, 7))).toBe("Půdorys 7. 11. 2026");
  });
});
