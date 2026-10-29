import { spiderLinks, type SpiderItem } from "@/lib/power-tree";

const LINE = "#facc15";
const REMOTE = "#38bdf8";

/** Popisek vývodu s tmavým podkladem (šířka odhadnutá z počtu znaků). */
function Label({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const width = text.length * 6.6 + 10;
  return (
    <g>
      <rect x={x - width / 2} y={y - 9} width={width} height={17} rx={4} fill="#09090b" fillOpacity={0.9} stroke={color} strokeOpacity={0.6} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize={11} fontFamily="ui-monospace, Consolas, monospace" fill={color}>
        {text}
      </text>
    </g>
  );
}

/**
 * „Pavouk napájení“: směrové spojnice rozváděč → napájená zařízení s popiskem vývodu.
 * Souřadnice ve viewBoxu půdorysu (pin je v procentech). Napájení z jiného patra = modrá odbočka.
 */
export function PowerSpiderOverlay({ items, viewBox }: { items: readonly SpiderItem[]; viewBox: { width: number; height: number } }) {
  const links = spiderLinks(items);
  const point = (item: SpiderItem) => [(item.pinX / 100) * viewBox.width, (item.pinY / 100) * viewBox.height] as const;

  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Pavouk napájení"
      role="img"
      data-testid="power-spider"
    >
      <defs>
        <marker id="spider-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={LINE} />
        </marker>
        <marker id="spider-arrow-remote" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={REMOTE} />
        </marker>
      </defs>
      {links.map((link) => {
        const [tx, ty] = point(link.to);
        if (link.kind === "remote") {
          const sx = tx - 70;
          const sy = ty - 70;
          return (
            <g key={`remote-${link.to.id}`} data-spider-link={`${link.sourceTag}>${link.to.tag}`}>
              <line x1={sx} y1={sy} x2={tx - 6} y2={ty - 6} stroke={REMOTE} strokeWidth={2} strokeDasharray="6 4" markerEnd="url(#spider-arrow-remote)" />
              <Label x={sx} y={sy - 12} text={`↗ ${link.sourceTag}${link.circuit ? ` · ${link.circuit}` : ""}`} color={REMOTE} />
            </g>
          );
        }
        const [fx, fy] = point(link.from);
        // Mírně zakřivená spojnice, ať se souběžné vývody nepřekrývají.
        const mx = (fx + tx) / 2 + (ty - fy) * 0.12;
        const my = (fy + ty) / 2 - (tx - fx) * 0.12;
        return (
          <g key={`${link.from.id}-${link.to.id}`} data-spider-link={`${link.from.tag}>${link.to.tag}`}>
            <path d={`M${fx} ${fy} Q${mx} ${my} ${tx} ${ty}`} fill="none" stroke={LINE} strokeWidth={2.5} strokeOpacity={0.85} markerEnd="url(#spider-arrow)" />
            {link.circuit ? <Label x={(fx + 2 * mx + tx) / 4} y={(fy + 2 * my + ty) / 4} text={link.circuit} color={LINE} /> : null}
          </g>
        );
      })}
    </svg>
  );
}
