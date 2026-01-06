"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

type UpdateAccessResult = {
  canManageUpdates: boolean;
  loading: boolean;
  error: string | null;
};

export function useCanManageUpdates(): UpdateAccessResult {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canManageUpdates, setCanManageUpdates] = useState(false);

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
          setError("権限の確認に失敗しました。");
          setLoading(false);
          return;
        }

        const leader = (data as { leader?: string } | null)?.leader;
        if (leader && leader !== "none") {
          leaders = [leader];
        }
      }

      const isAdministrator = leaders.includes("Administrator");

      const { data: positionsData, error: positionsError } = await supabase
        .from("profile_positions")
        .select("position")
        .eq("profile_id", userId)
        .eq("position", "Web Secretary");

      if (cancelled) return;

      if (positionsError) {
        console.error(positionsError);
      }

      const isWebSecretary = (positionsData ?? []).some(
        (row) => (row as { position?: string }).position === "Web Secretary"
      );

      setCanManageUpdates(isAdministrator || isWebSecretary);
      setError(null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  return {
    canManageUpdates: userId ? canManageUpdates : false,
    loading: authLoading || (userId ? loading : false),
    error: userId ? error : null,
  };
}
