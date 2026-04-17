import type { Metadata } from "next";
import { Roboto, Bebas_Neue } from "next/font/google";
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
    <html lang="en" className={`dark ${roboto.variable} ${bebasNeue.variable}`}>
      <body className={roboto.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
