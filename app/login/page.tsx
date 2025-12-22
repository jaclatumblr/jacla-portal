// app/login/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Chrome, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

function getAuthCallbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryError = (() => {
    const value = searchParams.get("error");
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  const errorMessage = error ?? queryError;

  // すでにログイン済みならホームに飛ばす
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) console.error(error);
      if (data.session) {
        setIsRedirecting(true);
        router.replace("/");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthCallbackUrl(),
        queryParams: {
          // アカウント選択を毎回表示
          prompt: "select_account",
        },
      },
    });

    if (error) {
      console.error(error);
      setError("Googleログインに失敗しました。");
      setIsLoading(false);
    }
  };

  const showFullscreenLoader = isLoading || isRedirecting;

  return (
    <div className="min-h-screen flex relative">
      <div className="hidden lg:flex lg:w-1/2 relative bg-card overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />

        <div className="absolute inset-0 opacity-5">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
              backgroundSize: "80px 80px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-center p-12 lg:p-16">
          <div className="mb-8">
            <Image
              src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
              alt="jacla logo"
              width={120}
              height={72}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold mb-4">
            <span className="text-foreground">総合音楽部</span>
            <span className="block text-primary mt-2">jacla</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
            部員専用ポータルサイトへようこそ。イベント管理、レパートリー提出、PA/照明機材の管理など、サークル活動をサポートします。
          </p>

          <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-primary/30" />
          <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-primary/30" />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Image
              src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
              alt="jacla logo"
              width={80}
              height={48}
              className="mx-auto object-contain mb-4"
              priority
            />
            <h1 className="text-2xl font-bold">
              <span className="text-foreground">総合音楽部 </span>
              <span className="text-primary">jacla</span>
            </h1>
          </div>

          <div className="space-y-6">
            <div className="text-center lg:text-left">
              <span className="text-xs text-primary tracking-[0.3em] font-mono">
                LOGIN
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold mt-2">ログイン</h2>
              <p className="text-muted-foreground mt-2">
                大学アカウントでログインしてください
              </p>
            </div>

            {errorMessage && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                {errorMessage}
              </div>
            )}

            <>
              <Button
                variant="outline"
                className="w-full h-12 bg-card/50 border-border hover:bg-card hover:border-primary/50 transition-all"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Chrome className="w-5 h-5 mr-3" />
                    Googleでログイン
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                edu.teu.ac.jp のアカウントでログインしてください
              </p>

              <p className="text-xs text-muted-foreground text-center">
                ログインすることで、
                <Link href="/terms" className="text-primary hover:underline">
                  利用規約
                </Link>
                と
                <Link href="/privacy" className="text-primary hover:underline">
                  プライバシーポリシー
                </Link>
                に同意したことになります。
              </p>
            </>
          </div>
        </div>
      </div>

      {showFullscreenLoader && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card shadow-lg">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-foreground">ログイン処理中です…</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-sm text-muted-foreground">読み込み中...</div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
