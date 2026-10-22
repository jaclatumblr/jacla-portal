"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { readSessionValue, writeSessionValue } from "@/lib/browserStorage";

type AuthContextType = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let authVersion = 0;
    let activeUserId: string | null = null;
    const pendingLogs = new Set<string>();
    const completedLogs = new Set<string>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    // Older versions used an access token as the marker key. Remove those
    // legacy copies without reading or logging their contents.
    try {
      for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
        const key = window.sessionStorage.key(index);
        if (key?.startsWith("loginLogged:") && key.slice("loginLogged:".length).includes(".")) window.sessionStorage.removeItem(key);
      }
    } catch { /* Login must also work with browser storage disabled. */ }
    const logLoginHistory = async (nextSession: Session | null) => {
      if (cancelled || !nextSession?.user?.id || activeUserId !== nextSession.user.id) return;
      const storageKey = `loginLogged:${nextSession.user.id}:${nextSession.expires_at ?? "session"}`;
      if (readSessionValue(storageKey) || pendingLogs.has(storageKey) || completedLogs.has(storageKey)) return;
      pendingLogs.add(storageKey);

      try {
        const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const { error } = await supabase.from("login_history").insert([
          {
            user_id: nextSession.user.id,
            email: nextSession.user.email ?? null,
            user_agent: userAgent,
          },
        ]);
        if (error) {
          console.error("login_history insert failed", error);
          return;
        }
        completedLogs.add(storageKey);
        writeSessionValue(storageKey, "1");
      } finally {
        pendingLogs.delete(storageKey);
      }
    };

    // Load session on first mount.
    const initialVersion = authVersion;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("getSession error:", error);
      }
      if (!cancelled && authVersion === initialVersion) {
        activeUserId = data.session?.user.id ?? null;
        setSession(data.session ?? null);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled && authVersion === initialVersion) setLoading(false);
    });

    // Track auth state changes and log login history.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return;
      authVersion += 1;
      activeUserId = newSession?.user.id ?? null;
      setSession(newSession);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        // Run Supabase queries outside the synchronous auth callback.
        const timer = setTimeout(() => {
          timers.delete(timer);
          void logLoginHistory(newSession).catch(() => { console.error("login_history insert failed"); });
        }, 0);
        timers.add(timer);
      }
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
