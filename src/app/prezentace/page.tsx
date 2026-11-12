import type { Metadata } from "next";

import { PitchDeck } from "@/components/pitch/PitchDeck";

// Fáze 99: veřejná prezentace ELDOCK – Pitch Deck (10 slidů) a Executive One-Pager A4 pro jednání o podpoře.
// Bez přihlášení (`PUBLIC_PATHS` v `src/proxy.ts`), mimo vyhledávače (není v sitemap, `noindex`).
export const metadata: Metadata = {
  title: "Prezentace ELDOCK – Pitch Deck a Executive One-Pager",
  description: "ELDOCK.cz – digitální ekosystém pro návrh elektroinstalací, výrobu rozváděčů a provozní správu budov a průmyslu: prezentace a jednostránkové shrnutí.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eldock.cz/prezentace" },
};

export default function PresentationPage() {
  return <PitchDeck />;
}
