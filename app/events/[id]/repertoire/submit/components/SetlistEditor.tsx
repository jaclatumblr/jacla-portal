"use client";

import { useState } from "react";
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
  GripVertical,
  Loader2,
  Mic,
  Music,
  Trash2,
} from "lucide-react";
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

type SetlistEditorProps = {
  songs: SongEntry[];
  setSongs: (songs: SongEntry[]) => void;
  onScheduleMetadata: (id: string, url: string, entryType: EntryType) => void;
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
  isDragging?: boolean;
  isOverlay?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
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
  isDragging,
  isOverlay,
  dragHandleProps,
  readOnly,
}: SongCardProps) {
  const isSong = entry.entry_type === "song";
  const isMc = entry.entry_type === "mc";
  const isReadOnly = !!isOverlay || !!readOnly;
  const canEditInstructions = !isReadOnly && (isSong || isMc);

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-border bg-card/70 px-4 py-3 touch-pan-y",
        isDragging && "opacity-50",
        isOverlay && "pointer-events-none z-50 bg-card shadow-xl"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
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
            onChange={(e) => onUpdate(entry.id, "title", e.target.value)}
            placeholder={isMc ? "MCタイトル" : "曲名"}
            className="w-full font-medium"
            disabled={isReadOnly}
          />
        </div>
        <div className="flex items-center gap-1 sm:ml-auto">
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

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">アーティスト</span>
          <Input
            value={entry.artist}
            onChange={(e) => onUpdate(entry.id, "artist", e.target.value)}
            disabled={!isSong || isReadOnly}
            placeholder={isSong ? "アーティスト" : "-"}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">URL</span>
          <div className="relative">
            <Input
              value={entry.url}
              onChange={(e) => {
                onUpdate(entry.id, "url", e.target.value);
                if (!isReadOnly) onScheduleMetadata(entry.id, e.target.value, entry.entry_type);
              }}
              disabled={!isSong || isReadOnly}
              placeholder={isSong ? "URL (予習用動画など)" : "-"}
            />
          </div>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[160px,1fr]">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">時間(分:秒)</span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={entry.durationMin}
              onChange={(e) => onUpdate(entry.id, "durationMin", e.target.value)}
              className="w-20"
              disabled={isReadOnly}
            />
            <span className="text-muted-foreground">:</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={entry.durationSec}
              onChange={(e) => onUpdate(entry.id, "durationSec", e.target.value)}
              className="w-20"
              disabled={isReadOnly}
            />
          </div>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">アレンジ/備考</span>
          <Textarea
            rows={2}
            value={entry.arrangementNote ?? ""}
            onChange={(e) => onUpdate(entry.id, "arrangementNote", e.target.value)}
            disabled={isReadOnly}
            placeholder="ソロ、アレンジ等あれば"
            className="resize-none"
          />
        </label>
      </div>

      <div className="space-y-2 rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold text-blue-500/90">
          <Music className="h-3 w-3" />
          <span>PA・音響指示</span>
        </div>
        <div className="grid gap-2">
          <Textarea
            rows={2}
            value={entry.memo ?? ""}
            onChange={(e) => onUpdate(entry.id, "memo", e.target.value)}
            disabled={!canEditInstructions}
            placeholder={isMc ? "MCのPA指示" : "リバーブ深め、Gtソロ上げ、同期音源ありなど"}
            className="resize-none bg-background/50 border-blue-200/20 focus:border-blue-500/50"
          />
        </div>
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
              onChange={(e) => onUpdate(entry.id, "lightingSpot", e.target.value as LightingChoice)}
              className="h-8 w-full rounded-md border border-purple-200/20 bg-background/50 px-2 focus:border-purple-500/50"
              disabled={!canEditInstructions}
            >
              {lightingChoiceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-muted-foreground">ストロボ</span>
            <select
              value={entry.lightingStrobe}
              onChange={(e) => onUpdate(entry.id, "lightingStrobe", e.target.value as LightingChoice)}
              className="h-8 w-full rounded-md border border-purple-200/20 bg-background/50 px-2 focus:border-purple-500/50"
              disabled={!canEditInstructions}
            >
              {lightingChoiceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-muted-foreground">ムービング</span>
            <select
              value={entry.lightingMoving}
              onChange={(e) => onUpdate(entry.id, "lightingMoving", e.target.value as LightingChoice)}
              className="h-8 w-full rounded-md border border-purple-200/20 bg-background/50 px-2 focus:border-purple-500/50"
              disabled={!canEditInstructions}
            >
              {lightingChoiceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-muted-foreground">色イメージ</span>
            <Input
              value={entry.lightingColor}
              onChange={(e) => onUpdate(entry.id, "lightingColor", e.target.value)}
              disabled={!canEditInstructions}
              className="h-8 bg-background/50 border-purple-200/20 focus:border-purple-500/50"
              placeholder={isMc ? "MCの色イメージ" : "赤系、青系など"}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function SortableSongItem(props: SongCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.entry.id,
    disabled: props.readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-pan-y">
      <SongCard {...props} isDragging={isDragging} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

export function SetlistEditor({ songs, setSongs, onScheduleMetadata, readOnly }: SetlistEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = readOnly ? [] : useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = songs.findIndex((s) => s.id === active.id);
    const newIndex = songs.findIndex((s) => s.id === over.id);

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
      order_index: songs.length + 1,
    };
    setSongs([...songs, newEntry]);
  };

  const updateEntry = (id: string, key: keyof SongEntry, value: SongEntry[keyof SongEntry]) => {
    if (readOnly) return;
    setSongs(songs.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  };

  const removeEntry = (id: string) => {
    if (readOnly) return;
    if (!window.confirm("この項目を削除しますか？")) return;
    setSongs(songs.filter((s) => s.id !== id));
  };

  const moveEntry = (from: number, to: number) => {
    if (readOnly) return;
    setSongs(arrayMove(songs, from, to));
  };

  const activeEntry = songs.find((s) => s.id === activeId);

  return (
    <Card className="bg-card/60">
      <CardHeader>
        <CardTitle>セットリスト</CardTitle>
        <CardDescription>
          演奏曲やMCの位置、各曲の長さや照明要望を入力してください。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
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
                  readOnly={readOnly}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeEntry ? (
              <SongCard
                entry={activeEntry}
                index={songs.findIndex((s) => s.id === activeId)}
                totalCount={songs.length}
                onUpdate={() => { }}
                onMove={() => { }}
                onRemove={() => { }}
                onScheduleMetadata={() => { }}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className="mt-6 flex gap-4">
          <Button variant="outline" className="flex-1 border-dashed" onClick={() => addEntry("song")} disabled={readOnly}>
            <Music className="mr-2 h-4 w-4" />
            曲を追加
          </Button>
          <Button variant="outline" className="flex-1 border-dashed" onClick={() => addEntry("mc")} disabled={readOnly}>
            <Mic className="mr-2 h-4 w-4" />
            MCを追加
          </Button>
        </div>

        <div className="mt-4 rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
          <p>💡 ヒント: 曲のURLを入力すると、YouTube等から曲名・アーティスト・長さが自動取得される場合があります。</p>
        </div>
      </CardContent>
    </Card>
  );
}
