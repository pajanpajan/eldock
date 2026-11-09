// Fáze 71: ikona aplikace (stejná značka jako web – src/lib/brand-icon.tsx) → build/icon.svg a build/icon.png
// (512 px; electron-builder z ní vyrobí ikonu .ico pro Windows). Sharp se bere z kořene projektu.
import { mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

const YELLOW = "#facc15";
const DARK = "#09090b";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 32 32">
  <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="${YELLOW}"/>
  <path d="M7 23V9.5h18V23" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M17.6 11.5 12.8 17.4h3.3l-1.4 4.2 4.9-6.1h-3.3z" fill="${DARK}"/>
  <rect x="4.5" y="23" width="23" height="4" rx="1" fill="${DARK}"/>
  <path d="M8 27l2.4-4M12.5 27l2.4-4M17 27l2.4-4M21.5 27l2.4-4" stroke="${YELLOW}" stroke-width="1.3"/>
</svg>
`;

mkdirSync("build", { recursive: true });
writeFileSync("build/icon.svg", svg);
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile("build/icon.png");
console.log("build/icon.svg + build/icon.png");
