import { esc, n, seededRandom } from "./svg";

// Stylizované SVG „fotky“ z haly: zapojení v rozváděči a štítek přístroje.
// Deterministické podle `seed`, žádné externí obrázky.

export type PhotoInput =
  | { kind: "wiring"; tag: string; seed?: string; stamp?: string }
  | {
      kind: "label";
      tag: string;
      seed?: string;
      stamp?: string;
      plate: { manufacturer: string; type: string; lines: string[] };
    };

const W = 1200;
const H = 900;
const WIRE_COLORS = ["#111827", "#1d4ed8", "#b91c1c", "#92400e", "#6b7280", "#15803d", "#f5f5f4"];

function defs(): string {
  return (
    `<defs>` +
    `<radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.65"/></radialGradient>` +
    `<linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#d6d9dc"/><stop offset="100%" stop-color="#9aa0a6"/></linearGradient>` +
    `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0"/></filter>` +
    `</defs>`
  );
}

function overlay(stamp: string): string {
  return (
    `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.5"/>` +
    `<rect width="${W}" height="${H}" fill="url(#vig)"/>` +
    `<text x="${W - 30}" y="${H - 28}" font-family="ui-monospace, Consolas, monospace" font-size="28" fill="#fb923c" text-anchor="end">${esc(stamp)}</text>`
  );
}

function wiring(input: Extract<PhotoInput, { kind: "wiring" }>): string {
  const rand = seededRandom(input.seed ?? input.tag);
  const out: string[] = [`<rect width="${W}" height="${H}" fill="url(#panel)"/>`];

  // Kabelové žlaby a lišty DIN
  const rails = [170, 450, 730];
  for (const y of rails) {
    out.push(
      `<rect x="40" y="${y - 70}" width="${W - 80}" height="46" rx="4" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>`,
    );
    for (let x = 60; x < W - 60; x += 22) {
      out.push(`<rect x="${x}" y="${y - 64}" width="10" height="34" rx="2" fill="#6b7280" opacity="0.55"/>`);
    }
    out.push(`<rect x="40" y="${y}" width="${W - 80}" height="26" fill="#52565c"/><rect x="40" y="${y + 8}" width="${W - 80}" height="9" fill="#2f3237"/>`);
  }

  // Moduly na lištách
  for (const y of rails) {
    let x = 70;
    while (x < W - 150) {
      const w = 40 + Math.floor(rand() * 4) * 22;
      const kind = rand();
      const h = 150;
      const top = y - h + 26;
      const body = kind < 0.4 ? "#f1f5f9" : kind < 0.75 ? "#1f2937" : "#d1d5db";
      out.push(
        `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="5" fill="${body}" stroke="#0f172a" stroke-width="2"/>`,
        `<rect x="${x + 6}" y="${top + 12}" width="${w - 12}" height="26" rx="3" fill="${kind < 0.75 ? "#e2e8f0" : "#9ca3af"}" opacity="0.8"/>`,
        `<circle cx="${x + w / 2}" cy="${top + 70}" r="${Math.min(14, w / 4)}" fill="${kind < 0.4 ? "#2563eb" : "#fbbf24"}" stroke="#0f172a" stroke-width="2"/>`,
        `<rect x="${x + 6}" y="${top + h - 34}" width="${w - 12}" height="12" fill="#0f172a" opacity="0.6"/>`,
      );
      // Vodiče vedoucí ze svorek do žlabu
      for (let k = 0; k < 3; k++) {
        const wx = x + 8 + k * ((w - 16) / 2);
        const color = WIRE_COLORS[Math.floor(rand() * WIRE_COLORS.length)];
        out.push(
          `<path d="M${n(wx)} ${top} C ${n(wx + (rand() - 0.5) * 40)} ${top - 30}, ${n(wx + (rand() - 0.5) * 40)} ${top - 36}, ${n(wx + (rand() - 0.5) * 20)} ${y - 24}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`,
        );
      }
      x += w + 10 + Math.floor(rand() * 10);
    }
  }

  // Popisný štítek u „nového“ komponentu
  const lx = 520 + Math.floor(rand() * 80);
  out.push(
    `<g transform="rotate(-3 ${lx} 360)"><rect x="${lx}" y="330" width="170" height="54" rx="3" fill="#fefce8" stroke="#a16207" stroke-width="2"/>` +
      `<text x="${lx + 85}" y="353" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#111827" text-anchor="middle">${esc(input.tag)}</text>` +
      `<text x="${lx + 85}" y="374" font-family="Arial, sans-serif" font-size="14" fill="#374151" text-anchor="middle">NOVÉ ZAPOJENÍ</text></g>`,
  );

  return out.join("");
}

function label(input: Extract<PhotoInput, { kind: "label" }>): string {
  const { plate } = input;
  const out: string[] = [
    `<rect width="${W}" height="${H}" fill="url(#panel)"/>`,
    // Svislá lišta okolo štítku
    `<rect x="0" y="0" width="${W}" height="120" fill="#52565c"/><rect x="0" y="${H - 120}" width="${W}" height="120" fill="#52565c"/>`,
    `<rect x="150" y="190" width="900" height="520" rx="22" fill="#e7e5e4" stroke="#44403c" stroke-width="6"/>`,
  ];
  for (const [cx, cy] of [[190, 230], [1010, 230], [190, 670], [1010, 670]]) {
    out.push(
      `<circle cx="${cx}" cy="${cy}" r="16" fill="#a8a29e" stroke="#44403c" stroke-width="3"/><line x1="${cx - 10}" y1="${cy - 4}" x2="${cx + 10}" y2="${cy + 4}" stroke="#44403c" stroke-width="3"/>`,
    );
  }
  out.push(
    `<text x="600" y="300" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#1c1917" text-anchor="middle">${esc(plate.manufacturer)}</text>`,
    `<text x="600" y="360" font-family="ui-monospace, Consolas, monospace" font-size="38" fill="#1c1917" text-anchor="middle">${esc(plate.type)}</text>`,
    `<line x1="220" y1="388" x2="980" y2="388" stroke="#57534e" stroke-width="3"/>`,
  );
  plate.lines.slice(0, 6).forEach((line, i) => {
    out.push(
      `<text x="230" y="${440 + i * 44}" font-family="ui-monospace, Consolas, monospace" font-size="30" fill="#292524">${esc(line)}</text>`,
    );
  });
  out.push(
    `<g transform="translate(830 595)"><rect width="110" height="44" rx="4" fill="#fff" stroke="#292524" stroke-width="2"/><text x="55" y="31" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#292524" text-anchor="middle">CE</text></g>`,
    `<g transform="rotate(2 600 780)"><rect x="440" y="745" width="320" height="64" rx="4" fill="#fefce8" stroke="#a16207" stroke-width="2"/><text x="600" y="786" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#111827" text-anchor="middle">${esc(input.tag)}</text></g>`,
  );
  return out.join("");
}

export function renderPhotoSvg(input: PhotoInput): string {
  const body = input.kind === "wiring" ? wiring(input) : label(input);
  const stamp = input.stamp ?? "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<title>${esc(input.kind === "wiring" ? `Zapojení rozváděče ${input.tag}` : `Štítek přístroje – ${input.tag}`)}</title>` +
    defs() +
    body +
    overlay(stamp) +
    `</svg>\n`
  );
}
