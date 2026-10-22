"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { applyDesignColor, colorStorageKey, DESIGN_COLOR_METADATA_KEY, normalizeDesignColor, resolveDesignColor } from "@/lib/designColors";

type ColorContextValue = {
  color: string | null;
  ready: boolean;
  saving: boolean;
  error: string | null;
  saveColor: (color: string | null) => Promise<void>;
};
const DesignColorContext = createContext<ColorContextValue | null>(null);

function readCache(owner: string) {
  try { return localStorage.getItem(colorStorageKey(owner)); } catch { return null; }
}
function apply(color: string | null, owner: string | null) {
  applyDesignColor(color);
  if (owner) {
    try { localStorage.setItem(colorStorageKey(owner), color ?? ""); } catch { /* Storage may be blocked. */ }
  }
}

export function DesignColorProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const owner = session?.user.id ?? null;
  const accountColor: unknown = session?.user.user_metadata?.[DESIGN_COLOR_METADATA_KEY];
  const [state, setState] = useState<{ owner: string | null; color: string | null; ready: boolean }>({ owner: null, color: null, ready: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<object | null>(null);
  const currentOwner = useRef(owner);
  const version = useRef(0);

  useEffect(() => {
    if (loading) return;
    currentOwner.current = owner;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || (state.owner === owner && pending.current)) return;
      pending.current = null;
      const color = owner ? resolveDesignColor(accountColor, readCache(owner)) : null;
      apply(color, owner);
      setState({ owner, color, ready: true });
      setSaving(false);
      setError(null);
    });
    return () => { cancelled = true; };
    // State is intentionally excluded: local selections must not restore stale session metadata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, accountColor, loading]);

  useEffect(() => {
    if (loading || !owner) return;
    let cancelled = false;
    const startVersion = version.current;
    void supabase.auth.getUser().then(({ data, error: fetchError }) => {
      if (cancelled || fetchError || data.user?.id !== owner || version.current !== startVersion || pending.current) return;
      const color = resolveDesignColor(data.user.user_metadata?.[DESIGN_COLOR_METADATA_KEY], readCache(owner));
      apply(color, owner);
      setState({ owner, color, ready: true });
    }).catch(() => { /* Keep local colors while offline. */ });
    return () => { cancelled = true; };
  }, [owner, loading]);

  const saveColor = async (value: string | null) => {
    const color = normalizeDesignColor(value);
    if ((value !== null && !color) || !owner || loading || state.owner !== owner || !state.ready || pending.current) return;
    const request = {};
    pending.current = request;
    version.current += 1;
    setSaving(true);
    setError(null);
    apply(color, owner);
    setState({ owner, color, ready: true });
    try {
      const { error: saveError } = await supabase.auth.updateUser({ data: { [DESIGN_COLOR_METADATA_KEY]: color } });
      if (saveError) throw saveError;
    } catch {
      if (currentOwner.current === owner && pending.current === request) setError("色は反映されましたが、保存に失敗しました。通信を確認して再保存してください。");
    } finally {
      if (pending.current === request) {
        pending.current = null;
        if (currentOwner.current === owner) setSaving(false);
      }
    }
  };

  return <DesignColorContext.Provider value={{ color: state.owner === owner ? state.color : null, ready: !loading && state.ready && state.owner === owner, saving, error, saveColor }}>{children}</DesignColorContext.Provider>;
}

export function useDesignColor() {
  const context = useContext(DesignColorContext);
  if (!context) throw new Error("useDesignColor must be used within DesignColorProvider");
  return context;
}
