// Fáze 99 / 101: veřejná prezentace ELDOCK (`/prezentace`) – 8 věcných inženýrských slidů a tisknutelný One-Pager A4.
// Údaje jednání (cílová částka podpory, partner, kontakt, texty a rozpad využití) si prezentující přepíše přímo
// v prohlížeči – uloží se jen do localStorage jeho prohlížeče, na server nic nejde. Čisté funkce.

export const PITCH_STORAGE_KEY = "eldock-pitch-config";
export const PITCH_SLIDE_COUNT = 8;

/** Fáze 101: plán využití podpory (slide 8, One-Pager) – výchozí texty, prezentující je může přepsat. */
export const PITCH_PLAN: readonly { title: string; text: string }[] = [
  {
    title: "Pilotní nasazení a obchodní vstup na trh ČR/SK",
    text: "Osobní nasazení u prvních desítek montážních firem a průmyslových areálů, technická podpora při zavádění.",
  },
  {
    title: "Datová a velkoobchodní integrace",
    text: "Dokončení plné certifikace katalogů výrobců (ETIM) a napojení přímého objednávání materiálu a tisku průmyslových štítků.",
  },
  {
    title: "Vývoj navazujících modulů",
    text: "Modul předvyplnění Výchozí revizní zprávy (VRZ dle ČSN 33 2000-6 ed. 2) a automatické cenové nabídky (materiál + práce).",
  },
];

export interface PitchConfig {
  /** „8 mil. Kč“ – prázdné = „podle domluvy na jednání“. */
  amount: string;
  /** Forma podpory („investice“, „grant“, „strategické partnerství“). */
  form: string;
  /** Partner / investor, pro kterého je prezentace připravená (prázdné = bez oslovení). */
  partner: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /** Podíl využití podpory v % pro body plánu 1–3 (prázdné = bez čísla). */
  funds: [string, string, string];
  /** Fáze 101: vlastní text bodů plánu 1–3 (prázdné = výchozí text `PITCH_PLAN`). */
  plan: [string, string, string];
}

export const DEFAULT_PITCH_CONFIG: PitchConfig = {
  amount: "",
  form: "",
  partner: "",
  contactName: "Pavel Janoušek",
  contactEmail: "info@eldock.cz",
  contactPhone: "",
  funds: ["", "", ""],
  plan: ["", "", ""],
};

const defaults = (): PitchConfig => ({ ...DEFAULT_PITCH_CONFIG, funds: [...DEFAULT_PITCH_CONFIG.funds], plan: [...DEFAULT_PITCH_CONFIG.plan] });

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : null);

/** Uložené údaje (localStorage) → platná konfigurace; cokoli neplatného nahradí výchozí hodnota. */
export function parsePitchConfig(raw: string | null | undefined): PitchConfig {
  if (!raw) return defaults();
  let value: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("tvar");
    value = parsed as Record<string, unknown>;
  } catch {
    return defaults();
  }
  const funds = Array.isArray(value.funds) ? value.funds : [];
  const plan = Array.isArray(value.plan) ? value.plan : [];
  return {
    amount: text(value.amount, 60) ?? DEFAULT_PITCH_CONFIG.amount,
    form: text(value.form, 60) ?? DEFAULT_PITCH_CONFIG.form,
    partner: text(value.partner, 80) ?? DEFAULT_PITCH_CONFIG.partner,
    contactName: text(value.contactName, 60) ?? DEFAULT_PITCH_CONFIG.contactName,
    contactEmail: text(value.contactEmail, 80) ?? DEFAULT_PITCH_CONFIG.contactEmail,
    contactPhone: text(value.contactPhone, 40) ?? DEFAULT_PITCH_CONFIG.contactPhone,
    funds: [0, 1, 2].map((index) => text(funds[index], 6) ?? "") as [string, string, string],
    plan: [0, 1, 2].map((index) => text(plan[index], 400) ?? "") as [string, string, string],
  };
}

/** Fáze 101: text bodu plánu – vlastní text prezentujícího, jinak výchozí. */
export const planText = (config: Pick<PitchConfig, "plan">, index: number) => config.plan[index]?.trim() || PITCH_PLAN[index].text;

/** Text částky na slidu a v One-Pageru. */
export const amountLabel = (config: Pick<PitchConfig, "amount">) => config.amount.trim() || "podle domluvy na jednání";

/** Podíl využití „45 %“ (prázdné = bez čísla). */
export function fundShare(value: string): string | null {
  const number = Number(value.replace(",", ".").replace("%", "").trim());
  return value.trim() && Number.isFinite(number) && number >= 0 && number <= 100 ? `${String(number).replace(".", ",")} %` : null;
}

/** Další / předchozí slide (bez přetečení). */
export const clampSlide = (index: number) => Math.min(PITCH_SLIDE_COUNT - 1, Math.max(0, Math.round(index)));

/** Klávesa → posun o slide (null = klávesa prezentaci nepatří). */
export function slideKey(key: string): "next" | "prev" | "first" | "last" | null {
  if (key === "ArrowRight" || key === "PageDown" || key === " " || key === "Spacebar") return "next";
  if (key === "ArrowLeft" || key === "PageUp") return "prev";
  if (key === "Home") return "first";
  if (key === "End") return "last";
  return null;
}

/** `#slide-4` → index 3 (neplatné = 0). */
export function slideFromHash(hash: string): number {
  const match = /^#slide-(\d{1,2})$/.exec(hash);
  return match ? clampSlide(Number(match[1]) - 1) : 0;
}

/** Odkazy živé ukázky z prezentace (otevírají se v nové kartě, po přihlášení firmy / účtu závodu). */
export const LIVE_DEMO = {
  floorplan: "/panel-builder/floorplan?demo=rd-4kk",
  clinic: "/panel-builder/floorplan?demo=ordinace",
  shop: "/panel-builder/floorplan?demo=oc-jednotka",
  panelBuilder: "/panel-builder",
  sampleElaborate: "/ukazka-elaboratu",
  plant: "/app",
} as const;
