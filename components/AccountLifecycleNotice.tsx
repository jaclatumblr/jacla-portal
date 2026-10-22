"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
export function AccountLifecycleNotice() {
  const { session } = useAuth();
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void fetch("/api/admin/accounts?status=warning", { cache: "no-store", signal: controller.signal, headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) { setCount(data.accounts.length); setHasMore(data.hasMore); }
      }).catch(() => {});
    return () => controller.abort();
  }, [session]);
  if (!count) return null;
  return <div role="status" className="mb-6 rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
    <p>休眠の事前警告中の部員が{count}名{hasMore ? "以上" : ""}います。</p>
    <Link href="/admin/accounts?status=warning" className="mt-2 inline-block font-medium text-primary underline">対象者を確認する</Link>
  </div>;
}
