// Zákres do fotky (červenka): tvary v normalizovaných souřadnicích 0–1 vůči fotce, takže stejný
// zákres jde vykreslit na plátno editoru i do plného rozlišení při uložení.

export type AnnotationTool = "pen" | "arrow" | "rect" | "ellipse" | "text";

export const ANNOTATION_COLORS = [
  { value: "#ef4444", label: "Červená" },
  { value: "#eab308", label: "Žlutá" },
] as const;

export type Point = [number, number];

export type AnnotationShape =
  | { kind: "pen"; color: string; points: Point[] }
  | { kind: "arrow" | "rect" | "ellipse"; color: string; from: Point; to: Point }
  | { kind: "text"; color: string; at: Point; text: string };

/** Tloušťka čáry a velikost písma relativně k delší straně fotky (stejně na displeji i v exportu). */
export const strokeWidthFor = (width: number, height: number) => Math.max(2, Math.max(width, height) * 0.006);
export const fontSizeFor = (width: number, height: number) => Math.max(14, Math.max(width, height) * 0.035);

/** Hroty šipky: dva body za koncem čáry pod úhlem ±28°, délka úměrná tloušťce. */
export function arrowHead(from: Point, to: Point, length: number): [Point, Point] {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const spread = (28 * Math.PI) / 180;
  return [
    [to[0] - length * Math.cos(angle - spread), to[1] - length * Math.sin(angle - spread)],
    [to[0] - length * Math.cos(angle + spread), to[1] - length * Math.sin(angle + spread)],
  ];
}

/** Příliš malý tvar (omylné ťuknutí) se neukládá. */
export function isMeaningful(shape: AnnotationShape): boolean {
  if (shape.kind === "text") return shape.text.trim().length > 0;
  if (shape.kind === "pen") return shape.points.length > 1;
  return Math.hypot(shape.to[0] - shape.from[0], shape.to[1] - shape.from[1]) > 0.01;
}

/** Vykreslí tvary na kontext plátna o rozměrech `width` × `height` (px). */
export function drawAnnotations(ctx: CanvasRenderingContext2D, shapes: readonly AnnotationShape[], width: number, height: number) {
  const line = strokeWidthFor(width, height);
  const px = ([x, y]: Point): Point => [x * width, y * height];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const shape of shapes) {
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = line;
    // Tmavý obrys zlepší čitelnost na světlé i tmavé fotce.
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = line * 0.8;
    switch (shape.kind) {
      case "pen": {
        ctx.beginPath();
        shape.points.forEach((point, index) => {
          const [x, y] = px(point);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        break;
      }
      case "arrow": {
        const from = px(shape.from);
        const to = px(shape.to);
        const [left, right] = arrowHead(from, to, line * 5);
        ctx.beginPath();
        ctx.moveTo(...from);
        ctx.lineTo(...to);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(...to);
        ctx.lineTo(...left);
        ctx.lineTo(...right);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "rect": {
        const [x1, y1] = px(shape.from);
        const [x2, y2] = px(shape.to);
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        break;
      }
      case "ellipse": {
        const [x1, y1] = px(shape.from);
        const [x2, y2] = px(shape.to);
        ctx.beginPath();
        ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "text": {
        const size = fontSizeFor(width, height);
        const [x, y] = px(shape.at);
        ctx.font = `700 ${size}px system-ui, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.shadowBlur = 0;
        ctx.lineWidth = size * 0.18;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(shape.text, x, y);
        ctx.fillText(shape.text, x, y);
        break;
      }
    }
  }
  ctx.restore();
}
