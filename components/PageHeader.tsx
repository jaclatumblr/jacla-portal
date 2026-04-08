import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { cn } from "@/lib/utils";

type PageHeaderTone = "primary" | "secondary" | "accent" | "muted" | "white";
type PageHeaderSize = "default" | "lg";

type PageHeaderProps = {
  kicker?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  tone?: PageHeaderTone;
  size?: PageHeaderSize;
  meta?: ReactNode;
  actions?: ReactNode;
};

const toneMap: Record<PageHeaderTone, { badge: string; band: string }> = {
  primary: {
    badge: "border-primary/15 bg-primary/8 text-primary",
    band: "from-primary/10",
  },
  secondary: {
    badge: "border-secondary/15 bg-secondary/8 text-secondary",
    band: "from-secondary/10",
  },
  accent: {
    badge: "border-accent/25 bg-accent/14 text-accent-foreground",
    band: "from-accent/12",
  },
  muted: {
    badge: "border-border bg-surface-secondary text-muted-foreground",
    band: "from-surface-secondary",
  },
  white: {
    badge: "border-border bg-card text-foreground",
    band: "from-card",
  },
};

const sizeMap: Record<PageHeaderSize, string> = {
  default: "py-8 md:py-10",
  lg: "py-10 md:py-14",
};

export function PageHeader({
  kicker,
  title,
  description,
  backHref,
  backLabel = "戻る",
  tone = "primary",
  size = "default",
  meta,
  actions,
}: PageHeaderProps) {
  const toneStyle = toneMap[tone];
  return (
    <section className={cn("relative overflow-hidden border-b border-border/80 bg-background", sizeMap[size])}>
      <div className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", toneStyle.band)} />
      <div className="relative z-10 container mx-auto px-4 sm:px-6">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{backLabel}</span>
          </Link>
        )}

        <div className="mt-5 max-w-5xl pt-[calc(var(--mobile-topbar-height,0px)/4)] md:pt-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              {kicker && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.24em] uppercase",
                    toneStyle.badge
                  )}
                >
                  {kicker}
                </span>
              )}
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.6rem]">
                {title}
              </h1>
              {description && (
                <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                  {description}
                </p>
              )}
              {meta && <div className="pt-1">{meta}</div>}
            </div>
            {actions && <div className="flex flex-wrap items-start gap-2 md:justify-end">{actions}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
