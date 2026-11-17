import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { TimeZoneSync } from "@/components/shared/time-zone-sync";
import { NavigationProgress } from "@/components/shared/navigation-progress";
import { siteConfig } from "@/config/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${siteConfig.name} — IT Jobs in the US and Canada`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" className={inter.variable}>
      <body className="min-h-dvh font-sans antialiased">
        <TimeZoneSync />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
