import { generateManufacturingPackage } from "@/lib/panel-builder/cnc-outputs";
import { parseTurnkeyConfig } from "@/lib/panel-builder/turnkey-manufacturing";
import { prisma } from "@/lib/prisma";
import { orderLinesOf } from "@/lib/quoting/quote-sources";
import { wholesalerFile } from "@/lib/quoting/wholesaler-export";
import { buildXlsx, zipStored } from "@/lib/xlsx";
import { getManufacturer } from "@/server/manufacturer-session";
import { getPanelProjectById } from "@/server/queries/panel-builder";
import { projectQuoteSource } from "@/server/quote-sources";
import { cncBaseOf } from "@/server/turnkey-data";

const text = (value: string) => new TextEncoder().encode(value);
const bytes = (value: string | Uint8Array) => (typeof value === "string" ? text(value) : value);

/**
 * Fáze 106: kompletní výrobní balíček zakázky (ZIP) jen pro výrobce, který zakázku přijal: CNC plán 1 : 1 (DXF + CSV),
 * nářezový a drátovací list (CSV + XLSX) a nářezový list lišt, kusovník s MPN / EAN (XLSX + import Sonepar) a odkazy na
 * tisk 6listového elaborátu a štítků (PDF z prohlížeče).
 */
export async function GET(request: Request, context: RouteContext<"/api/vyroba/package/[orderId]">) {
  const manufacturer = await getManufacturer();
  if (!manufacturer) return Response.json({ error: "Přihlaste se do portálu výrobců." }, { status: 401 });
  const { orderId } = await context.params;
  const order = await prisma.manufacturingOrder.findFirst({ where: { id: orderId, manufacturerId: manufacturer.id } });
  if (!order) return Response.json({ error: "Zakázka není vaše." }, { status: 403 });
  const project = await getPanelProjectById(order.projectId);
  if (!project) return Response.json({ error: "Rozváděč nebyl nalezen." }, { status: 404 });
  const pkg = generateManufacturingPackage({ ...cncBaseOf(project), ...parseTurnkeyConfig(order.configJson) });
  const source = await projectQuoteSource(project);
  const bom = [["Sekce", "Objednací číslo (MPN)", "EAN", "Výrobce", "Název a specifikace", "Množství", "Jednotka"], ...source.materials.map((item) => [item.section === "switchboard" ? "Rozváděč" : "Domovní instalace", item.code ?? "", item.ean ?? "", item.manufacturer ?? "", item.name, item.quantity, item.unit])];
  const origin = new URL(request.url).origin;
  const readme = [
    `Zakázka ${order.number} – rozváděč ${project.code}${project.name ? ` ${project.name}` : ""}`,
    `QR štítek ELDOCK: ${order.qrSerial} (po dokončení vede na uzamčenou Verzi 1.0: ${origin}/q/${order.qrSerial})`,
    "",
    "1_CNC_Vrtaci_plan_1-1.dxf / .csv – vrtání M5 / M6, výřezy dveří a otvory vývodek (souřadnice od levého dolního rohu dílu)",
    "2_Narezovy_a_dratovaci_list_vodicu.csv / .xlsx – vodiče Odkud → Kam, průřez, barva, délka a dutinky (TWIN u smyček)",
    "2b_Narezovy_list_list_zlabu_a_hrebenu.csv – DIN lišty, žlaby, sběrnice a propojovací hřebeny",
    "3_Kusovnik_materialu_MPN_EAN.xlsx + 3b_Kosik_Sonepar.csv – materiál s objednacími čísly a EAN",
    `4_6listovy elaborát a 1P schéma (tisk / PDF): ${origin}/vyroba-rozvadecu/zakazka/${order.id}/elaborat`,
    `5_Štítky přístrojů a QR štítek ${order.qrSerial} (tisk 1:1 / PDF): ${origin}/vyroba-rozvadecu/zakazka/${order.id}/stitky`,
  ].join("\r\n");
  const files = [
    ...pkg.files.map((file) => ({ name: file.name, data: bytes(file.content) })),
    { name: "3_Kusovnik_materialu_MPN_EAN.xlsx", data: buildXlsx("Kusovník", bom) },
    { name: "3b_Kosik_Sonepar.csv", data: bytes(wholesalerFile("sonepar", "csv", orderLinesOf(source.materials), { title: order.number, createdAt: new Date().toISOString().slice(0, 10) }).content) },
    { name: "0_PRECTETE_SI.txt", data: text(`﻿${readme}\r\n`) },
  ];
  return new Response(new Uint8Array(zipStored(files)), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${order.number}-vyrobni-balicek.zip"`, "cache-control": "no-store" } });
}
