// Generuje `node scripts/import-abb-etim9.mjs` z oficiálních dat ABB ETIM 9.0 (ELSB_ETIM-9.0_2026-05) – needitujte ručně.
// Rámečky 1R–5R z kusovníku s ověřením v ETIM (počet násobků EF000074), vestavné hloubky přístrojů řad (EF012278 /
// EF000218 v mm), GTIN / EAN objednacích čísel a výrobky chytré domácnosti (technický list).

export interface EtimFrame {
  gangs: number;
  mpn: string;
  gtin: string | null;
  /** Objednací číslo je v datech ETIM výrobce. */
  inEtim: boolean;
  /** Počet násobků podle ETIM (EF000074); null = neuvedeno. */
  etimGangs: number | null;
}

export const ETIM_SOURCE = "ABB – oficiální data ETIM 9.0 (ELSB_ETIM-9.0_2026-05, cdn.productimages.abb.com)";

/** Rámečky řady a barvy („ABB|Tango|abb-tango-b“). */
export const ETIM_FRAMES: Record<string, EtimFrame[]> = {
  "ABB|Zoni|abb-zoni-500": [
    {
      "gangs": 1,
      "mpn": "3901T-A00010 500",
      "gtin": "8592624235774",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901T-A00020 500",
      "gtin": "8592624235781",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901T-A00030 500",
      "gtin": "8592624235798",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901T-A00040 500",
      "gtin": "8592624370109",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901T-A00050 500",
      "gtin": "8592624235804",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Zoni|abb-zoni-240": [
    {
      "gangs": 1,
      "mpn": "3901T-A00010 240",
      "gtin": "8592624447702",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901T-A00020 240",
      "gtin": "8592624447849",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901T-A00030 240",
      "gtin": "8592624447986",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901T-A00040 240",
      "gtin": "8592624448129",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901T-A00050 240",
      "gtin": "8592624448266",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Zoni|abb-zoni-241-141": [
    {
      "gangs": 1,
      "mpn": "3901T-A00010 241",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 2,
      "mpn": "3901T-A00020 241",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 3,
      "mpn": "3901T-A00030 241",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 4,
      "mpn": "3901T-A00040 241",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 5,
      "mpn": "3901T-A00050 241",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    }
  ],
  "ABB|Zoni|abb-zoni-242-142": [
    {
      "gangs": 1,
      "mpn": "3901T-A00010 242",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 2,
      "mpn": "3901T-A00020 242",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 3,
      "mpn": "3901T-A00030 242",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 4,
      "mpn": "3901T-A00040 242",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 5,
      "mpn": "3901T-A00050 242",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    }
  ],
  "ABB|Zoni|abb-zoni-243-143": [
    {
      "gangs": 1,
      "mpn": "3901T-A00010 243",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 2,
      "mpn": "3901T-A00020 243",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 3,
      "mpn": "3901T-A00030 243",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 4,
      "mpn": "3901T-A00040 243",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 5,
      "mpn": "3901T-A00050 243",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    }
  ],
  "ABB|Zoni|abb-zoni-244-144": [
    {
      "gangs": 1,
      "mpn": "3901T-A00010 244",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 2,
      "mpn": "3901T-A00020 244",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 3,
      "mpn": "3901T-A00030 244",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 4,
      "mpn": "3901T-A00040 244",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    },
    {
      "gangs": 5,
      "mpn": "3901T-A00050 244",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    }
  ],
  "ABB|Zoni|abb-zoni-237": [
    {
      "gangs": 1,
      "mpn": "3901T-A00010 237",
      "gtin": "8592624447726",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901T-A00020 237",
      "gtin": "8592624447863",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901T-A00030 237",
      "gtin": "8592624448006",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901T-A00040 237",
      "gtin": "8592624448143",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901T-A00050 237",
      "gtin": "8592624448280",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Zoni|abb-zoni-137": [
    {
      "gangs": 1,
      "mpn": "3901T-A00010 137",
      "gtin": "8592624447740",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901T-A00020 137",
      "gtin": "8592624447887",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901T-A00030 137",
      "gtin": "8592624448020",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901T-A00040 137",
      "gtin": "8592624448167",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901T-A00050 137",
      "gtin": "8592624448303",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Tango|abb-tango-b": [
    {
      "gangs": 1,
      "mpn": "3901A-B10 B",
      "gtin": "8595017208782",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901A-B20 B",
      "gtin": "8595017208904",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901A-B30 B",
      "gtin": "8595017209147",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901A-B40 B",
      "gtin": "8595017217265",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901A-B50 B",
      "gtin": "8595017219443",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Tango|abb-tango-c": [
    {
      "gangs": 1,
      "mpn": "3901A-B10 C",
      "gtin": "8595017255922",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901A-B20 C",
      "gtin": "8595017257247",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901A-B30 C",
      "gtin": "8595017257254",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901A-B40 C",
      "gtin": "8595017257261",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901A-B50 C",
      "gtin": "8595017260292",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Tango|abb-tango-s": [
    {
      "gangs": 1,
      "mpn": "3901A-B10 S",
      "gtin": "8595017220746",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901A-B20 S",
      "gtin": "8595017220760",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901A-B30 S",
      "gtin": "8595017221002",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901A-B40 S",
      "gtin": "8595017221071",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901A-B50 S",
      "gtin": "8595017222405",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Tango|abb-tango-d": [
    {
      "gangs": 1,
      "mpn": "3901A-B10 D",
      "gtin": "8595017220753",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901A-B20 D",
      "gtin": "8595017220777",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901A-B30 D",
      "gtin": "8595017220999",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901A-B40 D",
      "gtin": "8595017221088",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901A-B50 D",
      "gtin": "8595017222399",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Tango|abb-tango-h": [
    {
      "gangs": 1,
      "mpn": "3901A-B10 H",
      "gtin": "8592624042945",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901A-B20 H",
      "gtin": "8592624042921",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901A-B30 H",
      "gtin": "8592624042884",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901A-B40 H",
      "gtin": "8592624042846",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901A-B50 H",
      "gtin": "8592624042808",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Tango|abb-tango-n": [
    {
      "gangs": 1,
      "mpn": "3901A-B10 N",
      "gtin": "8595017208805",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901A-B20 N",
      "gtin": "8595017208928",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901A-B30 N",
      "gtin": "8595017209161",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901A-B40 N",
      "gtin": "8595017217289",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901A-B50 N",
      "gtin": "8595017219467",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Tango|abb-tango-s2": [
    {
      "gangs": 1,
      "mpn": "3901A-B10 S2",
      "gtin": "8595017207181",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901A-B20 S2",
      "gtin": "8595017207266",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901A-B30 S2",
      "gtin": "8595017207389",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901A-B40 S2",
      "gtin": "8595017207587",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901A-B50 S2",
      "gtin": "8595017207747",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Tango|abb-tango-r2": [
    {
      "gangs": 1,
      "mpn": "3901A-B10 R2",
      "gtin": "8595017207174",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901A-B20 R2",
      "gtin": "8595017207235",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901A-B30 R2",
      "gtin": "8595017207365",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901A-B40 R2",
      "gtin": "8595017207549",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901A-B50 R2",
      "gtin": "8595017207723",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit|abb-levit-01": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 01",
      "gtin": "8592624064602",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 01",
      "gtin": "8592624064909",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 01",
      "gtin": "8592624064916",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 01",
      "gtin": "8592624065401",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 01",
      "gtin": "8592624065418",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit|abb-levit-03": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 03",
      "gtin": "8592624067108",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 03",
      "gtin": "8592624067306",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 03",
      "gtin": "8592624067504",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 03",
      "gtin": "8592624067702",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 03",
      "gtin": "8592624067948",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit|abb-levit-16": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 16",
      "gtin": "8592624067122",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 16",
      "gtin": "8592624067320",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 16",
      "gtin": "8592624067528",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 16",
      "gtin": "8592624067726",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 16",
      "gtin": "8592624067962",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit|abb-levit-17": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 17",
      "gtin": "8592624067146",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 17",
      "gtin": "8592624067344",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 17",
      "gtin": "8592624067542",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 17",
      "gtin": "8592624067757",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 17",
      "gtin": "8592624067986",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit|abb-levit-18": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 18",
      "gtin": "8592624067160",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 18",
      "gtin": "8592624067368",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 18",
      "gtin": "8592624067566",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 18",
      "gtin": "8592624067771",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 18",
      "gtin": "8592624068006",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit|abb-levit-62": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 62",
      "gtin": "8592624067184",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 62",
      "gtin": "8592624067382",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 62",
      "gtin": "8592624067580",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 62",
      "gtin": "8592624067795",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 62",
      "gtin": "8592624068020",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit|abb-levit-64": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 64",
      "gtin": "8592624067221",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 64",
      "gtin": "8592624067429",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 64",
      "gtin": "8592624067627",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 64",
      "gtin": "8592624067832",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 64",
      "gtin": "8592624068068",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit|abb-levit-65": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 65",
      "gtin": "8592624067245",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 65",
      "gtin": "8592624067443",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 65",
      "gtin": "8592624067641",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 65",
      "gtin": "8592624067856",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 65",
      "gtin": "8592624068082",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit|abb-levit-66": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 66",
      "gtin": "8592624067269",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 66",
      "gtin": "8592624067467",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 66",
      "gtin": "8592624067665",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 66",
      "gtin": "8592624067870",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 66",
      "gtin": "8592624068105",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit|abb-levit-67": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 67",
      "gtin": "8592624067283",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 67",
      "gtin": "8592624067481",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 67",
      "gtin": "8592624067689",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 67",
      "gtin": "8592624067894",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 67",
      "gtin": "8592624068129",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit M|abb-levit-m-63": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 63",
      "gtin": "8592624067207",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 63",
      "gtin": "8592624067405",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 63",
      "gtin": "8592624067603",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 63",
      "gtin": "8592624067818",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 63",
      "gtin": "8592624068044",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit M|abb-levit-m-68": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 68",
      "gtin": "8592624102687",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 68",
      "gtin": "8592624102717",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 68",
      "gtin": "8592624102748",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 68",
      "gtin": "8592624102762",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 68",
      "gtin": "8592624102793",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit M|abb-levit-m-69": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 69",
      "gtin": "8592624102694",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 69",
      "gtin": "8592624102724",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 69",
      "gtin": "8592624102755",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 69",
      "gtin": "8592624102779",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 69",
      "gtin": "8592624102809",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Levit M|abb-levit-m-70": [
    {
      "gangs": 1,
      "mpn": "3901H-A05010 70",
      "gtin": "8592624102700",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901H-A05020 70",
      "gtin": "8592624102731",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901H-A05030 70",
      "gtin": "8592624101512",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901H-A05040 70",
      "gtin": "8592624102786",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901H-A05050 70",
      "gtin": "8592624102816",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Time|abb-time-01": [
    {
      "gangs": 1,
      "mpn": "3901F-A00110 01",
      "gtin": "8595017234019",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901F-A00120 01",
      "gtin": "8595017234057",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901F-A00130 01",
      "gtin": "8595017234095",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901F-A00140 01",
      "gtin": "8595017234132",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901F-A00150 01",
      "gtin": "8595017234187",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Time|abb-time-03": [
    {
      "gangs": 1,
      "mpn": "3901F-A00110 03",
      "gtin": "8595017244605",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901F-A00120 03",
      "gtin": "8595017246272",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901F-A00130 03",
      "gtin": "8595017243936",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901F-A00140 03",
      "gtin": "8595017246302",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901F-A00150 03",
      "gtin": "8595017243943",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Time|abb-time-08": [
    {
      "gangs": 1,
      "mpn": "3901F-A00110 08",
      "gtin": "8595017234040",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901F-A00120 08",
      "gtin": "8595017234088",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901F-A00130 08",
      "gtin": "8595017234125",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901F-A00140 08",
      "gtin": "8595017234170",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901F-A00150 08",
      "gtin": "8595017234217",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Time|abb-time-32": [
    {
      "gangs": 1,
      "mpn": "3901F-A00110 32",
      "gtin": "8595017266317",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901F-A00120 32",
      "gtin": "8595017266355",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901F-A00130 32",
      "gtin": "8595017266515",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901F-A00140 32",
      "gtin": "8595017266553",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901F-A00150 32",
      "gtin": "8595017266591",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Time|abb-time-33": [
    {
      "gangs": 1,
      "mpn": "3901F-A00110 33",
      "gtin": "8595017266324",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901F-A00120 33",
      "gtin": "8595017266362",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901F-A00130 33",
      "gtin": "8595017266522",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901F-A00140 33",
      "gtin": "8595017266560",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901F-A00150 33",
      "gtin": "8595017266607",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Time|abb-time-34": [
    {
      "gangs": 1,
      "mpn": "3901F-A00110 34",
      "gtin": "8595017266331",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901F-A00120 34",
      "gtin": "8595017266379",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901F-A00130 34",
      "gtin": "8595017266539",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901F-A00140 34",
      "gtin": "8595017266577",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901F-A00150 34",
      "gtin": "8595017266614",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Time|abb-time-36": [
    {
      "gangs": 1,
      "mpn": "3901F-A00110 36",
      "gtin": "8592624077176",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901F-A00120 36",
      "gtin": "8592624077213",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901F-A00130 36",
      "gtin": "8592624077275",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901F-A00140 36",
      "gtin": "8592624077350",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901F-A00150 36",
      "gtin": "8592624077435",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Swing|abb-swing-b1": [
    {
      "gangs": 1,
      "mpn": "3901G-A00010 B1",
      "gtin": "8595017270307",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901G-A00020 B1",
      "gtin": "8595017274909",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901G-A00030 B1",
      "gtin": "8595017274954",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901G-A00040 B1",
      "gtin": "8595017293108",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901G-A00050 B1",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    }
  ],
  "ABB|Swing|abb-swing-c1": [
    {
      "gangs": 1,
      "mpn": "3901G-A00010 C1",
      "gtin": "8595017275807",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901G-A00020 C1",
      "gtin": "8595017274916",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901G-A00030 C1",
      "gtin": "8595017274961",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901G-A00040 C1",
      "gtin": "8595017293115",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901G-A00050 C1",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    }
  ],
  "ABB|Swing|abb-swing-d1": [
    {
      "gangs": 1,
      "mpn": "3901G-A00010 D1",
      "gtin": "8595017275814",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901G-A00020 D1",
      "gtin": "8595017274923",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901G-A00030 D1",
      "gtin": "8595017274978",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901G-A00040 D1",
      "gtin": "8595017293139",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901G-A00050 D1",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    }
  ],
  "ABB|Swing|abb-swing-s1": [
    {
      "gangs": 1,
      "mpn": "3901G-A00010 S1",
      "gtin": "8595017275906",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901G-A00020 S1",
      "gtin": "8595017274930",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901G-A00030 S1",
      "gtin": "8595017274985",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901G-A00040 S1",
      "gtin": "8595017293153",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901G-A00050 S1",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    }
  ],
  "ABB|Swing|abb-swing-h1": [
    {
      "gangs": 1,
      "mpn": "3901G-A00010 H1",
      "gtin": "8595017275821",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901G-A00020 H1",
      "gtin": "8595017274947",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901G-A00030 H1",
      "gtin": "8595017274992",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901G-A00040 H1",
      "gtin": "8595017293146",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901G-A00050 H1",
      "gtin": null,
      "inEtim": false,
      "etimGangs": null
    }
  ],
  "ABB|Swing L|abb-swing-l-b1": [
    {
      "gangs": 1,
      "mpn": "3901J-A00010 B1",
      "gtin": "8595017289606",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901J-A00020 B1",
      "gtin": "8595017289620",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901J-A00030 B1",
      "gtin": "8595017289644",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901J-A00040 B1",
      "gtin": "8595017203428",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901J-A00050 B1",
      "gtin": "8595017233661",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Swing L|abb-swing-l-c1": [
    {
      "gangs": 1,
      "mpn": "3901J-A00010 C1",
      "gtin": "8595017289613",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901J-A00020 C1",
      "gtin": "8595017289637",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901J-A00030 C1",
      "gtin": "8595017289651",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901J-A00040 C1",
      "gtin": "8595017203442",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901J-A00050 C1",
      "gtin": "8595017233678",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Swing L|abb-swing-l-c3": [
    {
      "gangs": 1,
      "mpn": "3901J-A00010 C3",
      "gtin": "8592624057802",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901J-A00020 C3",
      "gtin": "8592624057864",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901J-A00030 C3",
      "gtin": "8592624057901",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901J-A00040 C3",
      "gtin": "8592624057949",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901J-A00050 C3",
      "gtin": "8592624057987",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Swing L|abb-swing-l-s1": [
    {
      "gangs": 1,
      "mpn": "3901J-A00010 S1",
      "gtin": "8595017209635",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901J-A00020 S1",
      "gtin": "8595017209666",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901J-A00030 S1",
      "gtin": "8595017209710",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901J-A00040 S1",
      "gtin": "8595017203497",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901J-A00050 S1",
      "gtin": "8595017233722",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Swing L|abb-swing-l-r3": [
    {
      "gangs": 1,
      "mpn": "3901J-A00010 R3",
      "gtin": "8592624057833",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "3901J-A00020 R3",
      "gtin": "8592624057888",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "3901J-A00030 R3",
      "gtin": "8592624057925",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "3901J-A00040 R3",
      "gtin": "8592624057963",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "3901J-A00050 R3",
      "gtin": "8592624058007",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|future linear|abb-future-studio-bila": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4235",
      "gtin": "4011395050750",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4236",
      "gtin": "4011395050767",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4237",
      "gtin": "4011395050774",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4238",
      "gtin": "4011395050781",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4239",
      "gtin": "4011395050798",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|future linear|abb-future-hlinikova-stribrna": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4301",
      "gtin": "4011395069059",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4302",
      "gtin": "4011395069073",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4308",
      "gtin": "4011395070154",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4309",
      "gtin": "4011395074831",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4310",
      "gtin": "4011395074848",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|future linear|abb-future-antracitova": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4240",
      "gtin": "4011395050804",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4241",
      "gtin": "4011395050811",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4242",
      "gtin": "4011395050828",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4243",
      "gtin": "4011395050835",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4244",
      "gtin": "4011395050842",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|future linear|abb-future-uslechtila-ocel": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4317",
      "gtin": "4011395088319",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4318",
      "gtin": "4011395088340",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4319",
      "gtin": "4011395088371",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4320",
      "gtin": "4011395088395",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4321",
      "gtin": "4011395088425",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|future linear|abb-future-mechova-bila": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4414",
      "gtin": "4011395128244",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4415",
      "gtin": "4011395128251",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4416",
      "gtin": "4011395128268",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4417",
      "gtin": "4011395128275",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4418",
      "gtin": "4011395128282",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|future linear|abb-future-mechova-cerna": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4419",
      "gtin": "4011395128299",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4420",
      "gtin": "4011395128312",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4421",
      "gtin": "4011395128329",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4422",
      "gtin": "4011395128336",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4423",
      "gtin": "4011395128343",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|solo|abb-solo-studio-bila-chromova": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4104",
      "gtin": "4011395994825",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4105",
      "gtin": "4011395994849",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4106",
      "gtin": "4011395994863",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4107",
      "gtin": "4011395994887",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4108",
      "gtin": "4011395994924",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|solo|abb-solo-antracitova-chromova": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4104",
      "gtin": "4011395994825",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4105",
      "gtin": "4011395994849",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4106",
      "gtin": "4011395994863",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4107",
      "gtin": "4011395994887",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4108",
      "gtin": "4011395994924",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|solo|abb-solo-studio-bila-studio-bila": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4109",
      "gtin": "4011395996119",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4110",
      "gtin": "4011395996133",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4111",
      "gtin": "4011395996157",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4112",
      "gtin": "4011395996171",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4113",
      "gtin": "4011395996195",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|solo|abb-solo-antracitova-chromova-leskla": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4326",
      "gtin": "4011395113059",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4327",
      "gtin": "4011395113066",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4328",
      "gtin": "4011395113073",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4329",
      "gtin": "4011395113080",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4330",
      "gtin": "4011395113097",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|solo carat|abb-solo-carat-84": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4442",
      "gtin": "4011395157015",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4443",
      "gtin": "4011395157022",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4444",
      "gtin": "4011395157039",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4445",
      "gtin": "4011395157046",
      "inEtim": true,
      "etimGangs": 4
    }
  ],
  "ABB|solo carat|abb-solo-carat-884": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4442",
      "gtin": "4011395157015",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4443",
      "gtin": "4011395157022",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4444",
      "gtin": "4011395157039",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4445",
      "gtin": "4011395157046",
      "inEtim": true,
      "etimGangs": 4
    }
  ],
  "ABB|solo carat|abb-solo-carat-81": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4322",
      "gtin": "4011395088913",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4323",
      "gtin": "4011395088920",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4324",
      "gtin": "4011395088937",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4325",
      "gtin": "4011395088944",
      "inEtim": true,
      "etimGangs": 4
    }
  ],
  "ABB|solo carat|abb-solo-carat-885": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4322",
      "gtin": "4011395088913",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4323",
      "gtin": "4011395088920",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4324",
      "gtin": "4011395088937",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4325",
      "gtin": "4011395088944",
      "inEtim": true,
      "etimGangs": 4
    }
  ],
  "ABB|solo carat|abb-solo-carat-83": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4254",
      "gtin": "4011395056790",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4255",
      "gtin": "4011395056813",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4256",
      "gtin": "4011395056837",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4257",
      "gtin": "4011395056851",
      "inEtim": true,
      "etimGangs": 4
    }
  ],
  "ABB|solo carat|abb-solo-carat-866": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4254",
      "gtin": "4011395056790",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4255",
      "gtin": "4011395056813",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4256",
      "gtin": "4011395056837",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4257",
      "gtin": "4011395056851",
      "inEtim": true,
      "etimGangs": 4
    }
  ],
  "ABB|Busch-axcent|abb-axcent-84": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4437",
      "gtin": "4011395156957",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4438",
      "gtin": "4011395156964",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4439",
      "gtin": "4011395156971",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4440",
      "gtin": "4011395156988",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4441",
      "gtin": "4011395156995",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Busch-axcent|abb-axcent-884": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4800",
      "gtin": "4011395298251",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4801",
      "gtin": "4011395298268",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4802",
      "gtin": "4011395298275",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4803",
      "gtin": "4011395298299",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4804",
      "gtin": "4011395298305",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Busch-axcent|abb-axcent-81": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4683",
      "gtin": "4011395258682",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4684",
      "gtin": "4011395258699",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4685",
      "gtin": "4011395261125",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4686",
      "gtin": "4011395258712",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4687",
      "gtin": "4011395258729",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Busch-axcent|abb-axcent-885": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4703",
      "gtin": "4011395259115",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4704",
      "gtin": "4011395259122",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4705",
      "gtin": "4011395259139",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4706",
      "gtin": "4011395259146",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4707",
      "gtin": "4011395259153",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Busch-axcent|abb-axcent-83": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4693",
      "gtin": "4011395261132",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4694",
      "gtin": "4011395259016",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4695",
      "gtin": "4011395259023",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4696",
      "gtin": "4011395259047",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4697",
      "gtin": "4011395259054",
      "inEtim": true,
      "etimGangs": 5
    }
  ],
  "ABB|Busch-axcent|abb-axcent-866": [
    {
      "gangs": 1,
      "mpn": "2CKA001754A4683",
      "gtin": "4011395258682",
      "inEtim": true,
      "etimGangs": 1
    },
    {
      "gangs": 2,
      "mpn": "2CKA001754A4684",
      "gtin": "4011395258699",
      "inEtim": true,
      "etimGangs": 2
    },
    {
      "gangs": 3,
      "mpn": "2CKA001754A4685",
      "gtin": "4011395261125",
      "inEtim": true,
      "etimGangs": 3
    },
    {
      "gangs": 4,
      "mpn": "2CKA001754A4686",
      "gtin": "4011395258712",
      "inEtim": true,
      "etimGangs": 4
    },
    {
      "gangs": 5,
      "mpn": "2CKA001754A4687",
      "gtin": "4011395258729",
      "inEtim": true,
      "etimGangs": 5
    }
  ]
};

/** Vestavná hloubka přístroje řady podle ETIM („ABB|Levit|dimmer“) – nejhlubší díl přístroje. */
export const ETIM_DEVICE_DEPTHS: Record<string, { mpn: string; depthMm: number }> = {
  "ABB|Zoni|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|Zoni|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|Zoni|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|Zoni|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|Zoni|socket": {
    "mpn": "6619T-A06657 500",
    "depthMm": 24.6
  },
  "ABB|Tango|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|Tango|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|Tango|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|Tango|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|Tango|socket": {
    "mpn": "6619A-A06357 B",
    "depthMm": 40
  },
  "ABB|Tango|double-socket": {
    "mpn": "5513A-C02357 B",
    "depthMm": 40
  },
  "ABB|Levit|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|Levit|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|Levit|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|Levit|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|Levit|socket": {
    "mpn": "6619H-A06357 01",
    "depthMm": 40
  },
  "ABB|Levit|double-socket": {
    "mpn": "5513H-C02357 01",
    "depthMm": 40
  },
  "ABB|Levit M|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|Levit M|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|Levit M|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|Levit M|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|Levit M|socket": {
    "mpn": "6619H-A06357 63",
    "depthMm": 40
  },
  "ABB|Levit M|double-socket": {
    "mpn": "5513H-C02357 63",
    "depthMm": 40
  },
  "ABB|Time|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|Time|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|Time|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|Time|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|Time Arbo|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|Time Arbo|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|Time Arbo|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|Time Arbo|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|Swing|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|Swing|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|Swing|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|Swing|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|Swing L|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|Swing L|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|Swing L|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|Swing L|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|Classic|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|Classic|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|Classic|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|Classic|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|Decento|switch-1": {
    "mpn": "3559K-C06345",
    "depthMm": 26.2
  },
  "ABB|Decento|switch-6": {
    "mpn": "3559K-C06345",
    "depthMm": 26.2
  },
  "ABB|Decento|switch-7": {
    "mpn": "3559K-C07345",
    "depthMm": 26.2
  },
  "ABB|Decento|button": {
    "mpn": "3559K-C86345",
    "depthMm": 40
  },
  "ABB|Decento|blind": {
    "mpn": "3559K-C88345",
    "depthMm": 40
  },
  "ABB|Decento|socket": {
    "mpn": "6619K-C06347",
    "depthMm": 40
  },
  "ABB|Decento|double-socket": {
    "mpn": "6619K-C06347",
    "depthMm": 40
  },
  "ABB|Decento|data-socket": {
    "mpn": "5014K-C01018",
    "depthMm": 40
  },
  "ABB|future linear|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|future linear|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|future linear|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|future linear|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|solo|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|solo|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|solo|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|solo|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|solo carat|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|solo carat|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|solo carat|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|solo carat|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  },
  "ABB|Busch-axcent|switch-1": {
    "mpn": "3559-A01345",
    "depthMm": 17
  },
  "ABB|Busch-axcent|switch-6": {
    "mpn": "3559-A06345",
    "depthMm": 17
  },
  "ABB|Busch-axcent|switch-7": {
    "mpn": "3559-A07345",
    "depthMm": 17
  },
  "ABB|Busch-axcent|blind": {
    "mpn": "3559-A89345",
    "depthMm": 19
  }
};

/** GTIN / EAN objednacích čísel z kusovníku řad ABB (přístroje, kryty, rámečky) a chytré domácnosti – číslo je v datech výrobce. */
export const ETIM_GTIN: Record<string, string> = {
  "2CDG110146R0011": "4016779866699",
  "2CDG110167R0011": "4016779906210",
  "2CDG110198R0011": "4016779942669",
  "2CDG110216R0011": "4016779011488",
  "2CDG110262R0011": "4016779066655",
  "2CDG110263R0011": "4016779066679",
  "2CDG110264R0011": "4016779066693",
  "2CDG510001R0011": "4016779941839",
  "2CDG510008R0011": "4016779941815",
  "2CDG510009R0011": "4016779941808",
  "2CDG510012R0011": "4016779067409",
  "2CDG510014R0011": "4053546111132",
  "2CDG510025R0011": "4053546111309",
  "2CDG510026R0011": "4053546111316",
  "2CDG510027R0011": "4053546111330",
  "2CDG510028R0011": "4053546111347",
  "2CDG510029R0011": "4053546111354",
  "2CKA001754A4104": "4011395994825",
  "2CKA001754A4105": "4011395994849",
  "2CKA001754A4106": "4011395994863",
  "2CKA001754A4107": "4011395994887",
  "2CKA001754A4108": "4011395994924",
  "2CKA001754A4109": "4011395996119",
  "2CKA001754A4110": "4011395996133",
  "2CKA001754A4111": "4011395996157",
  "2CKA001754A4112": "4011395996171",
  "2CKA001754A4113": "4011395996195",
  "2CKA001754A4235": "4011395050750",
  "2CKA001754A4236": "4011395050767",
  "2CKA001754A4237": "4011395050774",
  "2CKA001754A4238": "4011395050781",
  "2CKA001754A4239": "4011395050798",
  "2CKA001754A4240": "4011395050804",
  "2CKA001754A4241": "4011395050811",
  "2CKA001754A4242": "4011395050828",
  "2CKA001754A4243": "4011395050835",
  "2CKA001754A4244": "4011395050842",
  "2CKA001754A4254": "4011395056790",
  "2CKA001754A4255": "4011395056813",
  "2CKA001754A4256": "4011395056837",
  "2CKA001754A4257": "4011395056851",
  "2CKA001754A4301": "4011395069059",
  "2CKA001754A4302": "4011395069073",
  "2CKA001754A4308": "4011395070154",
  "2CKA001754A4309": "4011395074831",
  "2CKA001754A4310": "4011395074848",
  "2CKA001754A4317": "4011395088319",
  "2CKA001754A4318": "4011395088340",
  "2CKA001754A4319": "4011395088371",
  "2CKA001754A4320": "4011395088395",
  "2CKA001754A4321": "4011395088425",
  "2CKA001754A4322": "4011395088913",
  "2CKA001754A4323": "4011395088920",
  "2CKA001754A4324": "4011395088937",
  "2CKA001754A4325": "4011395088944",
  "2CKA001754A4326": "4011395113059",
  "2CKA001754A4327": "4011395113066",
  "2CKA001754A4328": "4011395113073",
  "2CKA001754A4329": "4011395113080",
  "2CKA001754A4330": "4011395113097",
  "2CKA001754A4414": "4011395128244",
  "2CKA001754A4415": "4011395128251",
  "2CKA001754A4416": "4011395128268",
  "2CKA001754A4417": "4011395128275",
  "2CKA001754A4418": "4011395128282",
  "2CKA001754A4419": "4011395128299",
  "2CKA001754A4420": "4011395128312",
  "2CKA001754A4421": "4011395128329",
  "2CKA001754A4422": "4011395128336",
  "2CKA001754A4423": "4011395128343",
  "2CKA001754A4437": "4011395156957",
  "2CKA001754A4438": "4011395156964",
  "2CKA001754A4439": "4011395156971",
  "2CKA001754A4440": "4011395156988",
  "2CKA001754A4441": "4011395156995",
  "2CKA001754A4442": "4011395157015",
  "2CKA001754A4443": "4011395157022",
  "2CKA001754A4444": "4011395157039",
  "2CKA001754A4445": "4011395157046",
  "2CKA001754A4683": "4011395258682",
  "2CKA001754A4684": "4011395258699",
  "2CKA001754A4685": "4011395261125",
  "2CKA001754A4686": "4011395258712",
  "2CKA001754A4687": "4011395258729",
  "2CKA001754A4693": "4011395261132",
  "2CKA001754A4694": "4011395259016",
  "2CKA001754A4695": "4011395259023",
  "2CKA001754A4696": "4011395259047",
  "2CKA001754A4697": "4011395259054",
  "2CKA001754A4703": "4011395259115",
  "2CKA001754A4704": "4011395259122",
  "2CKA001754A4705": "4011395259139",
  "2CKA001754A4706": "4011395259146",
  "2CKA001754A4707": "4011395259153",
  "2CKA001754A4800": "4011395298251",
  "2CKA001754A4801": "4011395298268",
  "2CKA001754A4802": "4011395298275",
  "2CKA001754A4803": "4011395298299",
  "2CKA001754A4804": "4011395298305",
  "2CKA006134A0319": "4011395211014",
  "2CKA006197A0047": "4011395251867",
  "2CKA006200A0871": "4011395346075",
  "2CKA006220A0117": "4011395180075",
  "2CKA006220A0118": "4011395180082",
  "2CKA006220A0122": "4011395180099",
  "2CKA006220A0729": "4011395251799",
  "2CKA006220A0731": "4011395252031",
  "2CKA006710A0034": "4011395346433",
  "2CKA006710A0038": "4011395346396",
  "2CKA006710A0041": "4011395346365",
  "2CKA006710A0048": "4011395341612",
  "2CKA006710A0057": "4011395363379",
  "2TMA130050B0054": "6955891815155",
  "2TMA130050B0065": "6955891816978",
  "2TMA130050W0054": "6955891815148",
  "2TMA130050W0065": "6955891816961",
  "2TMA310011B0001": "6955891820005",
  "2TMA310011B0003": "6955891820029",
  "2TMA310011W0001": "6955891820036",
  "2TMA310051B0001": "6955891819443",
  "2TMA310051W0001": "6955891819436",
  "2TMA320051B0001": "6955891822702",
  "2TMA320051W0001": "6955891822696",
  "3558A-A651 B": "8595017208140",
  "3558A-A651 C": "8595017255908",
  "3558A-A651 D": "8595017220302",
  "3558A-A651 H": "8592624043003",
  "3558A-A651 N": "8595017208164",
  "3558A-A651 R2": "8595017206733",
  "3558A-A651 S": "8595017220319",
  "3558A-A651 S2": "8595017206740",
  "3558A-A652 B": "8595017208188",
  "3558A-A652 C": "8595017255915",
  "3558A-A652 D": "8595017220333",
  "3558A-A652 H": "8592624042983",
  "3558A-A652 N": "8595017208201",
  "3558A-A652 R2": "8595017206764",
  "3558A-A652 S": "8595017220326",
  "3558A-A652 S2": "8595017206795",
  "3558A-A662 B": "8595017221996",
  "3558A-A662 C": "8595017260254",
  "3558A-A662 D": "8595017222030",
  "3558A-A662 H": "8592624043331",
  "3558A-A662 N": "8595017222016",
  "3558A-A662 R2": "8595017206924",
  "3558A-A662 S": "8595017222047",
  "3558A-A662 S2": "8595017206931",
  "3558E-A00651 01": "8595017234484",
  "3558E-A00651 03": "8595017233210",
  "3558E-A00651 08": "8595017234514",
  "3558E-A00651 32": "8595017265914",
  "3558E-A00651 33": "8595017265921",
  "3558E-A00651 34": "8595017265938",
  "3558E-A00651 36": "8592624076896",
  "3558E-A00652 01": "8595017234521",
  "3558E-A00652 03": "8595017233258",
  "3558E-A00652 08": "8595017234552",
  "3558E-A00652 32": "8595017265952",
  "3558E-A00652 33": "8595017265969",
  "3558E-A00652 34": "8595017265976",
  "3558E-A00652 36": "8592624076933",
  "3558E-A00662 01": "8595017238758",
  "3558E-A00662 03": "8595017238772",
  "3558E-A00662 08": "8595017238826",
  "3558E-A00662 32": "8595017265891",
  "3558E-A00662 33": "8595017266201",
  "3558E-A00662 34": "8595017266218",
  "3558E-A00662 36": "8592624077053",
  "3559-A01345": "8595017245602",
  "3559-A05345": "8595017245619",
  "3559-A06345": "8595017245626",
  "3559-A07345": "8595017245633",
  "3559-A52345": "8595017290602",
  "3559-A87345": "8595017253645",
  "3559-A89345": "8595017201110",
  "3559B-A0065181": "8595017230905",
  "3559B-A0065183": "8595017230912",
  "3559B-A0065184": "8595017261381",
  "3559B-A00651866": "8595017231513",
  "3559B-A00651884": "8592624046103",
  "3559B-A00651885": "8592624046127",
  "3559B-A0065281": "8595017231612",
  "3559B-A0065283": "8595017231629",
  "3559B-A0065284": "8595017261886",
  "3559B-A00652866": "8595017231636",
  "3559B-A00652884": "8592624046141",
  "3559B-A00652885": "8592624046165",
  "3559H-A00651 01": "8592624064640",
  "3559H-A00651 03": "8592624068495",
  "3559H-A00651 16": "8592624068518",
  "3559H-A00651 17": "8592624068532",
  "3559H-A00651 18": "8592624068556",
  "3559H-A00651 62": "8592624068570",
  "3559H-A00651 63": "8592624068594",
  "3559H-A00651 64": "8592624068617",
  "3559H-A00651 65": "8592624068631",
  "3559H-A00651 66": "8592624068655",
  "3559H-A00651 67": "8592624068679",
  "3559H-A00651 68": "8592624102410",
  "3559H-A00651 69": "8592624102427",
  "3559H-A00651 70": "8592624102434",
  "3559H-A00652 01": "8592624064626",
  "3559H-A00652 03": "8592624068693",
  "3559H-A00652 16": "8592624068716",
  "3559H-A00652 17": "8592624068730",
  "3559H-A00652 18": "8592624068754",
  "3559H-A00652 62": "8592624068778",
  "3559H-A00652 63": "8592624068792",
  "3559H-A00652 64": "8592624068815",
  "3559H-A00652 65": "8592624068839",
  "3559H-A00652 66": "8592624068853",
  "3559H-A00652 67": "8592624068877",
  "3559H-A00652 68": "8592624102441",
  "3559H-A00652 69": "8592624102458",
  "3559H-A00652 70": "8592624102465",
  "3559H-A00662 01": "8592624070818",
  "3559H-A00662 03": "8592624070849",
  "3559H-A00662 16": "8592624070863",
  "3559H-A00662 17": "8592624070887",
  "3559H-A00662 18": "8592624070900",
  "3559H-A00662 62": "8592624070924",
  "3559H-A00662 63": "8592624070948",
  "3559H-A00662 64": "8592624070962",
  "3559H-A00662 65": "8592624070986",
  "3559H-A00662 66": "8592624071006",
  "3559H-A00662 67": "8592624071020",
  "3559H-A00662 68": "8592624102533",
  "3559H-A00662 69": "8592624102540",
  "3559H-A00662 70": "8592624102557",
  "3559K-C05345": "8592624037309",
  "3559K-C05345 50": "8592624051220",
  "3559K-C05345 52": "8592624051244",
  "3559K-C05345 N": "8592624084303",
  "3559K-C06345": "8592624037316",
  "3559K-C06345 50": "8592624051268",
  "3559K-C06345 52": "8592624051282",
  "3559K-C06345 N": "8592624084327",
  "3559K-C07345": "8592624040002",
  "3559K-C07345 50": "8592624051305",
  "3559K-C07345 52": "8592624051329",
  "3559K-C07345 N": "8592624084341",
  "3559K-C52345": "8592624058212",
  "3559K-C52345 50": "8592624058236",
  "3559K-C52345 52": "8592624058250",
  "3559K-C52345 N": "8592624084426",
  "3559K-C86345": "8592624040026",
  "3559K-C86345 50": "8592624051343",
  "3559K-C86345 52": "8592624051367",
  "3559K-C86345 N": "8592624084365",
  "3559K-C88345": "8592624040064",
  "3559K-C88345 50": "8592624051428",
  "3559K-C88345 52": "8592624051442",
  "3559K-C88345 N": "8592624084402",
  "3559T-A00651 237": "8592624448600",
  "3559T-A00651 240": "8592624448624",
  "3559T-A00651 500": "8592624132301",
  "3559T-A00652 237": "8592624449904",
  "3559T-A00652 240": "8592624450887",
  "3559T-A00652 500": "8592624235828",
  "3559T-A00662 237": "8592624450849",
  "3559T-A00662 240": "8592624450832",
  "3559T-A00662 500": "8592624450788",
  "3901A-B10 B": "8595017208782",
  "3901A-B10 C": "8595017255922",
  "3901A-B10 D": "8595017220753",
  "3901A-B10 H": "8592624042945",
  "3901A-B10 N": "8595017208805",
  "3901A-B10 R2": "8595017207174",
  "3901A-B10 S": "8595017220746",
  "3901A-B10 S2": "8595017207181",
  "3901A-B20 B": "8595017208904",
  "3901A-B20 C": "8595017257247",
  "3901A-B20 D": "8595017220777",
  "3901A-B20 H": "8592624042921",
  "3901A-B20 N": "8595017208928",
  "3901A-B20 R2": "8595017207235",
  "3901A-B20 S": "8595017220760",
  "3901A-B20 S2": "8595017207266",
  "3901A-B30 B": "8595017209147",
  "3901A-B30 C": "8595017257254",
  "3901A-B30 D": "8595017220999",
  "3901A-B30 H": "8592624042884",
  "3901A-B30 N": "8595017209161",
  "3901A-B30 R2": "8595017207365",
  "3901A-B30 S": "8595017221002",
  "3901A-B30 S2": "8595017207389",
  "3901A-B40 B": "8595017217265",
  "3901A-B40 C": "8595017257261",
  "3901A-B40 D": "8595017221088",
  "3901A-B40 H": "8592624042846",
  "3901A-B40 N": "8595017217289",
  "3901A-B40 R2": "8595017207549",
  "3901A-B40 S": "8595017221071",
  "3901A-B40 S2": "8595017207587",
  "3901A-B50 B": "8595017219443",
  "3901A-B50 C": "8595017260292",
  "3901A-B50 D": "8595017222399",
  "3901A-B50 H": "8592624042808",
  "3901A-B50 N": "8595017219467",
  "3901A-B50 R2": "8595017207723",
  "3901A-B50 S": "8595017222405",
  "3901A-B50 S2": "8595017207747",
  "3901F-A00110 01": "8595017234019",
  "3901F-A00110 03": "8595017244605",
  "3901F-A00110 08": "8595017234040",
  "3901F-A00110 32": "8595017266317",
  "3901F-A00110 33": "8595017266324",
  "3901F-A00110 34": "8595017266331",
  "3901F-A00110 36": "8592624077176",
  "3901F-A00120 01": "8595017234057",
  "3901F-A00120 03": "8595017246272",
  "3901F-A00120 08": "8595017234088",
  "3901F-A00120 32": "8595017266355",
  "3901F-A00120 33": "8595017266362",
  "3901F-A00120 34": "8595017266379",
  "3901F-A00120 36": "8592624077213",
  "3901F-A00130 01": "8595017234095",
  "3901F-A00130 03": "8595017243936",
  "3901F-A00130 08": "8595017234125",
  "3901F-A00130 32": "8595017266515",
  "3901F-A00130 33": "8595017266522",
  "3901F-A00130 34": "8595017266539",
  "3901F-A00130 36": "8592624077275",
  "3901F-A00140 01": "8595017234132",
  "3901F-A00140 03": "8595017246302",
  "3901F-A00140 08": "8595017234170",
  "3901F-A00140 32": "8595017266553",
  "3901F-A00140 33": "8595017266560",
  "3901F-A00140 34": "8595017266577",
  "3901F-A00140 36": "8592624077350",
  "3901F-A00150 01": "8595017234187",
  "3901F-A00150 03": "8595017243943",
  "3901F-A00150 08": "8595017234217",
  "3901F-A00150 32": "8595017266591",
  "3901F-A00150 33": "8595017266607",
  "3901F-A00150 34": "8595017266614",
  "3901F-A00150 36": "8592624077435",
  "3901G-A00010 B1": "8595017270307",
  "3901G-A00010 C1": "8595017275807",
  "3901G-A00010 D1": "8595017275814",
  "3901G-A00010 H1": "8595017275821",
  "3901G-A00010 S1": "8595017275906",
  "3901G-A00020 B1": "8595017274909",
  "3901G-A00020 C1": "8595017274916",
  "3901G-A00020 D1": "8595017274923",
  "3901G-A00020 H1": "8595017274947",
  "3901G-A00020 S1": "8595017274930",
  "3901G-A00030 B1": "8595017274954",
  "3901G-A00030 C1": "8595017274961",
  "3901G-A00030 D1": "8595017274978",
  "3901G-A00030 H1": "8595017274992",
  "3901G-A00030 S1": "8595017274985",
  "3901G-A00040 B1": "8595017293108",
  "3901G-A00040 C1": "8595017293115",
  "3901G-A00040 D1": "8595017293139",
  "3901G-A00040 H1": "8595017293146",
  "3901G-A00040 S1": "8595017293153",
  "3901H-A05010 01": "8592624064602",
  "3901H-A05010 03": "8592624067108",
  "3901H-A05010 16": "8592624067122",
  "3901H-A05010 17": "8592624067146",
  "3901H-A05010 18": "8592624067160",
  "3901H-A05010 62": "8592624067184",
  "3901H-A05010 63": "8592624067207",
  "3901H-A05010 64": "8592624067221",
  "3901H-A05010 65": "8592624067245",
  "3901H-A05010 66": "8592624067269",
  "3901H-A05010 67": "8592624067283",
  "3901H-A05010 68": "8592624102687",
  "3901H-A05010 69": "8592624102694",
  "3901H-A05010 70": "8592624102700",
  "3901H-A05020 01": "8592624064909",
  "3901H-A05020 03": "8592624067306",
  "3901H-A05020 16": "8592624067320",
  "3901H-A05020 17": "8592624067344",
  "3901H-A05020 18": "8592624067368",
  "3901H-A05020 62": "8592624067382",
  "3901H-A05020 63": "8592624067405",
  "3901H-A05020 64": "8592624067429",
  "3901H-A05020 65": "8592624067443",
  "3901H-A05020 66": "8592624067467",
  "3901H-A05020 67": "8592624067481",
  "3901H-A05020 68": "8592624102717",
  "3901H-A05020 69": "8592624102724",
  "3901H-A05020 70": "8592624102731",
  "3901H-A05030 01": "8592624064916",
  "3901H-A05030 03": "8592624067504",
  "3901H-A05030 16": "8592624067528",
  "3901H-A05030 17": "8592624067542",
  "3901H-A05030 18": "8592624067566",
  "3901H-A05030 62": "8592624067580",
  "3901H-A05030 63": "8592624067603",
  "3901H-A05030 64": "8592624067627",
  "3901H-A05030 65": "8592624067641",
  "3901H-A05030 66": "8592624067665",
  "3901H-A05030 67": "8592624067689",
  "3901H-A05030 68": "8592624102748",
  "3901H-A05030 69": "8592624102755",
  "3901H-A05030 70": "8592624101512",
  "3901H-A05040 01": "8592624065401",
  "3901H-A05040 03": "8592624067702",
  "3901H-A05040 16": "8592624067726",
  "3901H-A05040 17": "8592624067757",
  "3901H-A05040 18": "8592624067771",
  "3901H-A05040 62": "8592624067795",
  "3901H-A05040 63": "8592624067818",
  "3901H-A05040 64": "8592624067832",
  "3901H-A05040 65": "8592624067856",
  "3901H-A05040 66": "8592624067870",
  "3901H-A05040 67": "8592624067894",
  "3901H-A05040 68": "8592624102762",
  "3901H-A05040 69": "8592624102779",
  "3901H-A05040 70": "8592624102786",
  "3901H-A05050 01": "8592624065418",
  "3901H-A05050 03": "8592624067948",
  "3901H-A05050 16": "8592624067962",
  "3901H-A05050 17": "8592624067986",
  "3901H-A05050 18": "8592624068006",
  "3901H-A05050 62": "8592624068020",
  "3901H-A05050 63": "8592624068044",
  "3901H-A05050 64": "8592624068068",
  "3901H-A05050 65": "8592624068082",
  "3901H-A05050 66": "8592624068105",
  "3901H-A05050 67": "8592624068129",
  "3901H-A05050 68": "8592624102793",
  "3901H-A05050 69": "8592624102809",
  "3901H-A05050 70": "8592624102816",
  "3901J-A00010 B1": "8595017289606",
  "3901J-A00010 C1": "8595017289613",
  "3901J-A00010 C3": "8592624057802",
  "3901J-A00010 R3": "8592624057833",
  "3901J-A00010 S1": "8595017209635",
  "3901J-A00020 B1": "8595017289620",
  "3901J-A00020 C1": "8595017289637",
  "3901J-A00020 C3": "8592624057864",
  "3901J-A00020 R3": "8592624057888",
  "3901J-A00020 S1": "8595017209666",
  "3901J-A00030 B1": "8595017289644",
  "3901J-A00030 C1": "8595017289651",
  "3901J-A00030 C3": "8592624057901",
  "3901J-A00030 R3": "8592624057925",
  "3901J-A00030 S1": "8595017209710",
  "3901J-A00040 B1": "8595017203428",
  "3901J-A00040 C1": "8595017203442",
  "3901J-A00040 C3": "8592624057949",
  "3901J-A00040 R3": "8592624057963",
  "3901J-A00040 S1": "8595017203497",
  "3901J-A00050 B1": "8595017233661",
  "3901J-A00050 C1": "8595017233678",
  "3901J-A00050 C3": "8592624057987",
  "3901J-A00050 R3": "8592624058007",
  "3901J-A00050 S1": "8595017233722",
  "3901T-A00010 137": "8592624447740",
  "3901T-A00010 237": "8592624447726",
  "3901T-A00010 240": "8592624447702",
  "3901T-A00010 500": "8592624235774",
  "3901T-A00020 137": "8592624447887",
  "3901T-A00020 237": "8592624447863",
  "3901T-A00020 240": "8592624447849",
  "3901T-A00020 500": "8592624235781",
  "3901T-A00030 137": "8592624448020",
  "3901T-A00030 237": "8592624448006",
  "3901T-A00030 240": "8592624447986",
  "3901T-A00030 500": "8592624235798",
  "3901T-A00040 137": "8592624448167",
  "3901T-A00040 237": "8592624448143",
  "3901T-A00040 240": "8592624448129",
  "3901T-A00040 500": "8592624370109",
  "3901T-A00050 137": "8592624448303",
  "3901T-A00050 237": "8592624448280",
  "3901T-A00050 240": "8592624448266",
  "3901T-A00050 500": "8592624235804",
  "5014K-C00399": "8592624132202",
  "5014K-C00399 N": "8592624132219",
  "5014K-C01018": "8592624037330",
  "5014K-C01018 50": "8592624051541",
  "5014K-C01018 52": "8592624051565",
  "5014K-C01018 N": "8592624084501",
  "5513A-C02357 B": "8595017263033",
  "5513A-C02357 C": "8595017263040",
  "5513A-C02357 D": "8595017263057",
  "5513A-C02357 H": "8592624042679",
  "5513A-C02357 N": "8595017263071",
  "5513A-C02357 R2": "8595017209017",
  "5513A-C02357 S": "8595017263095",
  "5513A-C02357 S2": "8595017209062",
  "5513H-C02357 01": "8592624065807",
  "5513H-C02357 03": "8592624069300",
  "5513H-C02357 16": "8592624069324",
  "5513H-C02357 17": "8592624069348",
  "5513H-C02357 18": "8592624069362",
  "5513H-C02357 62": "8592624069386",
  "5513H-C02357 63": "8592624069409",
  "5513H-C02357 64": "8592624069423",
  "5513H-C02357 65": "8592624069447",
  "5513H-C02357 66": "8592624069461",
  "5513H-C02357 67": "8592624069485",
  "5513H-C02357 68": "8592624103066",
  "5513H-C02357 69": "8592624103073",
  "5513H-C02357 70": "8592624103080",
  "5513T-C02157 137": "8592624477532",
  "5513T-C02157 141": "8592624477549",
  "5513T-C02157 142": "8592624477556",
  "5513T-C02157 143": "8592624477563",
  "5513T-C02157 144": "8592624477570",
  "5513T-C02157 237": "8592624477518",
  "5513T-C02157 240": "8592624477525",
  "5513T-C02157 500": "8592624477501",
  "6619A-A06357 B": "8592624446804",
  "6619A-A06357 C": "8592624446835",
  "6619A-A06357 D": "8592624446873",
  "6619A-A06357 H": "8592624446897",
  "6619A-A06357 N": "8592624446910",
  "6619A-A06357 R2": "8592624446958",
  "6619A-A06357 S": "8592624446859",
  "6619A-A06357 S2": "8592624446934",
  "6619H-A06357 01": "8592624456209",
  "6619H-A06357 03": "8592624456216",
  "6619H-A06357 16": "8592624456223",
  "6619H-A06357 17": "8592624456230",
  "6619H-A06357 18": "8592624456247",
  "6619H-A06357 62": "8592624456254",
  "6619H-A06357 63": "8592624456261",
  "6619H-A06357 64": "8592624456278",
  "6619H-A06357 65": "8592624456285",
  "6619H-A06357 66": "8592624456292",
  "6619H-A06357 67": "8592624456308",
  "6619H-A06357 68": "8592624456315",
  "6619H-A06357 69": "8592624456322",
  "6619H-A06357 70": "8592624456339",
  "6619K-C06347": "8592624455608",
  "6619K-C06347 50": "8592624455646",
  "6619K-C06347 52": "8592624455660",
  "6619K-C06347 N": "8592624455622",
  "6619T-A06657 237": "8592624449430",
  "6619T-A06657 240": "8592624449454",
  "6619T-A06657 500": "8592624235811"
};

/** Výrobky chytré domácnosti ABB v ETIM (id výrobku katalogu → objednací číslo, GTIN, technický list). */
export const ETIM_SMART: Record<string, { mpn: string; gtin: string | null; datasheet: string | null }> = {
  "fah-rtc": {
    "mpn": "2CKA006220A0122",
    "gtin": "4011395180099",
    "datasheet": null
  },
  "fah-wl-act-1": {
    "mpn": "2CKA006710A0034",
    "gtin": "4011395346433",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CKA009973B5618&LanguageCode=cs&LanguageCode=da&LanguageCode=de&LanguageCode=el&LanguageCode=en&LanguageCode=es&LanguageCode=fi&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=no&LanguageCode=pl&LanguageCode=pt&LanguageCode=ru&LanguageCode=sk&LanguageCode=sv&LanguageCode=tr&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "fah-wl-act-2": {
    "mpn": "2CKA006710A0057",
    "gtin": "4011395363379",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CKA009973B0365&LanguageCode=cs&LanguageCode=da&LanguageCode=de&LanguageCode=el&LanguageCode=en&LanguageCode=es&LanguageCode=fi&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=no&LanguageCode=pl&LanguageCode=pt&LanguageCode=ru&LanguageCode=sk&LanguageCode=sv&LanguageCode=tr&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "fah-wl-blind": {
    "mpn": "2CKA006710A0041",
    "gtin": "4011395346365",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CKA009973B5628&LanguageCode=cs&LanguageCode=da&LanguageCode=de&LanguageCode=el&LanguageCode=en&LanguageCode=es&LanguageCode=fi&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=no&LanguageCode=pl&LanguageCode=pt&LanguageCode=ru&LanguageCode=sk&LanguageCode=sv&LanguageCode=tr&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "fah-wl-dim": {
    "mpn": "2CKA006710A0038",
    "gtin": "4011395346396",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CKA009973B5646&LanguageCode=cs&LanguageCode=da&LanguageCode=de&LanguageCode=el&LanguageCode=en&LanguageCode=es&LanguageCode=fi&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=no&LanguageCode=pl&LanguageCode=pt&LanguageCode=ru&LanguageCode=sk&LanguageCode=sv&LanguageCode=tr&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "fah-smart-switch": {
    "mpn": "2CKA006710A0048",
    "gtin": "4011395341612",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CKA009973B5522&LanguageCode=cs&LanguageCode=da&LanguageCode=de&LanguageCode=el&LanguageCode=en&LanguageCode=es&LanguageCode=fi&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=no&LanguageCode=pl&LanguageCode=pt&LanguageCode=ru&LanguageCode=sk&LanguageCode=sv&LanguageCode=tr&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "fah-ip-touch-10": {
    "mpn": "2TMA130050W0054",
    "gtin": "6955891815148",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2TMU170000M0017&LanguageCode=en&DocumentPartId=&Action=Launch, https://search.abb.com/library/Download.aspx?DocumentID=2TMU200000M0001&LanguageCode=cs&LanguageCode=da&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fi&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=no&LanguageCode=pl&LanguageCode=pt&LanguageCode=ru&LanguageCode=sk&LanguageCode=sv&LanguageCode=zh&DocumentPartId=&Action=Launch, https://search.abb.com/library/Download.aspx?DocumentID=2TMU200000M0009&LanguageCode=cs&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fi&LanguageCode=fr&LanguageCode=it&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "fah-ip-touch-7": {
    "mpn": "2TMA130050W0065",
    "gtin": "6955891816961",
    "datasheet": null
  },
  "fah-smarttouch-10": {
    "mpn": "2TMA310051W0001",
    "gtin": "6955891819436",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CKA001473B5343&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "fah-onetouch-7": {
    "mpn": "2TMA320051W0001",
    "gtin": "6955891822696",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2TMU230000M0022&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "fah-roomtouch-4": {
    "mpn": "2TMA310011W0001",
    "gtin": "6955891820036",
    "datasheet": null
  },
  "fah-trevion": {
    "mpn": "2TMA310011B0001",
    "gtin": "6955891820005",
    "datasheet": null
  },
  "abb_freeathome-fah-sap": {
    "mpn": "2CKA006200A0871",
    "gtin": "4011395346075",
    "datasheet": null
  },
  "abb_freeathome-fah-sap-din": {
    "mpn": "2CKA006200A0871",
    "gtin": "4011395346075",
    "datasheet": null
  },
  "abb_freeathome-fah-psu": {
    "mpn": "2CDG510001R0011",
    "gtin": "4016779941839",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "abb_freeathome-fah-sa4": {
    "mpn": "2CDG510025R0011",
    "gtin": "4053546111309",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "abb_freeathome-fah-sa8": {
    "mpn": "2CDG510026R0011",
    "gtin": "4053546111316",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "abb_freeathome-fah-sa12": {
    "mpn": "2CDG510027R0011",
    "gtin": "4053546111330",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072028F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "abb_freeathome-fah-da4": {
    "mpn": "2CKA006220A0729",
    "gtin": "4011395251799",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072026F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "abb_freeathome-fah-da6": {
    "mpn": "2CKA006220A0731",
    "gtin": "4011395252031",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "abb_freeathome-fah-dali": {
    "mpn": "2CDG510012R0011",
    "gtin": "4016779067409",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "abb_freeathome-fah-ba4": {
    "mpn": "2CDG510028R0011",
    "gtin": "4053546111347",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "abb_freeathome-fah-ba8": {
    "mpn": "2CDG510029R0011",
    "gtin": "4053546111354",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "abb_freeathome-fah-ha6": {
    "mpn": "2CDG510008R0011",
    "gtin": "4016779941815",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "abb_freeathome-fah-ha12": {
    "mpn": "2CDG510009R0011",
    "gtin": "4016779941808",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "abb_freeathome-fah-bi4": {
    "mpn": "2CDG510014R0011",
    "gtin": "4053546111132",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072025F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "knx-rtc": {
    "mpn": "2CKA006134A0319",
    "gtin": "4011395211014",
    "datasheet": null
  },
  "abb_knx-knx-psu": {
    "mpn": "2CDG110146R0011",
    "gtin": "4016779866699",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "abb_knx-knx-psu3": {
    "mpn": "2CDG110167R0011",
    "gtin": "4016779906210",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "abb_knx-knx-sa4": {
    "mpn": "2CDG110262R0011",
    "gtin": "4016779066655",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "abb_knx-knx-sa8": {
    "mpn": "2CDG110263R0011",
    "gtin": "4016779066679",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "abb_knx-knx-sa12": {
    "mpn": "2CDG110264R0011",
    "gtin": "4016779066693",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072028F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "abb_knx-knx-ud4": {
    "mpn": "2CKA006197A0047",
    "gtin": "4011395251867",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072026F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "abb_knx-knx-dali": {
    "mpn": "2CDG110198R0011",
    "gtin": "4016779942669",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "abb_knx-knx-vc4": {
    "mpn": "2CDG110216R0011",
    "gtin": "4016779011488",
    "datasheet": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  }
};
