// Fáze 104: veřejná část katalogových dat pro prohlížeč (`src/lib/panel-builder/catalog-public.generated.ts`) z celých
// importů ETIM, které jsou `server-only`. Spouští `npm run catalog:public` (tsx s podmínkou react-server, aby import
// `server-only` prošel) – po každém `npm run catalog:etim` / `catalog:parse`.
import { writeFileSync } from "node:fs";
import path from "node:path";

import { ETIM_DEVICE_DEPTHS } from "../src/lib/panel-builder/abb-etim.generated";
import { BRAND_DEVICE_DEPTHS, ETIM_FRAME_LIMITS, KOPOS_BOX_DATA, KOPOS_DATA_SOURCE } from "../src/lib/panel-builder/brand-etim.generated";
import { buildCatalogPublic, renderCatalogPublic } from "../src/lib/panel-builder/catalog-public";

const target = path.join(process.cwd(), "src", "lib", "panel-builder", "catalog-public.generated.ts");
const data = buildCatalogPublic({ abbDepths: ETIM_DEVICE_DEPTHS, brandDepths: BRAND_DEVICE_DEPTHS, frameLimits: ETIM_FRAME_LIMITS, kopos: KOPOS_BOX_DATA, koposSource: KOPOS_DATA_SOURCE });
writeFileSync(target, renderCatalogPublic(data), "utf8");
console.log(`catalog-public.generated.ts: ${Object.keys(data.deviceDepths).length} hloubek přístrojů, ${Object.keys(data.frameLimits).length} limitů rámečků, ${Object.keys(data.koposBoxes).length} krabic KOPOS (bez EAN a cen)`);
