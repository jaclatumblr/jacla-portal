// app/debug-auth/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SessionInfo = {
  userId: string | null;
  email: string | null;
} | null;

export default function DebugAuthPage() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      console.log("DebugAuth session:", data.session, "error:", error);

      if (data.session) {
        setSessionInfo({
          userId: data.session.user.id,
          email: data.session.user.email ?? null,
        });
      } else {
        setSessionInfo(null);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <div className="bg-white border rounded-lg shadow-sm p-4 w-full max-w-md text-sm">
        <h1 className="text-lg font-semibold mb-3">Debug: Auth Session</h1>
        {loading ? (
          <div>チェック中...</div>
        ) : sessionInfo ? (
          <div className="space-y-1">
            <div>セッションがあります。</div>
            <div>userId: {sessionInfo.userId}</div>
            <div>email: {sessionInfo.email}</div>
          </div>
        ) : (
          <div>セッションがありません。</div>
        )}
      </div>
    </main>
  );
}
