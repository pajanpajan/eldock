import { describe, expect, it } from "vitest";

import {
  canSubmit,
  initialWizardState,
  parseDraft,
  serializeDraft,
  stepsFor,
  wizardReducer,
  type WizardPhoto,
} from "./wizard-state";

const stroke = { tool: "pen" as const, color: "#ef4444", width: 0.004, points: [[0.1, 0.1, 0.5]] as [number, number, number][] };
const photo = (patch: Partial<WizardPhoto> = {}): WizardPhoto => ({
  key: "p1",
  fileName: "a.jpg",
  caption: "",
  previewUrl: "blob:x",
  url: "/api/files/photos/a.jpg",
  sizeBytes: 10,
  progress: 100,
  error: null,
  ...patch,
});

describe("wizardReducer", () => {
  it("kroky podle režimu", () => {
    expect(stepsFor("new")).toEqual(["markup", "photos", "note", "summary"]);
    expect(stepsFor("comment")).toEqual(["photos", "note", "summary"]);
  });

  it("změna listu zahodí tahy", () => {
    const withStrokes = wizardReducer(initialWizardState, { type: "setStrokes", strokes: [stroke] });
    expect(wizardReducer(withStrokes, { type: "setSheet", sheet: 1 }).strokes).toHaveLength(1);
    expect(wizardReducer(withStrokes, { type: "setSheet", sheet: 2 }).strokes).toHaveLength(0);
  });

  it("diktování se zapamatuje i po ruční úpravě textu", () => {
    let state = wizardReducer(initialWizardState, { type: "setText", text: "Vyměněn stykač", dictated: true });
    state = wizardReducer(state, { type: "setText", text: "Vyměněn stykač K4" });
    expect(state.dictated).toBe(true);
  });

  it("fotky: přidat, upravit, odebrat", () => {
    let state = wizardReducer(initialWizardState, { type: "addPhoto", photo: photo({ url: null, progress: 0 }) });
    state = wizardReducer(state, { type: "updatePhoto", key: "p1", patch: { progress: 50 } });
    expect(state.photos[0].progress).toBe(50);
    expect(wizardReducer(state, { type: "removePhoto", key: "p1" }).photos).toHaveLength(0);
  });
});

describe("canSubmit", () => {
  it("prázdný průvodce nejde odeslat", () => {
    expect(canSubmit(initialWizardState, "new").ok).toBe(false);
  });
  it("stačí zákres, fotka nebo poznámka", () => {
    expect(canSubmit({ ...initialWizardState, strokes: [stroke] }, "new").ok).toBe(true);
    expect(canSubmit({ ...initialWizardState, photos: [photo()] }, "new").ok).toBe(true);
    expect(canSubmit({ ...initialWizardState, text: " poznámka " }, "new").ok).toBe(true);
  });
  it("u doplnění k otevřené změně se zákres nepočítá", () => {
    expect(canSubmit({ ...initialWizardState, strokes: [stroke] }, "comment").ok).toBe(false);
  });
  it("během nahrávání fotek nejde odeslat", () => {
    const state = { ...initialWizardState, text: "x", photos: [photo({ url: null, progress: 40 })] };
    expect(canSubmit(state, "new")).toEqual({ ok: false, reason: "Počkejte, než se dokončí nahrávání fotek." });
  });
});

describe("koncept", () => {
  it("uloží jen nahrané fotky a obnoví stav", () => {
    const state = {
      ...initialWizardState,
      stepIndex: 2,
      text: "Přepojena svorka",
      strokes: [stroke],
      photos: [photo(), photo({ key: "p2", url: null, progress: 30 })],
    };
    const restored = parseDraft(serializeDraft(state))!;
    expect(restored.stepIndex).toBe(2);
    expect(restored.text).toBe("Přepojena svorka");
    expect(restored.strokes).toHaveLength(1);
    expect(restored.photos).toHaveLength(1);
    expect(restored.photos![0].previewUrl).toBe("/api/files/photos/a.jpg");
  });
  it("poškozený koncept ignoruje", () => {
    expect(parseDraft("{nope")).toBeNull();
    expect(parseDraft(null)).toBeNull();
  });
});
