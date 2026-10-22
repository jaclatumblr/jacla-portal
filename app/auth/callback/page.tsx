"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { safeSignOut, supabase } from "@/lib/supabaseClient";
import { emailPolicyMessage, getUserEmail, hasAllowedEmail, isGmailAddress } from "@/lib/authEmail";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    let receivedEvent = false;
    let activeUser: string | null = null;
    const pending = new Set<number>();
    const errorDescription = searchParams.get("error_description");

    if (errorDescription) {
      router.replace(
        `/login?error=${encodeURIComponent(errorDescription)}`
      );
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      generation++;
      router.replace(
        `/login?error=${encodeURIComponent("ログイン情報を確認できませんでした。")}`
      );
    }, 8000);

    const finish = (path: string) => {
      if (cancelled) return;
      cancelled = true;
      generation++;
      window.clearTimeout(timeoutId);
      router.replace(path);
    };

    const isAdminUser = async (userId: string) => {
      const { data: leadersData, error: leadersError } = await supabase
        .from("profile_leaders")
        .select("leader")
        .eq("profile_id", userId);
      if (!leadersError) {
        const leaders = (leadersData ?? [])
          .map((row) => (row as { leader?: string }).leader)
          .filter((role) => role && role !== "none") as string[];
        if (leaders.includes("Administrator")) return true;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("leader")
        .eq("id", userId)
        .maybeSingle();
      if (!profileError) {
        return (profileData as { leader?: string } | null)?.leader === "Administrator";
      }

      return false;
    };

    const handleSession = async (session: Session | null) => {
      if (!session || cancelled) return;
      const current = generation;
      const stale = () => cancelled || current !== generation;
      const email = getUserEmail(session.user ?? null);
      if (hasAllowedEmail(session.user ?? null)) {
        finish("/");
        return;
      }
      if (isGmailAddress(email) && session.user?.id) {
        const isAdmin = await isAdminUser(session.user.id);
        if (stale()) return;
        if (isAdmin) {
          finish("/");
          return;
        }
      }
      if (stale()) return;
      await safeSignOut();
      if (stale()) return;
      finish(`/login?error=${encodeURIComponent(emailPolicyMessage)}`);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      receivedEvent = true;
      if (activeUser === session?.user.id) return;
      activeUser = session?.user.id ?? null;
      generation++;
      if (!session) return;
      const scheduledGeneration = generation;
      const timer = window.setTimeout(() => {
        pending.delete(timer);
        if (cancelled || scheduledGeneration !== generation) return;
        void handleSession(session).catch(() => {
          if (!cancelled && scheduledGeneration === generation) finish("/login?error=Authentication%20failed");
        });
      }, 0);
      pending.add(timer);
    });

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled || receivedEvent) return;

      if (error) {
        console.error(error);
        window.clearTimeout(timeoutId);
        finish(`/login?error=${encodeURIComponent("ログインに失敗しました。")}`);
        return;
      }

      if (data.session) {
        activeUser = data.session.user.id;
        await handleSession(data.session);
        return;
      }

      // onAuthStateChange で拾えない場合に備えて待つ
    })().catch(() => {
      if (!cancelled && !receivedEvent) finish("/login?error=Authentication%20failed");
    });

    return () => {
      cancelled = true;
      generation++;
      pending.forEach((timer) => window.clearTimeout(timer));
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, [router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">ログイン処理中...</div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-sm text-muted-foreground">ログイン処理中...</div>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
