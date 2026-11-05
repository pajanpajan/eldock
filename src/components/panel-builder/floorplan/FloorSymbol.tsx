import type { PaletteItem } from "@/lib/panel-builder/floorplan-editor";

/**
 * Fáze 55: elektrotechnické značky do půdorysu (dle ČSN EN 60617 / ČSN 01 3481) místo teček – zásuvky (půlkruh se svislou
 * čarou, 2Z dvojitá ryska, IP44 stříška, RJ45), vypínače (kruh s praporky podle řazení, tlačítko trojúhelník, žaluzie šipky),
 * svítidla (⊗ stropní, konzola nástěnné) a spotřebiče (čtverec s piktogramem). Barevný lem = barva domovních přístrojů.
 * Kreslí se v jednotkách plátna (mm); `size` = velikost značky, `stroke` = tloušťka čáry.
 */
export function FloorSymbol({ item, size, stroke, active, lem, switchNo }: { item: PaletteItem; size: number; stroke: number; active: boolean; lem?: string | null; switchNo?: string }) {
  const r = size * 0.5;
  const ink = "#09090b";
  const line = { stroke: ink, strokeWidth: stroke * 2.2, fill: "none", strokeLinecap: "round" as const };
  const ring = active ? "#facc15" : lem ?? "#e4e4e7";
  // Neviditelná plocha pro snadné kliknutí
  const hit = <circle r={size * 0.75} fill="transparent" />;
  const label = (text: string) => (
    <text x={r * 1.15} y={r * 1.35} fontSize={size * 0.34} fontWeight={800} fill="#e4e4e7" stroke="#09090b" strokeWidth={stroke * 0.8} paintOrder="stroke">
      {text}
    </text>
  );

  if (item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket") {
    const double = item.kind === "double_socket";
    return (
      <g data-symbol="socket">
        {hit}
        <path d={`M${-r} 0 A${r} ${r} 0 0 1 ${r} 0 Z`} fill={item.kind === "data_socket" ? "#86efac" : "#f4f4f5"} stroke={ring} strokeWidth={stroke * (active ? 6 : 4)} />
        <path d={`M${-r} 0 A${r} ${r} 0 0 1 ${r} 0 M${-r * 1.1} 0 H${r * 1.1} M0 0 V${r * 0.9}`} {...line} />
        {double ? <path d={`M${-r * 0.35} ${-r * 0.2} V${-r * 0.75} M${r * 0.35} ${-r * 0.2} V${-r * 0.75}`} {...line} /> : null}
        {item.variant === "ip44" ? <path d={`M${-r * 0.8} ${-r * 1.15} L0 ${-r * 1.55} L${r * 0.8} ${-r * 1.15}`} {...line} /> : null}
        {label(item.kind === "data_socket" ? "RJ45" : item.variant === "worktop" ? "ZL" : double ? "2Z" : item.variant === "ip44" ? "IP44" : "Z")}
      </g>
    );
  }

  if (item.kind === "light") {
    return (
      <g data-symbol="light">
        {hit}
        {item.variant === "wall" ? (
          <>
            <path d={`M${-r} ${r * 0.4} A${r} ${r} 0 0 1 ${r} ${r * 0.4} Z`} fill="#fde68a" stroke={active ? "#facc15" : ink} strokeWidth={stroke * 2.2} />
            <path d={`M${-r * 1.1} ${r * 0.4} H${r * 1.1}`} {...line} />
          </>
        ) : (
          <>
            <circle r={r} fill="#fde68a" stroke={active ? "#facc15" : ink} strokeWidth={stroke * (active ? 5 : 2.2)} />
            <path d={`M${-r * 0.7} ${-r * 0.7} L${r * 0.7} ${r * 0.7} M${r * 0.7} ${-r * 0.7} L${-r * 0.7} ${r * 0.7}`} {...line} />
          </>
        )}
      </g>
    );
  }

  if (item.kind === "switch") {
    const no = switchNo ?? item.fixedSwitchNo ?? item.switchNo ?? "1";
    const flag = (angle: number, offset = 0) => {
      const rad = (angle * Math.PI) / 180;
      const x1 = Math.cos(rad) * r * 0.45;
      const y1 = -Math.sin(rad) * r * 0.45;
      const x2 = Math.cos(rad) * r * 1.5;
      const y2 = -Math.sin(rad) * r * 1.5;
      const tick = (offset ? 1 : 0) * r * 0.35;
      return <path key={`${angle}-${offset}`} d={`M${x1} ${y1} L${x2} ${y2} M${x2} ${y2} l${-tick || -r * 0.3} ${r * 0.2}`} {...line} />;
    };
    let marks: React.ReactNode = flag(45);
    if (item.control === "blind") marks = <path d={`M0 ${-r * 0.3} V${-r * 1.4} M${-r * 0.3} ${-r * 1.1} L0 ${-r * 1.4} L${r * 0.3} ${-r * 1.1} M0 ${r * 0.3} V${r * 1.4} M${-r * 0.3} ${r * 1.1} L0 ${r * 1.4} L${r * 0.3} ${r * 1.1}`} {...line} />;
    else if (item.variant === "button") marks = <path d={`M${-r * 0.45} ${r * 0.3} L0 ${-r * 0.5} L${r * 0.45} ${r * 0.3} Z`} {...line} />;
    else if (item.wiringCategory === "WD_DIMMER") marks = <path d={`M${-r * 1.2} ${r * 0.9} L${r * 1.2} ${-r * 0.9} M${r * 1.2} ${-r * 0.9} l${-r * 0.45} ${r * 0.05} M${r * 1.2} ${-r * 0.9} l${-r * 0.1} ${r * 0.45}`} {...line} />;
    else if (no.startsWith("7")) marks = [flag(45), flag(135), flag(225), flag(315)];
    else if (no.startsWith("6+6") || no.startsWith("6")) marks = no.startsWith("6+6") ? [flag(45), flag(225), flag(60, 1), flag(240, 1)] : [flag(45), flag(225)];
    else if (no.startsWith("5") || no.startsWith("1+1") || no.startsWith("1/0+1/0")) marks = [flag(45), flag(65, 1)];
    const special = item.wiringCategory === "WD_SENSOR" ? "PIR" : item.wiringCategory === "WD_THERMOSTAT" ? "t°" : null;
    return (
      <g data-symbol="switch">
        {hit}
        {marks}
        <circle r={r * 0.45} fill="#93c5fd" stroke={ring} strokeWidth={stroke * (active ? 6 : 4)} />
        {item.led ? <circle r={r * 0.15} fill="#f97316" /> : null}
        {item.ip44 ? <path d={`M${-r * 0.6} ${r * 0.9} L0 ${r * 1.3} L${r * 0.6} ${r * 0.9}`} {...line} /> : null}
        {special ? (
          <text textAnchor="middle" dominantBaseline="central" fontSize={size * 0.3} fontWeight={800} fill={ink}>
            {special}
          </text>
        ) : null}
        {label(item.symbol)}
      </g>
    );
  }

  // Samostatné spotřebiče: čtvercový technologický symbol s piktogramem
  const square = size * 0.6;
  const pictogram = (() => {
    switch (item.tag) {
      case "cooktop_3p":
        return [-0.25, 0.25].flatMap((dx) => [-0.25, 0.25].map((dy) => <circle key={`${dx}${dy}`} cx={dx * size} cy={dy * size} r={size * 0.12} fill="none" stroke={ink} strokeWidth={stroke * 1.6} />));
      case "ev_charger":
        return <path d={`M${-size * 0.15} ${-size * 0.3} L${size * 0.05} 0 H${-size * 0.08} L${size * 0.15} ${size * 0.3}`} {...line} />;
      case "pv_inverter":
        return <path d={`M${-square} ${square} L${square} ${-square} M${-square * 0.2} ${square} L${square} ${-square * 0.2}`} {...line} />;
      case "heat_pump":
        return <path d={`M${-size * 0.3} ${size * 0.15} q${size * 0.15} ${-size * 0.3} ${size * 0.3} 0 t${size * 0.3} 0`} {...line} />;
      default:
        return (
          <text textAnchor="middle" dominantBaseline="central" fontSize={size * (item.symbol.length > 2 ? 0.34 : 0.46)} fontWeight={800} fill={ink}>
            {item.symbol}
          </text>
        );
    }
  })();
  return (
    <g data-symbol="appliance">
      {hit}
      <rect x={-square} y={-square} width={square * 2} height={square * 2} rx={size * 0.06} fill="#fca5a5" stroke={active ? "#facc15" : ink} strokeWidth={stroke * (active ? 6 : 2.4)} />
      {pictogram}
      {item.tag === "cooktop_3p" || item.tag === "ev_charger" || item.tag === "pv_inverter" || item.tag === "heat_pump" ? label(item.symbol) : null}
    </g>
  );
}
