import type { Metadata } from "next";
import { Roboto, Bebas_Neue, Anton, Space_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
});
const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});
// Loaded for bespoke event landing pages (e.g. THE SEND). Tree-shaken
// off other routes by Next/font; safe to keep in the root layout.
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FFSA Hub",
  description: "Fire & Fragrance South Africa — Internal Operations Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${roboto.variable} ${bebasNeue.variable} ${anton.variable} ${spaceMono.variable}`}>
      <body className={roboto.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
