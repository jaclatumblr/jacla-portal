import { cn } from "@/lib/utils";
import { instructionTheme, InstructionRole } from "@/components/instructions/theme";

type InstructionMetricProps = {
  label: string;
  value: string;
  role: InstructionRole;
  tone?: "accent" | "muted";
  className?: string;
};

export function InstructionMetric({
  label,
  value,
  role,
  tone = "accent",
  className,
}: InstructionMetricProps) {
  const theme = instructionTheme[role];

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 shadow-sm",
        tone === "accent"
          ? `${theme.accentBorder} ${theme.accentSurfaceStrong}`
          : "border-border/70 bg-background/70",
        className
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold",
          tone === "accent" ? theme.accentStrongText : "text-foreground"
        )}
      >
        {value}
      </div>
    </div>
  );
}
