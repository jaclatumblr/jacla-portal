"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { PWA_APPLE_STATUS_BAR_STYLES, PWA_THEME_COLORS } from "@/lib/pwaTheme";

const SERVICE_WORKER_URL = "/sw.js";

export function PwaRegistrar() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const theme = resolvedTheme === "dark" ? "dark" : "light";
    const themeColor = PWA_THEME_COLORS[theme];
    const appleStatusBarStyle = PWA_APPLE_STATUS_BAR_STYLES[theme];

    let themeColorMeta = document.querySelector(
      'meta[name="theme-color"][data-pwa-sync="true"]'
    ) as HTMLMetaElement | null;

    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      themeColorMeta.setAttribute("data-pwa-sync", "true");
      document.head.appendChild(themeColorMeta);
    }

    themeColorMeta.content = themeColor;

    let appleStatusBarMeta = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]'
    ) as HTMLMetaElement | null;

    if (!appleStatusBarMeta) {
      appleStatusBarMeta = document.createElement("meta");
      appleStatusBarMeta.name = "apple-mobile-web-app-status-bar-style";
      document.head.appendChild(appleStatusBarMeta);
    }

    appleStatusBarMeta.content = appleStatusBarStyle;
  }, [resolvedTheme]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
          scope: "/",
        });

        registration.update().catch(() => undefined);
      } catch (error) {
        console.error("Failed to register service worker", error);
      }
    };

    if (document.readyState === "complete") {
      void register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
