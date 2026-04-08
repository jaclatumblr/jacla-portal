"use client";

import { useRoleFlags } from "@/lib/useRoleFlags";

type StudentIdAccessResult = {
  canViewStudentId: boolean;
  loading: boolean;
  error: string | null;
};

export function useCanViewStudentId(): StudentIdAccessResult {
  const { canAccessAdmin, loading, error } = useRoleFlags();

  return {
    canViewStudentId: canAccessAdmin,
    loading,
    error,
  };
}
