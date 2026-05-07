"use client";

import { StagePlotPreviewTabs as SharedStagePlotPreviewTabs } from "@/components/StagePlotPreviewTabs";
import { SongEntry, StageMember, StagePlot } from "../types";

type StagePlotPreviewTabsProps = {
  plots: StagePlot[];
  songs: SongEntry[];
  members: StageMember[];
  activePlotId: string | null;
  setActivePlotId: (plotId: string | null) => void;
  className?: string;
  previewClassName?: string;
  compact?: boolean;
};

export function StagePlotPreviewTabs({
  plots,
  songs,
  members,
  activePlotId,
  setActivePlotId,
  className,
  previewClassName,
  compact = false,
}: StagePlotPreviewTabsProps) {
  return (
    <SharedStagePlotPreviewTabs
      plots={plots}
      songs={songs}
      members={members}
      activePlotId={activePlotId}
      onActivePlotIdChange={setActivePlotId}
      className={className}
      previewClassName={previewClassName}
      compact={compact}
    />
  );
}
