import { expect, type Locator, type Page } from "@playwright/test";

// Fáze 98: 2D půdorys je fázový průvodce – paleta, pravý panel i vrstvy plátna ukazují jen nástroje aktivní fáze. Testy
// starších fází před vložením značky nebo kontrolou karty přepnou editor do fáze, ve které nástroj je:
//   1 půdorys a místnosti · 2 rozváděč, okna, dveře a vybavení · 3 zásuvky a spotřebiče · 4 světla, vypínače
//   a chytrá domácnost · 5 trasy, kusovník a rozváděč.

export type Phase = 1 | 2 | 3 | 4 | 5;

/** Přepne průvodce do fáze (v kompaktní liště nic – ta ukazuje vše). */
export async function goPhase(page: Page, phase: Phase) {
  const step = page.getByTestId(`wizard-step-${phase}`);
  if (!(await step.count())) return;
  if ((await page.getByTestId("floorplan-wizard").getAttribute("data-step")) === String(phase)) return;
  await step.click();
  await expect(page.getByTestId("floorplan-wizard")).toHaveAttribute("data-step", String(phase));
}

const palette = (page: Page) => page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });

/** Fáze, ve které je položka palety – zkusí aktuální, pak 3 (zásuvky), 4 (světla a ovládání) a 2 (rozváděče a vybavení). */
export async function phaseForPalette(page: Page, label: string | RegExp) {
  const item = () => palette(page).getByRole("button", { name: label, exact: false });
  if (await item().count()) return;
  for (const phase of [3, 4, 2] as const) {
    await goPhase(page, phase);
    if (await item().count()) return;
  }
}

/** Karty pravého panelu podle fáze (výkaz kabeláže, kontrola norem, kusovník = 5; zásuvkové okruhy = 3; design = 4). */
export async function phaseForPanel(page: Page, section: "cables" | "checks" | "bom" | "circuits" | "sockets" | "design" | "site" | "rooms") {
  const phase: Phase = section === "sockets" ? 3 : section === "design" ? 4 : section === "site" ? 2 : section === "rooms" ? 1 : 5;
  await goPhase(page, phase);
}

/** Skupiny palety podle fáze (`PHASE_PALETTE` v src/lib/panel-builder/floorplan-phases.ts). */
const GROUP_PHASE: Record<string, Phase> = { panel: 2, fixtures: 2, architecture: 2, medical: 2, sockets: 3, appliances: 3, lights: 4, controls: 4, shading: 4 };

/** Přepne do fáze se skupinou palety (rozváděče a vybavení 2, zásuvky a spotřebiče 3, světla, ovládání a stínění 4). */
export async function goPhaseForGroup(page: Page, group: string) {
  const phase = GROUP_PHASE[group];
  if (phase) await goPhase(page, phase);
}

/**
 * Značka jiné fáze je na plátně potlačená a neklikatelná (`data-view` „dim“ / „context“) – před klikem na ni přepne do
 * fáze 5 (celý výkres, filtr vrstev „vše“). Značka aktivní fáze (nebo kompaktní lišta bez filtru) zůstane, jak je.
 */
export async function ensureActive(page: Page, element: Locator) {
  const view = await element
    .evaluate((node) => node.closest("[data-view]")?.getAttribute("data-view") ?? null, undefined, { timeout: 15_000 })
    .catch(() => null);
  if (view === null || view === "active") return;
  await goPhase(page, 5);
  const all = page.getByTestId("layer-filter-all");
  if ((await all.count()) && (await all.getAttribute("aria-checked")) !== "true") await all.click();
}
