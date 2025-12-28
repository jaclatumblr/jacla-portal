"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { subscribeToasts } from "@/lib/toast";
import type { ToastPayload, ToastVariant } from "@/lib/toast";

type ToastItem = ToastPayload & {
  id: string;
  variant: ToastVariant;
};

const getToastId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const variantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-primary/40 bg-primary/10 text-primary",
};

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts((payload) => {
      const id = getToastId();
      const next: ToastItem = {
        id,
        message: payload.message,
        variant: payload.variant ?? "info",
        durationMs: payload.durationMs,
      };
      setToasts((prev) => [...prev, next]);
      const duration = payload.durationMs ?? 2600;
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, duration);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[90] flex flex-col gap-2 pointer-events-none"
      style={{
        top: "calc(env(safe-area-inset-top) + 1rem + var(--mobile-topbar-height, 0px))",
        right: "1rem",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto min-w-[220px] max-w-[90vw] rounded-lg border px-4 py-3 shadow-lg toast-in",
            variantStyles[toast.variant]
          )}
        >
          <span className="text-sm">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
