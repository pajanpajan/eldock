// Oficiální loga výrobců do public/brands/ (fáze 51): `npm run brands:fetch`.
//   --force      přepsat i existující soubory
//   --offline    nic nestahovat, jen doplnit chybějící loga generovaným wordmarkem
// Stáhne vektorová SVG z Wikimedia Commons (LOGO_SOURCES), zkontroluje je (žádné skripty ani externí
// odkazy) a uloží. Značky bez veřejného SVG dostanou vektorový wordmark generovaný kódem.
// Vlastní logo (PNG / WebP / SVG) stačí nahrát do public/brands/<slug>.<přípona> – skript ho bez --force
// nepřepíše a aplikace ho použije přednostně.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { BRAND_LOGO_EXTENSIONS, BRAND_SLUGS, LOGO_SOURCES, WORDMARKS, sanitizeSvg, wordmarkSvg } from "../src/lib/panel-builder/brand-logos";

const force = process.argv.includes("--force");
const offline = process.argv.includes("--offline");
const dir = path.join(process.cwd(), "public", "brands");
const USER_AGENT = "EldockBrandLogos/1.0 (https://eldock.cz)";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(file: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
      if (response.status === 429) {
        await sleep(4000 * (attempt + 1));
        continue;
      }
      if (!response.ok) return null;
      const text = await response.text();
      return sanitizeSvg(text);
    } catch {
      await sleep(1500);
    }
  }
  return null;
}

async function main() {
  await mkdir(dir, { recursive: true });
  const slugs = [...new Set([...Object.values(BRAND_SLUGS), ...Object.keys(WORDMARKS)])];
  const report: string[] = [];
  for (const slug of slugs) {
    const existing = BRAND_LOGO_EXTENSIONS.find((ext) => existsSync(path.join(dir, `${slug}.${ext}`)));
    if (existing && !force) {
      report.push(`  ${slug.padEnd(16)} ponecháno (${slug}.${existing})`);
      continue;
    }
    let svg: string | null = null;
    let source = "generovaný wordmark";
    if (!offline) {
      for (const file of LOGO_SOURCES[slug] ?? []) {
        svg = await download(file);
        if (svg) {
          source = `Wikimedia Commons: ${file}`;
          break;
        }
        await sleep(1200);
      }
    }
    await writeFile(path.join(dir, `${slug}.svg`), svg ?? wordmarkSvg(slug), "utf8");
    report.push(`  ${slug.padEnd(16)} ${source}`);
    if (svg) await sleep(1200);
  }
  console.log(`Loga výrobců v ${dir}:\n${report.join("\n")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
