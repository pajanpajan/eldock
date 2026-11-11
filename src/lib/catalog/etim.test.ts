import { describe, expect, it } from "vitest";

import { ETIM_UNITS, featureNumber, normalizeMpn, parseEtimProduct, productDocuments, productPhoto } from "./etim";

// Fáze 94: produkt BMEcat ETIM 9.0 (EDXF 5.0) – výřez skutečného záznamu zásuvky ABB Tango z ELSB_ETIM-9.0_2026-05.

const BLOCK = `<PRODUCT mode="new">
      <SUPPLIER_PID>5518A-A2359 B</SUPPLIER_PID>
      <PRODUCT_DETAILS>
        <DESCRIPTION_SHORT lang="eng">Socket Outlets Without imprint white - Tango</DESCRIPTION_SHORT>
        <DESCRIPTION_SHORT lang="cze">Zásuvka jednonásobná s ochranným kolíkem, s clonkami</DESCRIPTION_SHORT>
        <DESCRIPTION_LONG lang="cze">Zásuvka jednonásobná s ochranným kolíkem, s clonkami; bílá</DESCRIPTION_LONG>
        <INTERNATIONAL_PID type="gtin">8595017218101</INTERNATIONAL_PID>
        <MANUFACTURER_TYPE_DESCR>5518A-A2359 B</MANUFACTURER_TYPE_DESCR>
      </PRODUCT_DETAILS>
      <PRODUCT_FEATURES>
        <REFERENCE_FEATURE_SYSTEM_NAME>ETIM-9.0</REFERENCE_FEATURE_SYSTEM_NAME>
        <REFERENCE_FEATURE_GROUP_ID>EC000125</REFERENCE_FEATURE_GROUP_ID>
        <FEATURE><FNAME>EF000001</FNAME><FVALUE>16</FVALUE><FUNIT>EU570459</FUNIT></FEATURE>
        <FEATURE><FNAME>EF012278</FNAME><FVALUE>40</FVALUE><FUNIT>EU570448</FUNIT></FEATURE>
        <FEATURE><FNAME>EF000416</FNAME><FVALUE>50</FVALUE><FVALUE>50</FVALUE><FUNIT>EU570028</FUNIT></FEATURE>
        <FEATURE><FNAME>EF003823</FNAME><FVALUE>EV000494</FVALUE><FVALUE_DETAILS>None</FVALUE_DETAILS></FEATURE>
        <FEATURE><FNAME>EF006620</FNAME><FVALUE>-</FVALUE></FEATURE>
      </PRODUCT_FEATURES>
      <USER_DEFINED_EXTENSIONS>
        <UDX.EDXF.PRODUCT_SERIES>5518</UDX.EDXF.PRODUCT_SERIES>
        <UDX.EDXF.MIME_INFO>
          <UDX.EDXF.MIME><UDX.EDXF.MIME_SOURCE>https://cdn.productimages.abb.com/9IBA232842_master.gif</UDX.EDXF.MIME_SOURCE><UDX.EDXF.MIME_CODE>MD01</UDX.EDXF.MIME_CODE></UDX.EDXF.MIME>
          <UDX.EDXF.MIME><UDX.EDXF.MIME_SOURCE>https://cdn.productimages.abb.com/9IBA232842_720x540.jpg</UDX.EDXF.MIME_SOURCE><UDX.EDXF.MIME_CODE>MD01</UDX.EDXF.MIME_CODE><UDX.EDXF.MIME_FILENAME>9IBA232842_720x540.jpg</UDX.EDXF.MIME_FILENAME><UDX.EDXF.MIME_DESIGNATION>Product picture</UDX.EDXF.MIME_DESIGNATION></UDX.EDXF.MIME>
          <UDX.EDXF.MIME><UDX.EDXF.MIME_SOURCE>https://new.abb.com/products/2CHA182359A4500</UDX.EDXF.MIME_SOURCE><UDX.EDXF.MIME_CODE>MD04</UDX.EDXF.MIME_CODE></UDX.EDXF.MIME>
          <UDX.EDXF.MIME><UDX.EDXF.MIME_SOURCE lang="cze">new.abb.com/products/cs/5518A-A2359 B</UDX.EDXF.MIME_SOURCE><UDX.EDXF.MIME_CODE>MD04</UDX.EDXF.MIME_CODE></UDX.EDXF.MIME>
          <UDX.EDXF.MIME><UDX.EDXF.MIME_SOURCE lang="cze">https://search.abb.com/library/Download.aspx?DocumentID=1&amp;LanguageCode=cs</UDX.EDXF.MIME_SOURCE><UDX.EDXF.MIME_CODE>MD14</UDX.EDXF.MIME_CODE></UDX.EDXF.MIME>
        </UDX.EDXF.MIME_INFO>
      </USER_DEFINED_EXTENSIONS>
    </PRODUCT>`;

describe("fáze 94 – produkt BMEcat ETIM 9.0", () => {
  it("objednací číslo, GTIN, třída ETIM, řada a vlastnosti s jednotkou (bez neuvedených „-“)", () => {
    const product = parseEtimProduct(BLOCK)!;
    expect(product).toMatchObject({ pid: "5518A-A2359 B", gtin: "8595017218101", etimClass: "EC000125", series: "5518", shortCze: "Zásuvka jednonásobná s ochranným kolíkem, s clonkami" });
    expect(product.features.EF006620).toBeUndefined();
    expect(product.features.EF000416.value).toEqual(["50", "50"]);
    expect(product.features.EF003823).toEqual({ value: "EV000494", detail: "None" });
    // Vestavná hloubka zásuvky 40 mm, jmenovitý proud 16 A
    expect(featureNumber(product, "EF012278", ETIM_UNITS.mm)).toBe(40);
    expect(featureNumber(product, "EF000001", ETIM_UNITS.ampere)).toBe(16);
    expect(featureNumber(product, "EF012278", ETIM_UNITS.ampere)).toBeNull();
    expect(parseEtimProduct("<PRODUCT><PRODUCT_DETAILS/></PRODUCT>")).toBeNull();
  });

  it("fotka výrobku MD01 přednostně 720 × 540 (ne animovaný GIF), technický list a stránka výrobku česky", () => {
    const product = parseEtimProduct(BLOCK)!;
    expect(productPhoto(product)?.source).toBe("https://cdn.productimages.abb.com/9IBA232842_720x540.jpg");
    expect(productDocuments(product)).toEqual({ datasheet: "https://search.abb.com/library/Download.aspx?DocumentID=1&LanguageCode=cs", page: "https://new.abb.com/products/cs/5518A-A2359 B" });
    expect(normalizeMpn("3558A-A651_B")).toBe(normalizeMpn("3558a-a651 b"));
  });
});
