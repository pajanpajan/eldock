// Generuje `node scripts/import-etim-universal.mjs` z balíčků ve složce „ETIM data“ (fáze 105) – needitujte ručně.
// Ceníkové ceny výrobců bez DPH (bez individuálního rabatu) jako základ cenové nabídky: klíč `cable:<označení>` = Kč / m
// (kabely a vodiče podle označení Eldocku), `item:<objednací číslo>` = Kč / ks. Hodnota = [cena, index zdroje].
// Jen na serveru (fáze 104 – ceníky do klientského bundlu nesmí).

import "server-only";

export const LIST_PRICES_RETRIEVED = "2026-11-12";

export const LIST_PRICE_SOURCES: readonly string[] = [
  "Schrack Technik – ceník (999999_13905868752397041071.zip, ceníková cena za m bez DPH)"
];

export const LIST_PRICES: Readonly<Record<string, readonly [number, number]>> = {
 "cable:CYKY-J 3X1,5": [
  43.51,
  0
 ],
 "cable:CYKY-J 3X2,5": [
  72.97,
  0
 ],
 "cable:CYKY-J 3X4": [
  105.3,
  0
 ],
 "cable:CYKY-J 3X6": [
  175.7,
  0
 ],
 "cable:CYKY-J 4X10": [
  373,
  0
 ],
 "cable:CYKY-J 4X16": [
  589.2,
  0
 ],
 "cable:CYKY-J 5X1,5": [
  68.34,
  0
 ],
 "cable:CYKY-J 5X10": [
  473,
  0
 ],
 "cable:CYKY-J 5X16": [
  738.4,
  0
 ],
 "cable:CYKY-J 5X2,5": [
  113.8,
  0
 ],
 "cable:CYKY-J 5X4": [
  199.5,
  0
 ],
 "cable:CYKY-J 5X6": [
  283.8,
  0
 ],
 "cable:CYKY-J 7X1,5": [
  113.5,
  0
 ],
 "cable:CYKY-O 2X1,5": [
  32.15,
  0
 ],
 "cable:CYKY-O 3X1,5": [
  43.24,
  0
 ],
 "cable:H07V-K 1,5": [
  15.41,
  0
 ],
 "cable:H07V-K 10": [
  97.3,
  0
 ],
 "cable:H07V-K 16": [
  166,
  0
 ],
 "cable:H07V-K 2,5": [
  24.86,
  0
 ],
 "cable:H07V-K 25": [
  228.7,
  0
 ],
 "cable:H07V-K 4": [
  38.65,
  0
 ],
 "cable:H07V-K 6": [
  57.84,
  0
 ],
 "cable:J-Y(ST)Y 2X2X0,8": [
  27.46,
  0
 ],
 "cable:SYKFY 2X2X0,5": [
  17.57,
  0
 ],
 "cable:SYKFY 3X2X0,5": [
  22.16,
  0
 ]
};
