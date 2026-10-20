import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HomeMatch",
    short_name: "HomeMatch",
    description: "Find the Singapore area that fits your everyday life.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#101a2e",
    theme_color: "#101a2e",
    lang: "en-SG",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
