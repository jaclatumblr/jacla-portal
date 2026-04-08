"use client";

import { RefreshCw } from "@/lib/icons";

export function OfflineRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
    >
      <RefreshCw className="h-4 w-4" />
      Retry
    </button>
  );
}
