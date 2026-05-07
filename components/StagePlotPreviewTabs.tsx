"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StagePlotPreview } from "@/components/StagePlotPreview";
import { applyStagePlotMemberPositions } from "@/lib/stagePlot";
import { cn } from "@/lib/utils";

type StageItem = {
  id: string;
  label: string;
  dashed?: boolean;
  x: number;
  y: number;
  variant?: import("@/lib/stagePlot").StageItemVariant;
  templateId?: import("@/lib/stagePlot").DefaultStageItemTemplateId;
};

type StageMember = {
  id: string;
  name: string;
  instrument?: string | null;
  x: number;
  y: number;
  isMc?: boolean;
};

type StagePlot = {
  id: string;
  name: string;
  items: StageItem[];
  memberPositions?: import("@/lib/stagePlot").StagePlotMemberPositionMap;
};

type StagePlotSong = {
  id: string;
  title?: string | null;
  entry_type?: string | null;
  stagePlotId?: string | null;
};

type StagePlotPreviewTabsProps = {
  plots: StagePlot[];
  members: StageMember[];
  songs?: StagePlotSong[];
  activePlotId?: string | null;
  onActivePlotIdChange?: (plotId: string | null) => void;
  className?: string;
  previewClassName?: string;
  compact?: boolean;
};

const getSongLabel = (song: StagePlotSong) =>
  song.title?.trim() || (song.entry_type === "mc" ? "MC" : "曲名未入力");

export function StagePlotPreviewTabs({
  plots,
  members,
  songs = [],
  activePlotId,
  onActivePlotIdChange,
  className,
  previewClassName,
  compact = false,
}: StagePlotPreviewTabsProps) {
  const [internalActivePlotId, setInternalActivePlotId] = useState<string | null>(plots[0]?.id ?? null);
  const selectedPlotId = activePlotId ?? internalActivePlotId;
  const activePlot = plots.find((plot) => plot.id === selectedPlotId) ?? plots[0] ?? null;
  const resolvedActivePlotId = activePlot?.id ?? null;

  const songsByPlot = useMemo(() => {
    const fallbackPlotId = plots[0]?.id ?? null;
    return plots.map((plot) => ({
      plot,
      songs: songs.filter((song) => (song.stagePlotId ?? fallbackPlotId) === plot.id),
    }));
  }, [plots, songs]);

  const activePlotSongs =
    songsByPlot.find((entry) => entry.plot.id === resolvedActivePlotId)?.songs ?? [];
  const previewMembers = useMemo(
    () => applyStagePlotMemberPositions(members, activePlot?.memberPositions),
    [activePlot?.memberPositions, members]
  );

  const handleSelectPlot = (plotId: string | null) => {
    if (activePlotId === undefined) {
      setInternalActivePlotId(plotId);
    }
    onActivePlotIdChange?.(plotId);
  };

  if (!activePlot) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
        {songsByPlot.map(({ plot, songs: plotSongs }) => (
          <Button
            key={plot.id}
            type="button"
            variant={plot.id === resolvedActivePlotId ? "default" : "outline"}
            size="sm"
            onClick={() => handleSelectPlot(plot.id)}
            className="min-w-0 justify-between gap-2 sm:w-auto sm:justify-center"
          >
            <span className="truncate">{plot.name}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {plotSongs.length}曲
            </Badge>
          </Button>
        ))}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{activePlot.name}</span>
        <p className="break-words leading-relaxed">
          {activePlotSongs.length > 0
            ? `使用曲: ${activePlotSongs.map(getSongLabel).join(" / ")}`
            : "この配置図を使う曲はまだ割り当てられていません。"}
        </p>
      </div>

      <StagePlotPreview
        items={activePlot.items}
        members={previewMembers}
        compact={compact}
        className={previewClassName}
      />
    </div>
  );
}
