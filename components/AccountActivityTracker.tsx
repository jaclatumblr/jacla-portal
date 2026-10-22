"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

/** Records real, visible use; background timers only check access, never extend activity. */
export function AccountActivityTracker() {
  const { session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const tokenRef = useRef(session?.access_token);
  const userId = session?.user.id;
  useEffect(() => { tokenRef.current = session?.access_token; }, [session?.access_token]);
  useEffect(() => {
    if (!userId || !pathname || pathname.startsWith("/auth/") || pathname === "/login") return;
    let disposed = false;
    let lastRecorded = 0;
    let inFlight = false;
    let queuedActivity = false;
    const controller = new AbortController();
    const check = async (activity: boolean, retried = false) => {
      if (disposed || document.visibilityState !== "visible") return;
      if (inFlight) { queuedActivity ||= activity; return; }
      if (activity && Date.now() - lastRecorded < 15 * 60 * 1000) return;
      inFlight = true;
      const requestController = new AbortController();
      const abort = () => requestController.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 10000);
      try {
        const requestToken = tokenRef.current;
        const response = await fetch("/api/account/activity", {
          method: activity ? "POST" : "GET", cache: "no-store", signal: requestController.signal,
          headers: { Authorization: `Bearer ${requestToken}` },
        });
        if (disposed || requestToken !== tokenRef.current) return;
        if (response.status === 401 && !retried) {
          // A suspended mobile tab can resume before the SDK refreshes its old JWT.
          const { data, error } = await supabase.auth.refreshSession();
          if (disposed) return;
          if (error && (error.status === 0 || (error.status ?? 0) >= 500 || error.name === "AuthRetryableFetchError")) return;
          if (!error && data.session) {
            if (data.session.user.id !== userId) return;
            tokenRef.current = data.session.access_token;
            inFlight = false;
            await check(activity, true);
            return;
          }
        }
        if (response.status === 403 || response.status === 401) {
          // Local sign-out avoids using a revoked token to call global sign-out.
          const message = response.status === 403
            ? "アカウントの利用が停止されています。復帰は管理者にお問い合わせください。"
            : "ログインを確認できません。再ログインできない場合は管理者にお問い合わせください。";
          router.replace(`/login?error=${encodeURIComponent(message)}`);
          await supabase.auth.signOut({ scope: "local" });
        } else if (response.ok && activity) {
          lastRecorded = Date.now();
        }
      } catch { /* A temporary network failure does not sign the user out. */ }
      finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener("abort", abort);
        inFlight = false;
        if (queuedActivity && !disposed) { queuedActivity = false; void check(true); }
      }
    };
    const activity = () => { void check(true); };
    const focus = () => { void check(Date.now() - lastRecorded >= 15 * 60 * 1000); };
    activity();
    window.addEventListener("pointerdown", activity, { passive: true });
    window.addEventListener("keydown", activity);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const timer = window.setInterval(() => { void check(false); }, 60000);
    return () => {
      disposed = true; controller.abort(); window.clearInterval(timer);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [userId, pathname, router]);
  return null;
}
