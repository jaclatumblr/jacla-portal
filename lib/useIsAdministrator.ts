"use client";

import { useRoleFlags } from "@/lib/useRoleFlags";

type AdministratorHookResult = {
  isAdministrator: boolean;
  loading: boolean;
  error: string | null;
};

export function useIsAdministrator(): AdministratorHookResult {
  const { isAdministrator, loading, error } = useRoleFlags();

  return {
    isAdministrator,
    loading,
    error,
  };
}
