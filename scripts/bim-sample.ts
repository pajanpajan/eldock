// Fáze 95: vzorový BIM model haly `public/samples/eldock-sample-plant.ifc` z generátoru `samplePlantIfc()`
// („✨ Vyzkoušet na vzorovém BIM souboru haly“). Spuštění: `npm run bim:sample`; test hlídá, že soubor odpovídá kódu.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { samplePlantIfc } from "../src/lib/bim/sample-ifc";

export const SAMPLE_IFC_PATH = path.join(process.cwd(), "public", "samples", "eldock-sample-plant.ifc");

async function main() {
  await mkdir(path.dirname(SAMPLE_IFC_PATH), { recursive: true });
  const text = samplePlantIfc();
  await writeFile(SAMPLE_IFC_PATH, text);
  console.log(`${path.relative(process.cwd(), SAMPLE_IFC_PATH)}: ${text.length} B`);
}

if (process.argv[1] && /bim-sample\.ts$/.test(process.argv[1])) void main();
