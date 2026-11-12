import type { ReactNode } from "react";
import Link from "next/link";

import { PrintButton } from "@/components/landing/PrintButton";
import { versionBadge } from "@/lib/switchboard-versions";

// Fáze 103: rám snímku vydané verze pod QR štítkem – lišta (zpět na kartu, verze, tisk do PDF) a tisk A4 jako elaborát.
const PRINT_CSS = `
  @page { size: A4 portrait; margin: 8mm; }
  @media print {
    html, body { background: #fff !important; }
    .no-print { display: none !important; }
    .doc-sheets { display: block !important; gap: 0 !important; }
    .doc-sheet { max-width: none !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .doc-sheet:last-child { break-after: auto; }
  }
`;

export function VersionSnapshotFrame({ serial, version, current, supersededBy, latest, owner, title, children }: { serial: string; version: string; current: boolean; supersededBy: string | null; latest: string | null; owner: boolean; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-900" data-testid="version-snapshot" data-version={version} data-current={current}>
      <style>{PRINT_CSS}</style>
      <div className="no-print sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <Link href={`/q/${serial}`} className="text-sm underline">
            ↩ Karta štítku {serial}
          </Link>
          <span className="font-medium">{title}</span>
          <span className={current ? "rounded border border-emerald-500/60 px-2 py-0.5 text-xs font-bold text-emerald-200" : "rounded bg-red-600 px-2 py-0.5 text-xs font-black text-white"} data-testid="snapshot-badge">
            {versionBadge(version, current ? "LOCKED_PUBLISHED" : "SUPERSEDED", supersededBy)}
          </span>
          <div className="ml-auto">
            <PrintButton />
          </div>
        </div>
        {!current && latest ? (
          <p className="mx-auto w-full max-w-5xl px-4 pb-2 text-sm text-red-200 sm:px-6">
            ⚠️ Prohlížíte neaktuální verzi z archivu. Platná dokumentace:{" "}
            <Link href={`/q/${serial}/v/${latest}`} className="font-semibold underline">
              Verze {latest}
            </Link>
            .
          </p>
        ) : null}
        {owner ? null : <p className="mx-auto w-full max-w-5xl px-4 pb-2 text-xs text-muted-foreground sm:px-6">Jméno zákazníka, místo instalace a razítko firmy vidí jen přihlášená firma výrobce rozváděče.</p>}
      </div>
      <main className="px-2 py-6 sm:px-4">{children}</main>
    </div>
  );
}
