"use client";

import { useEffect } from "react";

const SERVICE_WORKER_URL = "/sw.js";

export function PwaRegistrar() {
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
