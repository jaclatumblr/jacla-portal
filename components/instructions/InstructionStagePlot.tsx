import { StagePlotPreview } from "@/components/StagePlotPreview";
import { StagePlotPreviewTabs } from "@/components/StagePlotPreviewTabs";
import { SongRow, StageItem, StageMember, StagePlot } from "@/app/types/instructions";
import { cn } from "@/lib/utils";
import { instructionTheme, InstructionRole } from "@/components/instructions/theme";

type InstructionStagePlotProps = {
  items?: StageItem[];
  plots?: StagePlot[];
  members: StageMember[];
  songs?: SongRow[];
  role: InstructionRole;
  compact?: boolean;
};

export function InstructionStagePlot({
  items,
  plots,
  members,
  songs = [],
  role,
  compact = false,
}: InstructionStagePlotProps) {
  const resolvedPlots =
    plots && plots.length > 0
      ? plots
      : [{ id: "stage-plot-default", name: "配置図1", items: items ?? [] }];
  const activeItems = resolvedPlots[0]?.items ?? [];
  const hasContent =
    resolvedPlots.some((plot) => plot.items.length > 0) || members.length > 0;
  const theme = instructionTheme[role];
  const caption =
    role === "pa"
      ? "モニター位置と追加機材を確認できます。"
      : "スポット位置とMC動線を確認できます。";

  if (!hasContent) {
    return (
      <p className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
        配置図は未入力です。
      </p>
    );
  }

  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-2")}>
      {plots && resolvedPlots.length > 0 ? (
        <StagePlotPreviewTabs
          plots={resolvedPlots}
          members={members}
          songs={songs}
          compact={compact}
          previewClassName={cn(
            "rounded-2xl border shadow-inner",
            theme.accentBorder,
            theme.accentSurface
          )}
        />
      ) : (
        <StagePlotPreview
          items={activeItems}
          members={members}
          compact={compact}
          className={cn(
            "rounded-2xl border shadow-inner",
            theme.accentBorder,
            theme.accentSurface
          )}
        />
      )}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2",
          compact ? "text-[10px]" : "text-[11px]"
        )}
      >
        <span className={cn("font-medium", theme.accentSoftText)}>{caption}</span>
        <span className="text-muted-foreground">丸印は出演者、四角は追加機材です。</span>
      </div>
    </div>
  );
}
