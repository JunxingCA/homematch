import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "HomeMatch | Your preferences",
  description: "Find the Singapore area that fits your everyday life.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
