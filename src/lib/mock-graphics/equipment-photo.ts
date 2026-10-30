// „Fotografie“ demo zařízení – technické ilustrace v SVG generované kódem (bez externích obrázků).
// Styl produktové fotky: studiové pozadí, stín na podlaze, kovové přechody a štítek s tagem.

export type EquipmentPhotoKind = "switchboard" | "motor" | "plc" | "microwave" | "cable-drum" | "kettle";

const W = 800;
const H = 600;

const esc = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);

const DEFS = `<defs>
  <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#3a3f47"/><stop offset="1" stop-color="#15171b"/></radialGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23262b"/><stop offset="1" stop-color="#0d0e10"/></linearGradient>
  <radialGradient id="shadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9bec5"/><stop offset=".45" stop-color="#e6e8eb"/><stop offset="1" stop-color="#9aa0a8"/></linearGradient>
  <linearGradient id="steelV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef0f2"/><stop offset="1" stop-color="#a5abb3"/></linearGradient>
  <linearGradient id="ral7035" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9ccc8"/><stop offset=".5" stop-color="#dfe1dd"/><stop offset="1" stop-color="#b4b7b3"/></linearGradient>
  <linearGradient id="motorBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f86c6"/><stop offset=".45" stop-color="#2d5f9e"/><stop offset="1" stop-color="#173a66"/></linearGradient>
  <linearGradient id="dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3f45"/><stop offset="1" stop-color="#1c1e22"/></linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2430"/><stop offset=".6" stop-color="#0c1118"/><stop offset="1" stop-color="#26313d"/></linearGradient>
  <linearGradient id="orange" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a3c"/><stop offset="1" stop-color="#d9621a"/></linearGradient>
  <linearGradient id="red" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b3261e"/><stop offset=".5" stop-color="#e0473b"/><stop offset="1" stop-color="#8f1d17"/></linearGradient>
</defs>`;

function stage(body: string, shadowWidth: number) {
  return `<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect y="470" width="${W}" height="130" fill="url(#floor)"/>
<ellipse cx="400" cy="500" rx="${shadowWidth}" ry="26" fill="url(#shadow)"/>
${body}`;
}

/** Žlutý inventární štítek s tagem (jako fyzický QR štítek Eldock). */
function tagSticker(x: number, y: number, tag: string) {
  const width = Math.max(64, tag.length * 9 + 34);
  return `<g transform="translate(${x} ${y})">
  <rect width="${width}" height="26" rx="3" fill="#facc15" stroke="#111" stroke-width="1.5"/>
  <rect x="4" y="4" width="18" height="18" fill="#111"/><rect x="7" y="7" width="5" height="5" fill="#facc15"/><rect x="14" y="14" width="5" height="5" fill="#facc15"/><rect x="14" y="7" width="3" height="3" fill="#facc15"/>
  <text x="28" y="18" font-family="ui-monospace, monospace" font-size="13" font-weight="700" fill="#111">${esc(tag)}</text>
</g>`;
}

function switchboard(tag: string) {
  const breakers = Array.from({ length: 12 }, (_, i) => {
    const x = 296 + i * 18;
    return `<rect x="${x}" y="196" width="15" height="40" rx="1.5" fill="#f4f4f2" stroke="#9a9a96"/><rect x="${x + 4}" y="206" width="7" height="12" rx="1" fill="${i % 5 === 0 ? "#2563eb" : "#1f2937"}"/>`;
  }).join("");
  const breakers2 = Array.from({ length: 10 }, (_, i) => {
    const x = 296 + i * 21;
    return `<rect x="${x}" y="276" width="18" height="44" rx="1.5" fill="#f4f4f2" stroke="#9a9a96"/><rect x="${x + 5}" y="287" width="8" height="13" rx="1" fill="${i === 0 ? "#dc2626" : "#1f2937"}"/>`;
  }).join("");
  return stage(
    `<rect x="250" y="80" width="300" height="410" rx="6" fill="url(#ral7035)" stroke="#8d918d" stroke-width="2"/>
<rect x="262" y="94" width="276" height="382" rx="4" fill="#d4d7d2" stroke="#9fa39f"/>
<rect x="276" y="110" width="248" height="300" rx="3" fill="url(#glass)" opacity=".92"/>
<rect x="286" y="180" width="228" height="4" fill="#8e9399"/><rect x="286" y="260" width="228" height="4" fill="#8e9399"/>
${breakers}${breakers2}
<rect x="300" y="340" width="70" height="52" rx="3" fill="#e8e8e4" stroke="#999"/><rect x="314" y="352" width="42" height="18" fill="#0f172a"/><text x="335" y="365" text-anchor="middle" font-family="monospace" font-size="10" fill="#22c55e">230.4V</text>
<rect x="388" y="336" width="110" height="60" rx="3" fill="#1f2937"/><circle cx="415" cy="366" r="16" fill="#dc2626" stroke="#facc15" stroke-width="5"/><rect x="440" y="350" width="46" height="32" rx="2" fill="#374151"/>
<path d="M276 110 L330 110 L290 410 L276 410 Z" fill="#fff" opacity=".07"/>
<rect x="520" y="230" width="10" height="64" rx="4" fill="#3f4348"/>
<path d="M400 424 l18 32 h-36 z" fill="#facc15" stroke="#111" stroke-width="2"/><path d="M402 432 l-6 12 h6 l-4 9 10 -14 h-6 l4 -7 z" fill="#111"/>
<rect x="250" y="490" width="300" height="10" fill="#555a5f"/>
${tagSticker(272, 440, tag)}`,
    190,
  );
}

function motor(tag: string) {
  const fins = Array.from({ length: 14 }, (_, i) => `<rect x="${262 + i * 20}" y="196" width="9" height="208" rx="3" fill="#1d4677" opacity=".55"/>`).join("");
  return stage(
    `<rect x="220" y="430" width="380" height="40" rx="4" fill="url(#dark)"/>
<rect x="250" y="400" width="40" height="40" fill="#1d3e6b"/><rect x="530" y="400" width="40" height="40" fill="#1d3e6b"/>
<rect x="240" y="180" width="320" height="240" rx="40" fill="url(#motorBlue)"/>
${fins}
<rect x="240" y="180" width="320" height="40" rx="20" fill="#fff" opacity=".1"/>
<rect x="552" y="200" width="60" height="200" rx="18" fill="#22497c"/>
<circle cx="612" cy="300" r="56" fill="#2a5a92" stroke="#173a66" stroke-width="6"/>
<rect x="612" y="286" width="90" height="28" rx="4" fill="url(#steelV)"/><rect x="690" y="290" width="10" height="20" fill="#7d8389"/>
<rect x="196" y="196" width="52" height="208" rx="16" fill="#1d4677"/>
<g transform="translate(330 120)"><rect width="120" height="70" rx="6" fill="url(#motorBlue)" stroke="#173a66" stroke-width="3"/><rect x="10" y="10" width="100" height="10" rx="2" fill="#173a66"/><circle cx="104" cy="54" r="9" fill="#111"/></g>
<rect x="290" y="240" width="110" height="56" rx="3" fill="url(#steelV)" stroke="#6b7280"/>
<text x="300" y="258" font-family="sans-serif" font-size="11" font-weight="700" fill="#111">3~ MOT IE3</text>
<text x="300" y="274" font-family="monospace" font-size="10" fill="#222">400 V Δ  7,5 kW</text>
<text x="300" y="288" font-family="monospace" font-size="10" fill="#222">1460 min⁻¹ IP55</text>
${tagSticker(420, 330, tag)}`,
    250,
  );
}

function plc(tag: string) {
  const modules = Array.from({ length: 9 }, (_, i) => {
    const x = 270 + i * 30;
    const leds = Array.from({ length: 6 }, (_, j) => `<circle cx="${x + 8 + (j % 2) * 10}" cy="${172 + Math.floor(j / 2) * 9}" r="2.6" fill="${(i + j) % 3 === 0 ? "#22c55e" : (i + j) % 4 === 0 ? "#f59e0b" : "#14532d"}"/>`).join("");
    return `<rect x="${x}" y="152" width="27" height="96" rx="2" fill="${i === 0 ? "#0f766e" : "#2f343a"}" stroke="#111"/>${leds}<rect x="${x + 4}" y="208" width="19" height="30" fill="#1b1e22"/>`;
  }).join("");
  const terminals = Array.from({ length: 30 }, (_, i) => `<rect x="${268 + i * 9}" y="330" width="8" height="34" fill="${i % 6 === 5 ? "#16a34a" : i % 6 === 4 ? "#2563eb" : "#9ca3af"}" stroke="#4b5563" stroke-width=".5"/>`).join("");
  return stage(
    `<rect x="230" y="70" width="340" height="420" rx="6" fill="url(#ral7035)" stroke="#8d918d" stroke-width="2"/>
<rect x="246" y="86" width="308" height="388" fill="#f0f1ee" stroke="#b5b8b4"/>
<rect x="256" y="104" width="288" height="24" fill="#9ca3af"/><rect x="256" y="270" width="288" height="24" fill="#9ca3af"/><rect x="256" y="380" width="288" height="24" fill="#9ca3af"/>
<rect x="256" y="140" width="288" height="6" fill="#8e9399"/>
${modules}
<rect x="256" y="320" width="288" height="5" fill="#8e9399"/>
${terminals}
<path d="M300 248 C 300 262, 280 262, 280 272 M340 248 C 340 262, 360 262, 360 272 M420 248 C 420 262, 440 262, 440 272" stroke="#2563eb" stroke-width="3" fill="none"/>
<path d="M300 364 C 300 372, 310 372, 310 382 M400 364 C 400 372, 390 372, 390 382" stroke="#dc2626" stroke-width="3" fill="none"/>
<rect x="440" y="412" width="96" height="50" rx="3" fill="#1f2937"/><rect x="450" y="420" width="44" height="30" fill="#0e7490"/><text x="472" y="440" text-anchor="middle" font-family="monospace" font-size="10" fill="#e0f2fe">HMI</text>
<rect x="566" y="220" width="10" height="70" rx="4" fill="#3f4348"/>
${tagSticker(258, 418, tag)}`,
    200,
  );
}

function microwave(tag: string) {
  return stage(
    `<rect x="190" y="240" width="420" height="230" rx="14" fill="url(#steelV)" stroke="#7d8389" stroke-width="2"/>
<rect x="208" y="258" width="290" height="194" rx="8" fill="url(#glass)"/>
<rect x="222" y="272" width="262" height="166" rx="5" fill="none" stroke="#3b4652" stroke-width="2" stroke-dasharray="2 4"/>
<path d="M222 272 L300 272 L240 438 L222 438 Z" fill="#fff" opacity=".07"/>
<rect x="508" y="258" width="88" height="194" rx="6" fill="#d9dce0"/>
<rect x="520" y="272" width="64" height="26" rx="3" fill="#0f172a"/><text x="552" y="290" text-anchor="middle" font-family="monospace" font-size="15" fill="#22d3ee">12:30</text>
<circle cx="552" cy="340" r="22" fill="url(#steel)" stroke="#6b7280" stroke-width="2"/><rect x="550" y="320" width="4" height="12" fill="#374151"/>
<rect x="526" y="380" width="52" height="16" rx="3" fill="#9ca3af"/><rect x="526" y="404" width="52" height="16" rx="3" fill="#9ca3af"/>
<rect x="210" y="470" width="30" height="8" fill="#333"/><rect x="560" y="470" width="30" height="8" fill="#333"/>
${tagSticker(520, 430, tag)}`,
    240,
  );
}

function cableDrum(tag: string) {
  const turns = Array.from({ length: 9 }, (_, i) => `<path d="M${312 + i * 20} 210 v180" stroke="#c2410c" stroke-width="16" stroke-linecap="round"/>`).join("");
  return stage(
    `<path d="M300 470 L360 300 M500 470 L440 300" stroke="url(#steel)" stroke-width="12" stroke-linecap="round"/>
<circle cx="400" cy="300" r="150" fill="url(#red)" stroke="#6b1410" stroke-width="4"/>
<circle cx="400" cy="300" r="150" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="20"/>
<rect x="300" y="200" width="200" height="200" rx="10" fill="url(#orange)"/>
${turns}
<circle cx="400" cy="300" r="46" fill="#111"/><circle cx="400" cy="300" r="30" fill="url(#steel)"/><circle cx="400" cy="300" r="10" fill="#374151"/>
<g transform="translate(372 116)"><rect width="56" height="50" rx="8" fill="#1f2937"/><rect x="8" y="6" width="40" height="38" rx="19" fill="#374151"/><circle cx="20" cy="25" r="3" fill="#111"/><circle cx="36" cy="25" r="3" fill="#111"/><rect x="26" y="10" width="4" height="7" fill="#d1d5db"/></g>
<path d="M470 410 C 560 430, 600 470, 660 474" stroke="#c2410c" stroke-width="12" fill="none" stroke-linecap="round"/>
<rect x="650" y="462" width="40" height="24" rx="5" fill="#1f2937"/>
${tagSticker(318, 420, tag)}`,
    220,
  );
}

function kettle(tag: string) {
  return stage(
    `<ellipse cx="400" cy="462" rx="130" ry="20" fill="#1f2937"/><rect x="270" y="440" width="260" height="22" rx="10" fill="url(#dark)"/>
<path d="M300 440 L318 220 Q400 190 482 220 L500 440 Z" fill="url(#steel)" stroke="#6b7280" stroke-width="2"/>
<path d="M318 220 Q400 190 482 220 L478 250 Q400 224 322 250 Z" fill="#1f2937"/>
<path d="M318 230 L268 210 L306 268 Z" fill="url(#steel)" stroke="#6b7280"/>
<path d="M486 250 C 580 250, 580 420, 496 420" stroke="#1f2937" stroke-width="26" fill="none" stroke-linecap="round"/>
<rect x="384" y="268" width="32" height="140" rx="12" fill="#0f172a" opacity=".85"/><rect x="390" y="330" width="20" height="72" rx="8" fill="#38bdf8" opacity=".7"/>
<path d="M330 232 L346 436" stroke="#fff" stroke-opacity=".35" stroke-width="10"/>
<rect x="512" y="398" width="22" height="12" rx="3" fill="#ef4444"/>
${tagSticker(330, 470, tag)}`,
    170,
  );
}

const RENDERERS: Record<EquipmentPhotoKind, (tag: string) => string> = {
  switchboard,
  motor,
  plc,
  microwave,
  "cable-drum": cableDrum,
  kettle,
};

/** SVG „fotografie“ zařízení (800×600) se štítkem tagu. */
export function renderEquipmentPhotoSvg(kind: EquipmentPhotoKind, tag: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${DEFS}${RENDERERS[kind](tag)}</svg>`;
}
