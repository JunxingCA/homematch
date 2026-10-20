import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { PwaProvider } from "@/components/PwaSupport";
import "./globals.css";
const bodyFont = localFont({
  src: "./fonts/SchibstedGrotesk.ttf",
  variable: "--font-body",
  weight: "400 900",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});
const displayFont = localFont({
  src: "./fonts/BricolageGrotesque.ttf",
  variable: "--font-display",
  weight: "200 800",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});
export const metadata: Metadata = {
  title: "HomeMatch | Find your area",
  description: "Find the Singapore area that fits your everyday life.",
  applicationName: "HomeMatch",
  appleWebApp: { capable: true, title: "HomeMatch", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/pwa/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [
      { url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};
export const viewport: Viewport = { themeColor: "#101a2e" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
