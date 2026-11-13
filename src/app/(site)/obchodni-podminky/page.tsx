import type { Metadata } from "next";

import { LegalPage } from "@/components/landing/LegalPage";
import { PLANT_TERMS_CONSENT, TERMS_CONSENT, TERMS_SECTIONS, TERMS_VERSION } from "@/lib/registered-company";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";
import { withOperator } from "@/lib/operator";
import { getOperatorProfile } from "@/server/operator";

const TITLE = "Obchodní podmínky a vyloučení odpovědnosti";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · ELDOCK` },
  description: "Obchodní podmínky platformy ELDOCK (AI Panel Builder a Průmyslový dok), odpovědnost výrobce rozváděče a provozovatele závodu.",
  alternates: { canonical: `${SITE_URL}/obchodni-podminky` },
  openGraph: { title: TITLE, url: `${SITE_URL}/obchodni-podminky`, images: [OG_IMAGE] },
};

/** Fáze 54: veřejné znění podmínek, se kterými firma souhlasí při registraci (dřív jen v modalu registrace). */
export default async function TermsPage() {
  const operator = await getOperatorProfile();
  return (
    <LegalPage
      title={TITLE}
      version={TERMS_VERSION}
      sections={[
        ...TERMS_SECTIONS.map((section) => ({ title: section.title, paragraphs: [withOperator(section.text, operator)] })),
        { title: "Souhlas při registraci – AI Panel Builder", paragraphs: [TERMS_CONSENT] },
        { title: "Souhlas při registraci – výrobní závod", paragraphs: [PLANT_TERMS_CONSENT] },
      ]}
    />
  );
}
