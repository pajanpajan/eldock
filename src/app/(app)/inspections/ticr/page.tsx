import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { NoAccess } from "@/components/common/NoAccess";
import { PageHeader } from "@/components/common/PageHeader";
import { TicrReportView } from "@/components/inspections/TicrReportView";
import { PageTransition } from "@/components/layout/PageTransition";
import { MONTH_PATTERN, pragueMonth } from "@/lib/revision-signature";
import { getTicrProfiles, getTicrReport } from "@/server/queries/ticr-report";
import { getCurrentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Měsíční report & Ochrana TIČR" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Fáze 108: 🛡️ Měsíční report & Ochrana TIČR (pro revizní techniky) – všechny revize pod číslem osvědčení za měsíc,
// zneplatnění cizí revize (🚨 Tato revize není moje!), měsíční e-mail a podepsaný výkaz PDF / CSV.
export default async function TicrReportPage({ searchParams }: PageProps<"/inspections/ticr">) {
  const [account, query] = await Promise.all([getCurrentAccount(), searchParams]);
  if (!account.can("recordInspection")) return <NoAccess title="Měsíční report & Ochrana TIČR" current={account.accountType} suggest="INSPECTOR_VTZ" />;
  const profiles = await getTicrProfiles();
  const requestedMonth = first(query.month) ?? "";
  const month = MONTH_PATTERN.test(requestedMonth) ? requestedMonth : pragueMonth(new Date());
  const profile = profiles.find((entry) => entry.id === first(query.profile)) ?? profiles[0] ?? null;
  const report = profile ? await getTicrReport(profile, month) : null;

  return (
    <PageTransition>
      <PageHeader
        title="🛡️ Měsíční report & Ochrana TIČR"
        description="Pro revizní techniky – kontrola všech revizí vystavených pod vaším číslem osvědčení TIČR. Revizi, kterou jste neprovedli, jedním klikem zneplatníte."
      />
      {profile && report ? (
        <TicrReportView profiles={profiles} profileId={profile.id} month={month} report={report} />
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="Zatím nemáte uložený profil revizního technika"
          description="Profil s číslem osvědčení TIČR založíte ve formuláři revize (🖊️ Doplnit data k revizi na kartě rozváděče nebo stroje). Podle čísla osvědčení pak report hlídá každou revizi."
        />
      )}
    </PageTransition>
  );
}
