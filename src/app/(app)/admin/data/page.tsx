import type { Metadata } from "next";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { CompanyDataPanel } from "@/components/data/CompanyDataPanel";
import { PageTransition } from "@/components/layout/PageTransition";
import { cancelCompanyClosureAction, requestCompanyClosureAction } from "@/server/actions/data-requests";
import { getCompanyDataOverview } from "@/server/queries/data-requests";
import { getCurrentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Data firmy" };

// Fáze 69 (GDPR): export dat registrované firmy, zrušení účtu firmy s lhůtou 30 dní a evidence žádostí – technický ředitel.
export default async function AdminDataPage() {
  const account = await getCurrentAccount();
  if (!account.can("manageUsers")) return <NoAccess title="Data firmy" current={account.accountType} suggest="PLANT_ADMIN" />;
  const companyId = account.user.companyId;
  const data = companyId ? await getCompanyDataOverview(companyId) : null;

  return (
    <PageTransition>
      <PageHeader title="Data firmy" description="Export všech dat firmy, zrušení účtu firmy a evidence žádostí o data (GDPR)." />
      <AdminTabs current="/admin/data" canUsers canModules={account.can("manageModules")} canData={Boolean(companyId)} />
      {data?.company ? (
        <CompanyDataPanel
          companyName={data.company.companyName}
          exportHref="/api/data-export"
          pending={data.pending}
          requests={data.requests}
          deletes={[
            "závod s budovami, patry a všemi zařízeními",
            "dokumentace, revize schémat, kusovníky, změny a jejich přílohy",
            "revize VTZ, závady, provizoria, návody, zálohy SW a životnost součástek",
            "účty zaměstnanců, bezpečnostní deník, avíza a všechny nahrané soubory firmy",
          ]}
          passwordLabel="Vaše heslo"
          canClose
          requestAction={requestCompanyClosureAction}
          cancelAction={cancelCompanyClosureAction}
        />
      ) : (
        <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Obchodní demo nemá data firmy k exportu ani výmazu – export, zrušení účtu a evidence žádostí jsou pro registrované firmy.
        </p>
      )}
    </PageTransition>
  );
}
