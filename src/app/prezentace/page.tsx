import type { Metadata } from "next";

import { PitchDeck } from "@/components/pitch/PitchDeck";
import { pitchLiveData } from "@/lib/pitch-live";

// Fáze 99 / 101: veřejná prezentace ELDOCK – 8 věcných inženýrských slidů a One-Pager A4 pro jednání o podpoře.
// Bez přihlášení (`PUBLIC_PATHS` v `src/proxy.ts`), mimo vyhledávače (není v sitemap, `noindex`). Živá data slidů
// (kusovník vzorového RD, převod vzorového BIM modelu) spočítá server při sestavení stránky stejnými funkcemi jako aplikace.
export const metadata: Metadata = {
  title: "Prezentace ELDOCK – návrh elektroinstalace, výroba rozváděčů a provozní dokumentace",
  description: "ELDOCK.cz – propojení návrhu elektroinstalace, výroby rozváděčů a provozní dokumentace do jednoho pracovního postupu: 8 věcných slidů a jednostránkové shrnutí A4.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eldock.cz/prezentace" },
};

export default function PresentationPage() {
  return <PitchDeck live={pitchLiveData()} />;
}
