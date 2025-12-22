"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { emailPolicyMessage, getUserEmail, isAllowedEmail, isGmailAddress } from "@/lib/authEmail";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    const errorDescription = searchParams.get("error_description");

    if (errorDescription) {
      router.replace(
        `/login?error=${encodeURIComponent(decodeURIComponent(errorDescription))}`
      );
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      router.replace(
        `/login?error=${encodeURIComponent("ログイン情報を確認できませんでした。")}`
      );
    }, 8000);

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
      if (!session) return;
      const email = getUserEmail(session.user ?? null);
      if (isAllowedEmail(email)) {
        router.replace("/");
        return;
      }
      if (isGmailAddress(email) && session.user?.id) {
        const isAdmin = await isAdminUser(session.user.id);
        if (isAdmin) {
          router.replace("/");
          return;
        }
      }
      await supabase.auth.signOut();
      router.replace(`/login?error=${encodeURIComponent(emailPolicyMessage)}`);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) {
        window.clearTimeout(timeoutId);
        void handleSession(session);
      }
    });

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error) {
        console.error(error);
        window.clearTimeout(timeoutId);
        router.replace(`/login?error=${encodeURIComponent("ログインに失敗しました。")}`);
        return;
      }

      if (data.session) {
        window.clearTimeout(timeoutId);
        await handleSession(data.session);
        return;
      }

      // onAuthStateChange で拾えない場合に備えて待つ
    })();

    return () => {
      cancelled = true;
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
