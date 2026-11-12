import type { MetadataRoute } from "next";

import { PRIVATE_PATHS, SEARCH_BOTS, SITE_URL } from "@/lib/seo";
import { SCRAPER_ROBOTS } from "@/lib/request-guard";

// robots.txt (fáze 48, fáze 96): indexace výslovně povolená klíčovým robotům (Google, Seznam, Bing a AI vyhledávače),
// zakázané jen interní API a velín.
export default function robots(): MetadataRoute.Robots {
  return {
    // Fáze 104: programy na kopírování webů – zákaz celého webu (neslušné roboty zastaví brána `proxy.ts` s 403)
    rules: [...SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: [...PRIVATE_PATHS] })), ...SCRAPER_ROBOTS.map((userAgent) => ({ userAgent, disallow: "/" }))],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
