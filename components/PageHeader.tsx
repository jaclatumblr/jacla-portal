import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

const toneMap: Record<PageHeaderTone, { text: string; gradient: string; blob: string }> = {
  primary: {
    text: "text-primary",
    gradient: "from-primary/5",
    blob: "bg-primary/5",
  },
  secondary: {
    text: "text-secondary",
    gradient: "from-secondary/5",
    blob: "bg-secondary/5",
  },
  accent: {
    text: "text-accent",
    gradient: "from-accent/5",
    blob: "bg-accent/5",
  },
  muted: {
    text: "text-muted-foreground",
    gradient: "from-muted/30",
    blob: "bg-muted/40",
  },
  white: {
    text: "text-white/70",
    gradient: "from-white/5",
    blob: "bg-white/5",
  },
};

const sizeMap: Record<PageHeaderSize, string> = {
  default: "py-12 md:py-16",
  lg: "py-16 md:py-24",
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
    <section className={cn("relative overflow-hidden", sizeMap[size])}>
      <div className={cn("absolute inset-0 bg-gradient-to-b to-transparent", toneStyle.gradient)} />
      <div className={cn("absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl", toneStyle.blob)} />

      <div className="relative z-10 container mx-auto px-4 sm:px-6">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{backLabel}</span>
          </Link>
        )}

        <div className="max-w-5xl mt-6 pt-[calc(var(--mobile-topbar-height,0px)/3)] md:pt-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              {kicker && (
                <span
                  className={cn(
                    "text-xs tracking-[0.3em] font-mono uppercase",
                    toneStyle.text
                  )}
                >
                  {kicker}
                </span>
              )}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3">{title}</h1>
              {description && (
                <p className="text-muted-foreground text-sm md:text-base mt-3 max-w-2xl">
                  {description}
                </p>
              )}
              {meta && <div className="mt-4">{meta}</div>}
            </div>
            {actions && <div className="flex items-start gap-2">{actions}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
