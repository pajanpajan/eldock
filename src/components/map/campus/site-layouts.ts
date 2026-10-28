// Kulisy areálu (komunikace, parkoviště, zeleň, vrátnice) pro jednotlivé závody.
// Souřadnice ve viewBoxu areálu 1000×700; budovy z DB se kreslí přes ně.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SiteLayout {
  fence: Rect;
  /** Vjezd – mezera v plotu na spodní straně (x od–do). */
  gate: { x1: number; x2: number };
  /** Ulice před areálem. */
  street: { y: number; name: string };
  roads: Rect[];
  parking: (Rect & { label?: string })[];
  green: Rect[];
  trees: [x: number, y: number, r: number][];
  gatehouse: Rect;
  compass: { x: number; y: number };
  scale: { x: number; y: number };
}

const FENCE: Rect = { x: 30, y: 40, w: 940, h: 620 };

/** Řada stromů podél úsečky. */
function treeRow(x1: number, y1: number, x2: number, y2: number, count: number, r = 9): [number, number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r + ((i * 7) % 4)];
  });
}

const JBC: SiteLayout = {
  fence: FENCE,
  gate: { x1: 98, x2: 146 },
  street: { y: 680, name: "ul. Průmyslová" },
  roads: [
    { x: 40, y: 318, w: 920, h: 34 },
    { x: 40, y: 578, w: 920, h: 32 },
    { x: 208, y: 52, w: 32, h: 558 },
    { x: 650, y: 52, w: 24, h: 558 },
    { x: 104, y: 610, w: 36, h: 50 },
  ],
  parking: [{ x: 58, y: 372, w: 134, h: 190, label: "P" }],
  green: [
    { x: 44, y: 54, w: 150, h: 128 },
    { x: 862, y: 186, w: 98, h: 120 },
    { x: 694, y: 516, w: 266, h: 52 },
    { x: 250, y: 620, w: 700, h: 30 },
  ],
  trees: [
    ...treeRow(70, 80, 170, 80, 5),
    ...treeRow(80, 130, 160, 150, 4, 11),
    ...treeRow(885, 210, 885, 290, 4),
    ...treeRow(935, 220, 935, 285, 3, 11),
    ...treeRow(715, 542, 945, 542, 9),
    ...treeRow(270, 635, 930, 635, 15, 8),
  ],
  gatehouse: { x: 150, y: 616, w: 46, h: 34 },
  compass: { x: 915, y: 100 },
  scale: { x: 840, y: 26 },
};

const LBC: SiteLayout = {
  fence: FENCE,
  gate: { x1: 686, x2: 720 },
  street: { y: 680, name: "ul. Textilní" },
  roads: [
    { x: 40, y: 480, w: 920, h: 32 },
    { x: 688, y: 52, w: 30, h: 608 },
    { x: 230, y: 160, w: 458, h: 24 },
  ],
  parking: [
    { x: 740, y: 200, w: 210, h: 120, label: "P" },
    { x: 740, y: 340, w: 210, h: 120 },
  ],
  green: [
    { x: 44, y: 54, w: 170, h: 410 },
    { x: 250, y: 530, w: 420, h: 110 },
    { x: 740, y: 530, w: 220, h: 110 },
  ],
  trees: [
    ...treeRow(80, 90, 80, 430, 9, 11),
    ...treeRow(160, 110, 160, 410, 7),
    ...treeRow(280, 560, 640, 560, 9),
    ...treeRow(300, 610, 620, 610, 7, 11),
    ...treeRow(770, 600, 930, 600, 5),
  ],
  gatehouse: { x: 726, y: 616, w: 46, h: 34 },
  compass: { x: 915, y: 100 },
  scale: { x: 840, y: 26 },
};

const GENERIC: SiteLayout = {
  fence: FENCE,
  gate: { x1: 480, x2: 520 },
  street: { y: 680, name: "" },
  roads: [],
  parking: [],
  green: [],
  trees: [],
  gatehouse: { x: 526, y: 616, w: 46, h: 34 },
  compass: { x: 915, y: 100 },
  scale: { x: 840, y: 26 },
};

export function getSiteLayout(plantCode: string): SiteLayout {
  return { JBC, LBC }[plantCode] ?? GENERIC;
}
