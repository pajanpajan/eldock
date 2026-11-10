# Zadání fáze 81 – panely chytré domácnosti a akční členy na DIN lištu v půdorysu i v AI Panel Builderu

Vloženo z chatu 2026-11-10. Celé zadání beze změn je níže, za ním tabulka ověření údajů proti katalogu výrobců
Eldocku (`prisma/external-catalog/catalog.json`, ABB podle Katalogu 2026, Loxone podle produktových listů).

## Zadání (z chatu)

Máme dva zásadní nedostatky v chytré domácnosti a jejím propojení mezi 2D půdorysem a AI Panel Builderem:
1. V nabídce panelů a displejových ovladačů (ABB-free@home, Loxone, TapHome) chybí klíčové produkty z aktuálních katalogů výrobců.
2. Akční členy na DIN lištu, které ukazujeme v 2D půdorysu (záložka „Akční členy a zdroje na DIN lištu“), chybí přímo v AI Panel Builderu (v kaskádovém menu Kroku 1, v Katalogu prvků `/panel-builder/catalog` a na 2D vektorové DIN liště) a ručně přidané kusy přes `+ Přidat do rozváděče` nejsou plně sjednocené s katalogem rozváděče.

**1. Dotykové panely ABB-free@home®** (záložky „🖥️ Panely, čidla a komunikace“ i „🎛️ Ovladače, tlačítka a termostaty“) s věrnými 2D vizualizacemi, datasheety, MPN a automatickým přibalením montážní krabice / mezirámečku do kusovníku:
- Dotykový panel ABB IP TOUCH 10" (10" kapacitní IPS, LAN PoE / Wi-Fi, 4 barvy: bílá, černá, stříbrná, zlatá; MPN např. `2TMA310050W0001` / `H82364`) + Instalační krabice, zapuštěná, pro IP TOUCH 7" a 10" (`2TMA310160B0001`).
- Dotykový panel ABB IP TOUCH 7" (4 barvy; MPN `2TMA310040W0001`) + zapuštěná instalační krabice.
- Dotykový panel ABB SmartTouch 10" (free@home a KNX, 2 varianty; MPN `2CKA006136A0212`) + volba Zapuštěná krabice pro SmartTouch 7" a 10" (`2CKA006136A0205`) nebo Povrchová krabice pro SmartTouch 10".
- Dotykový panel ABB OneTouch 7" (bílá `2CKA006220A0875`, černá `2CKA006220A0876`) + volba zapuštěná / povrchová krabice pro OneTouch 7".
- Dotykový panel ABB RoomTouch® 4" (osvětlení, žaluzie, scény, vytápění; na šířku i na výšku; černá/antracit a bílá; MPN `2CKA006136A0216`).
- Dotykový panel ABB Trevion® 2,4" (55×55 mm, akustická odezva, teplotní čidlo, do řad Zoni, Levit, Time, solo, future linear; černá `2CKA006220A0921`, bílá `2CKA006220A0920`) + při řadě Zoni do kusovníku Mezirámeček pro Zoni® (55×55 mm).

**2. Loxone:** Wall Display 10" (Ambientní režim v Config & App 17.2, vizualizace domu, interkom, audio, správa místnosti; Antracit / Bílá, 24 V DC / Tree / LAN) a Touch Pure Display (displej hodin `07:13`, horní lišta ikon světla / teploty / audia / žaluzií, dotyková plocha, čidlo teploty a vlhkosti; Antracit a Bílá, Tree / Air).

**3. TapHome – Ovladač s displejem** (vlevo čtvercový displej: `23.5 °C`, `48 %`, `15:56`, scéna `Living room`; vpravo svislý pruh tlačítek; snímač teploty, vlhkosti a přiblížení s automatickým jasem, stmívatelné noční světlo z boků): Multizónový ovladač *(Oblíbený)* – až 10 zón, tlačítka `∧` / `≡` / `∨`; Jednozónový ovladač – `∧` / `∨`; Termostat – `+` / `−`; u všech 4 barvy (Bílá, Antracit, Černá, Béžová – tmavý displej s barevnou klapkou vpravo).

**4. Sjednocení akčních členů na DIN lištu** – každý DIN přístroj chytré domácnosti ze záložky „⚡ Akční členy a zdroje na DIN lištu“ musí být plnohodnotný `CatalogComponent` (`prisma/seed-catalog-research.ts` + přírůstkový seed) se správnou kategorií, šířkou, ztrátovým výkonem Pv, MPN a datasheetem: ABB-free@home (PS-M-64.1.1, SA-M-4/8/12.16.2.2, DA-M-4.210.2.1, DA-M-8.210.2.1, DG-M-1.16.1, JA-M-4/8.230.1.1, HA-M-6/12.24.1, BE-M-4.20.1 / BE/S 8.20.2.1, SAP-S-3 s adaptérem na DIN), ABB i-bus KNX (SV/S 30.640.3.1, SA/S 4/8/12.16.2.2, JRA/S 4/8.230.2.1, UD/S 4.210.2.1, DG/S 1.64.1.1, VC/S 4.1.1), Loxone (Miniserver, Miniserver Compact, Relay / Dimmer / Multi Extension Air / Tree / DALI / DI Extension, RGBW 24V Dimmer Tree, Power Supply & Backup, zdroje 24 V DC 2,5 A a 4,2 A), TapHome (Core, 6DO, 4DO, Dimmer 4CH, 12UI, zdroj 24 V DC / 60 W; TapHome mezi výrobce v `brands.ts` s logem). Šířky, Pv a objednací čísla zadání uvádí u každého prvku.

**5. Propojení** – v AI Panel Builderu (`/panel-builder/[id]` Krok 1 `CascadePicker.tsx` a `/panel-builder/catalog`) kategorie „🏠 Chytrá domácnost / PLC / Aktory (SMART_HOME)“ s filtrem řady u ABB (Vše · ABB-free@home® · ABB i-bus® KNX), u Loxone všechny Extensions / Miniservery, u TapHome všechny DIN moduly; přetažení na DIN lištu nebo `1×`; ve `VectorModuleSymbol.tsx` autentický vícemodulový aktor (svorky kanálů nahoře / dole, LED kanálů 1–12, barevné označení `SPÍNACÍ 8×16A` / `ŽALUZIOVÝ 4×` / `STMÍVACÍ 4×` / `TOPENÍ 6×` / `DALI`, skutečná šířka 2M–12M). V půdorysu na kartě DIN prvku `+ Přidat do rozváděče` / `−` se živým počtem „V rozváděči: X ks (Y automaticky z půdorysu + Z ručně přidáno)“ uloženým v projektu; „⚡ Vygenerovat rozváděč z tohoto půdorysu“ vezme automatické i ruční kusy, spáruje je přes přesné MPN s `CatalogComponent`, osadí na vyhrazené DIN lišty chytré domácnosti, započítá Pv do oteplení (Krok 3) a vloží je do kusovníku (Krok 4).

Po implementaci `npm run verify`, unit testy (nové panely IP Touch, SmartTouch, RoomTouch, Trevion, Wall Display 10", Touch Pure Display, TapHome 3 varianty; přenos DIN akčních členů z půdorysu na lišty rozváděče), commit a příkazy pro push a nasazení.

## Ověření údajů (katalog výrobců Eldocku, 2026-11-10)

Pravidlo projektu: objednací číslo jen ověřené, údaj bez zdroje se nevymýšlí. Kde se zadání s katalogem rozchází, platí katalog.

| Zadání | Katalog výrobců | Použito |
|---|---|---|
| IP TOUCH 10" `2TMA310050W0001` / `H82364`, 4 barvy | `H8237-4W` 2TMA130050W0054 (bílý, LAN + Wi-Fi), `H8237-4B` 2TMA130050B0054 (černý), LAN + LAN `-5W` / `-5B` | bílá a černá s čísly z katalogu, stříbrná a zlatá bez čísla (ověřte) |
| IP TOUCH 7" `2TMA310040W0001` | `H8236-4W` 2TMA130050W0065, `H8236-4B` 2TMA130050B0065 (+ LAN + LAN) | jako u 10" |
| krabice IP TOUCH `2TMA310160B0001` | `42361F` 2TMA130160B0132 (zapuštěná pro 7" a 10"), povrchové `42361S` / `42371S` | katalog |
| SmartTouch 10" `2CKA006136A0212` | panel `ST/U10.1.1-811` 2TMA310051W0001 / `-825` 2TMA310051B0001; 2CKA006136A0212 = zapuštěná krabice `6136/07 UP-500` | katalog |
| krabice SmartTouch `2CKA006136A0205` | zapuštěná 2CKA006136A0212, povrchová `ST/A10.1` 2TMA310161W0001 / B0001 | katalog |
| OneTouch 7" `2CKA006220A0875` / `0876` | panel `M2249-2W` 2TMA320051W0001 / `M2249-2B` 2TMA320051B0001 (0875 / 0876 jsou ovládače ABB-Tenton®); krabice v katalogu nejsou | panel z katalogu, krabice bez čísla |
| RoomTouch 4" `2CKA006136A0216` | `RT/U12.86.1-825` 2TMA310011B0003, `-811` 2TMA310011W0001 | katalog |
| Trevion 2,4" `2CKA006220A0921` / `0920` | `SD/U12.55.1-825` 2TMA310011B0001 (černý 55 × 55), `SD/U12.63.1-825` 2TMA310011B0002 (černý 63 × 63); bílý není | černý z katalogu, bílý bez čísla |
| mezirámeček Zoni 55 × 55 | 2CHT010011B4500 (bílý), 2CHT010011B4509 (černý) | katalog |
| Loxone Wall Display 10" | 100891 (antracit, 18–27 V DC, 2,85 W, IP20) | antracit z katalogu, bílá bez čísla |
| Loxone Touch Pure Display, TapHome Ovladač s displejem | v katalogu nejsou | bez čísel (ověřte) |
| free@home `DA-M-8.210.2.1` 8násobný | 2CKA006220A0731 = `DA/M.6.210.2.1` 6násobný, 8 M | katalog |
| free@home `JA-M-4/8.230.1.1` 2CDG510020/21R0011 | žaluziové `BA-M-4.230.1.1` 2CDG510028R0011, `BA-M-8.230.1.1` 2CDG510029R0011 | katalog |
| free@home `HA-M-6/12.24.1` | `HA-M-0.6.1` / `HA-M-0.12.1` (čísla 2CDG510008/9R0011 sedí) | katalog |
| free@home `BE-M-4.20.1` | `BI-M-4.20.1.1` 2CDG510014R0011, 2 M (Katalog ABB 2026, str. 277) | katalog |
| `SAP-S-3` 6 M | `SAP.3` 2CKA006200A0871 (119 × 107 × 30 mm) + adaptér `SAP-A1.1` 2CKA006200A0158 → 7 M | 7 M podle rozměru |
| KNX `VC/S 4.1.1` 4 M | 2CDG110216R0011, 8 M | katalog |
| KNX `BE/S 8.20.2.1` | 2CDG110092R0011, 4 M | katalog |
| KNX `UD/S 4.210.2.1` 6 M | šířka v katalogu není (dosud 4 M „ověřte“) | 6 M podle zadání a shodné platformy DA/M.4.210.2.1 (ověřte) |
| Loxone `Miniserver Compact` 100500 | 100512, 6 M, Pv 8,4 W | katalog |
| Loxone `DI Extension` 100383 | 100283, 2 M, Pv 0,5 W | katalog |
| Loxone `Power Supply & Backup` 9 M | 100401, 18 M | katalog |
| Loxone Pv ze zadání (Miniserver 4,0 W, Relay Extension 6,0 W, Tree Extension 1,5 W …) | Miniserver 6,7 W, Relay Extension 11 W, Tree Extension 0,12 W, Multi Extension Air 8,7 W, RGBW 24V Dimmer Tree 3 W | katalog |
| Pv ABB-free@home, KNX zdroje a TapHome | katalog Pv neuvádí | hodnoty ze zadání jako orientační odhad (v katalogu prvků „odhad“) |
