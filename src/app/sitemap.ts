import type { MetadataRoute } from "next";

import { PUBLIC_PAGES, absoluteUrl } from "@/lib/seo";

// sitemap.xml (fáze 48): jen veřejné vstupní stránky.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PAGES.map((page) => ({ url: absoluteUrl(page.path), lastModified, changeFrequency: page.changeFrequency, priority: page.priority }));
}
