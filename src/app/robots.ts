import type { MetadataRoute } from "next";

import { PRIVATE_PATHS, SEARCH_BOTS, SITE_URL } from "@/lib/seo";

// robots.txt (fáze 48, fáze 96): indexace výslovně povolená klíčovým robotům (Google, Seznam, Bing a AI vyhledávače),
// zakázané jen interní API a velín.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: [...PRIVATE_PATHS] })),
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
