// Generuje `npm run catalog:public` z abb-etim.generated.ts a brand-etim.generated.ts (fáze 104) – needitujte ručně.
// Veřejná část katalogových dat pro výpočty v prohlížeči: bez EAN / GTIN, ceníkových cen a celých importů ETIM.
import type { EtimFrameLimit } from "./brand-etim.generated";
import type { PublicBoxData, PublicDeviceDepth } from "./catalog-public";

export const KOPOS_DATA_SOURCE = "KOPOS KOLÍN – e-shop kopos.cz (stránka výrobku) a ceník XLSX od 1. 8. 2026";

export const DEVICE_DEPTHS: Record<string, PublicDeviceDepth> = {
  "ABB|Busch-axcent|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Busch-axcent|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Busch-axcent|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Busch-axcent|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Classic|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Classic|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Classic|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Classic|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Decento|blind": {
    "mpn": "3559K-C88345",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Decento|button": {
    "mpn": "3559K-C86345",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Decento|data-socket": {
    "mpn": "5014K-C01018",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Decento|double-socket": {
    "mpn": "6619K-C06347",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Decento|socket": {
    "mpn": "6619K-C06347",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Decento|switch-1": {
    "mpn": "3559K-C06345",
    "depthMm": 26.2,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Decento|switch-6": {
    "mpn": "3559K-C06345",
    "depthMm": 26.2,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Decento|switch-7": {
    "mpn": "3559K-C07345",
    "depthMm": 26.2,
    "source": "ABB ETIM 9.0"
  },
  "ABB|future linear|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|future linear|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|future linear|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|future linear|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit M|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit M|double-socket": {
    "mpn": "5513H-C02357 63",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit M|socket": {
    "mpn": "6619H-A06357 63",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit M|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit M|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit M|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit|double-socket": {
    "mpn": "5513H-C02357 01",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit|socket": {
    "mpn": "6619H-A06357 01",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Levit|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|solo carat|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|solo carat|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|solo carat|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|solo carat|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|solo|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|solo|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|solo|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|solo|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Swing L|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Swing L|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Swing L|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Swing L|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Swing|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Swing|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Swing|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Swing|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Tango|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Tango|double-socket": {
    "mpn": "5513A-C02357 B",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Tango|socket": {
    "mpn": "6619A-A06357 B",
    "depthMm": 40,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Tango|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Tango|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Tango|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Time Arbo|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Time Arbo|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Time Arbo|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Time Arbo|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Time|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Time|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Time|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Time|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Zoni|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Zoni|socket": {
    "mpn": "6619T-A06657 500",
    "depthMm": 24.6,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Zoni|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Zoni|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "ABB|Zoni|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17,
    "source": "ABB ETIM 9.0"
  },
  "Hager|berker S.1 / B.3 / Q.1 / Q.3|socket": {
    "mpn": "47088989",
    "depthMm": 40,
    "source": "Hager ETIM 10"
  },
  "Hager|lumina|socket": {
    "mpn": "WL1450",
    "depthMm": 35,
    "source": "Hager ETIM 10"
  },
  "Hager|lumina|switch-1": {
    "mpn": "WL0012",
    "depthMm": 35,
    "source": "Hager ETIM 10"
  },
  "Hager|lumina|switch-6": {
    "mpn": "WL0023",
    "depthMm": 35,
    "source": "Hager ETIM 10"
  }
};

export const FRAME_LIMITS: Record<string, EtimFrameLimit> = {
  "Hager|berker S.1 / B.3 / Q.1 / Q.3": {
    "maxFrameGang": 5,
    "etimGangs": 5,
    "mpn": "5310158982",
    "frames": 78,
    "source": "Hager ETIM 10 – rámeček 5R 5310158982"
  },
  "Hager|lumina": {
    "maxFrameGang": 5,
    "etimGangs": 5,
    "mpn": "WL5150",
    "frames": 84,
    "source": "Hager ETIM 10 – rámeček 5R WL5150"
  }
};

export const KOPOS_BOXES: Record<string, PublicBoxData> = {
  "KEZ_KB": {
    "depthMm": 200,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PP",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kez_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2348-krabice-elektroinstalacni-do-zatepleni"
  },
  "KEZ-3_KB": {
    "depthMm": 250,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PP",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kez3_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2882-krabice-elektroinstalacni-vicenasobna-do-zatepleni"
  },
  "KP 64/2_KA": {
    "depthMm": 45,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kp64_2_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/1188-krabice-pristrojova"
  },
  "KP 64/3_KA": {
    "depthMm": 45,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/kp64_3_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/1189-krabice-pristrojova"
  },
  "KP 64/4_KA": {
    "depthMm": 45,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kp64_4_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/1743-krabice-pristrojova"
  },
  "KP 64/5_KA": {
    "depthMm": 45,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kp64_5_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2346-krabice-pristrojova"
  },
  "KPL 64-45/LD_NA": {
    "depthMm": 45,
    "diameterMm": 68,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kpl6445ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/9395-krabice-pristrojova"
  },
  "KPL 64-50/2LD HF_KA": {
    "depthMm": 50,
    "diameterMm": null,
    "halogenFree": true,
    "material": "PP",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kpl64502ldhf_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/13519-krabice-pristrojova-bezhalogenova"
  },
  "KPL 64-50/2LD_NA": {
    "depthMm": 50,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kpl64502ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/3073-krabice-pristrojova"
  },
  "KPL 64-50/3LD_NA": {
    "depthMm": 50,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kpl64503ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/3081-krabice-pristrojova"
  },
  "KPL 64-50/4LD_NA": {
    "depthMm": 50,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/kpl64504ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/10103-krabice-pristrojova"
  },
  "KPL 64-50/5LD_NA": {
    "depthMm": 50,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kpl64505ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/11719-krabice-pristrojova"
  },
  "KPR 68_KA": {
    "depthMm": 66,
    "diameterMm": 73,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/kpr68_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/1677-krabice-pristrojova"
  },
  "KPR 68-70_KA": {
    "depthMm": 70,
    "diameterMm": 71,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kpr68-70_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/12903-krabice-pristrojova"
  },
  "KPR 68-70/HF_HA": {
    "depthMm": 70,
    "diameterMm": 71,
    "halogenFree": true,
    "material": "PC-ABS",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/kpr68-70hf_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/12906-krabice-pristrojova-bezhalogenova"
  },
  "KPR 68/71L_NA": {
    "depthMm": 70,
    "diameterMm": 73,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/kpr6871l_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2351-krabice-pristrojova"
  },
  "KPRL 68-70/LD_NA": {
    "depthMm": 70,
    "diameterMm": 73,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/kprl6870ld_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/3048-krabice-pristrojova"
  },
  "KU 68 LD/1HF_HA": {
    "depthMm": 45,
    "diameterMm": 73,
    "halogenFree": true,
    "material": "PP",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/06/ku68ld1hf_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2885-krabice-univerzalni-bezhalogenova"
  },
  "KU 68-45_KA": {
    "depthMm": 45,
    "diameterMm": 71,
    "halogenFree": false,
    "material": "PVC",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/ku68-45_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/12902-krabice-univerzalni"
  },
  "KU 68-45/HF_HA": {
    "depthMm": 45,
    "diameterMm": 71,
    "halogenFree": true,
    "material": "PC-ABS",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/ku68-45hf_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/12905-krabice-univerzalni-bezhalogenova"
  },
  "MDZ_KB": {
    "depthMm": 200,
    "diameterMm": null,
    "halogenFree": false,
    "material": "PP",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/mdz_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/2349-montazni-deska-do-zatepleni"
  },
  "SB-KP 68-50/M_AB": {
    "depthMm": 50,
    "diameterMm": 68,
    "halogenFree": true,
    "material": "PP+TPE",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/sbkp_6850m_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/13779-krabice-pristrojova-beton-magnet-fix"
  },
  "SB-KP 68-70/M_AB": {
    "depthMm": 70,
    "diameterMm": 68,
    "halogenFree": true,
    "material": "PP+TPE",
    "datasheet": "https://www.kopos.cz/sites/default/files/product_attachments/2026/08/sbkp_6870m_cz.pdf",
    "page": "https://www.kopos.cz/cs/produkt/13787-krabice-pristrojova-beton-magnet-fix"
  }
};
