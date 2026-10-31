import type { PrismaClient } from "@/generated/prisma/client";
import { buildSearchText } from "@/lib/panel-builder/catalog";
import { extractComponents, type ExtractedComponent } from "@/lib/panel-builder/datasheet-extract";
import { WorkflowError } from "@/lib/workflow/state-machine";

// AI Panel Builder – zápisy: katalog prvků (atomizace PDF datasheetů).

export interface DatasheetInput {
  fileName: string;
  /** Text stránek PDF (řádky), vytěžený v prohlížeči přes pdf.js. */
  pages: string[][];
}

export interface ImportedComponent {
  id: string;
  articleNumber: string;
  typeCode: string;
  manufacturer: string;
  category: ExtractedComponent["category"];
  description: string;
  powerLossWatts: number;
  status: "created" | "existing";
}

/** Extraktor prvků z PDF (Gemini, nebo deterministický z textu). */
export type DatasheetExtractor = (input: DatasheetInput) => Promise<{ components: ExtractedComponent[]; mode: "GEMINI" | "DEMO" }>;

type CatalogRow = Omit<ImportedComponent, "status">;
const summary = (row: CatalogRow, status: ImportedComponent["status"]): ImportedComponent => ({
  id: row.id,
  articleNumber: row.articleNumber,
  typeCode: row.typeCode,
  manufacturer: row.manufacturer,
  category: row.category,
  description: row.description,
  powerLossWatts: row.powerLossWatts,
  status,
});

export const textExtractor: DatasheetExtractor = async (input) => ({ components: extractComponents(input.pages), mode: "DEMO" });

/**
 * „Atomizovat PDF datasheet“: z PDF vytáhne jednotlivé přístroje a každý uloží jako samostatný
 * řádek katalogu. Existující objednací čísla se nepřepisují (katalog je zdroj pravdy pro výpočty).
 */
export async function importDatasheet(prisma: PrismaClient, input: DatasheetInput, extractor: DatasheetExtractor = textExtractor) {
  const { components, mode } = await extractor(input);
  if (!components.length) {
    throw new WorkflowError("VALIDATION", "V PDF jsem nenašel žádný přístroj s objednacím číslem. Nahrajte kusovník nebo katalogový list výrobce.");
  }
  const existing = new Map(
    (await prisma.catalogComponent.findMany({ where: { articleNumber: { in: components.map((c) => c.articleNumber) } } })).map((row) => [row.articleNumber, row]),
  );

  const result: ImportedComponent[] = [];
  for (const component of components) {
    const found = existing.get(component.articleNumber);
    if (found) {
      result.push(summary(found, "existing"));
      continue;
    }
    const { powerLossEstimated, sourcePage, ...fields } = component;
    const created = await prisma.catalogComponent.create({
      data: {
        ...fields,
        dataSource: mode === "GEMINI" ? "GEMINI_AI" : powerLossEstimated ? "IEC_ESTIMATE" : "PDF_DATASHEET",
        sourcePdfName: input.fileName.slice(0, 200),
        sourcePage,
        searchText: buildSearchText(component),
      },
    });
    existing.set(created.articleNumber, created);
    result.push(summary(created, "created"));
  }
  return { mode, components: result };
}
