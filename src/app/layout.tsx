import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // metadataBase resolves the relative OG image to an absolute URL for scrapers.
  // Primary domain after the softballhelper.com -> dugoutadmin.com cutover.
  metadataBase: new URL("https://dugoutadmin.com"),
  title: "Dugout Admin",
  description: "Multi-tenant league management for baseball, softball & kickball",
  openGraph: {
    title: "Dugout Admin",
    description: "Multi-tenant league management for baseball, softball & kickball",
    siteName: "Dugout Admin",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Dugout Admin" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dugout Admin",
    description: "Multi-tenant league management for baseball, softball & kickball",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
