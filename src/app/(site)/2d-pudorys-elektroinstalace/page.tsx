import { SeoLandingPage, seoLandingMetadata } from "@/components/landing/SeoLandingPage";

// Fáze 96: veřejná SEO vstupní stránka (obsah v `src/lib/seo-landings.ts`).
export const metadata = seoLandingMetadata("2d-pudorys-elektroinstalace");

export default function Page() {
  return <SeoLandingPage id="2d-pudorys-elektroinstalace" />;
}
