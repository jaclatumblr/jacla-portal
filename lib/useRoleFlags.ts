"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { fetchLeaderRoles } from "@/lib/leaderRoles";

type RoleFlagsResult = {
  isAdministrator: boolean;
  isSupervisor: boolean;
  isPaLeader: boolean;
  isLightingLeader: boolean;
  isPartLeader: boolean;
  isAdmin: boolean;
  canAccessAdmin: boolean;
  loading: boolean;
  error: string | null;
};

export function useRoleFlags(): RoleFlagsResult {
  const { session, loading: authLoading } = useAuth();
  const { suppressPrivilegedAccess, loading: modeLoading } = useAdminMode();
  const userId = session?.user.id;
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
  }));

  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      let leaders: string[] = [];
      try {
        leaders = await fetchLeaderRoles(userId);
      } catch (leaderError) {
        if (cancelled) return;
        console.error(leaderError);
        setError("権限情報の取得に失敗しました。");
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

      setFlags({
        isAdministrator,
        isSupervisor,
        isPaLeader,
        isLightingLeader,
        isPartLeader,
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
    ...(suppressPrivilegedAccess
      ? {
          isAdministrator: false,
          isSupervisor: false,
          isPaLeader: false,
          isLightingLeader: false,
          isPartLeader: false,
          isAdmin: false,
          canAccessAdmin: false,
        }
      : flags),
    loading: authLoading || modeLoading || (userId ? loading : false),
    error: userId ? error : null,
  };
}
