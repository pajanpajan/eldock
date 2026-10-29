// Značka aplikace (Eldock) – jediné místo pro název, podtitul a domény.
// Soubor je bezpečný pro klient i server.

export const BRAND = {
  name: "Eldock",
  /** Verzálky pro razítka výkresů a tiskové sestavy. */
  mark: "ELDOCK",
  tagline: "Průmyslový dok dokumentace a revizí",
  description: "Elektrodokumentace, revize a údržba výrobních závodů",
  domain: "eldock.cz",
  domains: ["eldock.cz", "eldock.eu", "eldock.sk"],
  /** Back-office projektantů (autor revizí v seedu a ve výkresech). */
  cae: "Eldock CAE",
} as const;

/** Patička tiskových sestav: „ELDOCK · eldock.cz – Průmyslový dok dokumentace a revizí“. */
export const BRAND_PRINT_LINE = `${BRAND.mark} · ${BRAND.domain} – ${BRAND.tagline}`;
