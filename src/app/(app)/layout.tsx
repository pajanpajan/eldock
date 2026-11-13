import { AppHeader } from "@/components/layout/AppHeader";

/** Interní aplikace (za přihlášením): hlavička s navigací podle účtu a pracovní plocha. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {/* Fáze 108: spodní rezerva – poslední tlačítko stránky (např. „Potvrdit a propsat do systému“) jde odrolovat nad
          plovoucí tlačítko „💬 Nápověda, Chyby & Kontakt“ vpravo dole */}
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 pt-6 pb-24 sm:px-6">{children}</main>
    </>
  );
}
