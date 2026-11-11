// Fáze 96: obsah pěti veřejných SEO vstupních stránek (nadpisy H1–H3, sekce, srovnávací tabulky, FAQ, tlačítka).
// Jediný zdroj pro stránky, sitemap.xml, JSON-LD (FAQPage, BreadcrumbList) a patičku webu. Čistá data.

export type SeoLandingId = "ai-panel-builder" | "2d-pudorys-elektroinstalace" | "vypocet-otepleni-rozvadece" | "kusova-zkouska-rozvadece" | "prumyslova-udrzba-a-revize";

export interface SeoFaq {
  question: string;
  answer: string;
}

export interface SeoSection {
  /** H2 sekce. */
  title: string;
  intro?: string;
  /** H3 bloky sekce. */
  items: { title: string; text: string }[];
}

export interface SeoTable {
  title: string;
  head: string[];
  rows: string[][];
}

export interface SeoLanding {
  id: SeoLandingId;
  path: `/${SeoLandingId}`;
  /** Krátký název do patičky a drobečkové navigace. */
  label: string;
  h1: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  lead: string;
  cta: { label: string; href: string };
  secondary: { label: string; href: string };
  sections: SeoSection[];
  table: SeoTable;
  faq: SeoFaq[];
  related: SeoLandingId[];
}

export const SEO_LANDINGS: readonly SeoLanding[] = [
  {
    id: "ai-panel-builder",
    path: "/ai-panel-builder",
    label: "Návrh rozváděče online",
    h1: "Návrh rozváděče online a výrobní dokumentace dle ČSN EN IEC 61439",
    seoTitle: "Návrh rozváděče online – program na kreslení rozváděčů | ELDOCK AI Panel Builder",
    seoDescription:
      "Návrh rozváděče online z fotky nebo od nuly: schéma rozváděče, PE a N sběrnice, vyvážení fází, Elektro-linter dle ČSN 33 2130 ed. 4 a výrobní dokumentace dle ČSN EN IEC 61439 (6 listů PDF) na jeden klik.",
    keywords: ["návrh rozváděče online", "program na kreslení rozváděčů", "výrobní dokumentace rozváděče", "schéma rozváděče z fotky", "ČSN 33 2130 ed. 4", "ČSN EN IEC 61439"],
    lead:
      "AI Panel Builder pozná přístroje z fotky nebo videa hotového rozváděče, nebo vám pomůže navrhnout nový od nuly. Hlídá normy, vyváží fáze a vygeneruje kompletní výrobní dokumentaci – od výkresu osazení po EU prohlášení o shodě.",
    cta: { label: "⚡ Vyzkoušet AI Panel Builder zdarma", href: "/panel-builder/auth" },
    secondary: { label: "Prohlédnout ukázku 6listového elaborátu (PDF)", href: "/ukazka-elaboratu" },
    sections: [
      {
        title: "Dva způsoby, jak začít",
        intro: "Pasportizace stávajícího rozváděče i návrh nového vedou ke stejné dokumentaci.",
        items: [
          { title: "Pasportizace z fotky nebo videa", text: "Vyfotíte rozváděč, AI Vision rozpozná jističe, chrániče, svodiče a stykače i s typovým označením a sestaví lišty. Neznámé přístroje doplníte z katalogu jedním klikem." },
          { title: "Návrh od nuly nebo z půdorysu", text: "Zvolíte skříň a přístroje z katalogu výrobců, nebo rozváděč vygenerujete ze soupisu místností či z 2D půdorysu elektroinstalace podle ČSN 33 2130 ed. 4." },
          { title: "Rozváděč z BIM modelu", text: "Rozváděč importovaný z modelu IFC (Revit, ArchiCAD) dostane vývody ke strojům s jištěním podle příkonu a kabelem z BIMu." },
        ],
      },
      {
        title: "Co návrh hlídá za vás",
        items: [
          { title: "PE a N sběrnice automaticky", text: "Svorkovnice PE a N se doplní podle počtu vývodů a průřezů – nic nezapomenete do kusovníku." },
          { title: "Vyvážení fází L1 / L2 / L3", text: "Jednofázové okruhy se rozdělí na fáze podle soudobého příkonu, přehled ukáže proud v každé fázi." },
          { title: "Elektro-linter dle ČSN 33 2130 ed. 4", text: "Kontrola chráničů 30 mA pro zásuvky, jištění a průřezů, počtu zásuvek na okruh, typu chrániče a dalších pravidel s opravou jedním klikem." },
          { title: "Oteplení a krytí", text: "Výpočet oteplení dle IEC TR 60890 a protokol vnějších vlivů s doporučeným krytím IP pro prostředí instalace." },
        ],
      },
      {
        title: "Výrobní dokumentace na jeden klik",
        intro: "Šest listů A4 v jednom PDF s vaším logem a razítkem firmy:",
        items: [
          { title: "Výkres osazení a 1P schéma", text: "Čelní pohled s DIN lištami, označení přístrojů a jednopólové schéma s okruhy." },
          { title: "Kusovník s objednacími čísly", text: "Přístroje, skříň, příslušenství a EAN z dat výrobců, export do CSV / XLSX." },
          { title: "Oteplení, protokoly a štítek CE", text: "Výpočet oteplení, protokol o kusové zkoušce, EU prohlášení o shodě a výrobní štítek rozváděče." },
        ],
      },
    ],
    table: {
      title: "AI Panel Builder vs. kreslení v CAD a Excelu",
      head: ["", "Ruční kreslení (CAD + Excel)", "ELDOCK AI Panel Builder"],
      rows: [
        ["Pasport stávajícího rozváděče", "přepisování štítků přístrojů", "fotka → rozpoznané přístroje"],
        ["Kontrola norem", "ručně, podle zkušenosti", "Elektro-linter ČSN 33 2130 ed. 4"],
        ["Výpočet oteplení", "samostatná tabulka", "automaticky z Pv přístrojů a skříně"],
        ["Kusovník a objednací čísla", "ručně z katalogů", "z katalogu výrobců s EAN"],
        ["Prohlášení o shodě a štítek CE", "šablona ve Wordu", "vygeneruje se s dokumentací"],
      ],
    },
    faq: [
      { question: "Je návrh rozváděče online zdarma?", answer: "Registrace firmy je zdarma a obsahuje testovací kredity. Ukázku elaborátu a trenažér vyzkoušíte bez registrace." },
      { question: "Které výrobce přístrojů AI Panel Builder zná?", answer: "Katalog obsahuje přístroje ABB, Eaton, OEZ, Schneider Electric, Legrand, Hager a moduly chytré domácnosti Loxone a TapHome se ztrátovým výkonem pro výpočet oteplení." },
      { question: "Odpovídá dokumentace normě ČSN EN IEC 61439?", answer: "Ano – výkres osazení, schéma, kusovník, ověření oteplení, protokol o kusové zkoušce dle čl. 11 ČSN EN IEC 61439-1 ed. 3, EU prohlášení o shodě a výrobní štítek." },
      { question: "Zvládne AI rozpoznat rozváděč z fotky?", answer: "Ano, AI Vision rozpozná modulární přístroje na DIN lištách včetně typového označení; nejisté prvky označí k ověření a doplníte je z katalogu." },
      { question: "Mohu dokumentaci upravit a vytisknout s razítkem firmy?", answer: "Ano, po přihlášení firmy se do PDF doplní logo, razítko a údaje výrobce rozváděče." },
    ],
    related: ["vypocet-otepleni-rozvadece", "kusova-zkouska-rozvadece", "2d-pudorys-elektroinstalace"],
  },
  {
    id: "2d-pudorys-elektroinstalace",
    path: "/2d-pudorys-elektroinstalace",
    label: "Elektroinstalace v půdorysu",
    h1: "Návrh elektroinstalace v půdorysu a výkaz kabelů",
    seoTitle: "Návrh elektroinstalace v půdorysu – program na elektroinstalaci v domě | ELDOCK",
    seoDescription:
      "Program na elektroinstalaci v domě: nahrajte půdorys PDF / DXF / BIM .ifc nebo složte místnosti X × Y, rozmístěte zásuvky a vypínače, spočítejte délky kabelů a vygenerujte rozváděč na 1 klik. Chytrá domácnost ABB free@home, Loxone, TapHome.",
    keywords: ["návrh elektroinstalace v půdorysu", "program na elektroinstalaci v domě", "výpočet délky kabelů z půdorysu", "rozmístění zásuvek a vypínačů", "chytrá domácnost ABB free@home Loxone TapHome"],
    lead:
      "Nakreslete elektroinstalaci domu, bytu nebo provozovny přímo do půdorysu. ELDOCK sám natrasuje kabely po obvodu místností, spočítá metráž, hlídá koupelnové zóny i hloubku krabiček a z půdorysu vygeneruje rozváděč s jističi a chrániči.",
    cta: { label: "📐 Vyzkoušet 2D půdorys nanečisto", href: "/panel-builder/auth" },
    secondary: { label: "Video-návody s komentářem", href: "/navody" },
    sections: [
      {
        title: "Podklad během minuty",
        items: [
          { title: "Nahrání PDF, DXF nebo BIM (.ifc)", text: "Výkres DXF a model IFC se převezmou v měřítku 1 : 1 bez kalibrace – z BIMu rovnou s podlažími, místnostmi a elektro prvky. PDF nebo fotku zkalibrujete jednou kótou." },
          { title: "Místnosti zadané rozměrem X × Y", text: "Bez výkresu složíte dům z místností zadaných rozměrem, šikmé stěny nakreslíte polygonem." },
        ],
      },
      {
        title: "Kabeláž a normy automaticky",
        items: [
          { title: "Obvodové trasování kabelů dle ČSN", text: "Kabely vedou ve vodorovných a svislých instalačních zónách po obvodu místností; výkaz porovná vedení spodem, vrchem a optimalizovaně." },
          { title: "Koupelnové zóny ČSN 33 2000-7-701", text: "Zóny 0, 1 a 2 kolem vany, sprchy a umyvadla – prvek v nepovolené zóně editor hned označí." },
          { title: "Hlídání hloubky krabiček KOPOS", text: "Ke každému přístroji navrhne krabici (KU 68-45, KPR 68 …) podle vestavné hloubky z dat výrobce a konstrukce stěny." },
          { title: "Rozváděč z půdorysu na 1 klik", text: "Okruhy dle ČSN 33 2130 ed. 4, jističe, chrániče, fáze a skříň se vygenerují do AI Panel Builderu." },
        ],
      },
      {
        title: "Chytrá domácnost",
        items: [
          { title: "ABB-free@home, KNX, Loxone, TapHome", text: "Ovladače, aktory a čidla s výpočtem kanálů, sběrnice a napájení – kusovník i rozváděč podle zvoleného systému." },
          { title: "Designové řady vypínačů", text: "Řady ABB, Schneider, Legrand a Hager s fotkami a objednacími čísly krytů, rámečků a strojků v kusovníku." },
        ],
      },
    ],
    table: {
      title: "Co dostanete z půdorysu",
      head: ["Výstup", "Obsah"],
      rows: [
        ["Výkaz kabeláže", "délky kabelů po okruzích, úbytek napětí, typ kabelu"],
        ["Kusovník", "přístroje, kryty, rámečky, krabice KOPOS a kabely s objednacími čísly"],
        ["Rozváděč", "okruhy, jištění, chrániče, fáze a skříň v AI Panel Builderu"],
        ["Výkresy", "PDF a DXF půdorysu se značkami ČSN EN 60617"],
      ],
    },
    faq: [
      { question: "Jak spočítám délku kabelů z půdorysu?", answer: "Po osazení zásuvek, světel a rozváděče ELDOCK natrasuje kabely po obvodu místností v instalačních zónách a sečte metráž po okruzích včetně výšek přístrojů a rezervy." },
      { question: "Mohu nahrát výkres od architekta?", answer: "Ano – PDF, obrázek, DXF i BIM model IFC (IFC2x3 / IFC4). DXF a IFC jsou v měřítku 1 : 1 bez kalibrace." },
      { question: "Hlídá program koupelnové zóny?", answer: "Ano, podle ČSN 33 2000-7-701 vyznačí zóny kolem vany, sprchy a umyvadla a upozorní na nevhodný přístroj nebo krytí." },
      { question: "Podporuje chytrou domácnost?", answer: "Ano – ABB-free@home, ABB i-bus KNX, Loxone a TapHome včetně aktorů a čidel v rozváděči." },
      { question: "Funguje návrh i pro obchodní centra a ordinace?", answer: "Ano, režim objektu přepne kabely na bezhalogenové (BD4) nebo zdravotnické okruhy A / B dle ČSN 33 2000-7-710 ed. 2." },
    ],
    related: ["ai-panel-builder", "vypocet-otepleni-rozvadece", "prumyslova-udrzba-a-revize"],
  },
  {
    id: "vypocet-otepleni-rozvadece",
    path: "/vypocet-otepleni-rozvadece",
    label: "Výpočet oteplení rozváděče",
    h1: "Výpočet oteplení rozváděče dle ČSN EN IEC 61439 a IEC TR 60890",
    seoTitle: "Výpočet oteplení rozváděče – IEC TR 60890 kalkulačka online | ELDOCK",
    seoDescription:
      "Výpočet oteplení rozváděče dle IEC TR 60890 a ČSN EN IEC 61439: součet ztrátového výkonu přístrojů Pv, efektivní chladicí plocha skříně Ae, oteplení ve středu a nahoře skříně Δt0,5 a Δt1,0. Online kalkulačka a protokol do dokumentace.",
    keywords: ["výpočet oteplení rozváděče", "IEC TR 60890 kalkulačka", "tepelná bilance rozváděče", "ztrátový výkon přístrojů v rozváděči"],
    lead:
      "Ověření oteplení je povinnou součástí výrobní dokumentace rozváděče. ELDOCK sečte ztrátové výkony přístrojů z katalogu výrobců, spočítá chladicí plochu skříně a oteplení vzduchu uvnitř – a výsledek vloží do protokolu.",
    cta: { label: "🌡️ Otevřít kalkulačku oteplení v Panel Builderu", href: "/panel-builder/auth" },
    secondary: { label: "Ukázka protokolu v elaborátu", href: "/ukazka-elaboratu" },
    sections: [
      {
        title: "Metodika IEC TR 60890 krok za krokem",
        items: [
          { title: "1. Ztrátový výkon Pv", text: "Sečtou se ztráty všech přístrojů při jejich proudovém zatížení (jističe, chrániče, stykače, svorky a vodiče) – z katalogových údajů výrobců." },
          { title: "2. Efektivní chladicí plocha Ae", text: "Plocha stěn skříně se váží podle polohy (volná, u stěny, zapuštěná) – zakrytá plocha chladí méně." },
          { title: "3. Oteplení Δt0,5 a Δt1,0", text: "Z Pv, Ae a konstant skříně (k, d, c) vyjde oteplení vzduchu v polovině výšky a nahoře skříně; porovná se s přípustnou teplotou přístrojů." },
        ],
      },
      {
        title: "Proč výpočet oteplení vyžadují revizní technici a TIČR",
        items: [
          { title: "Ověření návrhu dle ČSN EN IEC 61439-1", text: "Výrobce rozváděče musí doložit, že teplota uvnitř nepřekročí meze přístrojů – výpočtem, porovnáním s referencí nebo zkouškou." },
          { title: "Prevence požárů a výpadků", text: "Přehřátý rozváděč zkracuje životnost přístrojů a vede k nechtěnému vybavení jističů." },
        ],
      },
    ],
    table: {
      title: "Vstupy a výstupy výpočtu",
      head: ["Veličina", "Význam", "Zdroj v ELDOCKu"],
      rows: [
        ["Pv [W]", "součet ztrátových výkonů přístrojů", "katalog výrobců (ABB ETIM 9.0, datasheety)"],
        ["Ae [m²]", "efektivní chladicí plocha skříně", "rozměry a montáž vybrané skříně"],
        ["Δt0,5 [K]", "oteplení vzduchu v polovině výšky", "výpočet IEC TR 60890"],
        ["Δt1,0 [K]", "oteplení vzduchu nahoře skříně", "výpočet IEC TR 60890"],
      ],
    },
    faq: [
      { question: "Kdy musím počítat oteplení rozváděče?", answer: "U každého rozváděče vyráběného dle ČSN EN IEC 61439 – výrobce doloží oteplení výpočtem, porovnáním s ověřeným vzorem nebo zkouškou." },
      { question: "Odkud vzít ztrátový výkon přístrojů?", answer: "Z katalogu výrobce (Pv při jmenovitém proudu); ELDOCK ho má u přístrojů ABB, Eaton, OEZ, Schneider a dalších a přepočte ho na skutečné zatížení." },
      { question: "Kdy stačí ověření oteplení výpočtem?", answer: "ČSN EN IEC 61439-1 (čl. 10.10.4) dovoluje ověření výpočtem dle IEC TR 60890 u rozváděčů do 1 600 A s rovnoměrně rozloženými ztrátami; jinak se oteplení ověřuje zkouškou nebo porovnáním s ověřeným vzorem." },
      { question: "Co když oteplení vyjde vysoké?", answer: "Kalkulačka navrhne větší skříň, ventilátor s filtrem nebo snížení zatížení; výsledek se propíše do dokumentace." },
    ],
    related: ["ai-panel-builder", "kusova-zkouska-rozvadece", "prumyslova-udrzba-a-revize"],
  },
  {
    id: "kusova-zkouska-rozvadece",
    path: "/kusova-zkouska-rozvadece",
    label: "Kusová zkouška a prohlášení o shodě",
    h1: "Protokol o kusové zkoušce rozváděče, EU prohlášení o shodě a výrobní štítek CE",
    seoTitle: "Protokol o kusové zkoušce rozváděče vzor, EU prohlášení o shodě a štítek CE | ELDOCK",
    seoDescription:
      "Vzor protokolu o kusové zkoušce rozváděče dle čl. 11 ČSN EN IEC 61439-1 ed. 3, EU prohlášení o shodě dle zákona č. 90/2016 Sb., výrobní štítek rozváděče CE a protokol o určení vnějších vlivů – vygenerované na jeden klik.",
    keywords: ["protokol o kusové zkoušce rozváděče vzor", "EU prohlášení o shodě rozváděč", "výrobní štítek rozváděče CE", "protokol o určení vnějších vlivů"],
    lead:
      "Každý vyrobený rozváděč potřebuje doložit shodu: kusovou zkoušku, prohlášení o shodě a štítek s parametry. ELDOCK tyto dokumenty vyplní z návrhu rozváděče – bez přepisování údajů.",
    cta: { label: "📄 Vygenerovat dokumentaci rozváděče", href: "/panel-builder/auth" },
    secondary: { label: "Ukázka hotového elaborátu", href: "/ukazka-elaboratu" },
    sections: [
      {
        title: "Co musí obsahovat dokumentace rozváděče",
        intro: "Podle zákona č. 90/2016 Sb. (posuzování shody) a ČSN EN IEC 61439-1 ed. 3:",
        items: [
          { title: "Protokol o kusové zkoušce (čl. 11)", text: "Krytí, izolační vzdálenosti, ochrana před úrazem a spojitost ochranného obvodu, zabudování přístrojů, vnitřní obvody, svorky, mechanická funkce, izolační pevnost a ověření zapojení." },
          { title: "EU prohlášení o shodě", text: "Identifikace výrobce a výrobku, směrnice 2014/35/EU (LVD, NV č. 118/2016 Sb.) a 2014/30/EU (EMC, NV č. 117/2016 Sb.), harmonizované normy a podpis odpovědné osoby." },
          { title: "Výrobní štítek rozváděče CE", text: "Výrobce, typ a výrobní číslo, jmenovité napětí a proud, krytí IP, soustava a označení normy." },
          { title: "Protokol o určení vnějších vlivů", text: "Prostředí instalace dle ČSN 33 2000-5-51 ed. 3 a z něj krytí a provedení rozváděče." },
        ],
      },
      {
        title: "Generování na jeden klik",
        items: [
          { title: "Z návrhu do PDF", text: "Údaje o přístrojích, skříni a výrobci rozváděče se převezmou z návrhu – vyplníte jen výsledky měření." },
          { title: "Logo a razítko firmy", text: "Dokumenty nesou údaje, logo a razítko vaší firmy a číslo oprávnění." },
        ],
      },
    ],
    table: {
      title: "Dokumenty rozváděče a jejich základ",
      head: ["Dokument", "Předpis", "V ELDOCKu"],
      rows: [
        ["Protokol o kusové zkoušce", "ČSN EN IEC 61439-1 ed. 3, čl. 11", "součást elaborátu (PDF)"],
        ["EU prohlášení o shodě", "zákon č. 90/2016 Sb., směrnice LVD / EMC", "součást elaborátu (PDF)"],
        ["Výrobní štítek CE", "ČSN EN IEC 61439-1 ed. 3, čl. 6.1", "tisk štítku k nalepení"],
        ["Protokol o vnějších vlivech", "ČSN 33 2000-5-51 ed. 3", "příloha dokumentace"],
      ],
    },
    faq: [
      { question: "Kdo podepisuje EU prohlášení o shodě rozváděče?", answer: "Výrobce rozváděče – firma, která ho sestavila a uvádí na trh, prostřednictvím odpovědné osoby." },
      { question: "Musí mít každý rozváděč protokol o kusové zkoušce?", answer: "Ano, kusová zkouška dle čl. 11 ČSN EN IEC 61439-1 ed. 3 se provádí u každého vyrobeného kusu před expedicí." },
      { question: "Jaké údaje patří na výrobní štítek?", answer: "Název výrobce, typové označení nebo výrobní číslo, datum výroby, odkaz na ČSN EN IEC 61439-2, jmenovité napětí, proud a krytí IP." },
      { question: "Je vzor protokolu ke stažení?", answer: "Ukázku celého elaborátu včetně protokolů si prohlédnete bez registrace; vlastní dokumenty vygenerujete po přihlášení firmy." },
    ],
    related: ["ai-panel-builder", "vypocet-otepleni-rozvadece", "prumyslova-udrzba-a-revize"],
  },
  {
    id: "prumyslova-udrzba-a-revize",
    path: "/prumyslova-udrzba-a-revize",
    label: "Průmyslová údržba a revize",
    h1: "Digitální dvojče závodu, QR diagnostika strojů a Nařízení EU 2023/1230",
    seoTitle: "Správa elektro dokumentace ve výrobě, revize strojů a EU 2023/1230 | ELDOCK",
    seoDescription:
      "Správa elektro dokumentace ve výrobě: digitální dvojče závodu z BIM (.ifc), elektronická červenka schémat, QR štítky na rozváděčích, Kniha revizí elektrických zařízení a strojů, zálohování PLC programů a hlídání podstatné změny stroje dle Nařízení EU 2023/1230.",
    keywords: ["správa elektro dokumentace ve výrobě", "revize elektrických zařízení a strojů", "elektronická červenka schémat", "zálohování PLC programů", "podstatná změna stroje EU 2023/1230"],
    lead:
      "Pro vedoucí údržby, energetiky nemocnic a správce obchodních center: celá elektrodokumentace areálu na jednom místě, u každého stroje dostupná přes QR kód, s hlídáním revizí a změn.",
    cta: { label: "🏭 Vyzkoušet ukázkový závod", href: "/register-plant" },
    secondary: { label: "Řešení pro průmysl", href: "/prumysl" },
    sections: [
      {
        title: "Digitální dvojče areálu",
        items: [
          { title: "Import BIM modelu (.ifc)", text: "Budovy, podlaží, místnosti, trafostanice, rozváděče, kabelové trasy i stroje se převezmou z modelu IFC v přesných souřadnicích." },
          { title: "3 úrovně zálohování napájení", text: "Síť, dieselagregát (DA, ATS do 15 s) a UPS / ZIS – filtr na mapě ukáže zálohované větve, součet výkonu a rezervu zdroje." },
          { title: "QR štítky na rozváděčích", text: "Naskenujete štítek a máte platné schéma, kusovník, revize a historii změn do tří vteřin." },
        ],
      },
      {
        title: "Změny, revize a zálohy",
        items: [
          { title: "Elektronická červenka", text: "Zákres změny prstem do schématu s fotkou a hlasovou poznámkou, zpracování projektantem a schválení vedoucím údržby." },
          { title: "Kniha revizí", text: "Lhůty revizí VTZ dle NV 190/2022 Sb., spotřebičů dle ČSN 33 1600 ed. 2, zdravotnických přístrojů a nouzového osvětlení s upozorněním." },
          { title: "Zálohování PLC programů", text: "Verze programů PLC a HMI u stroje s historií a kontrolou, kdo a kdy zálohu nahrál." },
          { title: "Podstatná změna stroje (EU 2023/1230)", text: "Hodnocení změny stroje podle Nařízení o strojních zařízeních s doporučením, zda je potřeba nové posouzení shody." },
        ],
      },
    ],
    table: {
      title: "Pro koho je správa závodů",
      head: ["Role", "Hlavní přínos"],
      rows: [
        ["Vedoucí údržby", "platná dokumentace u stroje, řízené změny, auditní stopa"],
        ["Energetik nemocnice", "zálohované větve DA / UPS, zdravotnické prostory a přístroje v Knize revizí"],
        ["Správce obchodního centra", "nájemní jednotky, CENTRAL STOP, nouzové osvětlení a revize VTZ"],
        ["Revizní technik", "podklady revizí, měření a protokoly na jednom místě"],
      ],
    },
    faq: [
      { question: "Co je digitální dvojče závodu?", answer: "Živá kopie areálu v aplikaci – budovy, rozváděče, stroje a jejich napájení s aktuální dokumentací, revizemi a změnami." },
      { question: "Umí ELDOCK načíst BIM model?", answer: "Ano, soubory IFC2x3 a IFC4 z Revitu i ArchiCADu – stavbu, místnosti i elektro prvky s parametry a napájením." },
      { question: "Jak hlídá revize elektrických zařízení a strojů?", answer: "Kniha revizí počítá lhůty podle předpisů a typu zařízení, upozorní e-mailem a uchová protokoly a závady." },
      { question: "Co je podstatná změna stroje podle EU 2023/1230?", answer: "Úprava stroje, která mění jeho bezpečnostní funkce nebo rizika; ELDOCK u změny vede hodnocení a dokumentaci rozhodnutí." },
      { question: "Funguje aplikace i offline v hale?", answer: "Ano, aplikace Eldock pro Windows a Android pracuje offline a synchronizuje se se serverem závodu nebo s eldock.cz." },
    ],
    related: ["ai-panel-builder", "2d-pudorys-elektroinstalace", "vypocet-otepleni-rozvadece"],
  },
];

export const seoLanding = (id: SeoLandingId): SeoLanding => SEO_LANDINGS.find((landing) => landing.id === id)!;
