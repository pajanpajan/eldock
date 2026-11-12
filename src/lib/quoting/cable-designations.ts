// Fáze 105: označení kabelů a vodičů Eldocku ↔ položky ceníků výrobců (klíč ceny „CYKY-J 3X1,5“, „H07V-K 2,5“).
// Popisy v ceníku („Kabel CYKY-J 3 x 1,5 mm², kruh 100 m“) i ve výkazu kabeláže Eldocku („CAT7 / KNX J-Y(St)Y 2×2×0,8
// (sběrnice 24 V DC)“) se převedou na stejný klíč: typ kabelu + počet žil × průřez (bez balení, barvy a poznámky).

/** Kabely a vodiče, pro které import hledá ceníkovou cenu za metr. */
export const PRICED_CABLES: readonly string[] = [
  "CYKY-J 3×1,5",
  "CYKY-J 3×2,5",
  "CYKY-J 3×4",
  "CYKY-J 3×6",
  "CYKY-J 4×10",
  "CYKY-J 4×16",
  "CYKY-J 4×25",
  "CYKY-J 5×1,5",
  "CYKY-J 5×2,5",
  "CYKY-J 5×4",
  "CYKY-J 5×6",
  "CYKY-J 5×10",
  "CYKY-J 5×16",
  "CYKY-J 5×25",
  "CYKY-J 7×1,5",
  "CYKY-O 2×1,5",
  "CYKY-O 3×1,5",
  "CYKY-O 5×1,5",
  "J-Y(St)Y 2×2×0,8",
  "SYKFY 2×2×0,5",
  "SYKFY 3×2×0,5",
  "CYSY 2×1",
  "CYSY 3×1,5",
  "CYSY 4×1,5",
  "CYSY 5×1,5",
  "1-CXKH-R-J 3×1,5",
  "1-CXKH-R-J 3×2,5",
  "1-CXKH-R-J 5×1,5",
  "1-CXKH-R-J 5×2,5",
  "H07V-K 1,5",
  "H07V-K 2,5",
  "H07V-K 4",
  "H07V-K 6",
  "H07V-K 10",
  "H07V-K 16",
  "H07V-K 25",
];

const number = (value: string) => value.replace(".", ",").replace(/,0+$/, "");

/** Klíč ceny z libovolného popisu kabelu (ceník i výkaz Eldocku); null = není to kabel se známým označením. */
export function cableKey(text: string): string | null {
  const source = text.replace(/\s+/g, " ").trim();
  // Jednožilové vodiče (lanko CYA): „H07V-K 2,5 mm²“, „H07V-K 16 černý“
  const wire = /(?<![\w-])(H07V-K|H05V-K|H07V-U|CYA|CY)\s*(\d+(?:[.,]\d+)?)(?=\s*(?:mm|$|[\s,(]))/i.exec(source);
  if (wire && !/\d\s*[x×]\s*\d/.test(source.slice(wire.index, wire.index + 30))) {
    const family = /^(CYA|CY)$/i.test(wire[1]) ? "H07V-K" : wire[1].toUpperCase();
    return `${family} ${number(wire[2])}`;
  }
  const cable = /(?<![\w-])(1-)?(CYKY|CXKH-R|SYKFY|CYSY|J-Y\(St\)Y)(?:\s*-\s*([JO]))?\s*(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?/i.exec(source);
  if (!cable) return null;
  const [, , rawFamily, variant, cores, size, pairSize] = cable;
  const family = rawFamily.toUpperCase().replace("J-Y(ST)Y", "J-Y(ST)Y");
  // CYKY a CXKH-R musí mít uvedené provedení J / O (jinak nejasné – „CYKY 5 x 2,5“)
  if ((family === "CYKY" || family === "CXKH-R") && !variant) return null;
  const prefix = family === "CXKH-R" ? "1-CXKH-R" : family;
  const dims = pairSize ? `${cores}X${number(size)}X${number(pairSize)}` : `${cores}X${number(size)}`;
  return `${prefix}${variant ? `-${variant.toUpperCase()}` : ""} ${dims}`;
}

/** Klíč ceny pro označení kabelu ve výkazu kabeláže / kusovníku Eldocku. */
export const cablePriceKey = (label: string): string | null => cableKey(label);
