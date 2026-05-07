import { ReactNode } from "react";
import { LucideIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { instructionTheme, InstructionRole } from "@/components/instructions/theme";

type InstructionPanelProps = {
  title: string;
  role: InstructionRole;
  icon?: LucideIcon;
  description?: string;
  headerRight?: ReactNode;
  emphasis?: "default" | "accent";
  compact?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function InstructionPanel({
  title,
  role,
  icon: Icon,
  description,
  headerRight,
  emphasis = "default",
  compact = false,
  children,
  className,
  bodyClassName,
}: InstructionPanelProps) {
  const theme = instructionTheme[role];

  return (
    <section
      className={cn(
        compact ? "rounded-xl border shadow-sm" : "rounded-2xl border shadow-sm",
        emphasis === "accent"
          ? `${theme.accentBorder} ${theme.accentSurfaceStrong}`
          : "border-border/70 bg-card/70",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between border-b border-border/60",
          compact ? "gap-2 px-3 py-2.5" : "gap-3 px-4 py-3"
        )}
      >
        <div className="space-y-1">
          <div className={cn("flex items-center gap-2", compact && "gap-1.5")}>
            {Icon ? (
              <Icon
                className={cn(
                  compact ? "h-3.5 w-3.5" : "h-4 w-4",
                  emphasis === "accent" ? theme.accentText : "text-primary"
                )}
              />
            ) : null}
            <h3 className={cn("font-semibold text-foreground", compact ? "text-[13px]" : "text-sm")}>
              {title}
            </h3>
          </div>
          {description ? (
            <p
              className={cn(
                "leading-relaxed text-muted-foreground",
                compact ? "text-[11px]" : "text-xs"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <div className={cn(compact ? "p-3" : "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
