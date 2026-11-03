import { PanelBuilderHeader } from "@/components/panel-builder/PanelBuilderHeader";
import { getPanelCompany } from "@/server/panel-session";

/** ELDOCK AI Panel Builder – samostatný produkt s vlastní hlavičkou (bez navigace správy závodů). */
export default async function PanelBuilderLayout({ children }: { children: React.ReactNode }) {
  const company = await getPanelCompany();
  return (
    <>
      <PanelBuilderHeader company={company} />
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 py-6 sm:px-6">{children}</main>
    </>
  );
}
