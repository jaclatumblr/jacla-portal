import type { MetadataRoute } from "next";
import { siteTitle } from "@/lib/pageTitles";
import { PWA_BACKGROUND_COLOR, PWA_THEME_COLORS } from "@/lib/pwaTheme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteTitle,
    short_name: "Jacla",
    description: "Jacla member portal for Tokyo University of Technology.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLORS.light,
    lang: "ja",
    categories: ["education", "music", "productivity"],
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
