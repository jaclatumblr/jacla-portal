"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Shield, User } from "@/lib/icons";
import { AdministratorModeToggle } from "@/components/AdministratorModeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "administrator-mode-dock-open";
const COLLAPSED_TAB_WIDTH_CLASS = "translate-x-[calc(100%-1.5rem)]";

export function AdministratorModeDock() {
  const { canToggleMode, mode } = useAdminMode();
  const [isOpen, setIsOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    setIsOpen(saved !== "0");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, isOpen ? "1" : "0");
  }, [hydrated, isOpen]);

  if (!canToggleMode) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-0 z-[85] flex max-w-[calc(100vw-1rem)] items-end">
      <div
        className={cn(
          "pointer-events-auto transition-transform duration-300",
          isOpen ? "translate-x-0" : COLLAPSED_TAB_WIDTH_CLASS
        )}
      >
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="flex h-11 w-5 items-center justify-center rounded-l-xl border border-r-0 border-border/80 bg-card/95 text-foreground shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-colors hover:bg-surface-hover"
            aria-label={isOpen ? "モード切替を右にしまう" : "モード切替を開く"}
            title={isOpen ? "しまう" : "開く"}
          >
            {isOpen ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          </button>

          <div className="rounded-l-2xl rounded-r-none border border-border/80 border-r-0 bg-card/95 p-3 shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:rounded-r-2xl sm:border-r">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={mode === "administrator" ? "default" : "secondary"} className="gap-1.5">
                {mode === "administrator" ? (
                  <Shield className="h-3 w-3" />
                ) : (
                  <User className="h-3 w-3" />
                )}
                {mode === "administrator" ? "Administrator mode" : "General mode"}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <AdministratorModeToggle variant="outline" className="min-w-[220px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
