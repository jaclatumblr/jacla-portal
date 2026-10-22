// app/debug-auth/page.tsx
"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function DebugAuthPage() {
  const { session, loading } = useAuth();
  const sessionInfo = session ? { userId: session.user.id, email: session.user.email ?? null } : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card/50 border border-border rounded-lg shadow-sm p-4 w-full max-w-md text-sm">
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
