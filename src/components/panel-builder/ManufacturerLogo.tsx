import { brandOf } from "@/lib/panel-builder/brands";
import { cn } from "@/lib/utils";

/**
 * Typografické vektorové wordmarky výrobců (fáze 47) – barvy a typografie značek kreslené kódem
 * (SVG, bez externích obrázků a CDN). Neznámý výrobce = neutrální wordmark z názvu.
 */
interface LogoStyle {
  text: string;
  color: string;
  /** Podklad (ABB, Rittal, Hensel – světlý text na barevném poli). */
  bg?: string;
  weight?: number;
  spacing?: number;
  italic?: boolean;
  size?: number;
  /** Doplňkový prvek wordmarku. */
  accent?: "abb" | "legrand" | "schneider" | "eaton" | "bar";
  sub?: string;
}

const STYLES: Record<string, LogoStyle> = {
  ABB: { text: "ABB", color: "#ffffff", bg: "#e30613", weight: 900, spacing: 1, size: 22, accent: "abb" },
  Eaton: { text: "EATON", color: "#005eb8", weight: 800, spacing: 2.5, size: 19, accent: "eaton" },
  OEZ: { text: "OEZ", color: "#009fe3", weight: 900, spacing: 1.5, size: 22 },
  Schneider: { text: "Schneider", color: "#3dcd58", weight: 700, size: 15, sub: "Electric", accent: "schneider" },
  Hager: { text: "hager", color: "#00468b", weight: 800, size: 22 },
  Noark: { text: "NOARK", color: "#d71920", weight: 900, spacing: 1.5, size: 19, italic: true },
  Bonega: { text: "BONEGA", color: "#f39200", weight: 900, spacing: 1, size: 17 },
  Schrack: { text: "SCHRACK", color: "#c8102e", weight: 800, spacing: 1, size: 16 },
  Siemens: { text: "SIEMENS", color: "#009999", weight: 800, spacing: 1.5, size: 16 },
  ETI: { text: "ETI", color: "#e2001a", weight: 900, spacing: 2, size: 22, accent: "bar" },
  SEZ: { text: "SEZ", color: "#004b93", weight: 900, spacing: 2, size: 22 },
  Saltek: { text: "SALTEK", color: "#e30613", weight: 800, spacing: 1, size: 17 },
  Hakel: { text: "HAKEL", color: "#1c63b7", weight: 900, spacing: 1.5, size: 18 },
  Legrand: { text: "legrand", color: "#e2231a", weight: 700, size: 18, accent: "legrand" },
  Loxone: { text: "LOXONE", color: "#69c350", weight: 800, spacing: 2, size: 16 },
  Eastron: { text: "EASTRON", color: "#1b3e8b", weight: 800, spacing: 1, size: 15 },
  Wago: { text: "WAGO", color: "#6ec800", weight: 900, spacing: 2, size: 20 },
  "Phoenix Contact": { text: "PHOENIX", color: "#008cd2", weight: 800, size: 14, sub: "CONTACT" },
  Omron: { text: "OMRON", color: "#005eb8", weight: 800, spacing: 2, size: 18 },
  Hensel: { text: "HENSEL", color: "#ffffff", bg: "#005ca9", weight: 800, spacing: 1.5, size: 15 },
  Rittal: { text: "RITTAL", color: "#ffffff", bg: "#e2001a", weight: 900, spacing: 1.5, size: 16 },
  Pfannenberg: { text: "PFANNENBERG", color: "#00539f", weight: 800, size: 11 },
  STEGO: { text: "STEGO", color: "#004a8f", weight: 900, spacing: 2, size: 18 },
};

const styleFor = (manufacturer: string): { key: string; style: LogoStyle } => {
  const brand = brandOf(manufacturer);
  const key = brand?.value ?? manufacturer;
  return { key, style: STYLES[key] ?? STYLES[manufacturer] ?? { text: manufacturer.toUpperCase().slice(0, 12), color: "#475569", weight: 800, size: manufacturer.length > 8 ? 12 : 16 } };
};

export function ManufacturerLogo({ manufacturer, className }: { manufacturer: string; className?: string }) {
  const { key, style } = styleFor(manufacturer);
  const label = brandOf(manufacturer)?.label ?? manufacturer;
  const font = "Arial, Helvetica, sans-serif";
  const textY = style.sub ? 18 : 24;
  return (
    <svg viewBox="0 0 120 36" className={cn("h-8 w-auto shrink-0", className)} role="img" aria-label={`Logo ${label}`} data-logo={key}>
      <rect x="0" y="0" width="120" height="36" rx="5" fill={style.bg ?? "#ffffff"} />
      {style.accent === "abb" ? (
        // dělené písmo ABB: bílé vodorovné průřezy přes znaky
        <>
          <text x="60" y="26" textAnchor="middle" fontFamily={font} fontSize={style.size} fontWeight={style.weight} letterSpacing={style.spacing} fill={style.color}>
            {style.text}
          </text>
          <rect x="30" y="16.2" width="60" height="1.6" fill={style.bg} />
          <rect x="30" y="20.4" width="60" height="1.6" fill={style.bg} />
        </>
      ) : (
        <text x="60" y={textY} textAnchor="middle" fontFamily={font} fontSize={style.size} fontWeight={style.weight} letterSpacing={style.spacing} fontStyle={style.italic ? "italic" : undefined} fill={style.color}>
          {style.text}
        </text>
      )}
      {style.sub ? (
        <text x="60" y="31" textAnchor="middle" fontFamily={font} fontSize={9} fontWeight={600} letterSpacing={1.5} fill={style.color}>
          {style.sub}
        </text>
      ) : null}
      {style.accent === "legrand" ? <rect x="10" y="12" width="8" height="12" rx="1" fill={style.color} /> : null}
      {style.accent === "eaton" ? <rect x="22" y="28" width="76" height="2" fill={style.color} /> : null}
      {style.accent === "bar" ? <rect x="38" y="29" width="44" height="2.5" fill={style.color} /> : null}
      {style.accent === "schneider" ? <circle cx="108" cy="9" r="3" fill={style.color} /> : null}
    </svg>
  );
}
