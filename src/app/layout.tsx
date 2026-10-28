import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppHeader } from "@/components/layout/AppHeader";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

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
  title: {
    default: "Digitry",
    template: "%s · Digitry",
  },
  description: "Elektrodokumentace a údržba výrobních závodů",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="cs"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="bg-blueprint flex min-h-full flex-col">
        <TooltipProvider delayDuration={200}>
          <AppHeader />
          <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 py-6 sm:px-6">{children}</main>
        </TooltipProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
