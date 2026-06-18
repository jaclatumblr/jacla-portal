import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { cn } from "@/lib/utils";

type PageHeaderTone = "primary" | "secondary" | "accent" | "muted" | "white";
type PageHeaderSize = "sm" | "default" | "lg";

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

const toneMap: Record<PageHeaderTone, { badge: string; band: string; line: string }> = {
  primary: {
    badge: "border-primary/20 bg-primary/10 text-primary",
    band: "from-primary/12",
    line: "via-primary/45",
  },
  secondary: {
    badge: "border-secondary/20 bg-secondary/10 text-secondary",
    band: "from-secondary/12",
    line: "via-secondary/45",
  },
  accent: {
    badge: "border-accent/30 bg-accent/15 text-accent-foreground",
    band: "from-accent/14",
    line: "via-accent/55",
  },
  muted: {
    badge: "border-border bg-surface-secondary text-muted-foreground",
    band: "from-surface-secondary",
    line: "via-border",
  },
  white: {
    badge: "border-border bg-card text-foreground",
    band: "from-card",
    line: "via-border",
  },
};

const sizeMap: Record<PageHeaderSize, { section: string; content: string; title: string }> = {
  sm: {
    section: "py-5 md:py-6",
    content: "mt-3",
    title: "text-2xl font-semibold leading-tight sm:text-[2rem] md:text-[2.15rem]",
  },
  default: {
    section: "py-7 md:py-9",
    content: "mt-5",
    title: "text-3xl font-semibold leading-tight sm:text-4xl md:text-[2.45rem]",
  },
  lg: {
    section: "py-8 md:py-11",
    content: "mt-5",
    title: "text-3xl font-semibold leading-tight sm:text-4xl md:text-[2.55rem]",
  },
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
  const sizeStyle = sizeMap[size];
  return (
    <section className={cn("relative overflow-hidden border-b border-border/80 bg-surface", sizeStyle.section)}>
      <div className="absolute inset-0 bg-gradient-to-b from-surface to-background" />
      <div className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", toneStyle.band)} />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent",
          toneStyle.line
        )}
      />
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

        <div className={cn(sizeStyle.content, "max-w-6xl pt-[calc(var(--mobile-topbar-height,0px)/4)] md:pt-0")}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              {kicker && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                    toneStyle.badge
                  )}
                >
                  {kicker}
                </span>
              )}
              <h1 className={sizeStyle.title}>{title}</h1>
              {description && (
                <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                  {description}
                </p>
              )}
              {meta && <div className="pt-1">{meta}</div>}
            </div>
            {actions && <div className="flex flex-wrap items-start gap-2 pt-1 md:justify-end">{actions}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
