// Fáze 71 a 73: ikony aplikace (stejná značka jako web – src/lib/brand-icon.tsx). Sharp se bere z kořene projektu.
// - Windows: build/icon.svg a build/icon.png (512 px; electron-builder z ní vyrobí ikonu .ico),
// - Android: starší ikony mipmap (adaptivní ikona, úvodní obrazovka a ikona oznámení jsou vektory v res/drawable),
// - iOS: ikona aplikace 1024 px (neprůhledná, roh zakulatí systém) a úvodní obrazovka 2732 px.
// Spouštět z apps/client: `npm run icon`.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

const YELLOW = "#facc15";
const DARK = "#09090b";
// Hala s bleskem na základu se šrafováním (návrh 32 × 32)
const GLYPH = `
  <path d="M7 23V9.5h18V23" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M17.6 11.5 12.8 17.4h3.3l-1.4 4.2 4.9-6.1h-3.3z" fill="${DARK}"/>
  <rect x="4.5" y="23" width="23" height="4" rx="1" fill="${DARK}"/>
  <path d="M8 27l2.4-4M12.5 27l2.4-4M17 27l2.4-4M21.5 27l2.4-4" stroke="${YELLOW}" stroke-width="1.3"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 32 32">
  <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="${YELLOW}"/>${GLYPH}
</svg>
`;

// Celoplošná ikona (iOS, starší Android): žluté pozadí, značka uprostřed (střed návrhu je 16; 18,25)
const fullBleed = (size, round = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  ${round ? `<circle cx="16" cy="16" r="16" fill="${YELLOW}"/>` : `<rect width="32" height="32" fill="${YELLOW}"/>`}
  <g transform="translate(16 16) scale(0.92) translate(-16 -18.25)">${GLYPH}</g>
</svg>`;

// Úvodní obrazovka iOS: tmavé pozadí, značka uprostřed (obrázek se roztáhne na displej a ořízne)
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="${DARK}"/>
  <g transform="translate(1166 1166) scale(12.5)">
    <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="${YELLOW}"/>${GLYPH}
  </g>
</svg>`;

const png = (source, size, file) => sharp(Buffer.from(source)).resize(size, size).flatten({ background: DARK }).png().toFile(file);

mkdirSync("build", { recursive: true });
writeFileSync("build/icon.svg", svg);
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile("build/icon.png");
console.log("build/icon.svg + build/icon.png");

const ANDROID_RES = "android/app/src/main/res";
if (existsSync(ANDROID_RES)) {
  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [density, size] of Object.entries(densities)) {
    const dir = `${ANDROID_RES}/mipmap-${density}`;
    mkdirSync(dir, { recursive: true });
    await sharp(Buffer.from(fullBleed(size))).resize(size, size).png().toFile(`${dir}/ic_launcher.png`);
    await sharp(Buffer.from(fullBleed(size, true))).resize(size, size).png().toFile(`${dir}/ic_launcher_round.png`);
  }
  console.log("android: mipmap ic_launcher + ic_launcher_round");
}

const IOS_ASSETS = "ios/App/App/Assets.xcassets";
if (existsSync(IOS_ASSETS)) {
  await png(fullBleed(1024), 1024, `${IOS_ASSETS}/AppIcon.appiconset/AppIcon-512@2x.png`);
  for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) await png(splash, 2732, `${IOS_ASSETS}/Splash.imageset/${name}`);
  console.log("ios: AppIcon 1024 + Splash 2732");
}
