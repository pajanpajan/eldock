// Fáze 105: tisková podoba cenové nabídky pro zákazníka (samostatné HTML pro tisk / PDF a stažení). Vzniká jen z části
// `customer` výpočtu – interní podklady (zdroje cen, hodiny, kalibrace) do ní z principu nemají cestu.

import { assertCustomerSafe, type CustomerQuote, type QuoteParty } from "./quote-engine";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const czk = (value: number) => `${value.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč`;
const qty = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });
export const czDate = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return year ? `${day}. ${month}. ${year}` : iso;
};

const party = (title: string, value: QuoteParty) =>
  `<div class="party"><h3>${escape(title)}</h3><b>${escape(value.name || "–")}</b>${[value.address, value.ico ? `IČO ${value.ico}` : null, value.dic ? `DIČ ${value.dic}` : null, value.contact, value.email, value.phone]
    .filter(Boolean)
    .map((line) => `<div>${escape(String(line))}</div>`)
    .join("")}</div>`;

/** Kompletní HTML nabídky (A4) – tisk z nového okna prohlížeče nebo stažený soubor. */
export function customerQuoteHtml(input: CustomerQuote, footer: string): string {
  const quote = assertCustomerSafe(input);
  const chapters = quote.chapters
    .map(
      (chapter) => `<h2>${escape(chapter.title)}</h2><table><thead><tr><th>Položka</th><th class="n">Množství</th><th>MJ</th><th class="n">Cena za MJ</th><th class="n">Cena celkem</th></tr></thead><tbody>${chapter.lines
        .map((line) => `<tr><td>${escape(line.name)}${line.code ? `<div class="code">${escape(line.code)}</div>` : ""}</td><td class="n">${qty(line.quantity)}</td><td>${line.unit}</td><td class="n">${czk(line.unitPriceCzk)}</td><td class="n">${czk(line.totalCzk)}</td></tr>`)
        .join("")}</tbody><tfoot><tr><td colspan="4">Celkem ${escape(chapter.title.toLowerCase())}</td><td class="n">${czk(chapter.totalCzk)}</td></tr></tfoot></table>`,
    )
    .join("");
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Cenová nabídka ${escape(quote.number)}</title><style>
@page { size: A4 portrait; margin: 14mm; }
body { font: 10pt/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 0; }
header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 8px; }
h1 { font-size: 18pt; margin: 0; } h2 { font-size: 11pt; margin: 18px 0 6px; } h3 { font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; margin: 0 0 4px; }
.meta { text-align: right; font-size: 9pt; } .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 14px 0; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; } th, td { border-bottom: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #f3f4f6; } .n { text-align: right; white-space: nowrap; } tfoot td { font-weight: 700; border-top: 1px solid #9ca3af; }
.code { font-family: ui-monospace, monospace; font-size: 8pt; color: #6b7280; }
.totals { margin-left: auto; margin-top: 16px; width: 55%; } .totals td { border: 0; padding: 2px 6px; } .totals tr.sum td { font-size: 12pt; font-weight: 800; border-top: 2px solid #111827; }
.notes { margin-top: 18px; font-size: 8.5pt; color: #374151; } footer { margin-top: 24px; font-size: 7pt; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 6px; }
</style></head><body>
<header><div><h1>Cenová nabídka</h1><div>${escape(quote.title)}</div></div><div class="meta"><b>č. ${escape(quote.number)}</b><div>Vystaveno ${czDate(quote.issuedAt)}</div><div>Platnost do ${czDate(quote.validUntil)}</div></div></header>
<div class="parties">${party("Dodavatel", quote.supplier)}${party("Odběratel", quote.customer)}</div>
${chapters}
<table class="totals"><tbody><tr><td>Celkem bez DPH</td><td class="n">${czk(quote.totals.withoutVatCzk)}</td></tr><tr><td>DPH ${quote.totals.vatRate} %</td><td class="n">${czk(quote.totals.vatCzk)}</td></tr><tr class="sum"><td>Celkem s DPH</td><td class="n">${czk(quote.totals.withVatCzk)}</td></tr></tbody></table>
<div class="notes">${quote.notes.map((note) => `<p>${escape(note)}</p>`).join("")}</div>
<footer>${escape(footer)}</footer>
</body></html>`;
}

/** Tabulka nabídky pro XLSX (stejný obsah jako tisk, bez interních podkladů). */
export function customerQuoteRows(input: CustomerQuote): (string | number)[][] {
  const quote = assertCustomerSafe(input);
  const rows: (string | number)[][] = [[`Cenová nabídka č. ${quote.number}`], [quote.title], [`Vystaveno ${czDate(quote.issuedAt)}, platnost do ${czDate(quote.validUntil)}`], [`Odběratel: ${quote.customer.name || "–"}${quote.customer.ico ? `, IČO ${quote.customer.ico}` : ""}`], []];
  for (const chapter of quote.chapters) {
    rows.push([chapter.title], ["Položka", "Objednací číslo", "Množství", "MJ", "Cena za MJ [Kč]", "Cena celkem [Kč]"]);
    for (const line of chapter.lines) rows.push([line.name, line.code ?? "", line.quantity, line.unit, line.unitPriceCzk, line.totalCzk]);
    rows.push([`Celkem – ${chapter.title}`, "", "", "", "", chapter.totalCzk], []);
  }
  rows.push(["Celkem bez DPH", "", "", "", "", quote.totals.withoutVatCzk], [`DPH ${quote.totals.vatRate} %`, "", "", "", "", quote.totals.vatCzk], ["Celkem s DPH", "", "", "", "", quote.totals.withVatCzk]);
  return rows;
}
