import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { BrokenImageGuard } from "@/components/common/BrokenImageGuard";
import { ConsentManager } from "@/components/consent/ConsentManager";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BRAND } from "@/lib/brand";
import { SEO_DESCRIPTION, SEO_KEYWORDS, SEO_TITLE, SITE_URL, jsonLdScript, siteJsonLd } from "@/lib/seo";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  // Absolutní URL pro OpenGraph / Twitter obrázky a canonical (fáze 48)
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} – ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  keywords: SEO_KEYWORDS,
  authors: [{ name: BRAND.mark, url: SITE_URL }],
  creator: BRAND.mark,
  openGraph: { type: "website", locale: "cs_CZ", siteName: BRAND.mark, title: SEO_TITLE, description: SEO_DESCRIPTION, url: SITE_URL },
  twitter: { card: "summary_large_image", title: SEO_TITLE, description: SEO_DESCRIPTION },
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // Fáze 96: ověření vlastnictví webu v Google Search Console a Seznam Webmaster (hodnoty z prostředí serveru)
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION, other: process.env.SEZNAM_WMT_VERIFICATION ? { "seznam-wmt": process.env.SEZNAM_WMT_VERIFICATION } : {} },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="cs"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="bg-blueprint flex min-h-full flex-col">
        {/* Fáze 96: strukturovaná data webu – Organization, WebSite a SoftwareApplication (schema.org) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd()) }} />
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-center" />
        {/* Fáze 99: žádná ikona rozbitého obrázku (globální pojistka k vektorovým náhledům katalogu) */}
        <BrokenImageGuard />
        {/* Fáze 56: souhlas s cookies – volitelné služby podle konfigurace serveru (ELDOCK_GA4_ID přes /api/consent) */}
        <ConsentManager />
      </body>
    </html>
  );
}
