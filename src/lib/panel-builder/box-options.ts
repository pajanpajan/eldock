// Fáze 91: volby instalačních krabic nákresu bez závislostí (výrobce krabic, konstrukce stěn, ruční volba krabice prvku)
// – načítá je i parser nákresu (`floorplan-editor.ts`) bez cyklu modulů; katalog krabic je v `mounting-boxes-catalog.ts`.

export type BoxMaker = "kopos" | "kaiser" | "schneider" | "obo" | "sez";
export type WallType = "masonry" | "drywall" | "timber" | "concrete" | "etics" | "surface";
/** Třída hloubky: mělká přístrojová, hluboká (svorky, hluboký strojek), s prostorem pro elektroniku (aktor do krabičky). */
export type BoxDepthClass = "shallow" | "deep" | "electronics";
/** Volba krabice v detailu prvku. */
export type BoxChoice = "auto" | BoxDepthClass | "surface";

export const BOX_MAKERS: readonly { id: BoxMaker; label: string; hint: string }[] = [
  { id: "kopos", label: "KOPOS Kolín", hint: "výchozí – nejrozšířenější v ČR a SK" },
  { id: "kaiser", label: "Kaiser", hint: "UP¹ do zdiva, O-range® Evo do dutých stěn, Electronic-Dose" },
  { id: "schneider", label: "Schneider Electric", hint: "Multifix Air – vzduchotěsné krabice do dutých stěn" },
  { id: "obo", label: "OBO Bettermann", hint: "UG do zdiva, HG do dutých stěn" },
  { id: "sez", label: "SEZ Dolný Kubín", hint: "6400 do zdiva, KUP 68 do dutých příček" },
];

export const WALL_TYPES: readonly { id: WallType; label: string; short: string }[] = [
  { id: "masonry", label: "Zdivo / Cihla / Ytong (pod omítku)", short: "do zdiva" },
  { id: "drywall", label: "Sádrokarton (SDK) / Duté příčky", short: "do sádrokartonu / dutých příček" },
  { id: "timber", label: "Dřevostavba / Pasivní dům (vzduchotěsné krabice s membránou)", short: "do dřevostavby / pasivního domu" },
  { id: "concrete", label: "Litý beton / Panel (krabice na bednění)", short: "do litého betonu" },
  { id: "etics", label: "Zateplená fasáda (ETICS – polystyren / vata, bez tepelného mostu)", short: "do zateplené fasády" },
  { id: "surface", label: "Vlhké / Venkovní prostředí (nástěnná montáž IP44 / IP54 – bez podomítkové krabice)", short: "nástěnná montáž" },
];

export const BOX_CHOICES: readonly { id: BoxChoice; label: string }[] = [
  { id: "auto", label: "Automaticky dle přístroje" },
  { id: "shallow", label: "Mělká 42–46 mm (KU 68-45)" },
  { id: "deep", label: "Hluboká 66–70 mm (KPR 68)" },
  { id: "electronics", label: "S prostorem pro aktor / elektroniku (70 mm)" },
  { id: "surface", label: "Bez krabice – nástěnná montáž" },
];

export const DEFAULT_BOX_MAKER: BoxMaker = "kopos";
export const DEFAULT_WALL_TYPE: WallType = "masonry";

export const isBoxMaker = (value: unknown): value is BoxMaker => BOX_MAKERS.some((maker) => maker.id === value);
export const isWallType = (value: unknown): value is WallType => WALL_TYPES.some((wall) => wall.id === value);
export const isBoxChoice = (value: unknown): value is BoxChoice => BOX_CHOICES.some((choice) => choice.id === value);
