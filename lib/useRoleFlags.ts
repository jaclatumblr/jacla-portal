"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

type RoleFlagsResult = {
  isAdministrator: boolean;
  isSupervisor: boolean;
  isPaLeader: boolean;
  isLightingLeader: boolean;
  isAdmin: boolean;
  canAccessAdmin: boolean;
  loading: boolean;
  error: string | null;
};

export function useRoleFlags(): RoleFlagsResult {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState(() => ({
    isAdministrator: false,
    isSupervisor: false,
    isPaLeader: false,
    isLightingLeader: false,
    isAdmin: false,
    canAccessAdmin: false,
  }));

  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    (async () => {
      const { data: leadersData, error: leadersError } = await supabase
        .from("profile_leaders")
        .select("leader")
        .eq("profile_id", userId);

      if (cancelled) return;

      let leaders = (leadersData ?? [])
        .map((row) => (row as { leader?: string }).leader)
        .filter((role) => role && role !== "none") as string[];

      if (leadersError || leaders.length === 0) {
        if (leadersError) {
          console.error(leadersError);
        }
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("leader")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (profileError) {
          console.error(profileError);
          setError("権限の取得に失敗しました。");
          setLoading(false);
          return;
        }
        const leader = (data as { leader?: string } | null)?.leader;
        if (leader && leader !== "none") {
          leaders = [leader];
        }
      }

      const isAdministrator = leaders.includes("Administrator");
      const isSupervisor = leaders.includes("Supervisor");
      const isPaLeader = leaders.includes("PA Leader");
      const isLightingLeader = leaders.includes("Lighting Leader");
      const isAdmin = isAdministrator || isSupervisor;
      const canAccessAdmin = isAdmin || isPaLeader || isLightingLeader;

      setFlags({
        isAdministrator,
        isSupervisor,
        isPaLeader,
        isLightingLeader,
        isAdmin,
        canAccessAdmin,
      });
      setError(null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  return {
    ...flags,
    loading: authLoading || (userId ? loading : false),
    error: userId ? error : null,
  };
}
