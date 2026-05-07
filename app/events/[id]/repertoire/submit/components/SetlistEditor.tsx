"use client";

import { type HTMLAttributes, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Loader2,
  Mic,
  Music,
  Trash2,
} from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EntryType,
  LightingChoice,
  SongEntry,
  createTempId,
  entryTypeLabels,
  lightingChoiceOptions,
} from "../types";

type StagePlotOption = {
  value: string;
  label: string;
};

type SetlistEditorProps = {
  songs: SongEntry[];
  setSongs: (songs: SongEntry[]) => void;
  onScheduleMetadata: (id: string, url: string, entryType: EntryType) => void;
  stagePlotOptions: StagePlotOption[];
  defaultStagePlotId: string | null;
  readOnly?: boolean;
};

type SongCardProps = {
  entry: SongEntry;
  index: number;
  totalCount: number;
  onUpdate: (id: string, key: keyof SongEntry, value: SongEntry[keyof SongEntry]) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onScheduleMetadata: (id: string, url: string, entryType: EntryType) => void;
  stagePlotOptions: StagePlotOption[];
  isDragging?: boolean;
  isOverlay?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  readOnly?: boolean;
};

function SongCard({
  entry,
  index,
  totalCount,
  onUpdate,
  onMove,
  onRemove,
  onScheduleMetadata,
  stagePlotOptions,
  isDragging,
  isOverlay,
  dragHandleProps,
  readOnly,
}: SongCardProps) {
  const isSong = entry.entry_type === "song";
  const isMc = entry.entry_type === "mc";
  const isReadOnly = !!isOverlay || !!readOnly;
  const canEditInstructions = !isReadOnly && (isSong || isMc);
  const [expanded, setExpanded] = useState(false);
  const durationSummary = `${entry.durationMin || "-"}:${String(entry.durationSec || "00").padStart(2, "0")}`;
  const hasMultipleStagePlots = stagePlotOptions.length > 1;
  const stagePlotLabel =
    stagePlotOptions.find((option) => option.value === entry.stagePlotId)?.label ??
    stagePlotOptions[0]?.label ??
    "-";

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-border bg-card/70 px-4 py-3 touch-pan-y",
        isDragging && "opacity-50",
        isOverlay && "pointer-events-none z-50 bg-card shadow-xl"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          {!isOverlay ? (
            <Button
              type="button"
              variant={expanded ? "secondary" : "outline"}
              size="sm"
              onClick={() => setExpanded((prev) => !prev)}
              className={cn(
                "h-9 shrink-0 gap-1.5 px-3 font-medium",
                expanded && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
              )}
              aria-expanded={expanded}
              aria-label={expanded ? "詳細を閉じる" : "詳細を開く"}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
              <span>{expanded ? "閉じる" : "詳細"}</span>
            </Button>
          ) : null}
          <button
            type="button"
            className="cursor-grab rounded-md border border-border p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing touch-none"
            disabled={isReadOnly}
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="w-8 text-xs text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Badge variant="outline">{entryTypeLabels[entry.entry_type]}</Badge>
        </div>

        <div className="min-w-0 flex-1">
          <Input
            value={entry.title}
            onChange={(event) => onUpdate(entry.id, "title", event.target.value)}
            placeholder={isMc ? "MCタイトル" : "曲名"}
            className="w-full font-medium"
            disabled={isReadOnly}
          />
        </div>

        <div className="flex items-center sm:ml-auto">
          <div className="flex items-center gap-1 rounded-md border border-border/60 bg-background/30 px-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMove(index, Math.max(0, index - 1))}
              disabled={isReadOnly || index === 0}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMove(index, Math.min(totalCount - 1, index + 1))}
              disabled={isReadOnly || index === totalCount - 1}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(entry.id)}
              disabled={isReadOnly}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="max-w-[240px] truncate">{isSong ? entry.artist || "-" : "MC"}</span>
        <span>{durationSummary}</span>
        {hasMultipleStagePlots ? <span>使用配置図: {stagePlotLabel}</span> : null}
        {isSong && entry.url ? <span className="max-w-[320px] truncate">{entry.url}</span> : null}
      </div>

      {expanded ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">アーティスト</span>
              <Input
                value={entry.artist}
                onChange={(event) => onUpdate(entry.id, "artist", event.target.value)}
                disabled={!isSong || isReadOnly}
                placeholder={isSong ? "アーティスト名" : "-"}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">URL</span>
              <Input
                value={entry.url}
                onChange={(event) => {
                  onUpdate(entry.id, "url", event.target.value);
                  if (!isReadOnly) {
                    onScheduleMetadata(entry.id, event.target.value, entry.entry_type);
                  }
                }}
                disabled={!isSong || isReadOnly}
                placeholder={isSong ? "YouTube などのURL" : "-"}
              />
            </label>
          </div>

          <div className={cn("grid gap-3", hasMultipleStagePlots ? "md:grid-cols-[160px,180px,1fr]" : "md:grid-cols-[160px,1fr]")}>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">時間(分:秒)</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={entry.durationMin}
                  onChange={(event) => onUpdate(entry.id, "durationMin", event.target.value)}
                  className="w-20"
                  disabled={isReadOnly}
                />
                <span className="text-muted-foreground">:</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={entry.durationSec}
                  onChange={(event) => onUpdate(entry.id, "durationSec", event.target.value)}
                  className="w-20"
                  disabled={isReadOnly}
                />
              </div>
            </label>

            {hasMultipleStagePlots ? (
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">使用配置図</span>
                <select
                  value={entry.stagePlotId ?? stagePlotOptions[0]?.value ?? ""}
                  onChange={(event) => onUpdate(entry.id, "stagePlotId", event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isReadOnly}
                >
                  {stagePlotOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">アレンジ/補足</span>
              <Textarea
                rows={2}
                value={entry.arrangementNote ?? ""}
                onChange={(event) => onUpdate(entry.id, "arrangementNote", event.target.value)}
                disabled={isReadOnly}
                placeholder="ソロ、アレンジ違いなど"
                className="resize-none"
              />
            </label>
          </div>

          <div className="space-y-2 rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-blue-500/90">
              <Music className="h-3 w-3" />
              <span>PA・音響指示</span>
            </div>
            <Textarea
              rows={2}
              value={entry.memo ?? ""}
              onChange={(event) => onUpdate(entry.id, "memo", event.target.value)}
              disabled={!canEditInstructions}
              placeholder={isMc ? "MCのPA指示" : "リバーブ控えめ、Gtソロ上げ、転換あり など"}
              className="resize-none bg-background/50 border-blue-200/20 focus:border-blue-500/50"
            />
          </div>

          <div className="space-y-2 rounded-md border border-purple-500/20 bg-purple-500/5 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-purple-500/90">
              <Loader2 className="h-3 w-3" />
              <span>照明指示</span>
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-4">
              <label className="space-y-1">
                <span className="text-[10px] text-muted-foreground">スポット</span>
                <select
                  value={entry.lightingSpot}
                  onChange={(event) =>
                    onUpdate(entry.id, "lightingSpot", event.target.value as LightingChoice)
                  }
                  className="h-8 w-full rounded-md border border-purple-200/20 bg-background/50 px-2 focus:border-purple-500/50"
                  disabled={!canEditInstructions}
                >
                  {lightingChoiceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] text-muted-foreground">ストロボ</span>
                <select
                  value={entry.lightingStrobe}
                  onChange={(event) =>
                    onUpdate(entry.id, "lightingStrobe", event.target.value as LightingChoice)
                  }
                  className="h-8 w-full rounded-md border border-purple-200/20 bg-background/50 px-2 focus:border-purple-500/50"
                  disabled={!canEditInstructions}
                >
                  {lightingChoiceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] text-muted-foreground">ムービング</span>
                <select
                  value={entry.lightingMoving}
                  onChange={(event) =>
                    onUpdate(entry.id, "lightingMoving", event.target.value as LightingChoice)
                  }
                  className="h-8 w-full rounded-md border border-purple-200/20 bg-background/50 px-2 focus:border-purple-500/50"
                  disabled={!canEditInstructions}
                >
                  {lightingChoiceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] text-muted-foreground">色イメージ</span>
                <Input
                  value={entry.lightingColor}
                  onChange={(event) => onUpdate(entry.id, "lightingColor", event.target.value)}
                  disabled={!canEditInstructions}
                  className="h-8 bg-background/50 border-purple-200/20 focus:border-purple-500/50"
                  placeholder={isMc ? "MCの色イメージ" : "寒色、暖色 など"}
                />
              </label>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SortableSongItem(props: SongCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.entry.id,
    disabled: props.readOnly,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="touch-pan-y"
    >
      <SongCard
        {...props}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export function SetlistEditor({
  songs,
  setSongs,
  onScheduleMetadata,
  stagePlotOptions,
  defaultStagePlotId,
  readOnly,
}: SetlistEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const sensors = useSensors(pointerSensor);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = songs.findIndex((song) => song.id === active.id);
    const newIndex = songs.findIndex((song) => song.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      setSongs(arrayMove(songs, oldIndex, newIndex));
    }
  };

  const addEntry = (type: EntryType) => {
    if (readOnly) return;

    const newEntry: SongEntry = {
      id: createTempId(),
      band_id: "",
      entry_type: type,
      title: "",
      artist: "",
      url: "",
      durationMin: "",
      durationSec: "",
      arrangementNote: "",
      lightingSpot: "",
      lightingStrobe: "",
      lightingMoving: "",
      lightingColor: "",
      memo: "",
      stagePlotId: defaultStagePlotId,
      order_index: songs.length + 1,
    };

    setSongs([...songs, newEntry]);
  };

  const updateEntry = (id: string, key: keyof SongEntry, value: SongEntry[keyof SongEntry]) => {
    if (readOnly) return;
    setSongs(songs.map((song) => (song.id === id ? { ...song, [key]: value } : song)));
  };

  const removeEntry = (id: string) => {
    if (readOnly) return;
    if (!window.confirm("この項目を削除しますか？")) return;
    setSongs(songs.filter((song) => song.id !== id));
  };

  const moveEntry = (from: number, to: number) => {
    if (readOnly) return;
    setSongs(arrayMove(songs, from, to));
  };

  const activeEntry = songs.find((song) => song.id === activeId) ?? null;

  return (
    <Card className="bg-card/60">
      <CardHeader>
        <CardTitle>セットリスト</CardTitle>
        <CardDescription>
          曲順やMCの配置、曲ごとの長さとPA・照明指示を入力してください。
        </CardDescription>
      </CardHeader>

      <CardContent>
        <DndContext
          sensors={readOnly ? [] : sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={songs.map((song) => song.id)} strategy={verticalListSortingStrategy}>
            <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1">
              {songs.map((song, index) => (
                <SortableSongItem
                  key={song.id}
                  entry={song}
                  index={index}
                  totalCount={songs.length}
                  onUpdate={updateEntry}
                  onMove={moveEntry}
                  onRemove={removeEntry}
                  onScheduleMetadata={onScheduleMetadata}
                  stagePlotOptions={stagePlotOptions}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeEntry ? (
              <SongCard
                entry={activeEntry}
                index={songs.findIndex((song) => song.id === activeId)}
                totalCount={songs.length}
                onUpdate={() => {}}
                onMove={() => {}}
                onRemove={() => {}}
                onScheduleMetadata={() => {}}
                stagePlotOptions={stagePlotOptions}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className="mt-6 flex gap-4">
          <Button
            variant="outline"
            className="flex-1 border-dashed"
            onClick={() => addEntry("song")}
            disabled={readOnly}
          >
            <Music className="mr-2 h-4 w-4" />
            曲を追加
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-dashed"
            onClick={() => addEntry("mc")}
            disabled={readOnly}
          >
            <Mic className="mr-2 h-4 w-4" />
            MCを追加
          </Button>
        </div>

        <div className="mt-4 rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
          <p>ヒント: URLを入れると、対応している場合は曲名やアーティスト名、時間が自動入力されます。</p>
        </div>
      </CardContent>
    </Card>
  );
}
