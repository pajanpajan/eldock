import type { MetadataRoute } from "next";

import { PRIVATE_PATHS, PUBLIC_PAGES, SITE_URL } from "@/lib/seo";

// robots.txt (fáze 48): veřejné vstupní stránky ano, interní aplikační trasy ne.
// Konkrétnější pravidlo vyhrává, takže /panel-builder/auth zůstane povolené i při zákazu /panel-builder/.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: PUBLIC_PAGES.map((page) => page.path), disallow: PRIVATE_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
