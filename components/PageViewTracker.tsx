"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

const eventIdPattern = /\/events\/([0-9a-fA-F-]{36})/;

const getEventIdFromPath = (path: string) => {
  const match = path.match(eventIdPattern);
  return match?.[1] ?? null;
};

export function PageViewTracker() {
  const { session } = useAuth();
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !pathname) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    const eventId = getEventIdFromPath(pathname);
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

    void supabase
      .from("page_views")
      .insert([
        {
          user_id: userId,
          path: pathname,
          event_id: eventId,
          user_agent: userAgent,
        },
      ])
      .then(({ error }) => {
        if (error) {
          console.error("page view log failed", error);
        }
      });
  }, [pathname, session?.user.id]);

  return null;
}
