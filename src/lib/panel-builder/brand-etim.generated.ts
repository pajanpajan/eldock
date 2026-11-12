// Generuje `node scripts/parse-etim-packages.mjs` z dat výrobců v data/etim/downloads (fáze 97) – needitujte ručně.
// Vestavné hloubky přístrojů řad Hager (ETIM 10: EF012278 / EF000218), nejvyšší vícenásobný rámeček řady podle ETIM
// (EF000074) a instalační krabice KOPOS ze stránek výrobků e-shopu kopos.cz a ceníku XLSX (EAN, hloubka, průměr,
// bezhalogenovost, technický list, ceníková cena bez DPH za kus).
// Fáze 104: celý import dat výrobců jen na serveru (do klientského bundlu nesmí – viz src/server/catalog-data.ts)
import "server-only";

export interface BrandDeviceDepth {
  mpn: string;
  depthMm: number;
  /** Zdroj údaje („Hager ETIM 10“). */
  source: string;
}

export interface EtimFrameLimit {
  /** Nejvyšší rámeček řady pro editor (nejvýš 5 pozic). */
  maxFrameGang: number;
  /** Nejvyšší počet násobků rámečku v datech výrobce. */
  etimGangs: number;
  mpn: string;
  /** Počet rámečků řady v datech ETIM. */
  frames: number;
  source: string;
}

export interface KoposBoxData {
  ean: string | null;
  depthMm: number | null;
  diameterMm: number | null;
  halogenFree: boolean;
  material: string | null;
  datasheet: string | null;
  page: string | null;
  /** Ceníková cena bez DPH za kus (ceník KOPOS od 1. 8. 2026). */
  priceCzk: number | null;
}

export const KOPOS_DATA_SOURCE = "KOPOS KOLÍN – e-shop kopos.cz (stránka výrobku) a ceník XLSX od 1. 8. 2026";

/** Vestavná hloubka přístroje řady („Hager|lumina|socket“) – nejhlubší díl podle dat výrobce. */
export const BRAND_DEVICE_DEPTHS: Record<string, BrandDeviceDepth> = {
  "Hager|lumina|switch-1": {
    "mpn": "WL0012",
    "depthMm": 35,
    "source": "Hager ETIM 10"
  },
  "Hager|lumina|switch-6": {
    "mpn": "WL0023",
    "depthMm": 35,
    "source": "Hager ETIM 10"
  },
  "Hager|lumina|socket": {
    "mpn": "WL1450",
    "depthMm": 35,
    "source": "Hager ETIM 10"
  },
  "Hager|berker S.1 / B.3 / Q.1 / Q.3|socket": {
    "mpn": "47088989",
    "depthMm": 40,
    "source": "Hager ETIM 10"
  }
};

/** Nejvyšší vícenásobný rámeček řady podle dat ETIM výrobce („Hager|lumina“). */
export const ETIM_FRAME_LIMITS: Record<string, EtimFrameLimit> = {
  "Hager|lumina": {
    "maxFrameGang": 5,
    "etimGangs": 5,
    "mpn": "WL5150",
    "frames": 84,
    "source": "Hager ETIM 10 – rámeček 5R WL5150"
  },
  "Hager|berker S.1 / B.3 / Q.1 / Q.3": {
    "maxFrameGang": 5,
    "etimGangs": 5,
    "mpn": "5310158982",
    "frames": 78,
    "source": "Hager ETIM 10 – rámeček 5R 5310158982"
  }
};

/** Krabice KOPOS podle objednacího kódu katalogu krabic („KU 68-45_KA“). */
export const KOPOS_BOX_DATA: Record<string, KoposBoxData> = {
  "KEZ_KB": {
    "ean": "8595057698499",
    "depthMm": 200,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PP",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kez_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2348-krabice-elektroinstalacni-do-zatepleni",
    "priceCzk": 534.26
  },
  "KEZ-3_KB": {
    "ean": "8595568910561",
    "depthMm": 250,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PP",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kez3_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2882-krabice-elektroinstalacni-vicenasobna-do-zatepleni",
    "priceCzk": 659.46
  },
  "KP 64/2_KA": {
    "ean": "8595057632707",
    "depthMm": 45,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kp64_2_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/1188-krabice-pristrojova",
    "priceCzk": 72.64
  },
  "KP 64/3_KA": {
    "ean": "8595057632714",
    "depthMm": 45,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/kp64_3_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/1189-krabice-pristrojova",
    "priceCzk": 107.82
  },
  "KP 64/4_KA": {
    "ean": "8595057632721",
    "depthMm": 45,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kp64_4_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/1743-krabice-pristrojova",
    "priceCzk": 125.17
  },
  "KP 64/5_KA": {
    "ean": "8595057657212",
    "depthMm": 45,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kp64_5_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2346-krabice-pristrojova",
    "priceCzk": 132.89
  },
  "KPL 64-45/LD_NA": {
    "ean": "8595568930835",
    "depthMm": 45,
    "diameterMm": 68,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kpl6445ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/9395-krabice-pristrojova",
    "priceCzk": 41.95
  },
  "KPL 64-50/2LD HF_KA": {
    "ean": "8595568937650",
    "depthMm": 50,
    "diameterMm": null,
    "halogenFree": true,
    "material": "PP",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kpl64502ldhf_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/13519-krabice-pristrojova-bezhalogenova",
    "priceCzk": 95.52
  },
  "KPL 64-50/2LD_NA": {
    "ean": "8595568926968",
    "depthMm": 50,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kpl64502ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/3073-krabice-pristrojova",
    "priceCzk": 84.05
  },
  "KPL 64-50/3LD_NA": {
    "ean": "8595568927705",
    "depthMm": 50,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kpl64503ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/3081-krabice-pristrojova",
    "priceCzk": 121.12
  },
  "KPL 64-50/4LD_NA": {
    "ean": "8595568931948",
    "depthMm": 50,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kpl64504ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/10103-krabice-pristrojova",
    "priceCzk": 155.86
  },
  "KPL 64-50/5LD_NA": {
    "ean": "8595568934246",
    "depthMm": 50,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kpl64505ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/11719-krabice-pristrojova",
    "priceCzk": 194.37
  },
  "KPR 68_KA": {
    "ean": "8595057648302",
    "depthMm": 66,
    "diameterMm": 73,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/kpr68_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/1677-krabice-pristrojova",
    "priceCzk": 36.88
  },
  "KPR 68-70_KA": {
    "ean": "8595568936240",
    "depthMm": 70,
    "diameterMm": 71,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kpr68-70_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/12903-krabice-pristrojova",
    "priceCzk": 34.78
  },
  "KPR 68-70/HF_HA": {
    "ean": "8595568936424",
    "depthMm": 70,
    "diameterMm": 71,
    "halogenFree": true,
    "material": "PC-ABS",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/kpr68-70hf_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/12906-krabice-pristrojova-bezhalogenova",
    "priceCzk": 48.41
  },
  "KPR 68/71L_NA": {
    "ean": "8595057687929",
    "depthMm": 70,
    "diameterMm": 73,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/kpr6871l_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2351-krabice-pristrojova",
    "priceCzk": 93.49
  },
  "KPRL 68-70/LD_NA": {
    "ean": "8595568925879",
    "depthMm": 70,
    "diameterMm": 73,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kprl6870ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/3048-krabice-pristrojova",
    "priceCzk": 101.7
  },
  "KU 68 LD/1HF_HA": {
    "ean": "8595568910585",
    "depthMm": 45,
    "diameterMm": 73,
    "halogenFree": true,
    "material": "PP",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/ku68ld1hf_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2885-krabice-univerzalni-bezhalogenova",
    "priceCzk": 46.38
  },
  "KU 68-45_KA": {
    "ean": "8595568936233",
    "depthMm": 45,
    "diameterMm": 71,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/ku68-45_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/12902-krabice-univerzalni",
    "priceCzk": 9.38
  },
  "KU 68-45/HF_HA": {
    "ean": "8595568936417",
    "depthMm": 45,
    "diameterMm": 71,
    "halogenFree": true,
    "material": "PC-ABS",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/ku68-45hf_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/12905-krabice-univerzalni-bezhalogenova",
    "priceCzk": 21.94
  },
  "MDZ_KB": {
    "ean": "8595057698505",
    "depthMm": 200,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PP",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/mdz_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2349-montazni-deska-do-zatepleni",
    "priceCzk": 534.26
  },
  "SB-KP 68-50/M_AB": {
    "ean": "8595568938640",
    "depthMm": 50,
    "diameterMm": 68,
    "halogenFree": true,
    "material": "PP+TPE",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/sbkp_6850m_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/13779-krabice-pristrojova-beton-magnet-fix",
    "priceCzk": 78.32
  },
  "SB-KP 68-70/M_AB": {
    "ean": "8595568938657",
    "depthMm": 70,
    "diameterMm": 68,
    "halogenFree": true,
    "material": "PP+TPE",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/sbkp_6870m_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/13787-krabice-pristrojova-beton-magnet-fix",
    "priceCzk": 91.56
  }
};
