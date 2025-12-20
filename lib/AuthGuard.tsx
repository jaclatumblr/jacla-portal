// lib/AuthGuard.tsx
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    if (loading || !session) return;
    if (pathname === "/onboarding") return;

    let cancelled = false;
    (async () => {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, part, leader")
        .eq("id", session.user.id)
        .maybeSingle();

      const { data: leadersData, error: leadersError } = await supabase
        .from("profile_leaders")
        .select("leader")
        .eq("profile_id", session.user.id);

      if (cancelled) return;
      const leaders = (leadersData ?? [])
        .map((row) => (row as { leader?: string }).leader)
        .filter((role) => role && role !== "none") as string[];
      const isAdmin =
        leaders.includes("Administrator") ||
        (!leadersError && leaders.length === 0 && profileData?.leader === "Administrator") ||
        (leadersError && profileData?.leader === "Administrator");
      const needsOnboarding =
        !!profileError ||
        !profileData ||
        !profileData.display_name ||
        profileData.display_name.trim().length === 0 ||
        (!isAdmin && (!profileData.part || profileData.part === "none"));

      if (needsOnboarding) {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
        router.replace(`/onboarding${next}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, session, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Checking session...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
