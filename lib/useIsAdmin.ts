"use client";

import { useRoleFlags } from "@/lib/useRoleFlags";

type AdminHookResult = {
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
};

export function useIsAdmin(): AdminHookResult {
  const { isAdmin, loading, error } = useRoleFlags();

  return {
    isAdmin,
    loading,
    error,
  };
}
