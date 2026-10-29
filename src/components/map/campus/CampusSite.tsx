import type { SiteLayout } from "./site-layouts";

const ASPHALT = "#1b222a";
const LINE = "#3b4652";
const GREEN = "#12221a";
const TREE = "#1c3a29";

/** Statické kulisy areálu: plot, ulice, komunikace, parkoviště, zeleň, vrátnice, růžice a měřítko. */
export function CampusSite({ layout, width, height, widthM }: { layout: SiteLayout; width: number; height: number; /** Šířka mapy v metrech (popisek měřítka 100 px). */ widthM?: number }) {
  const { fence, gate } = layout;
  const fenceBottom = fence.y + fence.h;

  return (
    <g aria-hidden>
      <rect width={width} height={height} fill="#0c1014" />
      <rect x={fence.x} y={fence.y} width={fence.w} height={fence.h} fill="#11161c" />

      {/* Ulice před areálem */}
      <rect x={0} y={layout.street.y - 14} width={width} height={28} fill={ASPHALT} />
      <line x1={0} y1={layout.street.y} x2={width} y2={layout.street.y} stroke={LINE} strokeWidth={1.5} strokeDasharray="18 12" />
      {layout.street.name ? (
        <text x={24} y={layout.street.y + 4} fontSize={11} fill="#64748b" fontFamily="var(--font-geist-mono)">
          {layout.street.name}
        </text>
      ) : null}

      {layout.green.map((g, i) => (
        <rect key={`g${i}`} x={g.x} y={g.y} width={g.w} height={g.h} rx={8} fill={GREEN} />
      ))}
      {layout.trees.map(([x, y, r], i) => (
        <g key={`t${i}`}>
          <circle cx={x} cy={y} r={r} fill={TREE} />
          <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.45} fill="#24492f" />
        </g>
      ))}

      {layout.roads.map((road, i) => {
        const horizontal = road.w >= road.h;
        return (
          <g key={`r${i}`}>
            <rect x={road.x} y={road.y} width={road.w} height={road.h} fill={ASPHALT} />
            {horizontal ? (
              <line x1={road.x + 6} y1={road.y + road.h / 2} x2={road.x + road.w - 6} y2={road.y + road.h / 2} stroke={LINE} strokeWidth={1.2} strokeDasharray="14 10" />
            ) : (
              <line x1={road.x + road.w / 2} y1={road.y + 6} x2={road.x + road.w / 2} y2={road.y + road.h - 6} stroke={LINE} strokeWidth={1.2} strokeDasharray="14 10" />
            )}
          </g>
        );
      })}

      {layout.parking.map((p, i) => {
        const stall = 18;
        const rows = Math.floor(p.h / stall);
        return (
          <g key={`p${i}`}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={ASPHALT} rx={3} />
            {Array.from({ length: rows + 1 }, (_, r) => (
              <g key={r}>
                <line x1={p.x + 4} y1={p.y + r * stall} x2={p.x + p.w * 0.4} y2={p.y + r * stall} stroke={LINE} />
                <line x1={p.x + p.w * 0.6} y1={p.y + r * stall} x2={p.x + p.w - 4} y2={p.y + r * stall} stroke={LINE} />
              </g>
            ))}
            {p.label ? (
              <g transform={`translate(${p.x + p.w / 2} ${p.y + p.h / 2})`}>
                <rect x={-11} y={-11} width={22} height={22} rx={4} fill="#1d4ed8" />
                <text y={5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#fff">
                  {p.label}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {/* Plot s vjezdem */}
      <path
        d={`M${gate.x1} ${fenceBottom} H${fence.x} V${fence.y} H${fence.x + fence.w} V${fenceBottom} H${gate.x2}`}
        fill="none"
        stroke="#475569"
        strokeWidth={2}
        strokeDasharray="10 4"
      />
      <line x1={gate.x1} y1={fenceBottom - 6} x2={(gate.x1 + gate.x2) / 2 + 4} y2={fenceBottom - 6} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />

      <g>
        <rect x={layout.gatehouse.x} y={layout.gatehouse.y} width={layout.gatehouse.w} height={layout.gatehouse.h} rx={2} fill="#26303a" stroke="#56636f" />
        <text x={layout.gatehouse.x + layout.gatehouse.w / 2} y={layout.gatehouse.y - 5} textAnchor="middle" fontSize={10} fill="#94a3b8">
          Vrátnice
        </text>
      </g>

      {/* Směrová růžice */}
      <g transform={`translate(${layout.compass.x} ${layout.compass.y})`}>
        <circle r={24} fill="#0c1014" stroke="#334155" />
        <path d="M0 -20 L6 0 L0 20 L-6 0 Z" fill="#334155" />
        <path d="M0 -20 L6 0 L-6 0 Z" fill="#fac800" />
        <text y={-28} textAnchor="middle" fontSize={11} fontWeight={700} fill="#cbd5e1">
          S
        </text>
      </g>

      {/* Měřítko */}
      <g transform={`translate(${layout.scale.x} ${layout.scale.y})`} fontSize={10} fill="#94a3b8">
        <rect x={0} y={-3} width={50} height={6} fill="#cbd5e1" />
        <rect x={50} y={-3} width={50} height={6} fill="#334155" stroke="#cbd5e1" strokeWidth={0.8} />
        <text x={0} y={-8}>0</text>
        <text x={100} y={-8} textAnchor="end">
          {widthM ? Math.round((widthM * 100) / width) : 50} m
        </text>
      </g>
    </g>
  );
}
