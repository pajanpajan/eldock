// Fáze 96: IndexNow – okamžité oznámení nových a změněných stránek vyhledávačům Seznam.cz a Bing (a partnerům
// protokolu: Yandex, Naver …) bez ruční registrace. Klíč je veřejný soubor `public/<klíč>.txt`. Čisté funkce + ping.

import { PUBLIC_PAGES, SITE_URL, absoluteUrl } from "./seo";

/** Pevný klíč IndexNow (32 znaků hex) = obsah i název souboru `public/<klíč>.txt`. */
export const INDEXNOW_KEY = "691cb2cf48b1a728710c6a7aa654013e";
export const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_HOST = new URL(SITE_URL).host;

/** Seznam.cz má vlastní koncový bod, api.indexnow.org předává adresy Bingu a dalším vyhledávačům protokolu. */
export const INDEXNOW_ENDPOINTS = ["https://search.seznam.cz/indexnow", "https://api.indexnow.org/indexnow"] as const;

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export interface IndexNowResult {
  endpoint: string;
  method: "POST" | "GET";
  status: number;
  /** 200 = přijato, 202 = přijato (ověření klíče probíhá). */
  ok: boolean;
  detail: string;
}

/** Veřejné stránky webu (stejný seznam jako sitemap.xml). */
export const publicUrls = () => PUBLIC_PAGES.map((page) => absoluteUrl(page.path));

export function indexNowPayload(urls: readonly string[]): IndexNowPayload {
  const own = urls.filter((url) => new URL(url).host === INDEXNOW_HOST);
  return { host: INDEXNOW_HOST, key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, urlList: [...new Set(own)].slice(0, 10_000) };
}

/** Oznámí adresy oběma koncovým bodům: POST se seznamem adres a GET s úvodní stránkou. */
export async function pingIndexNow(urls: readonly string[] = publicUrls(), fetcher: typeof fetch = fetch): Promise<IndexNowResult[]> {
  const payload = indexNowPayload(urls);
  const results: IndexNowResult[] = [];
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    const attempts: { method: "POST" | "GET"; run: () => Promise<Response> }[] = [
      { method: "POST", run: () => fetcher(endpoint, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000) }) },
      { method: "GET", run: () => fetcher(`${endpoint}?url=${encodeURIComponent(payload.urlList[0] ?? SITE_URL)}&key=${INDEXNOW_KEY}`, { signal: AbortSignal.timeout(20_000) }) },
    ];
    for (const attempt of attempts) {
      try {
        const response = await attempt.run();
        const text = (await response.text().catch(() => "")).trim().slice(0, 200);
        results.push({ endpoint, method: attempt.method, status: response.status, ok: response.status === 200 || response.status === 202, detail: text });
      } catch (error) {
        results.push({ endpoint, method: attempt.method, status: 0, ok: false, detail: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return results;
}
