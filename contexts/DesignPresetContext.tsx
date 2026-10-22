"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { DESIGN_ACTIVE_USER_KEY, DESIGN_METADATA_KEY, designStorageKey, isDesignPreset, resolveDesignPreset, type DesignPreset } from "@/lib/designPresets";

type DesignContextValue = {
  preset: DesignPreset;
  ready: boolean;
  saving: boolean;
  error: string | null;
  setPreset: (preset: DesignPreset) => Promise<void>;
};

export const DesignContext = createContext<DesignContextValue | null>(null);

function readCache(userId: string): string | null {
  try { return localStorage.getItem(designStorageKey(userId)); } catch { return null; }
}

function applyPreset(preset: DesignPreset, userId: string | null) {
  document.documentElement.dataset.design = preset;
  try {
    if (userId) {
      localStorage.setItem(DESIGN_ACTIVE_USER_KEY, userId);
      localStorage.setItem(designStorageKey(userId), preset);
    } else {
      localStorage.removeItem(DESIGN_ACTIVE_USER_KEY);
    }
  } catch { /* Appearance still works when browser storage is disabled. */ }
}

export function DesignPresetProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const accountPreset: unknown = session?.user.user_metadata?.[DESIGN_METADATA_KEY];
  const [state, setState] = useState<{ owner: string | null; preset: DesignPreset; ready: boolean }>({ owner: null, preset: "original", ready: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ owner: string; preset: DesignPreset } | null>(null);
  const currentUser = useRef<string | null>(null);
  const selectionVersion = useRef(0);

  useEffect(() => {
    if (loading) return;
    currentUser.current = userId;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (pending.current?.owner === userId && userId) return;
      pending.current = null;
      const preset = userId ? resolveDesignPreset(accountPreset, readCache(userId)) : "original";
      applyPreset(preset, userId);
      setState({ owner: userId, preset, ready: true });
      setSaving(false);
      setError(null);
    });
    return () => { cancelled = true; };
  }, [userId, accountPreset, loading]);

  // Existing sessions can hold old user metadata. Refresh once per account,
  // without allowing a slow response to replace a selection made meanwhile.
  useEffect(() => {
    if (loading || !userId) return;
    let cancelled = false;
    const version = selectionVersion.current;
    void supabase.auth.getUser().then(({ data, error: fetchError }) => {
      if (cancelled || fetchError || data.user?.id !== userId || selectionVersion.current !== version || pending.current) return;
      const preset = resolveDesignPreset(data.user.user_metadata?.[DESIGN_METADATA_KEY], readCache(userId));
      applyPreset(preset, userId);
      setState({ owner: userId, preset, ready: true });
    }).catch(() => { /* Keep the cached appearance when offline. */ });
    return () => { cancelled = true; };
  }, [userId, loading]);

  const setPreset = async (preset: DesignPreset) => {
    if (!isDesignPreset(preset) || !userId || loading || pending.current || state.owner !== userId || !state.ready) return;
    const owner = userId;
    selectionVersion.current += 1;
    const request = { owner, preset };
    pending.current = request;
    setSaving(true);
    setError(null);
    setState({ owner, preset, ready: true });
    applyPreset(preset, owner);
    try {
      const { error: saveError } = await supabase.auth.updateUser({ data: { [DESIGN_METADATA_KEY]: preset } });
      if (saveError) throw saveError;
    } catch {
      if (currentUser.current === owner && pending.current === request) {
        setError("表示は切り替わりましたが、アカウントへの保存に失敗しました。通信を確認して再保存してください。");
      }
    } finally {
      if (pending.current === request) {
        pending.current = null;
        if (currentUser.current === owner) setSaving(false);
      }
    }
  };

  return <DesignContext.Provider value={{ preset: state.owner === userId ? state.preset : "original", ready: !loading && state.ready && state.owner === userId, saving, error, setPreset }}>{children}</DesignContext.Provider>;
}

export function useDesignPreset() {
  const context = useContext(DesignContext);
  if (!context) throw new Error("useDesignPreset must be used within DesignPresetProvider");
  return context;
}
