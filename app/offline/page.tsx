import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircle } from "@/lib/icons";
import { OfflineRetryButton } from "@/components/OfflineRetryButton";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-lg rounded-[28px] border border-border/80 bg-card/80 p-8 text-center shadow-[0_24px_72px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
          <AlertCircle className="h-7 w-7" />
        </div>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.28em] text-primary">Offline</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">You are offline</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          The latest data is not available right now. Retry when your connection comes back, or return to the home page and open the portal again.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <OfflineRetryButton />
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary/30 hover:text-primary"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
