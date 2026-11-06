// Fáze 58: odkaz na datasheet ke každému přístroji. Uložený odkaz z katalogu (datasheetUrl) je ověřený zdroj;
// bez něj vede odkaz na produktovou stránku výrobce podle objednacího čísla (vzor URL výrobce – ověřte) nebo na
// vyhledání datasheetu. Žádný odkaz se nevydává za ověřený, když ověřený není. Čisté funkce.

export type DatasheetLinkKind = "datasheet" | "product" | "search";

export interface DatasheetLink {
  kind: DatasheetLinkKind;
  url: string;
  label: string;
  /** true = odkaz uložený v katalogu (z podkladů výrobce); false = sestavený z objednacího čísla. */
  verified: boolean;
}

export interface DatasheetSource {
  manufacturer: string;
  articleNumber: string;
  typeCode?: string | null;
  datasheetUrl?: string | null;
}

/** Produktová stránka výrobce podle objednacího čísla (jen výrobci se známým tvarem adresy). */
const PRODUCT_PAGE: Record<string, (article: string) => string> = {
  ABB: (article) => `https://new.abb.com/products/${encodeURIComponent(article)}`,
  "SCHNEIDER ELECTRIC": (article) => `https://www.se.com/cz/cs/product/${encodeURIComponent(article)}/`,
  SCHNEIDER: (article) => `https://www.se.com/cz/cs/product/${encodeURIComponent(article)}/`,
  SIEMENS: (article) => `https://www.siemens.com/product?${encodeURIComponent(article)}`,
  EATON: (article) => `https://www.eaton.com/cz/cs-cz/skuPage.${encodeURIComponent(article)}.html`,
  HAGER: (article) => `https://hager.com/cz/katalog/produkt/${encodeURIComponent(article.toLowerCase())}`,
};

/** Objednací číslo bez interního prefixu výrobce („ABB:2CDS…“ → „2CDS…“). */
export const cleanArticle = (article: string) => article.replace(/^[A-Z]+:/, "").trim();

/** Bezpečný odkaz (jen http / https / vlastní soubory aplikace). */
export function isSafeDatasheetUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (/^\/(api\/files|demo-docs)\/[\w./%-]+$/.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** PDF uložené v Eldocku (náhled přímo v dialogu). */
export const isLocalPdf = (url: string | null | undefined) => Boolean(url && /^\/(api\/files|demo-docs)\/[\w./%-]+\.pdf$/i.test(url));

/** Odkazy k přístroji v pořadí důvěryhodnosti: uložený datasheet → stránka výrobce → vyhledání. */
export function datasheetLinks(source: DatasheetSource): DatasheetLink[] {
  const links: DatasheetLink[] = [];
  const article = cleanArticle(source.articleNumber);
  if (isSafeDatasheetUrl(source.datasheetUrl)) links.push({ kind: "datasheet", url: source.datasheetUrl, label: "Datasheet z katalogu", verified: true });
  const page = PRODUCT_PAGE[source.manufacturer.trim().toUpperCase()];
  if (page && article) links.push({ kind: "product", url: page(article), label: `Produktová stránka ${source.manufacturer} (podle obj. čísla – ověřte)`, verified: false });
  const query = [source.manufacturer, article || source.typeCode, "datasheet"].filter(Boolean).join(" ");
  links.push({ kind: "search", url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, label: "Vyhledat datasheet na webu", verified: false });
  return links;
}

/** Hlavní odkaz pro tabulky (katalog). */
export const primaryDatasheetLink = (source: DatasheetSource) => datasheetLinks(source)[0];
