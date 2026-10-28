import { z } from "zod";

// Formát zákresu (redline) – viz PLAN fáze 8. Souřadnice 0–1 vůči listu schématu.

export const markupStrokeSchema = z.object({
  tool: z.enum(["pen", "highlighter"]),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
  /** Šířka čáry jako podíl šířky listu. */
  width: z.number().positive().max(0.1),
  points: z.array(z.tuple([z.number(), z.number(), z.number()])).min(1),
});

export const markupSchema = z.object({
  version: z.literal(1),
  sheet: z.number().int().positive(),
  strokes: z.array(markupStrokeSchema),
});

export type MarkupStroke = z.infer<typeof markupStrokeSchema>;
export type MarkupData = z.infer<typeof markupSchema>;

/** Bezpečné načtení JSON zákresu z DB; nevalidní data → `null`. */
export function parseMarkup(json: string | null | undefined): MarkupData | null {
  if (!json) return null;
  try {
    const parsed = markupSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Těžiště všech bodů zákresu (0–1), `null` bez tahů. */
export function markupCenter(markup: MarkupData | null): [number, number] | null {
  const points = markup?.strokes.flatMap((stroke) => stroke.points) ?? [];
  if (!points.length) return null;
  const [sx, sy] = points.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0]);
  return [sx / points.length, sy / points.length];
}
