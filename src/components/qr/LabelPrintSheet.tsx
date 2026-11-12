import { labelPurpose } from "@/lib/qr-label-registry";

import { EldockLabelFace } from "./EldockQrLabel";

export type LabelPrintFormat = "roll" | "a4";

/** Nejvýš štítků na jednu tiskovou stránku (větší série se tiskne po rozsazích). */
export const PRINT_PAGE_LIMIT = 500;

/**
 * Fáze 103: CSS tisku štítků – kotouč Zebra ZD421t = stránka přesného rozměru štítku (PDF 1:1, 1 štítek na stránku,
 * bez okrajů), arch A4 = mřížka štítků s rozestupem 2 mm a ořezovou čarou.
 */
export function labelPrintCss(purpose: string, format: LabelPrintFormat): string {
  const spec = labelPurpose(purpose);
  const common = "html, body { background: #fff !important; } header, nav, footer, .no-print { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: none !important; } * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }";
  return format === "roll"
    ? `@page { size: ${spec.widthMm}mm ${spec.heightMm}mm; margin: 0; } @media print { ${common} body { margin: 0 !important; } .label-sheet { display: block !important; gap: 0 !important; padding: 0 !important; background: none !important; } .label-cell { break-after: page; page-break-after: always; margin: 0 !important; box-shadow: none !important; } .label-cell:last-child { break-after: auto; page-break-after: auto; } }`
    : `@page { size: A4 portrait; margin: 10mm; } @media print { ${common} .label-sheet { padding: 0 !important; background: none !important; } .label-cell { box-shadow: none !important; outline: 0.1mm dashed #9ca3af !important; } }`;
}

/** Štítky série k tisku (kotouč 1:1 nebo arch A4). */
export function LabelPrintSheet({ codes, purpose, companyName, format }: { codes: readonly string[]; purpose: string; companyName?: string | null; format: LabelPrintFormat }) {
  const spec = labelPurpose(purpose);
  const columns = Math.max(1, Math.floor((190 + 2) / (spec.widthMm + 2)));
  return (
    <div
      className={format === "roll" ? "label-sheet flex flex-wrap gap-3 rounded-xl bg-zinc-800 p-4" : "label-sheet grid w-fit gap-[2mm] rounded-xl bg-white p-[10mm]"}
      style={format === "a4" ? { gridTemplateColumns: `repeat(${columns}, ${spec.widthMm}mm)` } : undefined}
      data-testid={format === "roll" ? "label-roll" : "label-a4"}
      data-count={codes.length}
    >
      {codes.map((code) => (
        <div key={code} className="label-cell break-inside-avoid shadow-lg" style={{ width: `${spec.widthMm}mm`, height: `${spec.heightMm}mm` }}>
          <EldockLabelFace code={code} purpose={purpose} companyName={companyName} />
        </div>
      ))}
    </div>
  );
}
