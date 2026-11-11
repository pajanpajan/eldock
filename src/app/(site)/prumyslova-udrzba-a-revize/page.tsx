import { SeoLandingPage, seoLandingMetadata } from "@/components/landing/SeoLandingPage";

// Fáze 96: veřejná SEO vstupní stránka (obsah v `src/lib/seo-landings.ts`).
export const metadata = seoLandingMetadata("prumyslova-udrzba-a-revize");

export default function Page() {
  return <SeoLandingPage id="prumyslova-udrzba-a-revize" />;
}
