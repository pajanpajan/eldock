import type { MetadataRoute } from "next";

import { BRAND_DARK } from "@/lib/brand-icon";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Digitry – elektrodokumentace a údržba",
    short_name: "Digitry",
    description: "Elektrodokumentace výrobních závodů a schvalování změn As-Built mezi údržbou a CAE.",
    lang: "cs",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: BRAND_DARK,
    theme_color: BRAND_DARK,
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "CAE Back-Office", url: "/cae", description: "Tickety požadavků na změnu" },
    ],
  };
}
