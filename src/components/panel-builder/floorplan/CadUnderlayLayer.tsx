"use client";

import { memo, useMemo } from "react";

import { layerPath, layerStroke, type CadGeometry, type CadUnderlay } from "@/lib/panel-builder/cad-underlay";

/**
 * Fáze 79: kresba podkladu CAD (DXF) po hladinách – viditelné hladiny, barva hladiny nebo šedá (ztlumení), krytí 20–100 %,
 * tloušťka čáry stejná na obrazovce při zoomu. Kliky nezachytává (osazování a kreslení jdou skrz).
 */
export const CadUnderlayLayer = memo(function CadUnderlayLayer({ geometry, cad, onPaper, unit }: { geometry: CadGeometry; cad: CadUnderlay; onPaper: boolean; unit: number }) {
  const paths = useMemo(() => new Map(geometry.layers.map((layer) => [layer.name, layerPath(layer.segments)])), [geometry]);
  const visible = cad.layers.filter((layer) => layer.visible);
  return (
    <g opacity={cad.opacity} pointerEvents="none" data-testid="cad-underlay" data-layers={visible.length} data-monochrome={cad.monochrome ? "true" : "false"}>
      {visible.map((layer) => {
        const shape = geometry.layers.find((entry) => entry.name === layer.name);
        const d = paths.get(layer.name);
        if (!shape) return null;
        const stroke = layerStroke(layer, cad.monochrome, onPaper);
        return (
          <g key={layer.name} data-cad-layer={layer.name}>
            {d ? <path d={d} fill="none" stroke={stroke} strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {shape.texts.slice(0, 2000).map((text, index) => (
              <text key={index} x={text.x} y={text.y} fontSize={Math.max(text.size, unit * 0.2)} fill={stroke} transform={text.rotation ? `rotate(${text.rotation} ${text.x} ${text.y})` : undefined}>
                {text.value.split("\n")[0]}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
});
