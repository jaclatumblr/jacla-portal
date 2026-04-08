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
  success: "border-success/20 bg-card text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
  error: "border-destructive/20 bg-card text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
  info: "border-primary/20 bg-card text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
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
            "pointer-events-auto min-w-[220px] max-w-[90vw] rounded-xl border px-4 py-3 toast-in",
            variantStyles[toast.variant]
          )}
        >
          <span className="text-sm">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
