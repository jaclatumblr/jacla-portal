"use client";

import { useEffect, useMemo } from "react";
import { Trash2 } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  applyStagePlotMemberPositions,
  createDefaultStagePlot,
  extractStagePlotMemberPositions,
} from "@/lib/stagePlot";
import { StagePlotEditor } from "./StagePlotEditor";
import { SongEntry, StageItem, StageMember, StagePlot, createTempId, orderEntries } from "../types";

type StagePlotManagerProps = {
  members: StageMember[];
  setMembers: (members: StageMember[]) => void;
  plots: StagePlot[];
  setPlots: (plots: StagePlot[] | ((prev: StagePlot[]) => StagePlot[])) => void;
  activePlotId: string | null;
  setActivePlotId: (plotId: string | null) => void;
  songs: SongEntry[];
  setSongs: (songs: SongEntry[] | ((prev: SongEntry[]) => SongEntry[])) => void;
};

const renumberPlots = (plots: StagePlot[]) =>
  plots.map((plot, index) => ({
    ...plot,
    name: `配置図${index + 1}`,
  }));

export function StagePlotManager({
  members,
  setMembers,
  plots,
  setPlots,
  activePlotId,
  setActivePlotId,
  songs,
  setSongs,
}: StagePlotManagerProps) {
  const activePlot = useMemo(
    () => plots.find((plot) => plot.id === activePlotId) ?? plots[0] ?? null,
    [activePlotId, plots]
  );

  useEffect(() => {
    if (!activePlot && plots.length === 0) return;
    const resolvedId = activePlot?.id ?? null;
    if (resolvedId !== activePlotId) {
      setActivePlotId(resolvedId);
    }
  }, [activePlot, activePlotId, plots.length, setActivePlotId]);

  const activePlotSongs = useMemo(() => {
    if (!activePlot) return [];
    const fallbackPlotId = plots[0]?.id ?? null;
    return orderEntries(songs).filter((song) => (song.stagePlotId ?? fallbackPlotId) === activePlot.id);
  }, [activePlot, plots, songs]);

  const activePlotMembers = useMemo(
    () => applyStagePlotMemberPositions(members, activePlot?.memberPositions),
    [activePlot?.memberPositions, members]
  );

  const handleSetItems = (items: StageItem[]) => {
    if (!activePlot) return;
    setPlots((prev) =>
      prev.map((plot) => (plot.id === activePlot.id ? { ...plot, items } : plot))
    );
  };

  const handleSetMembers = (nextMembers: StageMember[]) => {
    if (!activePlot) return;
    const nextMemberPositions = extractStagePlotMemberPositions(nextMembers);
    const primaryPlotId = plots[0]?.id ?? null;

    setPlots((prev) =>
      prev.map((plot) =>
        plot.id === activePlot.id ? { ...plot, memberPositions: nextMemberPositions } : plot
      )
    );

    if (activePlot.id === primaryPlotId) {
      setMembers(nextMembers);
    }
  };

  const handleAddPlot = () => {
    const sourcePlot = activePlot ?? plots[0] ?? createDefaultStagePlot<StageItem>(createTempId, plots.length);
    const duplicatedItems =
      sourcePlot.items.length > 0
        ? sourcePlot.items.map((item) => ({ ...item, id: createTempId() }))
        : createDefaultStagePlot<StageItem>(createTempId, plots.length).items;
    const duplicatedMemberPositions = extractStagePlotMemberPositions(activePlotMembers);

    const nextPlot: StagePlot = {
      id: createTempId(),
      name: `配置図${plots.length + 1}`,
      items: duplicatedItems,
      memberPositions: duplicatedMemberPositions,
    };

    const nextPlots = renumberPlots([...plots, nextPlot]);
    const createdPlot = nextPlots[nextPlots.length - 1] ?? null;
    setPlots(nextPlots);
    setActivePlotId(createdPlot?.id ?? null);
  };

  const handleRemovePlot = () => {
    if (!activePlot || plots.length <= 1) return;
    if (!window.confirm(`${activePlot.name} を削除しますか？ この配置図を使っていた曲は配置図1に戻ります。`)) {
      return;
    }

    const activeIndex = plots.findIndex((plot) => plot.id === activePlot.id);
    const nextPlots = renumberPlots(plots.filter((plot) => plot.id !== activePlot.id));
    const reassignedPlotId = nextPlots[0]?.id ?? null;
    const fallbackIndex = Math.max(0, Math.min(activeIndex, nextPlots.length - 1));
    const nextActivePlotId = nextPlots[fallbackIndex]?.id ?? reassignedPlotId;

    setPlots(nextPlots);
    setActivePlotId(nextActivePlotId);
    if (activeIndex === 0 && nextPlots[0]) {
      setMembers(applyStagePlotMemberPositions(members, nextPlots[0].memberPositions));
    }
    setSongs((prev) =>
      prev.map((song) =>
        song.stagePlotId === activePlot.id
          ? { ...song, stagePlotId: reassignedPlotId }
          : song
      )
    );
  };

  if (!activePlot) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card/60">
        <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {plots.map((plot) => {
                const plotSongCount = songs.filter(
                  (song) => (song.stagePlotId ?? plots[0]?.id ?? null) === plot.id
                ).length;

                return (
                  <Button
                    key={plot.id}
                    type="button"
                    variant={plot.id === activePlot.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActivePlotId(plot.id)}
                    className="w-full justify-between gap-2 sm:w-auto sm:justify-center"
                  >
                    <span>{plot.name}</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {plotSongCount}曲
                    </Badge>
                  </Button>
                );
              })}
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              <p>セットリスト側で曲ごとに使用配置図を選べます。</p>
              <p>
                {activePlotSongs.length > 0
                  ? `使用曲: ${activePlotSongs.map((song) => song.title || (song.entry_type === "mc" ? "MC" : "曲名未入力")).join(" / ")}`
                  : "この配置図を使う曲はまだ割り当てられていません。"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" variant="outline" size="sm" onClick={handleAddPlot} className="w-full sm:w-auto">
              配置図を複製して追加
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemovePlot}
              disabled={plots.length <= 1}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              選択中の配置図を削除
            </Button>
          </div>
        </CardContent>
      </Card>

      <StagePlotEditor
        members={activePlotMembers}
        items={activePlot.items}
        setMembers={handleSetMembers}
        setItems={handleSetItems}
      />
    </div>
  );
}
