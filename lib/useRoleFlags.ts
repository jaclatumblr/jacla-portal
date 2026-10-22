"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { fetchLeaderRoles } from "@/lib/leaderRoles";
import { supabase } from "@/lib/supabaseClient";

type RoleFlagsResult = {
  isAdministrator: boolean;
  isSupervisor: boolean;
  isPaLeader: boolean;
  isLightingLeader: boolean;
  isPartLeader: boolean;
  isAdmin: boolean;
  canAccessAdmin: boolean;
  canViewHandover: boolean;
  loading: boolean;
  error: string | null;
};

export function useRoleFlags(): RoleFlagsResult {
  const { session, loading: authLoading } = useAuth();
  const { suppressPrivilegedAccess, loading: modeLoading } = useAdminMode();
  const userId = session?.user.id;
  const [owner, setOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState(() => ({
    isAdministrator: false,
    isSupervisor: false,
    isPaLeader: false,
    isLightingLeader: false,
    isPartLeader: false,
    isAdmin: false,
    canAccessAdmin: false,
    canViewHandover: false,
  }));

  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setOwner(null);
      setLoading(true);
      setError(null);
      let leaders: string[] = [];
      try {
        leaders = await fetchLeaderRoles(userId);
      } catch (leaderError) {
        if (cancelled) return;
        console.error(leaderError);
        setError("権限情報の取得に失敗しました。");
        setOwner(userId);
        setFlags({ isAdministrator: false, isSupervisor: false, isPaLeader: false, isLightingLeader: false, isPartLeader: false, isAdmin: false, canAccessAdmin: false, canViewHandover: false });
        setLoading(false);
        return;
      }

      if (cancelled) return;

      const isAdministrator = leaders.includes("Administrator");
      const isSupervisor = leaders.includes("Supervisor");
      const isPaLeader = leaders.includes("PA Leader");
      const isLightingLeader = leaders.includes("Lighting Leader");
      const isPartLeader = leaders.includes("Part Leader");
      const isAdmin = isAdministrator || isSupervisor;
      const canAccessAdmin = isAdmin || isPaLeader || isLightingLeader;
      let canViewHandover = canAccessAdmin;
      if (!canViewHandover) {
        try {
          const { data, error: positionError } = await supabase
            .from("profile_positions")
            .select("position")
            .eq("profile_id", userId)
            .eq("position", "Treasurer");
          if (positionError) {
            console.error(positionError);
          } else {
            canViewHandover = (data ?? []).some((row) => row.position === "Treasurer");
          }
        } catch (positionError) {
          console.error(positionError);
        }
      }
      if (cancelled) return;

      setFlags({
        isAdministrator,
        isSupervisor,
        isPaLeader,
        isLightingLeader,
        isPartLeader,
        isAdmin,
        canAccessAdmin,
        canViewHandover,
      });
      setError(null);
      setOwner(userId);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  return {
    ...(suppressPrivilegedAccess || authLoading || !userId || owner !== userId || loading
      ? {
          isAdministrator: false,
          isSupervisor: false,
          isPaLeader: false,
          isLightingLeader: false,
          isPartLeader: false,
          isAdmin: false,
          canAccessAdmin: false,
          canViewHandover: false,
        }
      : flags),
    loading: authLoading || modeLoading || (userId ? loading || owner !== userId : false),
    error: userId && owner === userId ? error : null,
  };
}
