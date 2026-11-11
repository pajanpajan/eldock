"use client";

import { useEffect, useState } from "react";

import type { FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { WIZARD_STEP_KEY, resumeStep, type WizardStep } from "@/lib/panel-builder/floorplan-wizard";

const keyOf = (id: string) => `${WIZARD_STEP_KEY}:${id}`;

function readStep(id: string | null): number | null {
  if (!id) return null;
  try {
    const raw = window.sessionStorage.getItem(keyOf(id));
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function writeStep(id: string | null, step: WizardStep) {
  if (!id) return;
  try {
    window.sessionStorage.setItem(keyOf(id), String(step));
  } catch {
    // relace prohlížeče nedostupná (soukromé okno) – krok platí jen do přemontování editoru
  }
}

/**
 * Fáze 90: aktivní krok průvodce 2D půdorysu. Nový půdorys po prvním uložení dostane id a server stránku překreslí
 * (editor se přemontuje) – krok se proto pamatuje v relaci prohlížeče podle id půdorysu a po přemontování i po obnovení
 * stránky zůstane. Vytvoření místnosti, nahrání podkladu ani kalibrace krok nikdy nezmění; bez záznamu (nový půdorys,
 * jiná karta) výchozí krok podle obsahu nákresu.
 */
export function useWizardStep(storedId: string | null, floorplanId: string | null, draft: Pick<FloorplanDraft, "rooms" | "elements" | "background" | "cad">) {
  const [step, setStep] = useState<WizardStep>(() => resumeStep(readStep(storedId), draft));
  useEffect(() => {
    writeStep(floorplanId, step);
  }, [floorplanId, step]);
  return [step, setStep] as const;
}
