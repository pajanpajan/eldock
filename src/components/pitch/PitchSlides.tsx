import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";

import { LogoMark } from "@/components/layout/Logo";
import { phaseBubbleClass, phaseCardClass } from "@/components/phases/phase-style";
import { WIZARD_STEPS } from "@/lib/panel-builder/floorplan-wizard";
import { LIVE_DEMO, amountLabel, fundShare, type PitchConfig } from "@/lib/pitch";
import { cn } from "@/lib/utils";

// Fáze 99: obsah 10 slidů prezentace ELDOCK a jednostránkového Executive One-Pageru A4 (texty podle zadání fáze 99,
// čísla stavu projektu z repozitáře a katalogu k 12. 11. 2026).

export const SLIDE_TITLES = [
  "Vize & hodnota",
  "Problém na trhu",
  "Řešení: 3 pilíře",
  "Živá ukázka 1: Bytová a komerční elektroinstalace",
  "Živá ukázka 2: Průmysl, OC a nemocnice",
  "Technologický náskok",
  "Trh a škálování",
  "Obchodní model",
  "Současný stav projektu",
  "Žádost o podporu a roadmapa",
] as const;

/** Stav projektu (slide 9, One-Pager) – ověřená čísla z repozitáře, testů a katalogu. */
export const PROJECT_STATS: readonly { value: string; label: string }[] = [
  { value: "136 000+", label: "řádků inženýrského kódu (TypeScript)" },
  { value: "1 200+", label: "automatických unit testů + 71 sad E2E testů" },
  { value: "838", label: "přístrojů v katalogu s ETIM daty výrobců" },
  { value: "963", label: "ověřených fotek výrobců (WebP)" },
  { value: "264", label: "ověřených rozvodnic z katalogů výrobců" },
  { value: "99", label: "dokončených vývojových fází, nasazeno v cloudu" },
];

const ELDOCK_URL = "https://eldock.cz";

function SlideFrame({ index, title, children, className }: { index: number; title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto flex h-full w-full max-w-6xl flex-col gap-5 px-6 py-8 sm:px-10", className)}>
      <p className="flex items-center gap-3 font-mono text-xs tracking-widest text-yellow-300/80 uppercase">
        <span className="rounded-md border border-yellow-400/40 px-2 py-0.5">{String(index + 1).padStart(2, "0")} / 10</span>
        {title}
      </p>
      {children}
    </div>
  );
}

function DemoButton({ href, children, variant = "primary", testId }: { href: string; children: ReactNode; variant?: "primary" | "outline"; testId?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={cn(
        "pitch-no-print inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-lg transition-colors",
        variant === "primary" ? "bg-yellow-400 text-zinc-950 shadow-yellow-400/20 hover:bg-yellow-300" : "border border-yellow-400/60 text-yellow-100 hover:bg-yellow-400/10",
      )}
      data-testid={testId}
    >
      {children}
    </a>
  );
}

const card = "rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/30 backdrop-blur";

function Slide1() {
  return (
    <SlideFrame index={0} title={SLIDE_TITLES[0]} className="justify-center">
      <div className="flex items-center gap-4">
        <LogoMark className="size-16 sm:size-20" />
        <span className="text-4xl font-black tracking-tight sm:text-6xl">
          <span className="text-yellow-400">EL</span>DOCK<span className="text-yellow-400">.cz</span>
        </span>
      </div>
      <h1 className="max-w-5xl text-3xl leading-tight font-extrabold text-balance sm:text-5xl">
        Digitální ekosystém pro návrh elektroinstalací, výrobu rozváděčů a provozní správu budov a průmyslu.
      </h1>
      <p className="max-w-4xl text-lg text-pretty text-zinc-300 sm:text-2xl">
        Od 2D půdorysu a fotky rozváděče přes normativní výpočty až po digitální dvojče výrobního závodu, nemocnice či obchodního centra.
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        {["2D půdorys & kabeláž", "AI Panel Builder", "ELDOCK Průmysl & Facility", "ČSN · EN · IEC", "ETIM 9.0", "BIM IFC"].map((tag) => (
          <span key={tag} className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 font-semibold text-yellow-100">
            {tag}
          </span>
        ))}
      </div>
    </SlideFrame>
  );
}

function Slide2() {
  return (
    <SlideFrame index={1} title={SLIDE_TITLES[1]}>
      <h2 className="text-3xl font-extrabold sm:text-4xl">Proč vznikl ELDOCK</h2>
      <div className="grid flex-1 gap-5 md:grid-cols-2">
        <div className={cn(card, "flex flex-col gap-3")}>
          <span className="text-4xl" aria-hidden>
            🧰
          </span>
          <h3 className="text-xl font-bold">1. Montážní firmy a elektrikáři (40 000+ v ČR/SK)</h3>
          <p className="text-lg text-zinc-300">
            Ztrácejí desítky hodin měsíčně ručním počítáním kabelů z PDF půdorysů a večerním lepením výrobní dokumentace rozváděčů, kusových zkoušek a výpočtů oteplení v Excelu.
          </p>
        </div>
        <div className={cn(card, "flex flex-col gap-3")}>
          <span className="text-4xl" aria-hidden>
            🏭
          </span>
          <h3 className="text-xl font-bold">2. Průmyslové závody, OC a nemocnice</h3>
          <p className="text-lg text-zinc-300">
            „Mrtvá“ dokumentace v papírových šanonech nebo nepoužitelných 3D BIM modelech, prostoje při nočních poruchách strojů, nepodchycené ruční změny ve schématech a přísná nová legislativa (ČSN 33 2130 ed. 4, ČSN EN IEC 61439, Nařízení EU 2023/1230 o strojních zařízeních).
          </p>
        </div>
      </div>
    </SlideFrame>
  );
}

const PILLARS = [
  { icon: "📐", title: "2D Půdorys & Kabeláž", text: "Fázový průvodce 1–5, obvodové trasy dle ČSN, kusovník s krabičkami KOPOS a 1-klikový přenos do rozváděče." },
  { icon: "⚡", title: "AI Panel Builder", text: "Rozváděč z fotky nebo z půdorysu za 3 minuty, Elektro-linter, oteplení dle IEC TR 60890, 6listový PDF elaborát, CE štítek a popisky 1:1." },
  { icon: "🏭", title: "ELDOCK Průmysl & Facility", text: "Nativní BIM .ifc import, QR štítky na rozváděčích, elektronická Červenka, zálohy PLC, 3 zdroje Síť / DA / UPS a Kniha revizí." },
];

function Slide3() {
  return (
    <SlideFrame index={2} title={SLIDE_TITLES[2]}>
      <h2 className="text-3xl font-extrabold sm:text-4xl">3 propojené pilíře platformy ELDOCK</h2>
      <div className="grid flex-1 items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {PILLARS.map((pillar, index) => (
          <div key={pillar.title} className="contents">
            {index > 0 ? (
              <span className="hidden items-center justify-center text-4xl font-black text-yellow-400 lg:flex" aria-hidden>
                →
              </span>
            ) : null}
            <div className={cn(card, "flex flex-col gap-3 border-yellow-400/30")}>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-yellow-400 text-3xl text-zinc-950" aria-hidden>
                {pillar.icon}
              </span>
              <h3 className="text-xl font-bold">
                {index + 1}) {pillar.title}
              </h3>
              <p className="text-base text-zinc-300">{pillar.text}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-zinc-300">
        Jedna datová páteř: katalog výrobců (ETIM 9.0, MPN / EAN) · normy ČSN / EN / IEC · BIM IFC (ISO 16739) · cloud a aplikace pro Windows, Android a iOS
      </p>
    </SlideFrame>
  );
}

function Slide4() {
  return (
    <SlideFrame index={3} title={SLIDE_TITLES[3]}>
      <h2 className="text-3xl font-extrabold sm:text-4xl">Od půdorysu po PDF elaborát za 3 minuty</h2>
      <div className="grid gap-2 sm:grid-cols-5" aria-label="5fázový průvodce 2D půdorysem">
        {WIZARD_STEPS.map((step, index) => (
          <div key={step.id} className={phaseCardClass(index === 0, index > 0)}>
            <span className={phaseBubbleClass(index === 0, index > 0)} aria-hidden>
              {index > 0 ? "✓" : step.id}
            </span>
            <span className="min-w-0 text-sm leading-tight font-bold">{step.short}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["📐", "Půdorys", "PDF / DXF / DWG / IFC nebo místnosti X × Y"],
          ["🔌", "Osazení", "Zásuvky, světla, Smart Home, koupelnové zóny"],
          ["⚡", "Rozváděč", "1 klik: okruhy, fáze L1 / L2 / L3, chrániče, PE / N"],
          ["📄", "Elaborát", "6 listů PDF, kusovník, oteplení, štítky 1:1, CE"],
        ].map(([icon, title, text]) => (
          <div key={title} className={cn(card, "p-4")}>
            <p className="text-2xl" aria-hidden>
              {icon}
            </p>
            <p className="mt-1 font-bold">{title}</p>
            <p className="text-sm text-zinc-300">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap gap-3">
        <DemoButton href={LIVE_DEMO.floorplan} testId="pitch-demo-floorplan">
          🚀 Otevřít živou ukázku: 2D Půdorys 4+kk
        </DemoButton>
        <DemoButton href={LIVE_DEMO.panelBuilder} testId="pitch-demo-panel">
          ⚡ Otevřít živou ukázku: AI Panel Builder & 6listové PDF
        </DemoButton>
        <DemoButton href={LIVE_DEMO.sampleElaborate} variant="outline" testId="pitch-demo-elaborate">
          📄 Vzorový 6listový elaborát (bez přihlášení)
        </DemoButton>
      </div>
    </SlideFrame>
  );
}

function Slide5() {
  return (
    <SlideFrame index={4} title={SLIDE_TITLES[4]}>
      <h2 className="text-3xl font-extrabold sm:text-4xl">Průmyslové závody, obchodní centra a nemocnice</h2>
      <div className="grid flex-1 gap-3 md:grid-cols-3">
        {[
          ["🏢", "BIM .ifc import", "Budovy, místnosti, rozváděče, trasy a stroje z modelu za pár sekund – přímo v prohlížeči."],
          ["📱", "QR diagnostika u stroje", "Technik naskenuje štítek na rozváděči a má platné schéma, zálohy PLC i revize v ruce."],
          ["🖍️", "Elektronická Červenka", "Změna zakreslená v hale jde rovnou CAE projektantovi, nová revize se schvaluje online."],
          ["🛍️", "Obchodní centra BD4", "ČSN 33 2000-7-718: bezhalogenové kabely B2ca, CENTRAL STOP od EPS, elektroměr MID."],
          ["🏥", "Zdravotnictví – Skupina 1", "ČSN 33 2000-7-710 ed. 2: lůžkové rampy LUZ, EKV, okruhy A / B pod samostatnými chrániči."],
          ["🔋", "Síť / DA / UPS", "3 úrovně zálohování napájení v mapě areálu a What-If simulátor připojení nového stroje."],
        ].map(([icon, title, text]) => (
          <div key={title} className={cn(card, "p-4")}>
            <p className="text-2xl" aria-hidden>
              {icon}
            </p>
            <p className="mt-1 font-bold">{title}</p>
            <p className="text-sm text-zinc-300">{text}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <DemoButton href={LIVE_DEMO.plant} testId="pitch-demo-plant">
          🏭 Otevřít živou ukázku: Průmyslový závod & BIM
        </DemoButton>
        <DemoButton href={LIVE_DEMO.clinic} variant="outline" testId="pitch-demo-clinic">
          🏥 Ordinace – Skupina 1
        </DemoButton>
        <DemoButton href={LIVE_DEMO.shop} variant="outline" testId="pitch-demo-shop">
          🛍️ Obchodní centrum – BD4
        </DemoButton>
      </div>
    </SlideFrame>
  );
}

function Slide6() {
  return (
    <SlideFrame index={5} title={SLIDE_TITLES[5]}>
      <h2 className="text-3xl font-extrabold sm:text-4xl">Proč nás nelze snadno zkopírovat</h2>
      <div className="grid flex-1 gap-4 md:grid-cols-3">
        {[
          ["🧠", "Exaktní inženýrské jádro (ne jen kreslítko)", "Vestavěný deterministický Elektro-linter (ČSN 33 2130 ed. 4, ČSN 33 2000-7-701, 7-710, 7-718), normativní výpočet oteplení dle IEC TR 60890, automatické PE / N sběrnice a hlídač hloubky krabiček."],
          ["📦", "Reálná katalogová data ETIM 9.0", "Přesná objednací čísla (MPN / EAN), ztrátové výkony ve wattech a vestavné hloubky předních výrobců (ABB, Schneider, Legrand, Hager, Eaton, OEZ, KOPOS, Loxone, TapHome)."],
          ["🏗️", "Nativní BIM (.ifc) parser v prohlížeči", "Převod stavebně-elektrotechnického BIM modelu na živé provozní dvojče za 5 sekund bez drahých CAD licencí."],
        ].map(([icon, title, text]) => (
          <div key={title} className={cn(card, "flex flex-col gap-3")}>
            <span className="text-4xl" aria-hidden>
              {icon}
            </span>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-base text-zinc-300">{text}</p>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

function Slide7() {
  return (
    <SlideFrame index={6} title={SLIDE_TITLES[6]}>
      <h2 className="text-3xl font-extrabold sm:text-4xl">Tržní příležitost a škálování</h2>
      <div className="flex flex-wrap items-center gap-2 text-lg font-bold" aria-label="Plán expanze">
        {["🇨🇿 ČR", "🇸🇰 SK", "🇵🇱 PL / 🇭🇺 HU", "🇩🇪 🇦🇹 🇨🇭 DACH"].map((step, index) => (
          <span key={step} className="flex items-center gap-2">
            {index > 0 ? (
              <span className="text-yellow-400" aria-hidden>
                ➔
              </span>
            ) : null}
            <span className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-3 py-1.5">{step}</span>
          </span>
        ))}
      </div>
      <div className="grid flex-1 gap-4 md:grid-cols-2">
        <div className={card}>
          <p className="text-sm font-semibold tracking-wide text-yellow-300 uppercase">Segment A (SMB)</p>
          <p className="mt-2 text-lg">Živnostníci, elektromontážní firmy, revizní technici, instalační firmy FVE a TČ.</p>
        </div>
        <div className={card}>
          <p className="text-sm font-semibold tracking-wide text-yellow-300 uppercase">Segment B (Enterprise & Facility)</p>
          <p className="mt-2 text-lg">Výrobní závody, obchodní centra a retail parky, nemocnice a polikliniky.</p>
        </div>
      </div>
      <div className={cn(card, "p-4")}>
        <p className="font-bold">Mezinárodní škálovatelnost díky harmonizovaným normám IEC / EN</p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {["ČSN EN IEC 61439", "IEC TR 60890", "ISO 16739 IFC", "ETIM 9.0"].map((norm) => (
            <span key={norm} className="rounded-full border border-white/15 px-3 py-1 font-mono">
              {norm}
            </span>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}

function Slide8() {
  return (
    <SlideFrame index={7} title={SLIDE_TITLES[7]}>
      <h2 className="text-3xl font-extrabold sm:text-4xl">Obchodní model a zdroje příjmů</h2>
      <div className="grid flex-1 gap-4 md:grid-cols-3">
        {[
          ["💳", "1. SaaS předplatné & kreditový systém", "Pro montážní firmy a projektanty – okamžitá platba za vygenerovaný elaborát nebo měsíční / roční tarif."],
          ["🏢", "2. Roční B2B Enterprise licence", "Pro výrobní závody, obchodní centra a nemocnice – v limitu přímého nákupu pod 2 mil. Kč bez zdlouhavých tendrů."],
          ["🧾", "3. Transakční marže z kusovníků", "BOM Affiliate & rozváděče na klíč: jednoklikový přenos spočítaného kusovníku do e-shopů velkoobchodů a zakázková výroba rozváděčů s provizí z obratu materiálu."],
        ].map(([icon, title, text]) => (
          <div key={title} className={cn(card, "flex flex-col gap-3")}>
            <span className="text-4xl" aria-hidden>
              {icon}
            </span>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-base text-zinc-300">{text}</p>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

function Slide9() {
  return (
    <SlideFrame index={8} title={SLIDE_TITLES[8]}>
      <h2 className="text-3xl font-extrabold sm:text-4xl">100% funkční produkt v produkci</h2>
      <p className="max-w-4xl text-lg text-zinc-300">
        Platforma <b className="text-yellow-300">{ELDOCK_URL}</b> není prezentace nápadu na papíře, ale plně funkční, otestovaný systém běžící v cloudu s desítkami tisíc řádků inženýrského kódu, automatizovanými testy a napojeným katalogem.
      </p>
      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="pitch-stats">
        {PROJECT_STATS.map((stat) => (
          <div key={stat.label} className={cn(card, "flex flex-col justify-center")}>
            <p className="text-4xl font-black text-yellow-400 tabular-nums">{stat.value}</p>
            <p className="text-sm text-zinc-300">{stat.label}</p>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

function Slide10({ config }: { config: PitchConfig }) {
  const funds = ["Obchodní akvizice a B2B prodej (závody, OC, nemocnice, montážní firmy)", "Rozvoj produktového jádra a ETIM / velkoobchodních integrací", "Zákaznická podpora a onboarding"];
  return (
    <SlideFrame index={9} title={SLIDE_TITLES[9]}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Žádost o podporu · Roadmap 2026–2027</h2>
        {config.partner.trim() ? (
          <p className="rounded-full border border-yellow-400/50 px-3 py-1 text-sm text-yellow-100" data-testid="pitch-partner">
            Připraveno pro: <b>{config.partner}</b>
          </p>
        ) : null}
      </div>
      <div className="grid flex-1 gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className={cn(card, "border-yellow-400/40")}>
            <p className="text-sm font-semibold tracking-wide text-yellow-300 uppercase">Cílová podpora{config.form.trim() ? ` · ${config.form}` : ""}</p>
            <p className="mt-1 text-4xl font-black text-yellow-400" data-testid="pitch-amount">
              {amountLabel(config)}
            </p>
          </div>
          <div className={card}>
            <p className="font-bold">Cíl podpory / partnerství</p>
            <p className="mt-1 text-zinc-300">
              Akcelerace obchodního nasazení v ČR a expanze na Slovensko a do regionu CEE / DACH, přímé napojení API velkoobchodů a výrobců, certifikace a rozšíření modulu Výchozích revizních zpráv (VRZ) a automatických cenových nabídek.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className={card}>
            <p className="font-bold">Rozpad využití podpory</p>
            <ol className="mt-2 flex flex-col gap-2">
              {funds.map((item, index) => {
                const share = fundShare(config.funds[index]);
                return (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 font-black text-zinc-950">{index + 1}</span>
                    <span className="flex-1 text-zinc-200">{item}</span>
                    {share ? <b className="font-mono text-yellow-300">{share}</b> : null}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className={cn(card, "flex items-center gap-4")}>
            <QRCodeSVG value={ELDOCK_URL} size={96} bgColor="#ffffff" fgColor="#09090b" marginSize={2} className="shrink-0 rounded-md" aria-label="QR kód na eldock.cz" />
            <div className="text-sm" data-testid="pitch-contact">
              <p className="text-lg font-bold">
                {config.contactName} · ELDOCK
              </p>
              <p className="text-yellow-300">{ELDOCK_URL}</p>
              {config.contactEmail ? <p className="text-zinc-300">{config.contactEmail}</p> : null}
              {config.contactPhone ? <p className="text-zinc-300">{config.contactPhone}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

/** 10 slidů v pořadí prezentace. */
export function pitchSlides(config: PitchConfig): ReactNode[] {
  return [<Slide1 key={1} />, <Slide2 key={2} />, <Slide3 key={3} />, <Slide4 key={4} />, <Slide5 key={5} />, <Slide6 key={6} />, <Slide7 key={7} />, <Slide8 key={8} />, <Slide9 key={9} />, <Slide10 key={10} config={config} />];
}

/** Executive Summary (One-Pager) – jedna stránka A4 na výšku pro rozdání u stolu. */
export function OnePager({ config }: { config: PitchConfig }) {
  const section = "break-inside-avoid";
  const head = "mb-1 text-[9pt] font-black tracking-wider text-zinc-900 uppercase";
  return (
    <article className="onepager mx-auto flex w-[210mm] max-w-full flex-col gap-[3.2mm] bg-white p-[11mm] text-[8.6pt] leading-snug text-zinc-800 shadow-2xl" data-testid="pitch-onepager">
      <header className="flex items-center justify-between gap-4 border-b-2 border-yellow-400 pb-[2.5mm]">
        <div className="flex items-center gap-3">
          <LogoMark className="size-12" />
          <div>
            <p className="text-[20pt] leading-none font-black text-zinc-950">
              <span className="text-yellow-500">EL</span>DOCK.cz
            </p>
            <p className="text-[8pt] font-semibold text-zinc-600">Executive Summary · Digitální ekosystém pro elektroinstalace, rozváděče a provoz budov a průmyslu</p>
          </div>
        </div>
        <QRCodeSVG value={ELDOCK_URL} size={78} marginSize={1} aria-label="QR kód na eldock.cz" />
      </header>

      <section className={section}>
        <p className="text-[10.5pt] font-bold text-zinc-950">
          Od 2D půdorysu a fotky rozváděče přes normativní výpočty až po digitální dvojče výrobního závodu, nemocnice či obchodního centra.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-[4mm]">
        <section className={section}>
          <h2 className={head}>Problém</h2>
          <ul className="list-disc pl-4">
            <li>
              <b>Montážní firmy a elektrikáři (40 000+ v ČR/SK)</b> ztrácejí desítky hodin měsíčně ručním počítáním kabelů z PDF půdorysů a lepením dokumentace rozváděčů, kusových zkoušek a výpočtů oteplení v Excelu.
            </li>
            <li>
              <b>Závody, OC a nemocnice</b> mají „mrtvou“ dokumentaci v šanonech nebo nepoužitelných BIM modelech, prostoje při nočních poruchách, nepodchycené změny ve schématech a přísnou legislativu (ČSN 33 2130 ed. 4, ČSN EN IEC 61439, Nařízení EU 2023/1230).
            </li>
          </ul>
        </section>
        <section className={section}>
          <h2 className={head}>Řešení – 3 propojené pilíře</h2>
          <ol className="list-decimal pl-4">
            {PILLARS.map((pillar) => (
              <li key={pillar.title}>
                <b>{pillar.title}:</b> {pillar.text}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className={section}>
        <h2 className={head}>Architektura platformy</h2>
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-[2mm] text-center text-[8pt]">
          {["📐 2D půdorys & kabeláž", "⚡ AI Panel Builder", "🏭 Průmysl & Facility"].map((label, index) => (
            <div key={label} className="contents">
              {index > 0 ? <span className="font-black text-yellow-500">→</span> : null}
              <span className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-[1.5mm] font-bold">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-[1.5mm] text-center text-[7.6pt] text-zinc-600">Jedna datová páteř: katalog výrobců ETIM 9.0 (MPN / EAN) · normy ČSN / EN / IEC · BIM IFC (ISO 16739) · cloud a aplikace Windows / Android / iOS</p>
      </section>

      <div className="grid grid-cols-3 gap-[4mm]">
        <section className={section}>
          <h2 className={head}>Technologický náskok</h2>
          <ul className="list-disc pl-4">
            <li>Deterministický Elektro-linter (ČSN 33 2130 ed. 4, 7-701, 7-710, 7-718), oteplení dle IEC TR 60890, PE / N sběrnice.</li>
            <li>Reálná data ETIM 9.0: MPN / EAN, ztráty ve W a vestavné hloubky předních výrobců.</li>
            <li>Nativní BIM (.ifc) parser v prohlížeči – provozní dvojče za 5 s.</li>
          </ul>
        </section>
        <section className={section}>
          <h2 className={head}>Trh a škálování</h2>
          <ul className="list-disc pl-4">
            <li>
              <b>A (SMB):</b> elektromontážní firmy, revizní technici, FVE a TČ.
            </li>
            <li>
              <b>B (Enterprise):</b> závody, OC a retail parky, nemocnice.
            </li>
            <li>ČR ➔ SK ➔ PL / HU ➔ DACH díky normám IEC / EN.</li>
          </ul>
        </section>
        <section className={section}>
          <h2 className={head}>Obchodní model</h2>
          <ul className="list-disc pl-4">
            <li>SaaS předplatné a kreditový systém.</li>
            <li>Roční B2B Enterprise licence (pod 2 mil. Kč bez tendrů).</li>
            <li>Transakční marže z kusovníků a rozváděče na klíč.</li>
          </ul>
        </section>
      </div>

      <section className={section}>
        <h2 className={head}>Současný stav – funkční produkt v produkci ({ELDOCK_URL})</h2>
        <div className="grid grid-cols-3 gap-[2mm]">
          {PROJECT_STATS.map((stat) => (
            <div key={stat.label} className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-[1.2mm]">
              <b className="text-[11pt] text-zinc-950">{stat.value}</b> <span className="text-[7.4pt] text-zinc-600">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={cn(section, "rounded-lg border-2 border-yellow-400 bg-yellow-50 p-[3mm]")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={cn(head, "mb-0")}>Žádost o podporu · Roadmap 2026–2027</h2>
          {config.partner.trim() ? <span className="text-[8pt] text-zinc-700">Připraveno pro: <b>{config.partner}</b></span> : null}
        </div>
        <p className="mt-1">
          <b>Cílová podpora{config.form.trim() ? ` (${config.form})` : ""}:</b> <span data-testid="onepager-amount">{amountLabel(config)}</span> · <b>Cíl:</b> akcelerace obchodního nasazení v ČR, expanze na Slovensko a do CEE / DACH, napojení API velkoobchodů a výrobců, certifikace a modul VRZ a automatických nabídek.
        </p>
        <p className="mt-1">
          <b>Využití:</b> 1) obchodní akvizice a B2B prodej{fundShare(config.funds[0]) ? ` (${fundShare(config.funds[0])})` : ""} · 2) rozvoj jádra a ETIM / velkoobchodních integrací{fundShare(config.funds[1]) ? ` (${fundShare(config.funds[1])})` : ""} · 3) zákaznická podpora a onboarding{fundShare(config.funds[2]) ? ` (${fundShare(config.funds[2])})` : ""}
        </p>
      </section>

      <footer className="mt-auto flex items-center justify-between border-t border-zinc-200 pt-[2mm] text-[8.4pt]">
        <span>
          <b className="text-zinc-950">{config.contactName} · ELDOCK</b> · {ELDOCK_URL}
          {config.contactEmail ? ` · ${config.contactEmail}` : ""}
          {config.contactPhone ? ` · ${config.contactPhone}` : ""}
        </span>
        <span className="text-zinc-500">Živá ukázka: {ELDOCK_URL}/prezentace</span>
      </footer>
    </article>
  );
}
