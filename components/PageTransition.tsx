"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [overlayVisible, setOverlayVisible] = useState(false);
  const isFirst = useRef(true);
  const transitioningRef = useRef(false);

  const overlayDurationMs = 400;
  const pageFadeMs = 480;

  const startTransition = (href: string) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setOverlayVisible(true);
    window.setTimeout(() => {
      router.push(href);
    }, overlayDurationMs);
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      if (anchor.hasAttribute("data-no-transition")) return;
      if (anchor.hasAttribute("download")) return;
      const targetAttr = anchor.getAttribute("target");
      if (targetAttr && targetAttr !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      event.preventDefault();
      startTransition(url.pathname + url.search + url.hash);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    setOverlayVisible(false);
    transitioningRef.current = false;
  }, [pathname]);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0 z-[70] bg-background transition-opacity",
          overlayVisible ? "opacity-100" : "opacity-0"
        )}
        style={{ transitionDuration: `${overlayDurationMs}ms` }}
      />
      <div
        key={pathname}
        className="page-fade-in"
        style={{ "--page-fade-duration": `${pageFadeMs}ms` } as CSSProperties}
      >
        {children}
      </div>
    </>
  );
}
