import { cookies } from "next/headers";

import { SUPERADMIN_COOKIE, brandEnv, isSuperadminToken } from "@/lib/auth";
import { pingIndexNow, publicUrls } from "@/lib/indexnow";

/**
 * Fáze 96: `POST /api/seo/ping` – oznámí všechny veřejné stránky (sitemap.xml) vyhledávačům Seznam.cz a Bing přes
 * IndexNow (po nasazení nové verze). Přístup: hlavička `Authorization: Bearer <ELDOCK_CRON_SECRET>` nebo přihlášený
 * velín; přihlašovací brána cestu propouští, ověření je tady.
 */
export async function POST(request: Request) {
  const secret = brandEnv("CRON_SECRET");
  const bearer = secret && request.headers.get("authorization") === `Bearer ${secret}`;
  const superadmin = await isSuperadminToken((await cookies()).get(SUPERADMIN_COOKIE)?.value);
  if (!bearer && !superadmin) return Response.json({ error: "Neplatný token – použijte Authorization: Bearer <ELDOCK_CRON_SECRET> nebo přihlášení velínu." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const urls = publicUrls();
  const results = await pingIndexNow(urls);
  return Response.json({ urls: urls.length, results }, { status: results.some((result) => result.ok) ? 200 : 502, headers: { "Cache-Control": "no-store" } });
}
