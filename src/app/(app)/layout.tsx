import { AppHeader } from "@/components/layout/AppHeader";

/** Interní aplikace (za přihlášením): hlavička s navigací podle účtu a pracovní plocha. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 py-6 sm:px-6">{children}</main>
    </>
  );
}
