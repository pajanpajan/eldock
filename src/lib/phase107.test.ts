import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

import { CONTACT_CATEGORIES, CONTACT_FILTERS, IMAGE_CATEGORIES, QUICK_ACTIONS, categoriesOf, contactSchema, contextFromPath, detailRows, notificationSubject, notificationText, projectHref, sameSitePath, ticketLabel } from "./contact";
import { UPLOAD_KINDS, resolveUploadPath } from "./files";
import { PRIVACY_SECTIONS, PRIVACY_VERSION } from "./legal";
import { RATE_LIMITS, createRateLimiter, rateBucketOf } from "./request-guard";
import { PUBLIC_PAGES } from "./seo";
import { footerSections, siteNav } from "./site-map";

// Fáze 107: kontaktní a zpětnovazební hub – kategorie, schéma zprávy, diagnostika z adresy, číslo tiketu, notifikace,
// veřejná stránka /kontakt (bez přihlášení, sitemap, navigace) a limit odesílání.

const DIAG = { currentUrl: "https://eldock.cz/panel-builder/cm1abc2def3/thermal", module: "panel-builder", wizardPhase: "3. Výpočet oteplení IEC 60890", projectId: "cm1abc2def3", viewportSize: "1440×900", userAgent: "Mozilla/5.0 Test" };

describe("fáze 107 – kontaktní a zpětnovazební hub", () => {
  it("7 kategorií s dlaždicí, 4 rychlé akce plovoucího tlačítka a filtry velínu pokrývají všechny kategorie", () => {
    expect(CONTACT_CATEGORIES.map((category) => category.id)).toEqual(["BUG", "IDEA", "MEETING", "PARTNER", "B2B", "QR", "ADVICE"]);
    expect(QUICK_ACTIONS.map((id) => CONTACT_CATEGORIES.find((category) => category.id === id)!.short)).toEqual(["🐛 Nahlásit chybu (+ Printscreen)", "💡 Tip na zlepšení / Chybí prvek", "📅 Sjednat osobní schůzku / Demo", "🤝 Spolupráce & B2B poptávka"]);
    expect(CONTACT_FILTERS.map((filter) => filter.label)).toEqual(["Vše", "🐛 Chyby", "💡 Tipy na zlepšení", "📅 Schůzky & B2B", "🤝 Spolupráce", "🏷️ QR Štítky"]);
    const filtered = CONTACT_FILTERS.filter((filter) => filter.id !== "all").flatMap((filter) => categoriesOf(filter.id));
    expect(new Set(filtered)).toEqual(new Set(categoriesOf("all")));
    expect(categoriesOf("meetings")).toEqual(["MEETING", "B2B"]);
    expect(IMAGE_CATEGORIES).toEqual(["BUG", "IDEA", "ADVICE"]);
  });

  it("schéma zprávy: minimum polí každé kategorie projde, chyba bez popisu a schůzka bez kontaktu ne", () => {
    const valid = [
      { category: "BUG", message: "Tlačítko Vygenerovat nereaguje", diagnostics: DIAG },
      { category: "IDEA", subtype: "catalog", message: "Chybí Hager gallery", details: { mpn: "WXF001" } },
      { category: "MEETING", subtype: "regional", name: "Jan Novák", phone: "+420 777 123 456", message: "úterý dopoledne" },
      { category: "PARTNER", subtype: "manufacturer", company: "Rozváděče s.r.o.", ico: "27074358", email: "obchod@rozvadece.example" },
      { category: "B2B", company: "Krajská nemocnice", name: "Ing. Svoboda", email: "udrzba@nemocnice.example", details: { tags: ["hospital", "book"] } },
      { category: "QR", subtype: "series", company: "Elektro Plus", email: "info@elektro.example", details: { qrSizes: ["Rozváděče 50 × 25 mm"], quantity: "500" } },
      { category: "ADVICE", message: "Potřebuje koupelna vlastní chránič?", email: "jan@firma.example", diagnostics: DIAG },
    ];
    for (const input of valid) expect(contactSchema.safeParse(input).success, input.category).toBe(true);
    expect(contactSchema.safeParse({ category: "BUG", message: "x" }).error?.issues[0]?.message).toContain("Popište");
    expect(contactSchema.safeParse({ category: "MEETING", name: "Jan" }).error?.issues[0]?.message).toContain("e-mail nebo telefon");
    expect(contactSchema.safeParse({ category: "PARTNER", email: "a@b.cz" }).error?.issues[0]?.message).toContain("jméno nebo firmu");
    expect(contactSchema.safeParse({ category: "QR", name: "Jan", email: "neplatny" }).success).toBe(false);
    expect(contactSchema.safeParse({ category: "B2B", name: "Jan", email: "a@b.cz", ico: "123" }).error?.issues[0]?.message).toBe("IČO má 8 číslic.");
    expect(contactSchema.safeParse({ category: "SPAM", message: "xxxxx" }).success).toBe(false);
    // Past na roboty: skryté pole projde schématem – vyplněné API přijme jako úspěch, ale nic neuloží (test služby)
    expect(contactSchema.safeParse({ category: "BUG", message: "Popis chyby", website: "" }).success).toBe(true);
  });

  it("číslo tiketu #EL-1042, předmět a text notifikace s kontaktem, podrobnostmi a odkazem do velínu", () => {
    expect(ticketLabel(1042)).toBe("#EL-1042");
    expect(notificationSubject({ category: "PARTNER", name: "Jan", company: "Rozváděče s.r.o." }, 1042)).toBe("#EL-1042 🤝 Zájem o spolupráci (Partnerství) – Rozváděče s.r.o.");
    const text = notificationText(
      { ticket: 1043, category: "QR", subtype: "series", name: "Jan Novák", company: "Elektro Plus", ico: "27074358", email: "info@elektro.example", phone: "+420 777 123 456", message: "Prosíme nabídku", details: { qrSizes: ["Rozváděče 50 × 25 mm", "Stroje 70 × 40 mm"], quantity: "500" }, diagnostics: DIAG, attachments: 2 },
      "https://eldock.cz/superadmin?tab=zpravy#EL-1043",
    );
    expect(text).toContain("#EL-1043 · 🏷️ Objednávka / Vzorky odolných QR štítků ELDOCK · 📦 Poptávám tisk série QR štítků pro naši firmu");
    expect(text).toContain("Velikosti štítků: Rozváděče 50 × 25 mm, Stroje 70 × 40 mm");
    expect(text).toContain("Firma: Elektro Plus (IČO 27074358)");
    expect(text).toContain("Modul: ⚡ AI Panel Builder (rozváděč) · 3. Výpočet oteplení IEC 60890");
    expect(text).toContain("Printscreeny: 2");
    expect(text.endsWith("Velín: https://eldock.cz/superadmin?tab=zpravy#EL-1043")).toBe(true);
    expect(detailRows({ tags: ["hospital", "bim"], empty: "" })).toEqual([{ label: "Zájem", value: "🏥 Nemocnice / Klinika, 🏢 Převod BIM (.ifc) modelu" }]);
  });

  it("diagnostika z adresy: krok rozváděče, 2D půdorys, katalog a veřejný web; odkaz na projekt jen v rámci webu", () => {
    expect(contextFromPath("/panel-builder/cm1abc2def3/thermal")).toEqual({ module: "panel-builder", projectId: "cm1abc2def3", wizardPhase: "3. Výpočet oteplení IEC 60890" });
    expect(contextFromPath("/panel-builder/cm1abc2def3")).toEqual({ module: "panel-builder", projectId: "cm1abc2def3", wizardPhase: "1a. Osazení DIN lišt" });
    expect(contextFromPath("/panel-builder/cm1abc2def3/documentation")).toMatchObject({ wizardPhase: "4a. Dokumentace a kusovník (PDF)" });
    expect(contextFromPath("/panel-builder/floorplan/fp123456")).toEqual({ module: "floorplan", projectId: "fp123456" });
    expect(contextFromPath("/panel-builder/floorplan")).toEqual({ module: "floorplan", projectId: undefined });
    expect(contextFromPath("/panel-builder/catalog")).toEqual({ module: "catalog" });
    expect(contextFromPath("/panel-builder/credits")).toEqual({ module: "panel-builder" });
    expect(contextFromPath("/kontakt")).toEqual({ module: "public" });
    expect(projectHref({ module: "panel-builder", projectId: "cm1abc2def3" })).toBe("/panel-builder/cm1abc2def3");
    expect(projectHref({ module: "floorplan", projectId: "fp123456" })).toBe("/panel-builder/floorplan/fp123456");
    expect(projectHref({ module: "panel-builder", projectId: "../../etc" })).toBeNull();
    expect(sameSitePath("https://eldock.cz/panel-builder/x/thermal?krok=2")).toBe("/panel-builder/x/thermal?krok=2");
    expect(sameSitePath("https://zly-web.example/phish?x=1")).toBe("/phish?x=1");
    expect(sameSitePath(undefined)).toBeNull();
  });

  it("/kontakt bez přihlášení (i pro roboty vyhledávačů), v sitemap, navigaci a patičce; POST /api/contact s vlastním limitem", async () => {
    for (const pathname of ["/kontakt", "/kontakt?kategorie=MEETING", "/api/contact"]) {
      const response = await proxy(new NextRequest(`https://eldock.cz${pathname}`, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }));
      expect(response.status, pathname).toBe(200);
      expect(response.headers.get("location"), pathname).toBeNull();
    }
    expect(PUBLIC_PAGES.map((page) => page.path)).toContain("/kontakt");
    expect(siteNav({ showcase: true }).at(-1)).toEqual({ href: "/kontakt", label: "Kontakt & Spolupráce" });
    expect(footerSections({ showcase: false }).flatMap((section) => section.links)).toContainEqual({ href: "/kontakt", label: "Kontakt & Spolupráce" });
    expect(rateBucketOf({ pathname: "/api/contact", method: "POST", action: false })).toBe("contact");
    expect(rateBucketOf({ pathname: "/api/contact", method: "GET", action: false })).toBeNull();
    const limiter = createRateLimiter();
    const now = 1_000_000;
    for (let index = 0; index < RATE_LIMITS.contact.limit; index++) expect(limiter.hit("contact", "1.2.3.4", now)).toBeNull();
    expect(limiter.hit("contact", "1.2.3.4", now)).toBeGreaterThan(0);
  });

  it("printscreeny ve složce feedback (zálohuje se, čte přes /api/files) a zásady 1.5 s částí 7c", () => {
    expect(UPLOAD_KINDS).toContain("feedback");
    expect(resolveUploadPath("/srv/storage/uploads", ["feedback", "0b7c1a1e-1111-4222-8333-944455556666.webp"])).not.toBeNull();
    expect(resolveUploadPath("/srv/storage/uploads", ["feedback", "..", "x.webp"])).toBeNull();
    expect(PRIVACY_VERSION).toMatch(/^1\.5/);
    const section = PRIVACY_SECTIONS.find((item) => item.id === "kontaktni-formular");
    expect(section?.title).toBe("7c. Kontaktní formulář a hlášení chyb");
    const text = PRIVACY_SECTIONS.map((item) => [...item.paragraphs, ...(item.list ?? [])].join(" ")).join(" ");
    for (const phrase of ["printscreeny nebo fotky", "technická diagnostika", "2 roky od vyřízení", "bez metadat"]) expect(text).toContain(phrase);
  });
});
