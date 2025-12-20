"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

type AdministratorHookResult = {
  isAdministrator: boolean;
  loading: boolean;
  error: string | null;
};

export function useIsAdministrator(): AdministratorHookResult {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const [isAdministrator, setIsAdministrator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const leaders = (leadersData ?? [])
        .map((row) => (row as { leader?: string }).leader)
        .filter((role) => role && role !== "none") as string[];

      let isAdminRole = leaders.includes("Administrator");

      if (leadersError || leaders.length === 0) {
        if (leadersError) {
          console.error(leadersError);
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("leader")
          .eq("id", userId)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.error(error);
          setIsAdministrator(false);
          setError("管理権限の確認に失敗しました。");
          setLoading(false);
          return;
        }

        const leader = (data as { leader?: string } | null)?.leader;
        isAdminRole = leader === "Administrator";
      }

      setIsAdministrator(isAdminRole);
      setError(null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  return {
    isAdministrator: userId ? isAdministrator : false,
    loading: authLoading || (userId ? loading : false),
    error: userId ? error : null,
  };
}
