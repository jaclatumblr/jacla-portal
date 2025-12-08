// app/login/page.tsx
"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();

  // すでにログイン済みならホームに飛ばす
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/"); 
      }
    })();
  }, [router]);

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin, // ログイン後のリダイレクト先
      },
    });
    if (error) {
      console.error(error);
      alert("ログインに失敗しました");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <div className="bg-white border rounded-lg shadow-sm p-6 w-full max-w-sm">
        <h1 className="text-lg font-semibold mb-4 text-center">Jacla Portal ログイン</h1>
        <button
          onClick={handleGoogleLogin}
          className="w-full border rounded px-4 py-2 text-sm bg-black text-white"
        >
          Googleでログイン
        </button>
      </div>
    </main>
  );
}
