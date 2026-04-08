"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { MoonStar, SunMedium } from "@/lib/icons";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  THEME_TRANSITION_BUFFER_MS,
  THEME_TRANSITION_END_EVENT,
  THEME_TRANSITION_MS,
  THEME_TRANSITION_START_EVENT,
} from "@/lib/themeTransition";
import { cn } from "@/lib/utils";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void | Promise<void>) => {
    finished: Promise<void>;
  };
};

type ThemeToggleProps = {
  compact?: boolean;
  className?: string;
  variant?: "secondary" | "ghost" | "outline";
};

export function ThemeToggle({
  compact = false,
  className,
  variant = "secondary",
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const nextTheme = mounted && resolvedTheme === "dark" ? "light" : "dark";
  const label = mounted
    ? nextTheme === "dark"
      ? "ダークモードへ"
      : "ライトモードへ"
    : "テーマ切替";
  const Icon = mounted ? (nextTheme === "dark" ? MoonStar : SunMedium) : SunMedium;

  const handleToggle = () => {
    const documentWithTransition = document as DocumentWithViewTransition;
    window.dispatchEvent(new CustomEvent(THEME_TRANSITION_START_EVENT));

    if (documentWithTransition.startViewTransition) {
      void documentWithTransition
        .startViewTransition(() => {
          setTheme(nextTheme);
        })
        ?.finished.finally(() => {
          window.dispatchEvent(new CustomEvent(THEME_TRANSITION_END_EVENT));
        });
      return;
    }

    document.documentElement.classList.add("theme-transition");
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
      timeoutRef.current = null;
      window.dispatchEvent(new CustomEvent(THEME_TRANSITION_END_EVENT));
    }, THEME_TRANSITION_MS + THEME_TRANSITION_BUFFER_MS);
    setTheme(nextTheme);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={compact ? "icon" : "default"}
      onClick={handleToggle}
      aria-label={label}
      title={compact ? label : undefined}
      disabled={!mounted}
      className={cn(compact ? "h-10 w-10" : "w-full justify-start", className)}
    >
      <Icon className="h-4 w-4" />
      {!compact && <span>{label}</span>}
    </Button>
  );
}
