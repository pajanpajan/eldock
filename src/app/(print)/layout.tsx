/** Tiskové stránky (štítky): bez hlavičky aplikace a bez okrajů pracovní plochy. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 flex-col">{children}</main>;
}
