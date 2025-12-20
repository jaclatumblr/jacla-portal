"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

type AdminHookResult = {
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
};

export function useIsAdmin(): AdminHookResult {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    if (!userId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    supabase
      .from("profiles")
      .select("leader")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
          setIsAdmin(false);
          setError("権限の確認に失敗しました");
        } else {
          const leader = (data as { leader?: string } | null)?.leader;
          setIsAdmin(leader === "Administrator" || leader === "Supervisor");
          setError(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  return {
    isAdmin: userId ? isAdmin : false,
    loading: authLoading || (userId ? loading : false),
    error: userId ? error : null,
  };
}
