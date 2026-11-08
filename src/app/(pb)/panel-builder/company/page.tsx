import type { Metadata } from "next";

import { CompanyDetailsForm } from "@/components/companies/CompanyDetailsForm";
import { PageHeader } from "@/components/common/PageHeader";
import { CompanyDataPanel } from "@/components/data/CompanyDataPanel";
import { CompanyBrandingForm } from "@/components/panel-builder/CompanyBrandingForm";
import { formatDate } from "@/lib/format";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { cancelPanelClosureAction, requestPanelClosureAction } from "@/server/actions/data-requests";
import { requirePanelCompany } from "@/server/panel-session";
import { getCompanyDataOverview } from "@/server/queries/data-requests";

export const metadata: Metadata = { title: "Firemní údaje a razítko" };

/** Údaje výrobce rozváděče: titulní list, rohové razítko, prohlášení o shodě a výrobní štítek CE. */
export default async function CompanyDetailsPage() {
  const company = await requirePanelCompany("/panel-builder/company");
  const data = await getCompanyDataOverview(company.id);
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <PageHeader
        title="Firemní údaje a razítko"
        description="Údaje výrobce rozváděče, logo a razítko se propisují na titulní list, do rohového razítka všech 6 listů, do ES prohlášení o shodě, protokolu kusové zkoušky a na výrobní štítek CE."
      />
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <CompanyDetailsForm
          initial={{
            ico: company.ico,
            dic: company.dic ?? "",
            companyName: company.companyName,
            street: company.street,
            city: company.city,
            zip: company.zip,
            contactName: company.contactName,
            phone: company.phone,
            authorizationNumber: company.authorizationNumber ?? "",
          }}
        />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <CompanyBrandingForm initial={{ logoUrl: company.logoUrl, stampUrl: company.stampUrl }} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6" id="data-firmy">
        <CompanyDataPanel
          companyName={company.companyName}
          exportHref="/api/data-export?scope=panel"
          pending={data.pending}
          requests={data.requests}
          deletes={["projekty rozváděčů s fotkami, přístroji a dokumentací", "2D půdorysy s historií verzí", "logo, razítko, štítky a knihovna spotřebičů", "hlášení chyb AI a nahrané soubory firmy", "kontaktní osoba, e-mail, telefon a přihlášení"]}
          keeps="Objednávky kreditů a fakturační údaje firmy (název, IČO, DIČ, sídlo) se kvůli účetním a daňovým dokladům uchovávají 10 let, bez kontaktní osoby a přihlášení."
          passwordLabel="Heslo firmy"
          canClose={company.id !== TESTER_COMPANY.id}
          requestAction={requestPanelClosureAction}
          cancelAction={cancelPanelClosureAction}
        />
      </div>
      <p className="text-xs text-muted-foreground" data-testid="terms-accepted">
        Přihlašovací e-mail {company.email} · souhlas s obchodními podmínkami a přenesením odpovědnosti (verze {company.termsVersion}) udělen {formatDate(company.termsAcceptedAt)}.
      </p>
    </div>
  );
}
