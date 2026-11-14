// Fáze 115: horní navigace průmyslového portálu (`AppHeader`) – místo 11 roztříštěných položek (5 odkazů na revize)
// 5 hlavních sekcí, každá rozbalí své stránky:
//   1 🗺️ Areál & Budovy – mapa areálu, budovy, podlaží, BIM (.ifc) a Studio výstavby;
//   2 ⚡ Rozváděče & Stroje – rozváděče a stroje závodu, QR pasporty, prediktivní údržba a What-If simulátor napájení;
//   3 📐 Schémata & Červenka – dokumentace, zákresy změn z haly, CAE Back-Office a Pool projektantů;
//   4 📋 Revize & Hlídač – centrální „Revize & Plánovač“ (`/revize`), plánovač, rychlá revize, Hlídač spotřebičů,
//     TIČR report a audit;
//   5 ⚙️ Správa & Účty – uživatelé a oprávnění, moduly a tarify, spárovaná zařízení a data firmy.
// Oprávnění a moduly filtruje hlavička (stejně jako dřív). Čisté funkce.

import type { Permission } from "@/lib/accounts";
import type { FeatureKey } from "@/lib/modules";
import { plantPhaseHref } from "@/lib/plant-phases";
import { revisionHubHref } from "@/lib/revision-hub";
import { auditReportHref, inspectionsHref, plannerHref, plantHref, rapidInspectionHref, ticrReportHref } from "@/lib/routes";

export type NavSectionId = "areal" | "stroje" | "schemata" | "revize" | "sprava";

export interface IndustryNavLink {
  href: string;
  label: string;
  srLabel: string;
  hint?: string;
  /** null = každý přihlášený účet závodu. */
  permission: Permission | null;
  feature?: FeatureKey;
  hideInFieldView?: boolean;
  /** Firemní účet (zařízení a data firmy). */
  company?: boolean;
}

export interface IndustryNavSection {
  id: NavSectionId;
  emoji: string;
  label: string;
  srLabel: string;
  /** Předpony adres aktivní sekce. */
  match: string[];
  links: IndustryNavLink[];
}

/** 5 sekcí horní navigace; odkazy do závodu jen s posledním otevřeným závodem. */
export function industryNav(plantId: string | null): IndustryNavSection[] {
  const plant = (phase: 1 | 2 | 3 | 4): IndustryNavLink[] => (plantId ? [{ href: plantPhaseHref(plantId, phase), label: "", srLabel: "", permission: null, hideInFieldView: true }] : []);
  const withText = (links: IndustryNavLink[], label: string, srLabel: string, hint: string) => links.map((link) => ({ ...link, label, srLabel, hint }));
  return [
    {
      id: "areal",
      emoji: "🗺️",
      label: "Areál & Budovy",
      srLabel: "Areál & Budovy – mapa areálu, budovy, podlaží, BIM .ifc a Studio",
      match: [...(plantId ? [plantHref(plantId)] : []), "/studio"],
      links: [
        ...withText(plant(1), "Mapa areálu & budovy", "Mapa areálu, budovy a podlaží", "Vrstvy napájení Síť / DA / UPS, budovy, podlaží a import BIM (.ifc)"),
        { href: "/studio", label: "Studio výstavby závodu", srLabel: "Studio výstavby závodu", hint: "Nová budova, podlaží a stroje na mapě areálu", permission: "studio", feature: "enterprise.studio" },
      ],
    },
    {
      id: "stroje",
      emoji: "⚡",
      label: "Rozváděče & Stroje",
      srLabel: "Rozváděče & Stroje – katalog zařízení, QR pasporty, napájení a prediktivní údržba",
      match: ["/equipment", "/nakupni-report"],
      links: [
        ...withText(plant(2), "Rozváděče, stroje & QR pasporty", "Rozváděče, stroje a QR pasporty závodu", "Katalog zařízení v závodě, stav dokumentace a tisk QR štítků"),
        ...withText(plant(4), "Prediktivní údržba & simulátor napájení", "Prediktivní údržba a What-If simulátor napájení", "Napájení Síť / DA / UPS, What-If simulátor zátěže a legislativa strojů"),
        // Fáze 116: konsolidovaná objednávka náhradních dílů před koncem životnosti
        { href: "/nakupni-report", label: "📦 Nákupní report součástek", srLabel: "Nákupní report prediktivní údržby – konsolidovaná objednávka náhradních dílů", hint: "Součástky celého závodu před koncem životnosti podle objednacího čísla", permission: "submitChange", hideInFieldView: true },
      ],
    },
    {
      id: "schemata",
      emoji: "📐",
      label: "Schémata & Červenka",
      srLabel: "Schémata & Červenka – dokumentace, zákresy změn, Pool projektantů a zálohy PLC",
      match: ["/cae", "/portal-projektantu"],
      links: [
        ...withText(plant(3), "Schémata, Červenka & zálohy PLC", "Schémata, Červenka a zálohy PLC závodu", "Platná schémata, zákresy změn z haly a verzované zálohy řídicího SW"),
        { href: "/cae", label: "Back-Office (CAE)", srLabel: "CAE Back-Office", hint: "Fronta změn k překreslení a schválení", permission: "caeOffice", feature: "cae.ticketing" },
        { href: "/portal-projektantu", label: "Pool projektantů", srLabel: "Portál projektantů ELDOCK Pool", hint: "Externí projektanti – Červenky k překreslení", permission: "submitChange", hideInFieldView: true },
      ],
    },
    {
      id: "revize",
      emoji: "📋",
      label: "Revize & Hlídač",
      srLabel: "Revize & Hlídač – centrální revizní portál, Chytrá revize, plánovač, spotřebiče a TIČR report",
      match: [revisionHubHref, inspectionsHref, "/hlidac-revizi", "/rychla-revize"],
      links: [
        { href: revisionHubHref, label: "Revize & Plánovač", srLabel: "Revize a plánovač – centrální revizní portál", hint: "Semafor budov, Chytrá revize, lhůtník, spotřebiče a TIČR report", permission: "inspections", hideInFieldView: true },
        { href: inspectionsHref, label: "Přehled revizí (lhůtník)", srLabel: "Přehled revizí", hint: "Všechny revize s hromadným zápisem a importem", permission: "inspections", hideInFieldView: true },
        { href: plannerHref, label: "Plánovač", srLabel: "Plánovač revizí", hint: "Kalendář revizí a výjezdů", permission: "planner", feature: "inspections.planner" },
        { href: rapidInspectionHref, label: "Rychlá revize", srLabel: "Rychlá revize", hint: "Spotřebiče a nářadí na místě", permission: "rapid", feature: "inspections.planner" },
        { href: "/hlidac-revizi", label: "Hlídač revizí (spotřebiče)", srLabel: "Hlídač revizí a správa spotřebičů a zařízení", hint: "Monitory, prodlužovačky, nářadí a AI čtečka štítků", permission: "inspections", hideInFieldView: true },
        { href: ticrReportHref, label: "TIČR report", srLabel: "Měsíční report a ochrana TIČR pro revizní techniky", hint: "Kontrolní výpis revizí pod číslem TIČR", permission: "recordInspection", hideInFieldView: true },
        { href: auditReportHref, label: "Audit", srLabel: "Auditní report", hint: "Kniha revizí pro TIČR / SÚIP", permission: "audit", feature: "inspections.audit" },
      ],
    },
    {
      id: "sprava",
      emoji: "⚙️",
      label: "Správa & Účty",
      srLabel: "Správa & Účty – uživatelé, oprávnění, moduly a spárovaná zařízení",
      match: ["/admin"],
      links: [
        { href: "/admin/users", label: "Účty a oprávnění", srLabel: "Správa podúčtů", hint: "Uživatelé a role", permission: "manageUsers" },
        { href: "/admin/modules", label: "Moduly a tarify", srLabel: "Správa modulů a tarifů", hint: "Zapnuté funkce a tarif", permission: "manageModules" },
        { href: "/admin/devices", label: "Spárovaná zařízení", srLabel: "Zařízení firmy", hint: "Aplikace Windows, iOS a Android", permission: "manageUsers", company: true },
        { href: "/admin/data", label: "Data firmy", srLabel: "Data firmy", hint: "Export a zrušení účtu", permission: "manageUsers", company: true },
      ],
    },
  ];
}
