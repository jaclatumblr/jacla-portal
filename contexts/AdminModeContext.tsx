"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLeaderRoles } from "@/lib/leaderRoles";

export type AdministratorMode = "administrator" | "general";

type AdminModeContextType = {
  mode: AdministratorMode;
  actualIsAdministrator: boolean;
  canToggleMode: boolean;
  suppressPrivilegedAccess: boolean;
  loading: boolean;
  setMode: (mode: AdministratorMode) => void;
  toggleMode: () => void;
};

const defaultContext: AdminModeContextType = {
  mode: "administrator",
  actualIsAdministrator: false,
  canToggleMode: false,
  suppressPrivilegedAccess: false,
  loading: true,
  setMode: () => {},
  toggleMode: () => {},
};

const AdminModeContext = createContext<AdminModeContextType>(defaultContext);

const getStorageKey = (userId: string) => `administrator-mode:${userId}`;

const normalizeMode = (value: string | null | undefined): AdministratorMode =>
  value === "general" ? "general" : "administrator";

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? null;
  const [mode, setModeState] = useState<AdministratorMode>("administrator");
  const [actualIsAdministrator, setActualIsAdministrator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    if (!userId) {
      setModeState("administrator");
      setActualIsAdministrator(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    (async () => {
      try {
        const leaders = await fetchLeaderRoles(userId);
        if (cancelled) return;

        const nextIsAdministrator = leaders.includes("Administrator");
        setActualIsAdministrator(nextIsAdministrator);

        if (!nextIsAdministrator) {
          setModeState("administrator");
          setLoading(false);
          return;
        }

        if (typeof window !== "undefined") {
          setModeState(normalizeMode(window.localStorage.getItem(getStorageKey(userId))));
        } else {
          setModeState("administrator");
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setActualIsAdministrator(false);
        setModeState("administrator");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  useEffect(() => {
    if (!userId || !actualIsAdministrator || typeof window === "undefined") return;
    window.localStorage.setItem(getStorageKey(userId), mode);
  }, [actualIsAdministrator, mode, userId]);

  useEffect(() => {
    if (!userId || !actualIsAdministrator || typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== getStorageKey(userId)) return;
      setModeState(normalizeMode(event.newValue));
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [actualIsAdministrator, userId]);

  const setMode = useCallback((nextMode: AdministratorMode) => {
    if (!actualIsAdministrator) return;
    setModeState(nextMode);
  }, [actualIsAdministrator]);

  const toggleMode = useCallback(() => {
    if (!actualIsAdministrator) return;
    setModeState((prev) => (prev === "administrator" ? "general" : "administrator"));
  }, [actualIsAdministrator]);

  const value = useMemo<AdminModeContextType>(
    () => ({
      mode,
      actualIsAdministrator,
      canToggleMode: actualIsAdministrator,
      suppressPrivilegedAccess: actualIsAdministrator && mode === "general",
      loading: authLoading || (userId ? loading : false),
      setMode,
      toggleMode,
    }),
    [actualIsAdministrator, authLoading, loading, mode, setMode, toggleMode, userId]
  );

  return <AdminModeContext.Provider value={value}>{children}</AdminModeContext.Provider>;
}

export function useAdminMode() {
  return useContext(AdminModeContext);
}
