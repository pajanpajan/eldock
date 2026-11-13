import { LeadGateProvider } from "@/components/analytics/LeadCaptureModal";
import { PaywallHost } from "@/components/credits/PaywallModal";
import { PanelBuilderHeader } from "@/components/panel-builder/PanelBuilderHeader";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { getPanelCompany } from "@/server/panel-session";

/** ELDOCK AI Panel Builder – samostatný produkt s vlastní hlavičkou (bez navigace správy závodů). */
export default async function PanelBuilderLayout({ children }: { children: React.ReactNode }) {
  const company = await getPanelCompany();
  const demo = company?.id === TESTER_COMPANY.id;
  return (
    <>
      <PanelBuilderHeader company={company} demo={demo} />
      {/* Fáze 102: ukázková firma (trenažér, demo scénáře) – export kusovníku, tisk elaborátu a uložení přes okno kontaktu */}
      <LeadGateProvider enabled={demo}>
        <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 py-6 sm:px-6">{children}</main>
        {/* Fáze 111: prodejní modal „💎 Odemkněte plnou verzi ELDOCK“ (nedostatek kreditů, výstup bez zkušebního označení) */}
        {company ? <PaywallHost /> : null}
      </LeadGateProvider>
    </>
  );
}
