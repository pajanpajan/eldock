import type { Metadata } from "next";

import { CompanyDetailsForm } from "@/components/companies/CompanyDetailsForm";
import { PageHeader } from "@/components/common/PageHeader";
import { formatDate } from "@/lib/format";
import { requirePanelCompany } from "@/server/panel-session";

export const metadata: Metadata = { title: "Firemní údaje do razítka" };

/** Údaje výrobce rozváděče: titulní list, rohové razítko, prohlášení o shodě a výrobní štítek CE. */
export default async function CompanyDetailsPage() {
  const company = await requirePanelCompany("/panel-builder/company");
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <PageHeader
        title="Firemní údaje do razítka"
        description="Údaje výrobce rozváděče se propisují na titulní list, do rohového razítka všech 6 listů, do ES prohlášení o shodě a na výrobní štítek CE."
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
      <p className="text-xs text-muted-foreground" data-testid="terms-accepted">
        Přihlašovací e-mail {company.email} · souhlas s obchodními podmínkami a přenesením odpovědnosti (verze {company.termsVersion}) udělen {formatDate(company.termsAcceptedAt)}.
      </p>
    </div>
  );
}
