"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) {
        window.clearTimeout(timeoutId);
        router.replace("/");
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
        router.replace("/");
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
