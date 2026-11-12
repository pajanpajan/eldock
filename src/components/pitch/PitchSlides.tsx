import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";

import { LogoMark } from "@/components/layout/Logo";
import { WIZARD_STEPS } from "@/lib/panel-builder/floorplan-wizard";
import { LIVE_DEMO, PITCH_PLAN, PITCH_SLIDE_COUNT, amountLabel, fundShare, planText, type PitchConfig } from "@/lib/pitch";
import type { PitchLiveData } from "@/lib/pitch-live";
import { cn } from "@/lib/utils";

// Fáze 101: 8 věcných inženýrských slidů prezentace ELDOCK a jednostránkový One-Pager A4 – texty podle zadání fáze 101,
// každé tvrzení ověřené v kódu aplikace; živá data (kusovník vzorového RD 4+kk, převod vzorového BIM modelu haly, listy
// PDF elaborátu, úrovně napájení) počítá server při sestavení stránky stejnými funkcemi jako aplikace (`pitchLiveData`).
// Slidy se kreslí na pevné plátno 1280 × 720 a celé se zmenší / zvětší na obrazovku (1366 × 768 i 1920 × 1080 bez posuvníku).

export const SLIDE_TITLES = [
  "O čem je projekt ELDOCK",
  "Reálný problém z praxe",
  "Modul 1: 2D Půdorys & Kabeláž",
  "Modul 2: Návrhář rozváděčů a normativní výpočty",
  "Modul 3: Průmysl, obchodní centra a nemocnice",
  "Férový stav projektu",
  "Obchodní model",
  "Žádost o podporu a její využití",
] as const;

/** Stav projektu (slide 6, One-Pager) – ověřitelná čísla z repozitáře k 12. 11. 2026. */
export const PROJECT_STATS: readonly { value: string; label: string }[] = [
  { value: "160 000+", label: "řádků vlastního kódu (TypeScript)" },
  { value: "1 200+", label: "automatických unit testů" },
  { value: "73", label: "sad E2E testů v prohlížeči" },
  { value: "1 300+", label: "kódů EAN z oficiálních dat výrobců" },
  { value: "1 400+", label: "oficiálních fotek výrobců (WebP)" },
  { value: "100+", label: "vývojových fází nasazených v produkci" },
];

/** Moduly platformy (slide 1, One-Pager). */
const MODULES = [
  { name: "2D Půdorys & Kabeláž", text: "Od podkladu PDF / DXF / IFC přes osazení prvků po trasy kabelů a kusovník s MPN / EAN." },
  { name: "Návrhář rozváděčů (AI Panel Builder)", text: "Okruhy a fáze, kontrola českých norem, oteplení dle IEC TR 60890 a 6listový PDF elaborát." },
  { name: "Správa dokumentace závodů a budov", text: "Lokální převod BIM .ifc, QR štítky u strojů, elektronická Červenka a Kniha revizí." },
] as const;

/** 5fázový průvodce 2D půdorysem – názvy fází z aplikace (`WIZARD_STEPS`), popis podle skutečných funkcí. */
const WIZARD_TEXT = [
  "Nahrání PDF / DXF / BIM (.ifc) nebo složení místností zadáním rozměrů X × Y.",
  "Osazení rozváděče, vybavení a automatické hlídání koupelnových zón (ČSN 33 2000-7-701).",
  "Rozmístění zásuvek a spotřebičů, skládání vícerámečků 1R–5R přímo na stěně.",
  "Světla, vypínače a ovládání – včetně sestav ve vícerámečku u dveří a u postele.",
  "Automatické obvodové trasování kabelů, potřebná hloubka krabic KOPOS (45 mm vs. 66 mm) a kompletní kusovník s výrobními čísly (MPN / EAN).",
] as const;

const PANEL_POINTS = [
  { title: "Okruhy, fáze a sběrnice", text: "Automatické rozdělení okruhů, vyvážení fází L1 / L2 / L3 a dimenzování PE a oddělených N sběrnic (N1, N2 za každým chráničem)." },
  { title: "Kontrola českých norem", text: "ČSN 33 2130 ed. 4, ČSN 33 2000-7-710 ed. 2 pro zdravotnictví, ČSN 33 2000-7-718 / BD4 pro obchodní centra." },
  { title: "Oteplení dle IEC TR 60890", text: "Výpočet ze ztrátových výkonů přístrojů – Pv z oficiálních dat výrobců ETIM (ABB ETIM 9.0, Hager ETIM 10)." },
  { title: "6listový PDF elaborát", text: "Okamžitý tisk výrobní dokumentace včetně protokolu kusové zkoušky, vnějších vlivů, ES prohlášení o shodě, štítku CE a samolepicích popisků 1:1." },
] as const;

const PLANT_POINTS = [
  { icon: "🔒", title: "100% lokální a bezpečný převod BIM (.ifc)", text: "Stavební a TZB model → přehledná 2D mapa hal a rozváděčů přímo v prohlížeči. Soubor .ifc se nikam neodesílá a převod funguje i bez internetu." },
  { icon: "📱", title: "QR diagnostika a elektronická Červenka", text: "Schéma v mobilu u stroje, zákres provozní změny přímo do výkresu a archiv záloh PLC / HMI s hlídáním podstatné změny stroje dle Nařízení EU 2023/1230." },
  { icon: "🔋", title: "Přehled kritického napájení a Kniha revizí", text: "Barevná filtrace větví Běžná síť / Dieselagregát DA / Kritická UPS, simulátor připojení nového stroje a lhůty revizí včetně nouzového osvětlení a zdravotnických přístrojů." },
] as const;

const DONE = [
  "Plně funkční jádro 2D půdorysu, návrháře rozváděčů i průmyslové správy areálu.",
  "Výpočtové jádro: ČSN linter, oteplení IEC TR 60890, úbytky napětí, hloubky krabic a délky tras.",
  "Zpracování dat ETIM 9.0, lokální parser BIM (.ifc), exporty DXF / PDF a generátor 6listové dokumentace.",
] as const;

const NEXT = [
  "Pilotní testování v reálném provozu s prvními elektrikáři, revizními techniky a správci budov (sběr zpětné vazby z praxe).",
  "Kompletní dopárování ceníkových matic všech výrobců a přímé propojení kusovníků s košíky elektro-velkoobchodů.",
  "Rozšíření o modul Výchozích revizních zpráv (VRZ) a automatický rozpočet montážních prací pro zákazníka.",
] as const;

const REVENUE = [
  { title: "Kredity a předplatné", text: "Kredity, měsíční a roční předplatné pro montážní elektrikáře, projektanty a revizní techniky." },
  { title: "Firemní B2B licence", text: "Pro výrobní závody, obchodní centra a zdravotnická zařízení." },
  { title: "Partnerské provize z materiálu a výroby rozváděčů", text: "Přenos přesného kusovníku k elektro-velkoobchodům a výrobcům rozváděčů." },
] as const;

export const AUTHOR_LINE = "Pavel Janoušek · zkušenosti z technického obchodu a elektrotechniky (ABB, Hilti, PC|SCHEMATIC) · https://eldock.cz";

const ELDOCK_URL = "https://eldock.cz";
const nn = (index: number) => String(index + 1).padStart(2, "0");
const n = (value: number) => value.toLocaleString("cs-CZ");

/** Rám slidu: horní technická linka (číslo · téma), nadpis, obsah a patička s číslem slidu. */
function SlideFrame({ index, title, children }: { index: number; title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col px-14 pt-8 pb-6">
      <header className="flex items-center justify-between border-b border-slate-700/70 pb-2.5 font-mono text-[11px] tracking-[0.2em] text-slate-400 uppercase">
        <span className="flex items-center gap-3">
          <span className="font-bold text-yellow-400">{nn(index)}</span>
          <span className="h-3 w-px bg-slate-600" aria-hidden />
          {SLIDE_TITLES[index]}
        </span>
        <span className="flex items-center gap-2 tracking-normal normal-case">
          <LogoMark className="size-4" />
          <span className="font-sans text-[13px] font-black">
            <span className="text-yellow-400">EL</span>DOCK<span className="text-slate-500">.cz</span>
          </span>
        </span>
      </header>
      <h2 className="mt-5 max-w-[1100px] text-[30px] leading-[1.15] font-bold tracking-tight text-balance text-slate-50">{title}</h2>
      <div className="mt-5 flex min-h-0 flex-1 flex-col">{children}</div>
      <footer className="mt-3 flex items-center justify-between border-t border-slate-700/70 pt-2.5 font-mono text-[11px] text-slate-500">
        <span>eldock.cz/prezentace</span>
        <span>
          {nn(index)} / {String(PITCH_SLIDE_COUNT).padStart(2, "0")}
        </span>
      </footer>
    </div>
  );
}

/** Tlačítko živé ukázky – otevře aplikaci v nové kartě (při tisku skryté). */
function DemoButton({ href, children, variant = "primary", testId }: { href: string; children: ReactNode; variant?: "primary" | "outline"; testId?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={cn(
        "pitch-no-print inline-flex h-10 items-center gap-2 rounded-md px-4 text-[14px] font-bold transition-colors",
        variant === "primary" ? "bg-yellow-400 text-slate-950 hover:bg-yellow-300" : "border border-slate-600 text-slate-200 hover:border-yellow-400/70 hover:text-white",
      )}
      data-testid={testId}
    >
      {children}
    </a>
  );
}

/** Nadpis bloku – drobné verzálky s tenkou linkou (švýcarský styl). */
function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase", className)}>{children}</p>;
}

/**
 * Výřez skutečného snímku obrazovky aplikace (snímek z výukového videa 1280 × 720) – `region` = [x, y, šířka, výška]
 * v pixelech snímku, zobrazí se v šířce `width`.
 */
function Shot({ src, alt, region, width, caption }: { src: string; alt: string; region: [number, number, number, number]; width: number; caption: string }) {
  const [x, y, w, h] = region;
  const scale = width / w;
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="relative overflow-hidden rounded-md border border-slate-700 bg-slate-900" style={{ width, height: Math.round(h * scale) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- statický snímek z public/tutorials, výřez přes absolutní polohu */}
        <img src={src} alt={alt} width={1280} height={720} loading="lazy" decoding="async" className="absolute max-w-none" style={{ width: Math.round(1280 * scale), left: -Math.round(x * scale), top: -Math.round(y * scale) }} />
      </div>
      <figcaption className="font-mono text-[10.5px] text-slate-500">{caption}</figcaption>
    </figure>
  );
}

function Slide1() {
  return (
    <div className="flex h-full flex-col px-14 pt-8 pb-6">
      <header className="flex items-center justify-between border-b border-slate-700/70 pb-2.5 font-mono text-[11px] tracking-[0.2em] text-slate-400 uppercase">
        <span className="flex items-center gap-3">
          <span className="font-bold text-yellow-400">01</span>
          <span className="h-3 w-px bg-slate-600" aria-hidden />
          {SLIDE_TITLES[0]}
        </span>
        <span>{ELDOCK_URL.replace("https://", "")}</span>
      </header>
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex items-center gap-4">
          <LogoMark className="size-14" />
          <span className="text-[44px] leading-none font-black tracking-tight">
            <span className="text-yellow-400">EL</span>DOCK<span className="text-slate-500">.cz</span>
          </span>
        </div>
        <h1 className="max-w-[1120px] text-[38px] leading-[1.12] font-bold tracking-tight text-balance text-slate-50">
          <span className="text-yellow-400">ELDOCK.cz</span> – Propojení návrhu elektroinstalace, výroby rozváděčů a provozní dokumentace do jednoho pracovního postupu.
        </h1>
        <p className="max-w-[1040px] text-[19px] leading-relaxed text-pretty text-slate-300">
          Praktický webový nástroj vyvíjený přímo z potřeb montážních elektrikářů, revizních techniků a průmyslové údržby. Odstraňuje ruční přepisování mezi stavebním půdorysem, kusovníkem materiálu, schématem rozváděče a dokumentací na stavbě či ve výrobním závodě.
        </p>
        <div>
          <Label className="mb-2">3 reálné moduly v provozu</Label>
          <ol className="grid grid-cols-3 border-y border-slate-700/70">
            {MODULES.map((module, index) => (
              <li key={module.name} className={cn("flex flex-col gap-1.5 py-4 pr-6", index > 0 && "border-l border-slate-700/70 pl-6")}>
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[15px] font-bold text-yellow-400">{index + 1}.</span>
                  <span className="text-[18px] font-bold text-slate-50">{module.name}</span>
                </span>
                <span className="text-[14px] leading-snug text-slate-400">{module.text}</span>
                <span className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden /> běží na eldock.cz
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <footer className="flex items-center justify-between border-t border-slate-700/70 pt-2.5 font-mono text-[11px] text-slate-500">
        <span>Pavel Janoušek · ELDOCK</span>
        <span>01 / {String(PITCH_SLIDE_COUNT).padStart(2, "0")}</span>
      </footer>
    </div>
  );
}

function Flow({ steps }: { steps: readonly string[] }) {
  return (
    <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-slate-700/70 pt-4 font-mono text-[12px] text-slate-300">
      {steps.map((step, index) => (
        <span key={step} className="flex items-center gap-1.5">
          {index > 0 ? (
            <span className="text-slate-600" aria-hidden>
              →
            </span>
          ) : null}
          <span className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1">{step}</span>
        </span>
      ))}
    </div>
  );
}

function Slide2() {
  return (
    <SlideFrame index={1} title="Proč to dnes trvá tak dlouho">
      <div className="grid flex-1 grid-cols-2 gap-10">
        <section className="flex flex-col gap-3">
          <Label>🏠 U domovní a komerční instalace</Label>
          <p className="text-[19px] leading-relaxed text-slate-200">
            Elektrikář dostane slepý PDF půdorys od stavaře. Ručně pravítkem měří délky kabelů, v Excelu sčítá vypínače, rámečky a krabičky, a po večerech lepí dokumentaci rozváděče, výpočet oteplení a štítky, aby prošel výchozí revizí.
          </p>
          <Flow steps={["PDF půdorys", "pravítko", "Excel", "dokumentace po večerech", "výchozí revize"]} />
        </section>
        <section className="flex flex-col gap-3 border-l border-slate-700/70 pl-10">
          <Label>🏭 U výrobních závodů, obchodních center a nemocnic</Label>
          <p className="text-[19px] leading-relaxed text-slate-200">
            Dokumentace rozváděčů je rozházená v papírových šanonech nebo v těžkých 3D BIM modelech, které údržbář u stroje neotevře. Změny zapojení během nočních oprav se nezakreslují a chybí přehled o zálohovaných větvích (Síť / Dieselagregát / UPS) a termínech revizí.
          </p>
          <Flow steps={["šanony", "těžký BIM model", "nezakreslená oprava", "Síť / DA / UPS?", "lhůty revizí?"]} />
        </section>
      </div>
    </SlideFrame>
  );
}

function Slide3({ live }: { live: PitchLiveData }) {
  return (
    <SlideFrame index={2} title="Krok za krokem od stěn po kusovník">
      <div className="grid flex-1 grid-cols-[1fr_560px] gap-10">
        <div className="flex flex-col">
          <p className="text-[15px] text-slate-300">5fázový průvodce, který zvládne i montér bez znalosti AutoCADu:</p>
          <ol className="mt-3 flex flex-col">
            {WIZARD_STEPS.map((step, index) => (
              <li key={step.id} className="flex gap-3 border-t border-slate-700/70 py-2 first:border-t-0 first:pt-0">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-yellow-400 font-mono text-[13px] font-black text-slate-950">{step.id}</span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-bold text-slate-50">{step.short}</span>
                  <span className="text-[13.5px] leading-snug text-slate-400">{WIZARD_TEXT[index]}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-auto pt-3">
            <DemoButton href={LIVE_DEMO.floorplan} testId="pitch-demo-floorplan">
              📐 Otevřít živou ukázku: 2D Půdorys
            </DemoButton>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Shot src="/tutorials/eldock-2d-pudorys-navod.jpg" alt="Snímek 2D půdorysu ELDOCK: automatické trasy kabelů po stěnách" region={[226, 100, 730, 420]} width={560} caption="Snímek z aplikace · automatické trasy kabelů v 2D půdorysu" />
          <div className="rounded-md border border-slate-700" data-testid="pitch-live-bom">
            <p className="flex items-baseline justify-between border-b border-slate-700 px-3 py-1.5">
              <span className="text-[13px] font-bold text-slate-100">Vzorový RD 4+kk – výpočet aplikace</span>
              <span className="font-mono text-[11px] text-slate-400">
                {live.bomStats.circuits} okruhů · {n(live.bomStats.cableM)} m kabelu · {live.bomStats.rows} položek
              </span>
            </p>
            <table className="w-full text-left text-[11.5px]">
              <thead className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-1 font-semibold">Položka</th>
                  <th className="px-2 py-1 font-semibold">MPN</th>
                  <th className="px-2 py-1 font-semibold">EAN</th>
                  <th className="px-3 py-1 text-right font-semibold">Ks</th>
                </tr>
              </thead>
              <tbody>
                {live.bom.map((row) => (
                  <tr key={row.mpn} className="border-t border-slate-800">
                    <td className="max-w-[230px] truncate px-3 py-1 text-slate-200">{row.name}</td>
                    <td className="px-2 py-1 font-mono whitespace-nowrap text-yellow-200">{row.mpn}</td>
                    <td className="px-2 py-1 font-mono text-slate-400">{row.ean ?? "–"}</td>
                    <td className="px-3 py-1 text-right font-mono text-slate-200">{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

function Slide4({ live }: { live: PitchLiveData }) {
  return (
    <SlideFrame index={3} title="Návrhář rozváděčů a normativní výpočty (ČSN EN IEC 61439)">
      <div className="grid flex-1 grid-cols-[1fr_560px] gap-10">
        <div className="flex flex-col">
          <p className="text-[15px] text-slate-300">Z půdorysu (nebo z fotky rozváděče na stavbě) ke kompletní výrobní dokumentaci:</p>
          <ul className="mt-3 flex flex-col">
            {PANEL_POINTS.map((point) => (
              <li key={point.title} className="border-t border-slate-700/70 py-2 first:border-t-0 first:pt-0">
                <p className="text-[15px] font-bold text-slate-50">{point.title}</p>
                <p className="text-[13.5px] leading-snug text-slate-400">{point.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            <DemoButton href={LIVE_DEMO.panelBuilder} testId="pitch-demo-panel">
              ⚡ Otevřít živou ukázku: Návrhář rozváděčů & PDF elaborát
            </DemoButton>
            <DemoButton href={LIVE_DEMO.sampleElaborate} variant="outline" testId="pitch-demo-elaborate">
              📄 Vzorový elaborát bez přihlášení
            </DemoButton>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Shot src="/tutorials/eldock-ai-panel-builder-navod.jpg" alt="Snímek výpočtu oteplení rozváděče v ELDOCK podle IEC TR 60890" region={[408, 120, 816, 412]} width={560} caption="Snímek z aplikace · oteplení dle IEC TR 60890 a fázová bilance" />
          <div className="rounded-md border border-slate-700 px-3 py-2" data-testid="pitch-live-sheets">
            <p className="mb-1 text-[13px] font-bold text-slate-100">Listy PDF elaborátu (z generátoru dokumentace)</p>
            <ol className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11.5px] leading-snug text-slate-300">
              {live.sheets.map((sheet, index) => (
                <li key={sheet} className="flex gap-1.5">
                  <span className="font-mono text-yellow-400">{index + 1}</span>
                  {sheet}
                </li>
              ))}
            </ol>
            <p className="mt-1 font-mono text-[10.5px] text-slate-500">+ samostatný tisk samolepicích popisků a štítků 1:1</p>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

function Slide5({ live }: { live: PitchLiveData }) {
  const facts: [string, string][] = [
    ["Rozměr haly", live.bim.dimensions],
    ["Podlaží", String(live.bim.storeys)],
    ["Místnosti", `${live.bim.spaces} · ${n(live.bim.areaM2)} m²`],
    ["Rozváděče", String(live.bim.boards)],
    ["Stroje", String(live.bim.machines)],
    ["Kabely", `${n(live.bim.cableM)} m`],
  ];
  return (
    <SlideFrame index={4} title="Průmyslové závody, obchodní centra a nemocnice: lokální BIM (.ifc) a provoz">
      <div className="grid flex-1 grid-cols-[1fr_470px] gap-10">
        <div className="flex flex-col">
          <p className="text-[15px] text-slate-300">Praktické nástroje pro vedoucí údržby, energetiky a facility manažery:</p>
          <ul className="mt-3 flex flex-col">
            {PLANT_POINTS.map((point) => (
              <li key={point.title} className="flex gap-3 border-t border-slate-700/70 py-2.5 first:border-t-0 first:pt-0">
                <span className="text-[20px] leading-none" aria-hidden>
                  {point.icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-bold text-slate-50">{point.title}</span>
                  <span className="text-[13.5px] leading-snug text-slate-400">{point.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            <DemoButton href={LIVE_DEMO.plant} testId="pitch-demo-plant">
              🏭 Otevřít živou ukázku: Průmyslový areál & BIM import
            </DemoButton>
            <DemoButton href={LIVE_DEMO.clinic} variant="outline" testId="pitch-demo-clinic">
              🏥 Ordinace – Skupina 1
            </DemoButton>
            <DemoButton href={LIVE_DEMO.shop} variant="outline" testId="pitch-demo-shop">
              🛍️ Obchodní jednotka – BD4
            </DemoButton>
          </div>
        </div>
        <div className="flex flex-col gap-3" data-testid="pitch-live-bim">
          <div className="rounded-md border border-slate-700">
            <p className="border-b border-slate-700 px-3 py-1.5 text-[13px] font-bold text-slate-100">Vzorový BIM model haly (IFC4) – převod v prohlížeči</p>
            <dl className="grid grid-cols-3">
              {facts.map(([label, value], index) => (
                <div key={label} className={cn("px-3 py-2", index % 3 > 0 && "border-l border-slate-800", index >= 3 && "border-t border-slate-800")}>
                  <dt className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">{label}</dt>
                  <dd className="text-[16px] font-bold text-slate-50 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-slate-700 px-3 py-1.5 font-mono text-[11px] text-slate-400">Zdroje: {live.bim.sources.map((source) => `${source.tag} (${source.tier})`).join(" · ")}</p>
          </div>
          <div className="rounded-md border border-slate-700 px-3 py-2">
            <Label className="mb-1.5">Filtr napájení na mapě areálu</Label>
            <ul className="flex flex-col gap-1 text-[12.5px] text-slate-200">
              {live.tiers.map((tier) => (
                <li key={tier.label} className="flex items-center gap-2">
                  <span className="h-1 w-6 rounded-full" style={{ background: tier.color }} aria-hidden />
                  {tier.label}
                </li>
              ))}
            </ul>
          </div>
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12.5px] leading-snug text-emerald-100">
            🔒 Soubor .ifc čte a převádí jen prohlížeč – na server ani do žádné AI se neposílá. Do ELDOCKu (cloud nebo vlastní server firmy) se uloží až výsledná struktura, kterou potvrdíte.
          </p>
        </div>
      </div>
    </SlideFrame>
  );
}

function Slide6() {
  return (
    <SlideFrame index={5} title="Kde přesně dnes jsme: co už běží vs. co je před námi">
      <div className="grid grid-cols-2 gap-10">
        <section>
          <Label className="mb-2 text-emerald-400">✅ Hotové, otestované a běží na eldock.cz</Label>
          <ul className="flex flex-col">
            {DONE.map((item) => (
              <li key={item} className="border-t border-slate-700/70 py-2.5 text-[16px] leading-snug text-slate-200">
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section className="border-l border-slate-700/70 pl-10">
          <Label className="mb-2 text-yellow-400">🛠️ Co nyní řešíme a kam směřuje další vývoj</Label>
          <ul className="flex flex-col">
            {NEXT.map((item) => (
              <li key={item} className="border-t border-slate-700/70 py-2.5 text-[16px] leading-snug text-slate-200">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="mt-auto">
        <Label className="mb-2">Ověřitelná čísla z repozitáře · 12. 11. 2026</Label>
        <div className="grid grid-cols-6 border-y border-slate-700/70" data-testid="pitch-stats">
          {PROJECT_STATS.map((stat, index) => (
            <div key={stat.label} className={cn("flex flex-col gap-0.5 py-3 pr-3", index > 0 && "border-l border-slate-700/70 pl-3")}>
              <span className="text-[24px] font-black text-yellow-400 tabular-nums">{stat.value}</span>
              <span className="text-[12px] leading-snug text-slate-400">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}

function Slide7() {
  return (
    <SlideFrame index={6} title="Obchodní model a komu ELDOCK šetří peníze">
      <div className="grid grid-cols-[260px_1fr] items-center gap-8 border-y border-slate-700/70 py-5">
        <p className="text-[64px] leading-none font-black tracking-tight text-yellow-400 tabular-nums">
          6–10 <span className="text-[30px] text-slate-300">hodin</span>
        </p>
        <div>
          <p className="text-[20px] leading-snug text-slate-100">
            Pokud elektrikář na jediném rodinném domě ušetří <b className="text-yellow-300">6–10 hodin</b> ručního měření, počítání kusovníku a psaní dokumentace rozváděče, zaplatí se mu licence na celý rok na první zakázce.
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-slate-500">Jasná ekonomika pro uživatele · odhad z praxe montážních firem</p>
        </div>
      </div>
      <Label className="mt-6 mb-2">3 zdroje příjmů platformy</Label>
      <ol className="grid grid-cols-3 gap-6">
        {REVENUE.map((item, index) => (
          <li key={item.title} className="flex flex-col gap-2 border-t-2 border-yellow-400/80 pt-3">
            <span className="font-mono text-[13px] font-bold text-yellow-400">{index + 1})</span>
            <span className="text-[18px] leading-snug font-bold text-slate-50">{item.title}</span>
            <span className="text-[14.5px] leading-snug text-slate-400">{item.text}</span>
          </li>
        ))}
      </ol>
    </SlideFrame>
  );
}

function Slide8({ config, onEdit }: { config: PitchConfig; onEdit?: () => void }) {
  return (
    <SlideFrame index={7} title="Proč žádáme o podporu a jak přesně ji využijeme">
      <div className="grid flex-1 grid-cols-[1fr_400px] gap-10">
        <div className="flex flex-col">
          <div className="flex items-end justify-between gap-4 border-b border-slate-700/70 pb-3">
            <div>
              <Label>Cílová podpora{config.form.trim() ? ` · ${config.form}` : ""}</Label>
              <p className="mt-1 text-[34px] leading-none font-black text-yellow-400" data-testid="pitch-amount">
                {amountLabel(config)}
              </p>
            </div>
            {onEdit ? (
              <button type="button" onClick={onEdit} className="pitch-no-print inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-600 px-3 text-[13px] font-semibold text-slate-200 hover:border-yellow-400/70 hover:text-white" data-testid="pitch-edit-slide">
                ✏️ Upravit text / částku
              </button>
            ) : null}
          </div>
          {config.partner.trim() ? (
            <p className="mt-2 text-[13px] text-slate-300" data-testid="pitch-partner">
              Připraveno pro: <b className="text-slate-100">{config.partner}</b>
            </p>
          ) : null}
          <ol className="mt-2 flex flex-col">
            {PITCH_PLAN.map((item, index) => {
              const share = fundShare(config.funds[index]);
              return (
                <li key={item.title} className="flex gap-3 border-b border-slate-700/70 py-2.5 last:border-b-0">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-yellow-400 font-mono text-[13px] font-black text-slate-950">{index + 1}</span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[16px] font-bold text-slate-50">{item.title}</span>
                    <span className="text-[14px] leading-snug text-slate-400" data-testid={`pitch-plan-${index + 1}`}>
                      {planText(config, index)}
                    </span>
                  </span>
                  {share ? <b className="font-mono text-[15px] text-yellow-300">{share}</b> : null}
                </li>
              );
            })}
          </ol>
        </div>
        <aside className="flex flex-col gap-4">
          <div className="border-t-2 border-yellow-400/80 pt-3" data-testid="pitch-author">
            <Label>Autor projektu</Label>
            <p className="mt-1.5 text-[20px] font-bold text-slate-50">Pavel Janoušek</p>
            <p className="text-[14px] leading-snug text-slate-300">zkušenosti z technického obchodu a elektrotechniky (ABB, Hilti, PC|SCHEMATIC)</p>
            <p className="mt-1 font-mono text-[13px] text-yellow-300">{ELDOCK_URL}</p>
          </div>
          <div className="mt-auto flex items-center gap-4 rounded-md border border-slate-700 p-3">
            <QRCodeSVG value={ELDOCK_URL} size={96} bgColor="#ffffff" fgColor="#090d16" marginSize={2} className="shrink-0 rounded-sm" aria-label="QR kód na eldock.cz" />
            <div className="text-[13px]" data-testid="pitch-contact">
              <p className="text-[16px] font-bold text-slate-50">{config.contactName} · ELDOCK</p>
              <p className="text-yellow-300">{ELDOCK_URL}</p>
              {config.contactEmail ? <p className="text-slate-300">{config.contactEmail}</p> : null}
              {config.contactPhone ? <p className="text-slate-300">{config.contactPhone}</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </SlideFrame>
  );
}

/** 8 slidů v pořadí prezentace (`onEdit` = tlačítko ✏️ přímo na slidu 8). */
export function pitchSlides(config: PitchConfig, live: PitchLiveData, onEdit?: () => void): ReactNode[] {
  return [<Slide1 key={1} />, <Slide2 key={2} />, <Slide3 key={3} live={live} />, <Slide4 key={4} live={live} />, <Slide5 key={5} live={live} />, <Slide6 key={6} />, <Slide7 key={7} />, <Slide8 key={8} config={config} onEdit={onEdit} />];
}

/** One-Pager – jedna stránka A4 na výšku pro rozdání u stolu (stejné ověřené texty jako slidy). */
export function OnePager({ config, live }: { config: PitchConfig; live: PitchLiveData }) {
  const section = "break-inside-avoid";
  const head = "mb-[1mm] border-b border-zinc-300 pb-[0.6mm] text-[8.4pt] font-black tracking-wider text-zinc-900 uppercase";
  return (
    <article className="onepager mx-auto flex w-[210mm] max-w-full flex-col gap-[3mm] bg-white p-[11mm] text-[8.4pt] leading-snug text-zinc-800 shadow-2xl" data-testid="pitch-onepager">
      <header className="flex items-center justify-between gap-4 border-b-2 border-zinc-900 pb-[2.5mm]">
        <div className="flex items-center gap-3">
          <LogoMark className="size-11" />
          <div>
            <p className="text-[19pt] leading-none font-black text-zinc-950">
              <span className="text-yellow-500">EL</span>DOCK.cz
            </p>
            <p className="mt-[0.8mm] max-w-[120mm] text-[8.4pt] font-semibold text-zinc-700">Propojení návrhu elektroinstalace, výroby rozváděčů a provozní dokumentace do jednoho pracovního postupu</p>
          </div>
        </div>
        <QRCodeSVG value={ELDOCK_URL} size={74} marginSize={1} aria-label="QR kód na eldock.cz" />
      </header>

      <p className={cn(section, "text-[9.2pt] text-zinc-900")}>
        Praktický webový nástroj vyvíjený přímo z potřeb montážních elektrikářů, revizních techniků a průmyslové údržby. Odstraňuje ruční přepisování mezi stavebním půdorysem, kusovníkem materiálu, schématem rozváděče a dokumentací na stavbě či ve výrobním závodě.
      </p>

      <section className={section}>
        <h2 className={head}>Reálný problém z praxe</h2>
        <ul className="list-disc pl-4">
          <li>
            <b>Domovní a komerční instalace:</b> slepý PDF půdorys, délky kabelů pravítkem, vypínače, rámečky a krabičky v Excelu, dokumentace rozváděče, oteplení a štítky po večerech kvůli výchozí revizi.
          </li>
          <li>
            <b>Závody, obchodní centra a nemocnice:</b> dokumentace v šanonech nebo v těžkých BIM modelech, nezakreslené změny z nočních oprav, chybí přehled o větvích Síť / DA / UPS a termínech revizí.
          </li>
        </ul>
      </section>

      <div className="grid grid-cols-3 gap-[4mm]">
        <section className={section}>
          <h2 className={head}>1 · 2D Půdorys & Kabeláž</h2>
          <ol className="list-decimal pl-4">
            {WIZARD_STEPS.map((step, index) => (
              <li key={step.id}>
                <b>{step.short}:</b> {WIZARD_TEXT[index]}
              </li>
            ))}
          </ol>
        </section>
        <section className={section}>
          <h2 className={head}>2 · Návrhář rozváděčů</h2>
          <ul className="list-disc pl-4">
            {PANEL_POINTS.map((point) => (
              <li key={point.title}>
                <b>{point.title}:</b> {point.text}
              </li>
            ))}
          </ul>
        </section>
        <section className={section}>
          <h2 className={head}>3 · Závody, OC a nemocnice</h2>
          <ul className="list-disc pl-4">
            {PLANT_POINTS.map((point) => (
              <li key={point.title}>
                <b>{point.title}:</b> {point.text}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={cn(section, "rounded-md border border-zinc-300 bg-zinc-50 px-[3mm] py-[1.5mm] text-[7.8pt]")}>
        <b>Živá data z aplikace:</b> vzorový RD 4+kk = {live.bomStats.circuits} okruhů, {n(live.bomStats.cableM)} m kabelu, {live.bomStats.rows} položek kusovníku (např. {live.bom[0]?.mpn ?? "–"}, EAN {live.bom[0]?.ean ?? "–"}) · vzorová hala IFC4 {live.bim.dimensions} = {live.bim.spaces} místností, {live.bim.boards} rozváděče, zdroje {live.bim.sources.map((source) => source.tag).join(" / ")}.
      </section>

      <div className="grid grid-cols-2 gap-[4mm]">
        <section className={section}>
          <h2 className={head}>✅ Hotové a běží na eldock.cz</h2>
          <ul className="list-disc pl-4">
            {DONE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className={section}>
          <h2 className={head}>🛠️ Co řešíme a kam směřuje vývoj</h2>
          <ul className="list-disc pl-4">
            {NEXT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className={section}>
        <div className="grid grid-cols-6 gap-[1.5mm]">
          {PROJECT_STATS.map((stat) => (
            <div key={stat.label} className="rounded-md border border-zinc-200 px-[1.5mm] py-[1mm]">
              <b className="block text-[10.5pt] text-zinc-950">{stat.value}</b>
              <span className="text-[6.8pt] leading-tight text-zinc-600">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={section}>
        <h2 className={head}>Obchodní model</h2>
        <p>
          <b>6–10 hodin</b> ušetřených na jediném rodinném domě (ruční měření, kusovník, dokumentace rozváděče) zaplatí licenci na celý rok na první zakázce (odhad z praxe). Příjmy: 1) kredity, měsíční a roční předplatné pro elektrikáře, projektanty a revizní techniky · 2) firemní B2B licence pro závody, obchodní centra a zdravotnická zařízení · 3) partnerské provize z materiálu a výroby rozváděčů.
        </p>
      </section>

      <section className={cn(section, "rounded-md border-2 border-yellow-400 bg-yellow-50 p-[3mm]")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[8.4pt] font-black tracking-wider text-zinc-900 uppercase">Žádost o podporu a její využití</h2>
          {config.partner.trim() ? (
            <span className="text-[8pt] text-zinc-700">
              Připraveno pro: <b>{config.partner}</b>
            </span>
          ) : null}
        </div>
        <p className="mt-1">
          <b>Cílová podpora{config.form.trim() ? ` (${config.form})` : ""}:</b> <span data-testid="onepager-amount">{amountLabel(config)}</span>
        </p>
        <ol className="mt-1 list-decimal pl-4">
          {PITCH_PLAN.map((item, index) => {
            const share = fundShare(config.funds[index]);
            return (
              <li key={item.title}>
                <b>
                  {item.title}
                  {share ? ` (${share})` : ""}:
                </b>{" "}
                {planText(config, index)}
              </li>
            );
          })}
        </ol>
      </section>

      <footer className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-300 pt-[2mm] text-[8pt]">
        <span>
          <b className="text-zinc-950">{AUTHOR_LINE}</b>
          {config.contactEmail ? ` · ${config.contactEmail}` : ""}
          {config.contactPhone ? ` · ${config.contactPhone}` : ""}
        </span>
        <span className="shrink-0 text-zinc-500">eldock.cz/prezentace</span>
      </footer>
    </article>
  );
}
