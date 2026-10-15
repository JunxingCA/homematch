import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { PwaProvider } from "@/components/PwaSupport";
import "./globals.css";
const bodyFont = localFont({
  src: "./fonts/DMSans.ttf",
  variable: "--font-body",
  weight: "100 1000",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});
const scriptFont = localFont({
  src: "./fonts/PlaywriteGBS.ttf",
  variable: "--font-script",
  weight: "100 400",
  display: "swap",
  fallback: ["Georgia", "serif"],
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
export const viewport: Viewport = { themeColor: "#151313" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-palette="red"
      className={`${bodyFont.variable} ${scriptFont.variable}`}
    >
      <body>
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
