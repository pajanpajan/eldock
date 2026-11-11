// Generuje `node scripts/import-abb-etim9.mjs` z oficiálních dat ABB ETIM 9.0 (ELSB_ETIM-9.0_2026-05) – needitujte ručně.
// DIN přístroje ABB podle objednacího čísla: EAN (GTIN), technický list, ztrátový výkon Pv [W] (EF005387) a vestavná
// hloubka [mm] (EF000218) – seed AI Panel Builderu je zapíše ke kusům katalogu (`applyEtimComponents`).

export interface EtimComponentData {
  ean?: string;
  datasheetUrl?: string;
  powerLossWatts?: number;
  depthMm?: number;
}

export const ABB_ETIM_COMPONENTS: Record<string, EtimComponentData> = {
  "2CCA703401R0001": {
    "ean": "7612270939299",
    "depthMm": 58
  },
  "2CCA703402R0001": {
    "ean": "7612270939305",
    "depthMm": 59
  },
  "2CCA703403R0001": {
    "ean": "7612270939312",
    "depthMm": 58
  },
  "2CCA703404R0001": {
    "ean": "7612270939329",
    "depthMm": 58
  },
  "2CCA703405R0001": {
    "ean": "7612270939336",
    "depthMm": 59
  },
  "2CCA703406R0001": {
    "ean": "7612270939343",
    "depthMm": 59
  },
  "2CCA703407R0001": {
    "ean": "7612270939350",
    "depthMm": 59
  },
  "2CCA703408R0001": {
    "ean": "7612270939367",
    "depthMm": 59
  },
  "2CCA703409R0001": {
    "ean": "7612270939374",
    "depthMm": 59
  },
  "2CCA703900R0001": {
    "ean": "7612271413309",
    "depthMm": 59
  },
  "2CCA703901R0001": {
    "ean": "7612271413316",
    "depthMm": 68
  },
  "2CCA703902R0001": {
    "ean": "7612271413323",
    "depthMm": 59
  },
  "2CCA703910R0001": {
    "ean": "7612271413330",
    "depthMm": 68
  },
  "2CCA704300R0001": {
    "ean": "7612270939480",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6182&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CCA704301R0001": {
    "ean": "7612270939503",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6182&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CCA704302R0001": {
    "ean": "7612270939527",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6182&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD271111R0016": {
    "ean": "4016779904308",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD271111R0025": {
    "ean": "4016779904315",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD271111R0032": {
    "ean": "4016779904322",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD271111R0040": {
    "ean": "4016779904339",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD271111R0050": {
    "ean": "4016779904346",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD271111R0063": {
    "ean": "4016779904353",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD273111R0016": {
    "ean": "4016779904421",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD273111R0025": {
    "ean": "4016779904438",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD273111R0032": {
    "ean": "4016779904445",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD273111R0040": {
    "ean": "4016779904452",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD273111R0050": {
    "ean": "4016779904469",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD273111R0063": {
    "ean": "4016779904476",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC441016D0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD281101R0016": {
    "ean": "4016779904063",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD281101R0025": {
    "ean": "4016779904070",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD281101R0032": {
    "ean": "4016779904087",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD281101R0040": {
    "ean": "4016779904094",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD281101R0050": {
    "ean": "4016779904100",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD281101R0063": {
    "ean": "4016779904117",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD283101R0016": {
    "ean": "4016779904186",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD283101R0025": {
    "ean": "4016779904193",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD283101R0032": {
    "ean": "4016779904209",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD283101R0040": {
    "ean": "4016779904216",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD283101R0050": {
    "ean": "4016779904223",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD283101R0063": {
    "ean": "4016779904230",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD284101R0040": {
    "ean": "4016779904278",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDD284101R0063": {
    "ean": "4016779904292",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDS207104P0003&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDE110000R0501": {
    "ean": "4016779548243",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK108468A5389&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDE110003R0511": {
    "ean": "4016779654166",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK108466A2386&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CDG110146R0011": {
    "ean": "4016779866699",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "2CDG110167R0011": {
    "ean": "4016779906210",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "2CDG110198R0011": {
    "ean": "4016779942669",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "2CDG110216R0011": {
    "ean": "4016779011488",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG110262R0011": {
    "ean": "4016779066655",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "2CDG110263R0011": {
    "ean": "4016779066679",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG110264R0011": {
    "ean": "4016779066693",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072028F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG510001R0011": {
    "ean": "4016779941839",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "2CDG510007R0011": {
    "ean": "4016779945561",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG510008R0011": {
    "ean": "4016779941815",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "2CDG510009R0011": {
    "ean": "4016779941808",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG510010R0011": {
    "ean": "4016779945592",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072026F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG510012R0011": {
    "ean": "4016779067409",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "2CDG510013R0011": {
    "ean": "4053546046618",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072025F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG510014R0011": {
    "ean": "4053546111132",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072025F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG510016R0011": {
    "ean": "4053546111170",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072025F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG510025R0011": {
    "ean": "4053546111309",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "2CDG510026R0011": {
    "ean": "4053546111316",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG510027R0011": {
    "ean": "4053546111330",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072028F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDG510028R0011": {
    "ean": "4053546111347",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072033F0015&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=EPS&Action=Launch"
  },
  "2CDG510029R0011": {
    "ean": "4053546111354",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CDL200001R0001": {
    "ean": "4016779514729"
  },
  "2CDL200001R0004": {
    "ean": "4016779652261"
  },
  "2CDL210001R1003": {
    "ean": "4016779514651"
  },
  "2CDL210001R1012": {
    "ean": "4016779463300"
  },
  "2CDL210001R1060": {
    "ean": "4016779514668"
  },
  "2CDL210331R1012": {
    "ean": "4053546050516"
  },
  "2CDL210331R1060": {
    "ean": "4053546050530"
  },
  "2CDL220001R1012": {
    "ean": "4016779556521"
  },
  "2CDL230001R1012": {
    "ean": "4016779576116"
  },
  "2CDL230001R1060": {
    "ean": "4016779514699"
  },
  "2CDL230331R1012": {
    "ean": "4053546050554"
  },
  "2CDL230331R1060": {
    "ean": "4053546050561"
  },
  "2CDL231002R1012": {
    "ean": "4016779463706"
  },
  "2CDL240213R1012": {
    "ean": "4016779656139"
  },
  "2CDS251001R0014": {
    "ean": "4016779523318",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.4,
    "depthMm": 69
  },
  "2CDS251001R0024": {
    "ean": "4016779523325",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.8,
    "depthMm": 69
  },
  "2CDS251001R0025": {
    "ean": "4016779612944",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CDS251001R0034": {
    "ean": "4016779523332",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.3,
    "depthMm": 69
  },
  "2CDS251001R0044": {
    "ean": "4016779523349",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.8,
    "depthMm": 69
  },
  "2CDS251001R0045": {
    "ean": "4016779926218",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CDS251001R0061": {
    "ean": "4016779529990",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.9,
    "depthMm": 69
  },
  "2CDS251001R0064": {
    "ean": "4016779464000",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2,
    "depthMm": 69
  },
  "2CDS251001R0065": {
    "ean": "4016779464901",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2,
    "depthMm": 69
  },
  "2CDS251001R0084": {
    "ean": "4016779464109",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.5,
    "depthMm": 69
  },
  "2CDS251001R0101": {
    "ean": "4016779530019",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.6,
    "depthMm": 69
  },
  "2CDS251001R0104": {
    "ean": "4016779464208",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.1,
    "depthMm": 69
  },
  "2CDS251001R0105": {
    "ean": "4016779463805",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.1,
    "depthMm": 69
  },
  "2CDS251001R0134": {
    "ean": "4016779464307",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.3,
    "depthMm": 69
  },
  "2CDS251001R0135": {
    "ean": "4016779465007",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.3,
    "depthMm": 69
  },
  "2CDS251001R0161": {
    "ean": "4016779530033",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.5,
    "depthMm": 69
  },
  "2CDS251001R0164": {
    "ean": "4016779464406",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.5,
    "depthMm": 69
  },
  "2CDS251001R0201": {
    "ean": "4016779530040",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.3,
    "depthMm": 69
  },
  "2CDS251001R0204": {
    "ean": "4016779464505",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.5,
    "depthMm": 69
  },
  "2CDS251001R0205": {
    "ean": "4016779465106",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.5,
    "depthMm": 69
  },
  "2CDS251001R0251": {
    "ean": "4016779530057",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.1,
    "depthMm": 69
  },
  "2CDS251001R0254": {
    "ean": "4016779464604",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.2,
    "depthMm": 69
  },
  "2CDS251001R0255": {
    "ean": "4016779465205",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.2,
    "depthMm": 69
  },
  "2CDS251001R0321": {
    "ean": "4016779530064",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.6,
    "depthMm": 69
  },
  "2CDS251001R0324": {
    "ean": "4016779464703",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.7,
    "depthMm": 69
  },
  "2CDS251001R0325": {
    "ean": "4016779465304",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.7,
    "depthMm": 69
  },
  "2CDS251001R0404": {
    "ean": "4016779464802",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.8,
    "depthMm": 69
  },
  "2CDS251001R0405": {
    "ean": "4016779465403",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.8,
    "depthMm": 69
  },
  "2CDS251001R0504": {
    "ean": "4016779551007",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.25,
    "depthMm": 69
  },
  "2CDS251001R0505": {
    "ean": "4016779550925",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.25,
    "depthMm": 69
  },
  "2CDS251001R0634": {
    "ean": "4016779551014",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.8,
    "depthMm": 69
  },
  "2CDS251001R0635": {
    "ean": "4016779550932",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.8,
    "depthMm": 69
  },
  "2CDS251001R1165": {
    "ean": "4016779578639",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.5,
    "depthMm": 69
  },
  "2CDS252001R0104": {
    "ean": "4016779465700",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.2,
    "depthMm": 69
  },
  "2CDS252001R0164": {
    "ean": "4016779465908",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 5,
    "depthMm": 69
  },
  "2CDS252001R0204": {
    "ean": "4016779466004",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 5,
    "depthMm": 69
  },
  "2CDS252001R0254": {
    "ean": "4016779466103",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6.4,
    "depthMm": 69
  },
  "2CDS253001R0014": {
    "ean": "4016779523424",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.2,
    "depthMm": 69
  },
  "2CDS253001R0024": {
    "ean": "4016779523448",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 5.4,
    "depthMm": 69
  },
  "2CDS253001R0034": {
    "ean": "4016779523455",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.9,
    "depthMm": 69
  },
  "2CDS253001R0044": {
    "ean": "4016779523462",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 5.4,
    "depthMm": 69
  },
  "2CDS253001R0064": {
    "ean": "4016779467506",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6,
    "depthMm": 69
  },
  "2CDS253001R0065": {
    "ean": "4016779468602",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6,
    "depthMm": 69
  },
  "2CDS253001R0084": {
    "ean": "4016779467605",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.5,
    "depthMm": 69
  },
  "2CDS253001R0104": {
    "ean": "4016779467803",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6.3,
    "depthMm": 69
  },
  "2CDS253001R0105": {
    "ean": "4016779468701",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6.3,
    "depthMm": 69
  },
  "2CDS253001R0134": {
    "ean": "4016779467902",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6.9,
    "depthMm": 69
  },
  "2CDS253001R0135": {
    "ean": "4016779468909",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6.9,
    "depthMm": 69
  },
  "2CDS253001R0164": {
    "ean": "4016779468008",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 7.5,
    "depthMm": 69
  },
  "2CDS253001R0165": {
    "ean": "4016779469005",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 7.5,
    "depthMm": 69
  },
  "2CDS253001R0204": {
    "ean": "4016779468107",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 7.5,
    "depthMm": 69
  },
  "2CDS253001R0205": {
    "ean": "4016779469104",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 7.5,
    "depthMm": 69
  },
  "2CDS253001R0254": {
    "ean": "4016779468206",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 9.6,
    "depthMm": 69
  },
  "2CDS253001R0255": {
    "ean": "4016779469203",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 9.6,
    "depthMm": 69
  },
  "2CDS253001R0324": {
    "ean": "4016779468305",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 11.1,
    "depthMm": 69
  },
  "2CDS253001R0325": {
    "ean": "4016779469302",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 11.1,
    "depthMm": 69
  },
  "2CDS253001R0404": {
    "ean": "4016779468404",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 14.4,
    "depthMm": 69
  },
  "2CDS253001R0405": {
    "ean": "4016779469401",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 14.4,
    "depthMm": 69
  },
  "2CDS253001R0504": {
    "ean": "4016779551069",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 9.75,
    "depthMm": 69
  },
  "2CDS253001R0505": {
    "ean": "4016779550963",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 9.75,
    "depthMm": 69
  },
  "2CDS253001R0634": {
    "ean": "4016779551076",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 14.4,
    "depthMm": 69
  },
  "2CDS253001R0635": {
    "ean": "4016779550970",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 14.4,
    "depthMm": 69
  },
  "2CDS254001R0164": {
    "ean": "4016779529211",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 10,
    "depthMm": 69
  },
  "2CDS254001R0254": {
    "ean": "4016779529235",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 12.8,
    "depthMm": 69
  },
  "2CDS254001R0324": {
    "ean": "4016779529242",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 14.8,
    "depthMm": 69
  },
  "2CDS254001R0404": {
    "ean": "4016779529259",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 19.2,
    "depthMm": 69
  },
  "2CDS271001R0014": {
    "ean": "4016779549929",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.4,
    "depthMm": 69
  },
  "2CDS271001R0024": {
    "ean": "4016779549936",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.8,
    "depthMm": 69
  },
  "2CDS271001R0034": {
    "ean": "4016779549943",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.3,
    "depthMm": 69
  },
  "2CDS271001R0044": {
    "ean": "4016779549950",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.8,
    "depthMm": 69
  },
  "2CDS271001R0064": {
    "ean": "4016779549967",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2,
    "depthMm": 69
  },
  "2CDS271001R0065": {
    "ean": "4016779549424",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2,
    "depthMm": 69
  },
  "2CDS271001R0084": {
    "ean": "4016779549974",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.5,
    "depthMm": 69
  },
  "2CDS271001R0104": {
    "ean": "4016779549981",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.1,
    "depthMm": 69
  },
  "2CDS271001R0105": {
    "ean": "4016779549431",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.1,
    "depthMm": 69
  },
  "2CDS271001R0134": {
    "ean": "4016779549998",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.3,
    "depthMm": 69
  },
  "2CDS271001R0135": {
    "ean": "4016779549448",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.3,
    "depthMm": 69
  },
  "2CDS271001R0164": {
    "ean": "4016779550000",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.5,
    "depthMm": 69
  },
  "2CDS271001R0165": {
    "ean": "4016779549455",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.5,
    "depthMm": 69
  },
  "2CDS271001R0204": {
    "ean": "4016779550017",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.5,
    "depthMm": 69
  },
  "2CDS271001R0205": {
    "ean": "4016779549462",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.5,
    "depthMm": 69
  },
  "2CDS271001R0254": {
    "ean": "4016779550024",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.2,
    "depthMm": 69
  },
  "2CDS271001R0255": {
    "ean": "4016779549479",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.2,
    "depthMm": 69
  },
  "2CDS271001R0324": {
    "ean": "4016779550031",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.7,
    "depthMm": 69
  },
  "2CDS271001R0325": {
    "ean": "4016779549486",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.7,
    "depthMm": 69
  },
  "2CDS271001R0404": {
    "ean": "4016779550048",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.8,
    "depthMm": 69
  },
  "2CDS271001R0405": {
    "ean": "4016779549493",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.8,
    "depthMm": 69
  },
  "2CDS271001R0504": {
    "ean": "4016779543934",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.25,
    "depthMm": 69
  },
  "2CDS271001R0505": {
    "ean": "4016779543811",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.25,
    "depthMm": 69
  },
  "2CDS271001R0634": {
    "ean": "4016779543941",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.8,
    "depthMm": 69
  },
  "2CDS271001R0635": {
    "ean": "4016779543828",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.8,
    "depthMm": 69
  },
  "2CDS273001R0014": {
    "ean": "4016779550376",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.2,
    "depthMm": 69
  },
  "2CDS273001R0024": {
    "ean": "4016779550383",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 5.4,
    "depthMm": 69
  },
  "2CDS273001R0034": {
    "ean": "4016779550390",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.9,
    "depthMm": 69
  },
  "2CDS273001R0044": {
    "ean": "4016779550406",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 5.4,
    "depthMm": 69
  },
  "2CDS273001R0064": {
    "ean": "4016779550413",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6,
    "depthMm": 69
  },
  "2CDS273001R0084": {
    "ean": "4016779550420",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.5,
    "depthMm": 69
  },
  "2CDS273001R0104": {
    "ean": "4016779550437",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6.3,
    "depthMm": 69
  },
  "2CDS273001R0105": {
    "ean": "4016779549677",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6.3,
    "depthMm": 69
  },
  "2CDS273001R0134": {
    "ean": "4016779550444",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 6.9,
    "depthMm": 69
  },
  "2CDS273001R0164": {
    "ean": "4016779550451",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 7.5,
    "depthMm": 69
  },
  "2CDS273001R0165": {
    "ean": "4016779549691",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 7.5,
    "depthMm": 69
  },
  "2CDS273001R0204": {
    "ean": "4016779550468",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 7.5,
    "depthMm": 69
  },
  "2CDS273001R0205": {
    "ean": "4016779549707",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 7.5,
    "depthMm": 69
  },
  "2CDS273001R0254": {
    "ean": "4016779550475",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 9.6,
    "depthMm": 69
  },
  "2CDS273001R0255": {
    "ean": "4016779549714",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 9.6,
    "depthMm": 69
  },
  "2CDS273001R0324": {
    "ean": "4016779550482",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 11.1,
    "depthMm": 69
  },
  "2CDS273001R0325": {
    "ean": "4016779549721",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 11.1,
    "depthMm": 69
  },
  "2CDS273001R0404": {
    "ean": "4016779550499",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 14.4,
    "depthMm": 69
  },
  "2CDS273001R0405": {
    "ean": "4016779549738",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 14.4,
    "depthMm": 69
  },
  "2CDS273001R0504": {
    "ean": "4016779543996",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 9.75,
    "depthMm": 69
  },
  "2CDS273001R0505": {
    "ean": "4016779543873",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 9.75,
    "depthMm": 69
  },
  "2CDS273001R0634": {
    "ean": "4016779544009",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 14.4,
    "depthMm": 69
  },
  "2CDS273001R0635": {
    "ean": "4016779543880",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC022007F0010&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 14.4,
    "depthMm": 69
  },
  "2CKA006197A0047": {
    "ean": "4011395251867",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072026F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CKA006200A0871": {
    "ean": "4011395346075"
  },
  "2CKA006220A0729": {
    "ean": "4011395251799",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072026F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CKA006220A0731": {
    "ean": "4011395252031",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC072027F0017&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=nl&LanguageCode=pl&LanguageCode=ru&DocumentPartId=PDF&Action=Launch"
  },
  "2CMA100155R1000": {
    "ean": "7392696001557",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CMC485004M0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CMA100177R1000": {
    "ean": "7392696001779",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CMC485003M0201&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CMA241645R1000": {
    "ean": "8012542635451",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK108469A1075&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CMA241655R1000": {
    "ean": "8012542635550",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK108469A1075&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CMA241695R1000": {
    "ean": "8012542635956",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK108469A1075&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CMA241725R1000": {
    "ean": "8012542636052",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK108469A1075&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSF202101R1250": {
    "ean": "8012542782506",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0758&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2,
    "depthMm": 69
  },
  "2CSF202101R1400": {
    "ean": "8012542782605",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0758&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.8,
    "depthMm": 69
  },
  "2CSF202101R3250": {
    "ean": "8012542782803",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A6127&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CSF202101R3400": {
    "ean": "8012542782902",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A6127&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CSF202102R1250": {
    "ean": "8012542892403",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK1074920067&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2,
    "depthMm": 69
  },
  "2CSF202102R1400": {
    "ean": "8012542892502",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK1074920067&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.8,
    "depthMm": 69
  },
  "2CSF202325R1250": {
    "ean": "8012542992738",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A6127&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CSF202325R1400": {
    "ean": "8012542992837",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0758&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CSF204101R1250": {
    "ean": "8012542783404",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0759&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.9,
    "depthMm": 69
  },
  "2CSF204101R1400": {
    "ean": "8012542783503",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0759&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 9.6,
    "depthMm": 69
  },
  "2CSF204101R1630": {
    "ean": "8012542783602",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0759&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 13.2,
    "depthMm": 69
  },
  "2CSF204101R3250": {
    "ean": "8012542783701",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0759&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CSF204101R3400": {
    "ean": "8012542783800",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0759&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CSF204101R3630": {
    "ean": "8012542783909",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0759&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CSF204102R1250": {
    "ean": "8012542892700",
    "powerLossWatts": 5.2,
    "depthMm": 69
  },
  "2CSF204102R1400": {
    "ean": "8012542892809",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK108467A2990&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 12.8,
    "depthMm": 69
  },
  "2CSF204102R1630": {
    "ean": "8012542892908",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK108467A2990&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 17.6,
    "depthMm": 69
  },
  "2CSF204201R3400": {
    "ean": "8012542784708",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0759&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 9.6,
    "depthMm": 69
  },
  "2CSF204201R3630": {
    "ean": "8012542784807",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK106354A0759&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 13.2,
    "depthMm": 69
  },
  "2CSF204325R1250": {
    "ean": "8012542993032",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A6127&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CSF204325R1400": {
    "ean": "8012542993131",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A6127&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CSF204325R1630": {
    "ean": "8012542993230",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A6127&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 69
  },
  "2CSM110000R0711": {
    "ean": "8012542006602",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK108469A3976&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 60
  },
  "2CSM200883R1801": {
    "ean": "8012542008835",
    "depthMm": 64
  },
  "2CSM200923R1801": {
    "ean": "8012542009238",
    "depthMm": 64
  },
  "2CSM204753R1801": {
    "ean": "8012542047537",
    "depthMm": 64
  },
  "2CSM210000R0721": {
    "ean": "8012542027850",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK108469A3974&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 60
  },
  "2CSM221201R1000": {
    "ean": "8012542212010",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CSM441045D0201&LanguageCode=fr&DocumentPartId=FR&Action=Launch"
  },
  "2CSM222471R1000": {
    "ean": "8012542224716",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A8050&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSM222491R1000": {
    "ean": "8012542224914",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CSM441043D0201&LanguageCode=cs&DocumentPartId=&Action=Launch"
  },
  "2CSM222501R1000": {
    "ean": "8012542225010",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CSM441044D0201&LanguageCode=cs&DocumentPartId=&Action=Launch"
  },
  "2CSM222511R1000": {
    "ean": "8012542225119",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CSM441044D0201&LanguageCode=cs&DocumentPartId=&Action=Launch"
  },
  "2CSM222521R1000": {
    "ean": "8012542225218",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CSM441050D0201&LanguageCode=cs&DocumentPartId=&Action=Launch"
  },
  "2CSM222531R1000": {
    "ean": "8012542225317",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CSM441050D0201&LanguageCode=cs&DocumentPartId=&Action=Launch"
  },
  "2CSM228715R0802": {
    "ean": "8012542287155"
  },
  "2CSM228725R0802": {
    "ean": "8012542287254"
  },
  "2CSM277962R1801": {
    "ean": "8012542779629",
    "depthMm": 73.26
  },
  "2CSM279022R1801": {
    "ean": "8012542587422",
    "depthMm": 73.26
  },
  "2CSR254101R1104": {
    "ean": "8012542862604",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR254101R1105": {
    "ean": "8012542859604",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR254101R1164": {
    "ean": "8012542862802",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR254101R1165": {
    "ean": "8012542859802",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR254101R1204": {
    "ean": "8012542862901",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR254101R1205": {
    "ean": "8012542859901",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR255163R1064": {
    "ean": "8012542360957",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9407&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.56,
    "depthMm": 17.6
  },
  "2CSR255163R1065": {
    "ean": "8012542359357",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9407&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.2,
    "depthMm": 17.6
  },
  "2CSR255163R1104": {
    "ean": "8012542361053",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9407&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 1.5,
    "depthMm": 17.6
  },
  "2CSR255163R1105": {
    "ean": "8012542359456",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9407&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.6,
    "depthMm": 17.6
  },
  "2CSR255163R1134": {
    "ean": "8012542361251",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9407&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.25,
    "depthMm": 17.6
  },
  "2CSR255163R1135": {
    "ean": "8012542359654",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9407&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.47,
    "depthMm": 17.6
  },
  "2CSR255163R1164": {
    "ean": "8012542361459",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.48,
    "depthMm": 17.6
  },
  "2CSR255163R1165": {
    "ean": "8012542359852",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.83,
    "depthMm": 17.6
  },
  "2CSR255163R1204": {
    "ean": "8012542361657",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9407&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.4,
    "depthMm": 17.6
  },
  "2CSR255163R1205": {
    "ean": "8012542360056",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9407&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.66,
    "depthMm": 17.6
  },
  "2CSR255180R1064": {
    "ean": "8012542737117",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6185&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.6,
    "depthMm": 69
  },
  "2CSR255180R1065": {
    "ean": "8012542066217",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6185&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.6,
    "depthMm": 69
  },
  "2CSR255180R1104": {
    "ean": "8012542737810",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6185&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.3,
    "depthMm": 69
  },
  "2CSR255180R1105": {
    "ean": "8012542066118",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6185&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.3,
    "depthMm": 69
  },
  "2CSR255180R1164": {
    "ean": "8012542739319",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6185&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.5,
    "depthMm": 69
  },
  "2CSR255180R1165": {
    "ean": "8012542058519",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6185&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.5,
    "depthMm": 69
  },
  "2CSR255563R1064": {
    "ean": "8012542723455",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.2
  },
  "2CSR255563R1065": {
    "ean": "8012542722953",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.2
  },
  "2CSR255563R1104": {
    "ean": "8012542723554",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.6
  },
  "2CSR255563R1105": {
    "ean": "8012542723059",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.6
  },
  "2CSR255563R1134": {
    "ean": "8012542723653",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.47
  },
  "2CSR255563R1135": {
    "ean": "8012542723158",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.47
  },
  "2CSR255563R1164": {
    "ean": "8012542723752",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.83
  },
  "2CSR255563R1165": {
    "ean": "8012542723257",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.83
  },
  "2CSR255563R1204": {
    "ean": "8012542723851",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.66
  },
  "2CSR255563R1205": {
    "ean": "8012542723356",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107991A9486&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 3.66
  },
  "2CSR274101R1104": {
    "ean": "8012542850601",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR274101R1105": {
    "ean": "8012542847601",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR274101R1164": {
    "ean": "8012542850809",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR274101R1165": {
    "ean": "8012542847809",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR274101R1204": {
    "ean": "8012542850908",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR274101R1205": {
    "ean": "8012542847908",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107045A1451&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CSR275180R1064": {
    "ean": "8012542595410",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6006&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.6,
    "depthMm": 69
  },
  "2CSR275180R1065": {
    "ean": "8012542775515",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6006&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.6,
    "depthMm": 69
  },
  "2CSR275180R1104": {
    "ean": "8012542583615",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6185&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.3,
    "depthMm": 69
  },
  "2CSR275180R1105": {
    "ean": "8012542773313",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6006&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.3,
    "depthMm": 69
  },
  "2CSR275180R1164": {
    "ean": "8012542592815",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6185&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.5,
    "depthMm": 69
  },
  "2CSR275180R1165": {
    "ean": "8012542587217",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6185&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.5,
    "depthMm": 69
  },
  "2CSR275580R1105": {
    "ean": "8012542582618",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6006&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 2.3,
    "depthMm": 69
  },
  "2CSR275580R1165": {
    "ean": "8012542595717",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107492A6006&LanguageCode=en&DocumentPartId=&Action=Launch",
    "powerLossWatts": 4.5,
    "depthMm": 69
  },
  "2CTB803871R2300": {
    "ean": "3660308519580",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC432097M1701&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=pt&LanguageCode=ru&LanguageCode=sv&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "2CTB803873R2400": {
    "ean": "3660308519825",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC432096M1701&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=pt&LanguageCode=ru&LanguageCode=sv&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "2CTB803873R5600": {
    "ean": "3660308520548",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC432096M1701&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=pt&LanguageCode=ru&LanguageCode=sv&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "2CTB803972R1100": {
    "ean": "3660308519696",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC432096M1701&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=pt&LanguageCode=ru&LanguageCode=sv&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "2CTB803973R1100": {
    "ean": "3660308519931",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC432096M1701&LanguageCode=de&LanguageCode=en&LanguageCode=es&LanguageCode=fr&LanguageCode=it&LanguageCode=pt&LanguageCode=ru&LanguageCode=sv&LanguageCode=zh&DocumentPartId=&Action=Launch"
  },
  "2CTB815704R1800": {
    "ean": "3660308525314",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC432106M1701&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CTB815704R2300": {
    "ean": "3660308525345",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC432106M1701&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CTB815710R1200": {
    "ean": "3660308524959",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC431030M1701&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CTB815710R1300": {
    "ean": "3660308524966",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC431030M1701&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CTB815710R1800": {
    "ean": "3660308524980",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC431030M1701&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CTB815710R1900": {
    "ean": "3660308524997",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC431030M1701&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2CTB815710R2300": {
    "ean": "3660308525017",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=2CTC431030M1701&LanguageCode=en&DocumentPartId=&Action=Launch"
  },
  "2TAZ311000R2011": {
    "ean": "7612270940059",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6188&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 62
  },
  "2TAZ311000R2012": {
    "ean": "7612270940172",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6188&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 62
  },
  "2TAZ312000R2011": {
    "ean": "7612270939602",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6188&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 68
  },
  "2TAZ312000R2012": {
    "ean": "7612270939725",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6188&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 68
  },
  "2TAZ312000R2013": {
    "ean": "7612270939848",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6188&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 68
  },
  "2TAZ322000R2011": {
    "ean": "7612270939664",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6188&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 68
  },
  "2TAZ322000R2012": {
    "ean": "7612270939787",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6188&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 68
  },
  "2TAZ322000R2013": {
    "ean": "7612270939909",
    "datasheetUrl": "https://search.abb.com/library/Download.aspx?DocumentID=9AKK107992A6188&LanguageCode=en&DocumentPartId=&Action=Launch",
    "depthMm": 68
  }
};
