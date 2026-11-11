"use client";

import dynamic from "next/dynamic";

import type { PlantOnboardingProps } from "./IndustrialPlantOnboarding";

// Fáze 92: průvodce závodem se načte až v prohlížeči (dialogy, QR, mise) – stránka závodu zůstává lehká.
const IndustrialPlantOnboarding = dynamic(() => import("./IndustrialPlantOnboarding").then((mod) => mod.IndustrialPlantOnboarding), { ssr: false });

export function PlantOnboardingLoader(props: PlantOnboardingProps) {
  return <IndustrialPlantOnboarding key={props.open ?? "zavreno"} {...props} />;
}
