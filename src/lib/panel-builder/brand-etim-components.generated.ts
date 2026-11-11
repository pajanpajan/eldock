// Generuje `node scripts/parse-etim-packages.mjs` z dat výrobců v data/etim/downloads (fáze 97) – needitujte ručně.
// DIN přístroje a rozvodnice Hager (ETIM 10) a OEZ (stránky výrobků oez.cz) podle objednacího čísla katalogu: EAN (GTIN),
// ztrátový výkon Pv [W] (EF005387), hloubka [mm] (EF000218 / „Hloubka (netto)“) a technický list – seed AI Panel
// Builderu je zapíše ke kusům katalogu (`applyEtimComponents`). Jen pro seed (server), ne do klienta.

import type { EtimComponentData } from "./abb-etim-components.generated";

export const BRAND_ETIM_COMPONENTS: Record<string, EtimComponentData> = {
  "HAGER:S35S": {
    "ean": "4010330662621",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=S35S&file=datasheet"
  },
  "KDN163A": {
    "ean": "3250613740900",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=KDN163A&file=datasheet"
  },
  "KDN263A": {
    "ean": "3250613740917",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=KDN263A&file=datasheet"
  },
  "KDN363A": {
    "ean": "3250613740924",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=KDN363A&file=datasheet"
  },
  "KDN363B": {
    "ean": "3250613740962",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=KDN363B&file=datasheet"
  },
  "KZN021": {
    "ean": "3250613961701",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=KZN021&file=datasheet"
  },
  "KZN023": {
    "ean": "3250613961718",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=KZN023&file=datasheet"
  },
  "OEZ:38292": {
    "ean": "8590125382928",
    "depthMm": 80.3
  },
  "OEZ:38293": {
    "ean": "8590125382935",
    "depthMm": 80.3
  },
  "OEZ:38294": {
    "ean": "8590125382942",
    "depthMm": 80.3
  },
  "OEZ:38295": {
    "ean": "8590125382959",
    "depthMm": 80.3
  },
  "OEZ:38296": {
    "ean": "8590125382966",
    "depthMm": 80.3
  },
  "OEZ:38297": {
    "ean": "8590125382973",
    "depthMm": 80.3
  },
  "OEZ:38298": {
    "ean": "8590125382980",
    "depthMm": 80.3
  },
  "OEZ:38299": {
    "ean": "8590125382997",
    "depthMm": 80.3
  },
  "OEZ:38300": {
    "ean": "8590125383000",
    "depthMm": 80.3
  },
  "OEZ:38301": {
    "ean": "8590125383017",
    "depthMm": 80.3
  },
  "OEZ:38302": {
    "ean": "8590125383024",
    "depthMm": 80.3
  },
  "OEZ:38303": {
    "ean": "8590125383031",
    "depthMm": 80.3
  },
  "OEZ:38304": {
    "ean": "8590125383048",
    "depthMm": 80.3
  },
  "OEZ:38305": {
    "ean": "8590125383055",
    "depthMm": 80.3
  },
  "OEZ:38306": {
    "ean": "8590125383062",
    "depthMm": 80.3
  },
  "OEZ:38307": {
    "ean": "8590125383079",
    "depthMm": 80.3
  },
  "OEZ:38308": {
    "ean": "8590125383086",
    "depthMm": 80.3
  },
  "OEZ:38309": {
    "ean": "8590125383093",
    "depthMm": 80.3
  },
  "OEZ:38310": {
    "ean": "8590125383109",
    "depthMm": 80.3
  },
  "OEZ:38311": {
    "ean": "8590125383116",
    "depthMm": 80.3
  },
  "OEZ:38312": {
    "ean": "8590125383123",
    "depthMm": 80.3
  },
  "OEZ:41634": {
    "ean": "8590125416340",
    "depthMm": 79.7
  },
  "OEZ:41635": {
    "ean": "8590125416357",
    "depthMm": 79.7
  },
  "OEZ:41636": {
    "ean": "8590125416364",
    "depthMm": 79.7
  },
  "OEZ:41638": {
    "ean": "8590125416388",
    "depthMm": 79.7
  },
  "OEZ:41639": {
    "ean": "8590125416395",
    "depthMm": 79.7
  },
  "OEZ:41640": {
    "ean": "8590125416401",
    "depthMm": 79.7
  },
  "OEZ:41641": {
    "ean": "8590125416418",
    "depthMm": 79.7
  },
  "OEZ:41642": {
    "ean": "8590125416425",
    "depthMm": 79.7
  },
  "OEZ:41643": {
    "ean": "8590125416432",
    "depthMm": 79.7
  },
  "OEZ:41644": {
    "ean": "8590125416449",
    "depthMm": 79.7
  },
  "OEZ:41645": {
    "ean": "8590125416456",
    "depthMm": 79.7
  },
  "OEZ:41646": {
    "ean": "8590125416463",
    "depthMm": 79.7
  },
  "OEZ:41647": {
    "ean": "8590125416470",
    "depthMm": 79.7
  },
  "OEZ:41648": {
    "ean": "8590125416487",
    "depthMm": 79.7
  },
  "OEZ:41649": {
    "ean": "8590125416494",
    "depthMm": 79.7
  },
  "OEZ:41650": {
    "ean": "8590125416500",
    "depthMm": 79.7
  },
  "OEZ:41651": {
    "ean": "8590125416517",
    "depthMm": 79.7
  },
  "OEZ:41652": {
    "ean": "8590125416524",
    "depthMm": 79.7
  },
  "OEZ:41653": {
    "ean": "8590125416531",
    "depthMm": 79.7
  },
  "OEZ:41654": {
    "ean": "8590125416548",
    "depthMm": 79.7
  },
  "OEZ:41655": {
    "ean": "8590125416555",
    "depthMm": 79.7
  },
  "OEZ:41656": {
    "ean": "8590125416562",
    "depthMm": 79.7
  },
  "OEZ:41657": {
    "ean": "8590125416579",
    "depthMm": 79.7
  },
  "OEZ:41658": {
    "ean": "8590125416586",
    "depthMm": 79.7
  },
  "OEZ:41659": {
    "ean": "8590125416593",
    "depthMm": 79.7
  },
  "OEZ:41660": {
    "ean": "8590125416609",
    "depthMm": 79.7
  },
  "OEZ:41661": {
    "ean": "8590125416616",
    "depthMm": 79.7
  },
  "OEZ:41662": {
    "ean": "8590125416623",
    "depthMm": 79.7
  },
  "OEZ:41663": {
    "ean": "8590125416630",
    "depthMm": 79.7
  },
  "OEZ:41664": {
    "ean": "8590125416647",
    "depthMm": 79.7
  },
  "OEZ:41665": {
    "ean": "8590125416654",
    "depthMm": 79.7
  },
  "OEZ:41666": {
    "ean": "8590125416661",
    "depthMm": 79.7
  },
  "OEZ:41667": {
    "ean": "8590125416678",
    "depthMm": 79.7
  },
  "OEZ:41668": {
    "ean": "8590125416685",
    "depthMm": 79.7
  },
  "OEZ:41669": {
    "ean": "8590125416692",
    "depthMm": 79.7
  },
  "OEZ:41670": {
    "ean": "8590125416708",
    "depthMm": 79.7
  },
  "OEZ:41671": {
    "ean": "8590125416715",
    "depthMm": 79.7
  },
  "OEZ:41672": {
    "ean": "8590125416722",
    "depthMm": 79.7
  },
  "OEZ:41673": {
    "ean": "8590125416739",
    "depthMm": 79.7
  },
  "OEZ:41674": {
    "ean": "8590125416746",
    "depthMm": 79.7
  },
  "OEZ:41675": {
    "ean": "8590125416753",
    "depthMm": 79.7
  },
  "OEZ:41676": {
    "ean": "8590125416760",
    "depthMm": 79.7
  },
  "OEZ:41677": {
    "ean": "8590125416777",
    "depthMm": 79.7
  },
  "OEZ:41678": {
    "ean": "8590125416784",
    "depthMm": 79.7
  },
  "OEZ:41679": {
    "ean": "8590125416791",
    "depthMm": 79.7
  },
  "OEZ:41680": {
    "ean": "8590125416807",
    "depthMm": 79.7
  },
  "OEZ:41681": {
    "ean": "8590125416814",
    "depthMm": 80.3
  },
  "OEZ:41683": {
    "ean": "8590125416838",
    "depthMm": 80.3
  },
  "OEZ:41684": {
    "ean": "8590125416845",
    "depthMm": 80.3
  },
  "OEZ:41685": {
    "ean": "8590125416852",
    "depthMm": 80.3
  },
  "OEZ:41686": {
    "ean": "8590125416869",
    "depthMm": 80.3
  },
  "OEZ:41687": {
    "ean": "8590125416876",
    "depthMm": 80.3
  },
  "OEZ:41688": {
    "ean": "8590125416883",
    "depthMm": 80.3
  },
  "OEZ:41689": {
    "ean": "8590125416890",
    "depthMm": 80.3
  },
  "OEZ:41690": {
    "ean": "8590125416906",
    "depthMm": 80.3
  },
  "OEZ:41691": {
    "ean": "8590125416913",
    "depthMm": 80.3
  },
  "OEZ:41692": {
    "ean": "8590125416920",
    "depthMm": 80.3
  },
  "OEZ:41693": {
    "ean": "8590125416937",
    "depthMm": 80.3
  },
  "OEZ:41694": {
    "ean": "8590125416944",
    "depthMm": 80.3
  },
  "OEZ:41695": {
    "ean": "8590125416951",
    "depthMm": 80.3
  },
  "OEZ:41696": {
    "ean": "8590125416968",
    "depthMm": 80.3
  },
  "OEZ:41697": {
    "ean": "8590125416975",
    "depthMm": 80.3
  },
  "OEZ:41698": {
    "ean": "8590125416982",
    "depthMm": 80.3
  },
  "OEZ:41699": {
    "ean": "8590125416999",
    "depthMm": 80.3
  },
  "OEZ:41700": {
    "ean": "8590125417002",
    "depthMm": 80.3
  },
  "OEZ:41701": {
    "ean": "8590125417019",
    "depthMm": 80.3
  },
  "OEZ:41702": {
    "ean": "8590125417026",
    "depthMm": 80.3
  },
  "OEZ:41703": {
    "ean": "8590125417033",
    "depthMm": 80.3
  },
  "OEZ:41704": {
    "ean": "8590125417040",
    "depthMm": 80.3
  },
  "OEZ:41705": {
    "ean": "8590125417057",
    "depthMm": 80.3
  },
  "OEZ:41706": {
    "ean": "8590125417064",
    "depthMm": 80.3
  },
  "OEZ:41707": {
    "ean": "8590125417071",
    "depthMm": 80.3
  },
  "OEZ:41708": {
    "ean": "8590125417088",
    "depthMm": 80.3
  },
  "OEZ:41709": {
    "ean": "8590125417095",
    "depthMm": 80.3
  },
  "OEZ:41710": {
    "ean": "8590125417101",
    "depthMm": 80.3
  },
  "OEZ:41711": {
    "ean": "8590125417118",
    "depthMm": 80.3
  },
  "OEZ:41712": {
    "ean": "8590125417125",
    "depthMm": 80.3
  },
  "OEZ:41713": {
    "ean": "8590125417132",
    "depthMm": 80.3
  },
  "OEZ:41714": {
    "ean": "8590125417149",
    "depthMm": 80.3
  },
  "OEZ:41715": {
    "ean": "8590125417156",
    "depthMm": 80.3
  },
  "OEZ:41719": {
    "ean": "8590125417194",
    "depthMm": 80.3
  },
  "OEZ:41721": {
    "ean": "8590125417217",
    "depthMm": 80.3
  },
  "OEZ:41722": {
    "ean": "8590125417224",
    "depthMm": 80.3
  },
  "OEZ:41723": {
    "ean": "8590125417231",
    "depthMm": 80.3
  },
  "OEZ:41724": {
    "ean": "8590125417248",
    "depthMm": 80.3
  },
  "OEZ:41725": {
    "ean": "8590125417255",
    "depthMm": 80.3
  },
  "OEZ:41726": {
    "ean": "8590125417262",
    "depthMm": 80.3
  },
  "OEZ:41727": {
    "ean": "8590125417279",
    "depthMm": 80.3
  },
  "OEZ:41728": {
    "ean": "8590125417286",
    "depthMm": 80.3
  },
  "OEZ:41729": {
    "ean": "8590125417293",
    "depthMm": 80.3
  },
  "OEZ:41730": {
    "ean": "8590125417309",
    "depthMm": 80.3
  },
  "OEZ:41731": {
    "ean": "8590125417316",
    "depthMm": 80.3
  },
  "OEZ:41732": {
    "ean": "8590125417323",
    "depthMm": 80.3
  },
  "OEZ:41733": {
    "ean": "8590125417330",
    "depthMm": 80.3
  },
  "OEZ:41734": {
    "ean": "8590125417347",
    "depthMm": 80.3
  },
  "OEZ:41735": {
    "ean": "8590125417354",
    "depthMm": 80.3
  },
  "OEZ:41736": {
    "ean": "8590125417361",
    "depthMm": 80.3
  },
  "OEZ:41737": {
    "ean": "8590125417378",
    "depthMm": 80.3
  },
  "OEZ:41738": {
    "ean": "8590125417385",
    "depthMm": 80.3
  },
  "OEZ:41739": {
    "ean": "8590125417392",
    "depthMm": 80.3
  },
  "OEZ:41740": {
    "ean": "8590125417408",
    "depthMm": 80.3
  },
  "OEZ:41741": {
    "ean": "8590125417415",
    "depthMm": 80.3
  },
  "OEZ:41742": {
    "ean": "8590125417422",
    "depthMm": 80.3
  },
  "OEZ:41743": {
    "ean": "8590125417439",
    "depthMm": 80.3
  },
  "OEZ:41744": {
    "ean": "8590125417446",
    "depthMm": 80.3
  },
  "OEZ:41745": {
    "ean": "8590125417453",
    "depthMm": 80.3
  },
  "OEZ:41746": {
    "ean": "8590125417460",
    "depthMm": 80.3
  },
  "OEZ:41747": {
    "ean": "8590125417477",
    "depthMm": 80.3
  },
  "OEZ:41748": {
    "ean": "8590125417484",
    "depthMm": 80.3
  },
  "OEZ:41749": {
    "ean": "8590125417491",
    "depthMm": 80.3
  },
  "OEZ:41750": {
    "ean": "8590125417507",
    "depthMm": 80.3
  },
  "OEZ:41751": {
    "ean": "8590125417514",
    "depthMm": 80.3
  },
  "OEZ:41752": {
    "ean": "8590125417521",
    "depthMm": 80.3
  },
  "OEZ:41753": {
    "ean": "8590125417538",
    "depthMm": 80.3
  },
  "OEZ:41754": {
    "ean": "8590125417545",
    "depthMm": 80.3
  },
  "OEZ:41755": {
    "ean": "8590125417552",
    "depthMm": 80.3
  },
  "OEZ:41756": {
    "ean": "8590125417569",
    "depthMm": 80.3
  },
  "OEZ:41757": {
    "ean": "8590125417576",
    "depthMm": 80.3
  },
  "OEZ:41758": {
    "ean": "8590125417583",
    "depthMm": 80.3
  },
  "OEZ:41759": {
    "ean": "8590125417590",
    "depthMm": 80.3
  },
  "OEZ:41760": {
    "ean": "8590125417606",
    "depthMm": 80.3
  },
  "OEZ:41761": {
    "ean": "8590125417613",
    "depthMm": 80.3
  },
  "OEZ:41768": {
    "ean": "8590125417682",
    "depthMm": 80.3
  },
  "OEZ:41770": {
    "ean": "8590125417705",
    "depthMm": 80.3
  },
  "OEZ:41771": {
    "ean": "8590125417712",
    "depthMm": 80.3
  },
  "OEZ:41772": {
    "ean": "8590125417729",
    "depthMm": 80.3
  },
  "OEZ:41773": {
    "ean": "8590125417736",
    "depthMm": 80.3
  },
  "OEZ:41774": {
    "ean": "8590125417743",
    "depthMm": 80.3
  },
  "OEZ:41775": {
    "ean": "8590125417750",
    "depthMm": 80.3
  },
  "OEZ:41776": {
    "ean": "8590125417767",
    "depthMm": 80.3
  },
  "OEZ:41777": {
    "ean": "8590125417774",
    "depthMm": 80.3
  },
  "OEZ:41778": {
    "ean": "8590125417781",
    "depthMm": 80.3
  },
  "OEZ:41779": {
    "ean": "8590125417798",
    "depthMm": 80.3
  },
  "OEZ:41780": {
    "ean": "8590125417804",
    "depthMm": 80.3
  },
  "OEZ:41781": {
    "ean": "8590125417811",
    "depthMm": 80.3
  },
  "OEZ:41782": {
    "ean": "8590125417828",
    "depthMm": 80.3
  },
  "OEZ:41783": {
    "ean": "8590125417835",
    "depthMm": 80.3
  },
  "OEZ:41784": {
    "ean": "8590125417842",
    "depthMm": 80.3
  },
  "OEZ:41785": {
    "ean": "8590125417859",
    "depthMm": 80.3
  },
  "OEZ:41786": {
    "ean": "8590125417866",
    "depthMm": 80.3
  },
  "OEZ:41787": {
    "ean": "8590125417873",
    "depthMm": 80.3
  },
  "OEZ:41788": {
    "ean": "8590125417880",
    "depthMm": 80.3
  },
  "OEZ:41789": {
    "ean": "8590125417897",
    "depthMm": 80.3
  },
  "OEZ:41790": {
    "ean": "8590125417903",
    "depthMm": 80.3
  },
  "OEZ:41791": {
    "ean": "8590125417910",
    "depthMm": 80.3
  },
  "OEZ:41792": {
    "ean": "8590125417927",
    "depthMm": 80.3
  },
  "OEZ:41793": {
    "ean": "8590125417934",
    "depthMm": 80.3
  },
  "OEZ:41794": {
    "ean": "8590125417941",
    "depthMm": 80.3
  },
  "OEZ:41795": {
    "ean": "8590125417958",
    "depthMm": 80.3
  },
  "OEZ:41796": {
    "ean": "8590125417965",
    "depthMm": 80.3
  },
  "OEZ:41797": {
    "ean": "8590125417972",
    "depthMm": 80.3
  },
  "OEZ:41798": {
    "ean": "8590125417989",
    "depthMm": 80.3
  },
  "OEZ:41799": {
    "ean": "8590125417996",
    "depthMm": 80.3
  },
  "OEZ:41800": {
    "ean": "8590125418009",
    "depthMm": 80.3
  },
  "OEZ:41801": {
    "ean": "8590125418016",
    "depthMm": 80.3
  },
  "OEZ:41802": {
    "ean": "8590125418023",
    "depthMm": 80.3
  },
  "OEZ:41803": {
    "ean": "8590125418030",
    "depthMm": 80.3
  },
  "OEZ:41804": {
    "ean": "8590125418047",
    "depthMm": 80.3
  },
  "OEZ:41805": {
    "ean": "8590125418054",
    "depthMm": 80.3
  },
  "OEZ:41806": {
    "ean": "8590125418061",
    "depthMm": 80.3
  },
  "OEZ:41807": {
    "ean": "8590125418078",
    "depthMm": 80.3
  },
  "OEZ:41808": {
    "ean": "8590125418085",
    "depthMm": 80.3
  },
  "OEZ:41809": {
    "ean": "8590125418092",
    "depthMm": 80.3
  },
  "OEZ:41810": {
    "ean": "8590125418108",
    "depthMm": 80.3
  },
  "OEZ:41811": {
    "ean": "8590125418115",
    "depthMm": 80.3
  },
  "OEZ:41812": {
    "ean": "8590125418122",
    "depthMm": 80.3
  },
  "OEZ:41815": {
    "ean": "8590125418153",
    "depthMm": 80.3
  },
  "OEZ:41817": {
    "ean": "8590125418177",
    "depthMm": 80.3
  },
  "OEZ:41818": {
    "ean": "8590125418184",
    "depthMm": 80.3
  },
  "OEZ:41819": {
    "ean": "8590125418191",
    "depthMm": 80.3
  },
  "OEZ:41820": {
    "ean": "8590125418207",
    "depthMm": 80.3
  },
  "OEZ:41821": {
    "ean": "8590125418214",
    "depthMm": 80.3
  },
  "OEZ:41822": {
    "ean": "8590125418221",
    "depthMm": 80.3
  },
  "OEZ:41823": {
    "ean": "8590125418238",
    "depthMm": 80.3
  },
  "OEZ:41824": {
    "ean": "8590125418245",
    "depthMm": 80.3
  },
  "OEZ:41825": {
    "ean": "8590125418252",
    "depthMm": 80.3
  },
  "OEZ:41826": {
    "ean": "8590125418269",
    "depthMm": 80.3
  },
  "OEZ:41827": {
    "ean": "8590125418276",
    "depthMm": 80.3
  },
  "OEZ:41828": {
    "ean": "8590125418283",
    "depthMm": 80.3
  },
  "OEZ:41829": {
    "ean": "8590125418290",
    "depthMm": 80.3
  },
  "OEZ:41830": {
    "ean": "8590125418306",
    "depthMm": 80.3
  },
  "OEZ:41831": {
    "ean": "8590125418313",
    "depthMm": 80.3
  },
  "OEZ:41832": {
    "ean": "8590125418320",
    "depthMm": 80.3
  },
  "OEZ:41833": {
    "ean": "8590125418337",
    "depthMm": 80.3
  },
  "OEZ:41834": {
    "ean": "8590125418344",
    "depthMm": 80.3
  },
  "OEZ:41835": {
    "ean": "8590125418351",
    "depthMm": 80.3
  },
  "OEZ:41836": {
    "ean": "8590125418368",
    "depthMm": 80.3
  },
  "OEZ:41837": {
    "ean": "8590125418375",
    "depthMm": 80.3
  },
  "OEZ:41838": {
    "ean": "8590125418382",
    "depthMm": 80.3
  },
  "OEZ:41839": {
    "ean": "8590125418399",
    "depthMm": 80.3
  },
  "OEZ:41840": {
    "ean": "8590125418405",
    "depthMm": 80.3
  },
  "OEZ:41841": {
    "ean": "8590125418412",
    "depthMm": 80.3
  },
  "OEZ:41842": {
    "ean": "8590125418429",
    "depthMm": 80.3
  },
  "OEZ:41843": {
    "ean": "8590125418436",
    "depthMm": 80.3
  },
  "OEZ:41844": {
    "ean": "8590125418443",
    "depthMm": 80.3
  },
  "OEZ:41845": {
    "ean": "8590125418450",
    "depthMm": 80.3
  },
  "OEZ:41874": {
    "ean": "8590125418740",
    "depthMm": 79.7
  },
  "OEZ:41875": {
    "ean": "8590125418757",
    "depthMm": 79.7
  },
  "OEZ:41876": {
    "ean": "8590125418764",
    "depthMm": 79.7
  },
  "OEZ:41878": {
    "ean": "8590125418788",
    "depthMm": 79.7
  },
  "OEZ:41879": {
    "ean": "8590125418795",
    "depthMm": 79.7
  },
  "OEZ:41880": {
    "ean": "8590125418801",
    "depthMm": 79.7
  },
  "OEZ:41881": {
    "ean": "8590125418818",
    "depthMm": 79.7
  },
  "OEZ:41882": {
    "ean": "8590125418825",
    "depthMm": 79.7
  },
  "OEZ:41883": {
    "ean": "8590125418832",
    "depthMm": 79.7
  },
  "OEZ:41884": {
    "ean": "8590125418849",
    "depthMm": 79.7
  },
  "OEZ:41885": {
    "ean": "8590125418856",
    "depthMm": 79.7
  },
  "OEZ:41886": {
    "ean": "8590125418863",
    "depthMm": 79.7
  },
  "OEZ:41887": {
    "ean": "8590125418870",
    "depthMm": 79.7
  },
  "OEZ:41888": {
    "ean": "8590125418887",
    "depthMm": 79.7
  },
  "OEZ:41889": {
    "ean": "8590125418894",
    "depthMm": 79.7
  },
  "OEZ:41891": {
    "ean": "8590125418917",
    "depthMm": 79.7
  },
  "OEZ:41892": {
    "ean": "8590125418924",
    "depthMm": 79.7
  },
  "OEZ:41893": {
    "ean": "8590125418931",
    "depthMm": 79.7
  },
  "OEZ:41894": {
    "ean": "8590125418948",
    "depthMm": 79.7
  },
  "OEZ:41895": {
    "ean": "8590125418955",
    "depthMm": 79.7
  },
  "OEZ:41896": {
    "ean": "8590125418962",
    "depthMm": 79.7
  },
  "OEZ:41897": {
    "ean": "8590125418979",
    "depthMm": 79.7
  },
  "OEZ:41898": {
    "ean": "8590125418986",
    "depthMm": 79.7
  },
  "OEZ:41899": {
    "ean": "8590125418993",
    "depthMm": 79.7
  },
  "OEZ:41902": {
    "ean": "8590125419020",
    "depthMm": 80.3
  },
  "OEZ:41904": {
    "ean": "8590125419044",
    "depthMm": 80.3
  },
  "OEZ:41905": {
    "ean": "8590125419051",
    "depthMm": 80.3
  },
  "OEZ:41906": {
    "ean": "8590125419068",
    "depthMm": 80.3
  },
  "OEZ:41907": {
    "ean": "8590125419075",
    "depthMm": 80.3
  },
  "OEZ:41908": {
    "ean": "8590125419082",
    "depthMm": 80.3
  },
  "OEZ:41909": {
    "ean": "8590125419099",
    "depthMm": 80.3
  },
  "OEZ:41910": {
    "ean": "8590125419105",
    "depthMm": 80.3
  },
  "OEZ:41911": {
    "ean": "8590125419112",
    "depthMm": 80.3
  },
  "OEZ:41912": {
    "ean": "8590125419129",
    "depthMm": 80.3
  },
  "OEZ:41913": {
    "ean": "8590125419136",
    "depthMm": 80.3
  },
  "OEZ:41914": {
    "ean": "8590125419143",
    "depthMm": 80.3
  },
  "OEZ:41915": {
    "ean": "8590125419150",
    "depthMm": 80.3
  },
  "OEZ:41917": {
    "ean": "8590125419174",
    "depthMm": 80.3
  },
  "OEZ:41918": {
    "ean": "8590125419181",
    "depthMm": 80.3
  },
  "OEZ:41919": {
    "ean": "8590125419198",
    "depthMm": 80.3
  },
  "OEZ:41920": {
    "ean": "8590125419204",
    "depthMm": 80.3
  },
  "OEZ:41921": {
    "ean": "8590125419211",
    "depthMm": 80.3
  },
  "OEZ:41922": {
    "ean": "8590125419228",
    "depthMm": 80.3
  },
  "OEZ:41923": {
    "ean": "8590125419235",
    "depthMm": 80.3
  },
  "OEZ:41924": {
    "ean": "8590125419242",
    "depthMm": 80.3
  },
  "OEZ:41925": {
    "ean": "8590125419259",
    "depthMm": 80.3
  },
  "OEZ:41928": {
    "ean": "8590125419280",
    "depthMm": 80.3
  },
  "OEZ:41930": {
    "ean": "8590125419303",
    "depthMm": 80.3
  },
  "OEZ:41931": {
    "ean": "8590125419310",
    "depthMm": 80.3
  },
  "OEZ:41932": {
    "ean": "8590125419327",
    "depthMm": 80.3
  },
  "OEZ:41933": {
    "ean": "8590125419334",
    "depthMm": 80.3
  },
  "OEZ:41934": {
    "ean": "8590125419341",
    "depthMm": 80.3
  },
  "OEZ:41935": {
    "ean": "8590125419358",
    "depthMm": 80.3
  },
  "OEZ:41936": {
    "ean": "8590125419365",
    "depthMm": 80.3
  },
  "OEZ:41937": {
    "ean": "8590125419372",
    "depthMm": 80.3
  },
  "OEZ:41938": {
    "ean": "8590125419389",
    "depthMm": 80.3
  },
  "OEZ:41939": {
    "ean": "8590125419396",
    "depthMm": 80.3
  },
  "OEZ:41940": {
    "ean": "8590125419402",
    "depthMm": 80.3
  },
  "OEZ:41941": {
    "ean": "8590125419419",
    "depthMm": 80.3
  },
  "OEZ:41943": {
    "ean": "8590125419433",
    "depthMm": 80.3
  },
  "OEZ:41944": {
    "ean": "8590125419440",
    "depthMm": 80.3
  },
  "OEZ:41945": {
    "ean": "8590125419457",
    "depthMm": 80.3
  },
  "OEZ:41946": {
    "ean": "8590125419464",
    "depthMm": 80.3
  },
  "OEZ:41947": {
    "ean": "8590125419471",
    "depthMm": 80.3
  },
  "OEZ:41948": {
    "ean": "8590125419488",
    "depthMm": 80.3
  },
  "OEZ:41949": {
    "ean": "8590125419495",
    "depthMm": 80.3
  },
  "OEZ:41950": {
    "ean": "8590125419501",
    "depthMm": 80.3
  },
  "OEZ:41951": {
    "ean": "8590125419518",
    "depthMm": 80.3
  },
  "OEZ:43085": {
    "ean": "8590125430858",
    "depthMm": 80.3
  },
  "OEZ:43086": {
    "ean": "8590125430865",
    "depthMm": 80.3
  },
  "OEZ:43087": {
    "ean": "8590125430872",
    "depthMm": 80.3
  },
  "OEZ:43088": {
    "ean": "8590125430889",
    "depthMm": 80.3
  },
  "OEZ:43218": {
    "ean": "8590125432180",
    "depthMm": 79.7
  },
  "OEZ:43219": {
    "ean": "8590125432197",
    "depthMm": 80.3
  },
  "OEZ:43220": {
    "ean": "8590125432203",
    "depthMm": 80.3
  },
  "OEZ:43221": {
    "ean": "8590125432210",
    "depthMm": 79.7
  },
  "OEZ:43222": {
    "ean": "8590125432227",
    "depthMm": 80.3
  },
  "OEZ:43223": {
    "ean": "8590125432234",
    "depthMm": 80.3
  },
  "OEZ:43224": {
    "ean": "8590125432241",
    "depthMm": 80.3
  },
  "OEZ:43225": {
    "ean": "8590125432258",
    "depthMm": 80.3
  },
  "OEZ:43227": {
    "ean": "8590125432272",
    "depthMm": 80.3
  },
  "OEZ:43228": {
    "ean": "8590125432289",
    "depthMm": 80.3
  },
  "OEZ:43229": {
    "ean": "8590125432296",
    "depthMm": 80.3
  },
  "OEZ:43231": {
    "ean": "8590125432319",
    "depthMm": 80.3
  },
  "OEZ:43232": {
    "ean": "8590125432326",
    "depthMm": 80.3
  },
  "OEZ:43233": {
    "ean": "8590125432333",
    "depthMm": 80.3
  },
  "OEZ:46395": {
    "ean": "8590125463955",
    "depthMm": 79.7
  },
  "OEZ:46396": {
    "ean": "8590125463962",
    "depthMm": 79.7
  },
  "OEZ:46397": {
    "ean": "8590125463979",
    "depthMm": 79.7
  },
  "OEZ:46398": {
    "ean": "8590125463986",
    "depthMm": 79.7
  },
  "OEZ:46399": {
    "ean": "8590125463993",
    "depthMm": 79.7
  },
  "OEZ:46400": {
    "ean": "8590125464006",
    "depthMm": 79.7
  },
  "OEZ:46401": {
    "ean": "8590125464013",
    "depthMm": 79.7
  },
  "OEZ:46402": {
    "ean": "8590125464020",
    "depthMm": 79.7
  },
  "OEZ:46403": {
    "ean": "8590125464037",
    "depthMm": 79.7
  },
  "OEZ:46404": {
    "ean": "8590125464044",
    "depthMm": 79.7
  },
  "OEZ:46405": {
    "ean": "8590125464051",
    "depthMm": 79.7
  },
  "OEZ:46406": {
    "ean": "8590125464068",
    "depthMm": 79.7
  },
  "OEZ:46633": {
    "ean": "8590125466338",
    "depthMm": 79.7
  },
  "OEZ:46634": {
    "ean": "8590125466345",
    "depthMm": 79.7
  },
  "OEZ:46635": {
    "ean": "8590125466352",
    "depthMm": 79.7
  },
  "OEZ:46636": {
    "ean": "8590125466369",
    "depthMm": 79.7
  },
  "OEZ:46637": {
    "ean": "8590125466376",
    "depthMm": 79.7
  },
  "OEZ:46638": {
    "ean": "8590125466383",
    "depthMm": 79.7
  },
  "OEZ:46639": {
    "ean": "8590125466390",
    "depthMm": 79.7
  },
  "OEZ:46640": {
    "ean": "8590125466406",
    "depthMm": 79.7
  },
  "OEZ:46641": {
    "ean": "8590125466413",
    "depthMm": 79.7
  },
  "OEZ:46642": {
    "ean": "8590125466420",
    "depthMm": 79.7
  },
  "OEZ:46643": {
    "ean": "8590125466437",
    "depthMm": 79.7
  },
  "OEZ:46644": {
    "ean": "8590125466444",
    "depthMm": 79.7
  },
  "OEZ:46645": {
    "ean": "8590125466451",
    "depthMm": 79.7
  },
  "OEZ:46646": {
    "ean": "8590125466468",
    "depthMm": 79.7
  },
  "OEZ:46788": {
    "ean": "8590125467885",
    "depthMm": 80.3
  },
  "OEZ:46789": {
    "ean": "8590125467892",
    "depthMm": 80.3
  },
  "OEZ:46791": {
    "ean": "8590125467915",
    "depthMm": 80.3
  },
  "OEZ:46792": {
    "ean": "8590125467922",
    "depthMm": 80.3
  },
  "OEZ:46793": {
    "ean": "8590125467939",
    "depthMm": 80.3
  },
  "OEZ:46794": {
    "ean": "8590125467946",
    "depthMm": 80.3
  },
  "OEZ:46795": {
    "ean": "8590125467953",
    "depthMm": 80.3
  },
  "OEZ:46796": {
    "ean": "8590125467960",
    "depthMm": 80.3
  },
  "OEZ:46797": {
    "ean": "8590125467977",
    "depthMm": 80.3
  },
  "OEZ:46799": {
    "ean": "8590125467991",
    "depthMm": 80.3
  },
  "OEZ:46800": {
    "ean": "8590125468004",
    "depthMm": 80.3
  },
  "OEZ:46801": {
    "ean": "8590125468011",
    "depthMm": 80.3
  },
  "OEZ:46802": {
    "ean": "8590125468028",
    "depthMm": 80.3
  },
  "OEZ:46803": {
    "ean": "8590125468035",
    "depthMm": 80.3
  },
  "SFB116": {
    "ean": "3250615510709",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=SFB116&file=datasheet",
    "depthMm": 70
  },
  "SFT125": {
    "ean": "3250615510747",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=SFT125&file=datasheet",
    "depthMm": 70
  },
  "SFT340": {
    "ean": "3250615510938",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=SFT340&file=datasheet",
    "depthMm": 70
  },
  "SFT440": {
    "ean": "3250615510945",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=SFT440&file=datasheet",
    "depthMm": 71
  },
  "SN216": {
    "ean": "3250615642165",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=SN216&file=datasheet"
  },
  "ST301": {
    "ean": "3250615703019",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=ST301&file=datasheet"
  },
  "VU36NWB": {
    "ean": "3250616615731",
    "datasheetUrl": "https://assets.hager.com/step-content/P/HA_69966195/Document/std.lang.all/6LE001973D.pdf",
    "depthMm": 90
  },
  "VZ455N": {
    "ean": "3250616666412",
    "datasheetUrl": "https://hager.com/cz/katalog/?artnr=VZ455N&file=datasheet"
  }
};

/** Opravy řad × modulů rozvodnic katalogu podle dat výrobce (ETIM potvrzený popisem výrobce). */
export interface EnclosureFix {
  rows: number;
  modulesPerRow: number;
  totalModules: number;
  source: string;
}

export const BRAND_ENCLOSURE_FIXES: Record<string, EnclosureFix> = {
  "VF212TD": {
    "rows": 2,
    "modulesPerRow": 12,
    "totalModules": 24,
    "source": "Hager ETIM 10 (řady EF000266, moduly v řadě EF002950) a popis výrobce „Rozvod. zap. golf, IP40, 24M, tr. dv. Rozvodnice zapuštěná golf, IP40, 2-řadá, 24 mod., tr“"
  },
  "VS212TD": {
    "rows": 2,
    "modulesPerRow": 12,
    "totalModules": 24,
    "source": "Hager ETIM 10 (řady EF000266, moduly v řadě EF002950) a popis výrobce „Rozvod. nástěn.golf, IP40,24M, tr. dv. Rozvodnice nástěnná golf, IP40, 2-řadá, 24 mod., tr“"
  }
};
