import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TimeZoneSync } from "@/components/shared/time-zone-sync";
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
        {children}
      </body>
    </html>
  );
}
