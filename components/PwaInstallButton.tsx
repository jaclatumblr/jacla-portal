"use client";

import { useEffect, useState } from "react";
import { Download } from "@/lib/icons";
import { toast } from "@/lib/toast";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_STORAGE_KEY = "jacla:pwa:installed";

const rememberInstallation = (installed: boolean) => {
  try {
    if (installed) window.localStorage.setItem(INSTALL_STORAGE_KEY, "1");
    else window.localStorage.removeItem(INSTALL_STORAGE_KEY);
  } catch {
    // Installation detection also works when browser storage is unavailable.
  }
};

const hasInstallationRecord = () => {
  try {
    return window.localStorage.getItem(INSTALL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const isIosBrowser = () => {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
};

const isStandaloneMode = () => {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (typeof navigator !== "undefined" &&
      "standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
};

export function PwaInstallButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const syncInstallation = () => {
      const standalone = isStandaloneMode();
      if (standalone) rememberInstallation(true);
      setIsInstalled(standalone || hasInstallationRecord());
    };
    queueMicrotask(() => {
      if (cancelled) return;
      setIsIos(isIosBrowser());
      syncInstallation();
      setReady(true);
    });

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      // A fresh prompt means the browser allows installation again.
      rememberInstallation(false);
      setIsInstalled(isStandaloneMode());
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallEvent(null);
      rememberInstallation(true);
      setIsInstalled(true);
      toast.success("App installed.");
    };

    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
    const handleDisplayModeChange = syncInstallation;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === INSTALL_STORAGE_KEY || event.key === null) syncInstallation();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    mediaQuery?.addEventListener?.("change", handleDisplayModeChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", syncInstallation);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery?.removeEventListener?.("change", handleDisplayModeChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", syncInstallation);
    };
  }, []);

  const handleClick = async () => {
    if (isInstalled) {
      toast.info("Already installed.");
      return;
    }

    if (installEvent) {
      try {
        setInstalling(true);
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice.outcome === "accepted") {
          rememberInstallation(true);
          setIsInstalled(true);
        } else {
          toast.info("Install prompt dismissed.");
        }
      } catch (error) {
        console.error("PWA install failed", error);
        toast.error("Could not start install.");
      } finally {
        setInstallEvent(null);
        setInstalling(false);
      }
      return;
    }

    if (isIos) {
      toast.info('Open Safari share menu and choose "Add to Home Screen".');
      return;
    }

    toast.info("Install prompt is not available yet. Open the production build and try again.");
  };

  if (!ready || isInstalled) return null;

  const label = installEvent
      ? "Install App"
      : isIos
        ? "Add to Home Screen"
        : "Install";

  const toneClass = "border-border bg-background/80 text-foreground hover:border-primary hover:text-primary";

  return (
    <button
      type="button"
      onClick={() => {
        void handleClick();
      }}
      disabled={installing}
      className={`w-full rounded border px-8 py-3 text-center font-medium transition-colors sm:w-auto ${toneClass} ${installing ? "cursor-wait opacity-70" : ""}`}
      aria-label={label}
    >
      <span className="inline-flex items-center justify-center gap-2">
        <Download className="h-4 w-4" />
        {installing ? "Installing..." : label}
      </span>
    </button>
  );
}
