import type { Metadata } from "next";

import { LegalPage } from "@/components/landing/LegalPage";
import { PRIVACY_SECTIONS, PRIVACY_VERSION } from "@/lib/legal";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";
import { withOperator } from "@/lib/operator";
import { getOperatorProfile } from "@/server/operator";

const TITLE = "Zásady zpracování osobních údajů";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · ELDOCK` },
  description: "Jak ELDOCK zpracovává osobní údaje firem a uživatelů platformy: účely, právní základy, zpracovatelé, doba uložení a vaše práva.",
  alternates: { canonical: `${SITE_URL}/ochrana-osobnich-udaju` },
  openGraph: { title: TITLE, url: `${SITE_URL}/ochrana-osobnich-udaju`, images: [OG_IMAGE] },
};

/** Fáze 54: veřejné zásady zpracování osobních údajů (GDPR). */
export default async function PrivacyPage() {
  // Fáze 112: správce = provozovatel z velínu (jméno, sídlo, IČO, e-mail)
  const operator = await getOperatorProfile();
  return <LegalPage title={TITLE} version={PRIVACY_VERSION} sections={PRIVACY_SECTIONS.map((section) => ({ ...section, paragraphs: section.paragraphs.map((paragraph) => withOperator(paragraph, operator)) }))} />;
}
