"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
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
  Grid3x3,
  GripVertical,
  Hand,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type EventRow = {
  id: string;
  name: string;
  date: string;
  event_type: string;
};

type BandRow = {
  id: string;
  name: string;
  created_by: string | null;
  repertoire_status: string | null;
  stage_plot_data?: Record<string, unknown> | null;
  representative_name?: string | null;
  sound_note?: string | null;
  lighting_note?: string | null;
  general_note?: string | null;
  lighting_total_min?: number | null;
};

type EntryType = "song" | "mc";
type RepertoireStatus = "draft" | "submitted";

type SongRow = {
  id: string;
  band_id: string;
  title: string;
  artist: string | null;
  entry_type: EntryType | null;
  url: string | null;
  order_index: number | null;
  duration_sec: number | null;
  arrangement_note?: string | null;
  lighting_spot?: string | null;
  lighting_strobe?: string | null;
  lighting_moving?: string | null;
  lighting_color?: string | null;
  memo: string | null;
  created_at?: string | null;
};

type LightingChoice = "o" | "x" | "auto" | "";

type SongEntry = {
  id: string;
  band_id: string;
  entry_type: EntryType;
  title: string;
  artist: string;
  url: string;
  durationMin: string;
  durationSec: string;
  arrangementNote: string;
  lightingSpot: LightingChoice;
  lightingStrobe: LightingChoice;
  lightingMoving: LightingChoice;
  lightingColor: string;
  memo: string;
  order_index: number | null;
};

type ProfileOption = {
  id: string;
  display_name: string | null;
  real_name: string | null;
  part: string | null;
  leader: string | null;
};

type ProfilePartRow = {
  profile_id: string;
  part: string | null;
  is_primary?: boolean | null;
};

type BandMemberRow = {
  id: string;
  band_id: string;
  user_id: string;
  instrument: string;
  position_x: number | null;
  position_y: number | null;
  order_index?: number | null;
  created_at?: string | null;
  monitor_request?: string | null;
  monitor_note?: string | null;
  is_mc?: boolean | null;
  profiles?:
    | {
        display_name: string | null;
        real_name: string | null;
        part: string | null;
      }
    | {
        display_name: string | null;
        real_name: string | null;
        part: string | null;
      }[]
    | null;
};

type StageMember = {
  id: string;
  userId: string;
  name: string;
  realName: string | null;
  part: string | null;
  instrument: string;
  x: number;
  y: number;
  orderIndex?: number | null;
  monitorRequest: string;
  monitorNote: string;
  isMc: boolean;
};

type StageItem = {
  id: string;
  label: string;
  dashed: boolean;
  x: number;
  y: number;
  fixed?: boolean;
};

type RepertoireDraft = {
  eventId: string;
  bandId: string;
  updatedAt: number;
  bandName: string;
  representativeName: string;
  generalNote: string;
  soundNote: string;
  lightingNote: string;
  lightingTotal: string;
  repertoireStatus: RepertoireStatus;
  songs: SongEntry[];
  removedSongIds: string[];
  stageItems: StageItem[];
  bandMembers: StageMember[];
};

type DragHandleProps = Record<string, any>;

const statusOptions: { value: RepertoireStatus; label: string }[] = [
  { value: "draft", label: "下書き" },
  { value: "submitted", label: "提出済み" },
];

const entryTypeLabels: Record<EntryType, string> = {
  song: "曲",
  mc: "MC",
};

const lightingChoiceOptions: { value: LightingChoice; label: string }[] = [
  { value: "", label: "-" },
  { value: "o", label: "○" },
  { value: "x", label: "×" },
  { value: "auto", label: "おまかせ" },
];

const lightingChoiceLabels: Record<Exclude<LightingChoice, "">, string> = {
  o: "○",
  x: "×",
  auto: "おまかせ",
};

const adminLeaderSet = new Set(["Administrator"]);

const createTempId = () => `temp-${crypto.randomUUID()}`;

const toDurationInputs = (duration: number | null) => {
  if (duration == null) return { durationMin: "", durationSec: "" };
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return {
    durationMin: String(minutes),
    durationSec: String(seconds),
  };
};

const toDurationSec = (minutes: string, seconds: string) => {
  const minValue = Number.parseInt(minutes, 10);
  const secValue = Number.parseInt(seconds, 10);
  if (Number.isNaN(minValue) && Number.isNaN(secValue)) return null;
  const safeMin = Number.isNaN(minValue) ? 0 : Math.max(0, minValue);
  const safeSec = Number.isNaN(secValue) ? 0 : Math.max(0, Math.min(59, secValue));
  return safeMin * 60 + safeSec;
};

const formatDuration = (durationSec: number | null) => {
  if (durationSec == null) return "-";
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatLightingChoice = (value: LightingChoice) =>
  value ? lightingChoiceLabels[value as Exclude<LightingChoice, "">] : "-";

const normalizeSongs = (rows: SongRow[]): SongEntry[] =>
  rows.map((row, index) => {
    const durationInputs = toDurationInputs(row.duration_sec ?? null);
    return {
      id: String(row.id),
      band_id: row.band_id,
      entry_type: row.entry_type ?? "song",
      title: row.title ?? "",
      artist: row.artist ?? "",
      url: row.url ?? "",
      durationMin: durationInputs.durationMin,
      durationSec: durationInputs.durationSec,
      arrangementNote: row.arrangement_note ?? "",
      lightingSpot: (row.lighting_spot as LightingChoice) ?? "",
      lightingStrobe: (row.lighting_strobe as LightingChoice) ?? "",
      lightingMoving: (row.lighting_moving as LightingChoice) ?? "",
      lightingColor: row.lighting_color ?? "",
      memo: row.memo ?? "",
      order_index: row.order_index ?? index + 1,
    };
  });

const orderEntries = (entries: SongEntry[]) =>
  [...entries].sort((a, b) => {
    const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

const isTemp = (id: string) => String(id).startsWith("temp-");

type StageCategory = "drums" | "bass" | "guitar" | "keyboard" | "wind" | "vocal" | "other";

const stageSlots: Record<StageCategory, { x: number; y: number }[]> = {
  drums: [{ x: 52, y: 26 }],
  bass: [{ x: 30, y: 52 }],
  guitar: [
    { x: 72, y: 52 },
    { x: 78, y: 44 },
  ],
  keyboard: [{ x: 70, y: 64 }],
  vocal: [
    { x: 50, y: 84 },
    { x: 40, y: 84 },
    { x: 60, y: 84 },
  ],
  wind: [
    { x: 50, y: 64 },
    { x: 42, y: 64 },
    { x: 58, y: 64 },
    { x: 46, y: 56 },
    { x: 54, y: 56 },
    { x: 40, y: 48 },
    { x: 60, y: 48 },
    { x: 34, y: 40 },
    { x: 66, y: 40 },
    { x: 30, y: 32 },
    { x: 70, y: 32 },
    { x: 24, y: 24 },
    { x: 76, y: 24 },
  ],
  other: [
    { x: 18, y: 60 },
    { x: 82, y: 60 },
    { x: 18, y: 72 },
    { x: 82, y: 72 },
  ],
};

const stagePresets: { label: string; dashed: boolean }[] = [
  { label: "Marshall", dashed: true },
  { label: "JC", dashed: true },
  { label: "Active", dashed: true },
  { label: "Passive", dashed: true },
];

const stagePresetPositions: Record<string, { x: number; y: number }> = {
  Marshall: { x: 72, y: 40 },
  JC: { x: 64, y: 40 },
  Active: { x: 36, y: 40 },
  Passive: { x: 28, y: 40 },
};

const clampPercent = (value: number) => Math.min(95, Math.max(5, value));
const GRID_STEP = 2.5;
const MIN_STAGE_ZOOM = 0.7;
const MAX_STAGE_ZOOM = 2.4;

type SongValueGetter = <K extends keyof SongEntry>(
  entry: SongEntry,
  key: K
) => SongEntry[K];
type SongFieldUpdater = <K extends keyof SongEntry>(
  id: string,
  key: K,
  value: SongEntry[K]
) => void;

type SongCardProps = {
  entry: SongEntry;
  index: number;
  totalCount: number;
  getValue: SongValueGetter;
  onUpdateField: SongFieldUpdater;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onScheduleMetadata: (id: string, url: string, entryType: EntryType) => void;
  fetchingMeta: Record<string, boolean>;
  dragAttributes?: DragHandleProps;
  dragListeners?: DragHandleProps;
  setActivatorRef?: (node: HTMLElement | null) => void;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  isDragging?: boolean;
  isOverlay?: boolean;
};

const SongCard = ({
  entry,
  index,
  totalCount,
  getValue,
  onUpdateField,
  onMove,
  onRemove,
  onScheduleMetadata,
  fetchingMeta,
  dragAttributes,
  dragListeners,
  setActivatorRef,
  setNodeRef,
  style,
  isDragging,
  isOverlay,
}: SongCardProps) => {
  const isSong = entry.entry_type === "song";
  const readOnly = isOverlay === true;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border bg-card/70 px-4 py-3 space-y-3",
        isDragging ? "opacity-60" : "",
        isOverlay ? "shadow-xl pointer-events-none" : ""
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label="並び替え"
            disabled={readOnly}
            ref={setActivatorRef}
            {...dragAttributes}
            {...dragListeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground w-8">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Badge variant="outline">{entryTypeLabels[entry.entry_type]}</Badge>
        </div>
        <div className="flex-1 min-w-0">
          <Input
            value={getValue(entry, "title")}
            onChange={(event) => onUpdateField(entry.id, "title", event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            placeholder={entry.entry_type === "mc" ? "MCタイトル" : "曲名"}
            className="w-full"
            disabled={readOnly}
          />
        </div>
        <div className="flex items-center gap-1 sm:ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onMove(index, Math.max(0, index - 1))}
            disabled={readOnly || index === 0}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onMove(index, Math.min(totalCount - 1, index + 1))}
            disabled={readOnly || index === totalCount - 1}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(entry.id)}
            disabled={readOnly}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">アーティスト</span>
          <Input
            value={getValue(entry, "artist")}
            onChange={(event) => onUpdateField(entry.id, "artist", event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            disabled={!isSong || readOnly}
            placeholder={isSong ? "アーティスト" : "-"}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">URL</span>
          <div className="relative">
            <Input
              value={getValue(entry, "url")}
              onChange={(event) => {
                const nextValue = event.target.value;
                onUpdateField(entry.id, "url", nextValue);
                if (!readOnly) {
                  onScheduleMetadata(entry.id, nextValue, entry.entry_type);
                }
              }}
              onPointerDown={(event) => event.stopPropagation()}
              disabled={!isSong || readOnly}
              placeholder={isSong ? "URLを貼ると自動で曲名やアーティストが入力されます" : "-"}
            />
            {fetchingMeta[entry.id] && (
              <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
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
              value={getValue(entry, "durationMin")}
              onChange={(event) =>
                onUpdateField(entry.id, "durationMin", event.target.value)
              }
              onPointerDown={(event) => event.stopPropagation()}
              className="w-20"
              disabled={readOnly}
            />
            <span className="text-muted-foreground">:</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={getValue(entry, "durationSec")}
              onChange={(event) =>
                onUpdateField(entry.id, "durationSec", event.target.value)
              }
              onPointerDown={(event) => event.stopPropagation()}
              className="w-20"
              disabled={readOnly}
            />
          </div>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">メモ</span>
          <Textarea
            rows={2}
            value={getValue(entry, "memo")}
            onChange={(event) => onUpdateField(entry.id, "memo", event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            disabled={readOnly}
          />
        </label>
      </div>
    </div>
  );
};

type LightingEntryCardProps = {
  entry: SongEntry;
  index: number;
  getValue: SongValueGetter;
  onUpdateField: SongFieldUpdater;
  onScheduleMetadata: (id: string, url: string, entryType: EntryType) => void;
  fetchingMeta: Record<string, boolean>;
};

const LightingEntryCard = ({
  entry,
  index,
  getValue,
  onUpdateField,
  onScheduleMetadata,
  fetchingMeta,
}: LightingEntryCardProps) => {
  const isSong = entry.entry_type === "song";
  return (
    <div className="rounded-lg border border-border bg-card/60 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <Badge variant="outline">{entryTypeLabels[entry.entry_type]}</Badge>
      </div>
      <div className="space-y-2">
        <Input
          value={getValue(entry, "title")}
          onChange={(event) => onUpdateField(entry.id, "title", event.target.value)}
          placeholder={isSong ? "曲名" : "MC"}
          className="h-8 text-xs"
        />
        <Input
          value={getValue(entry, "artist")}
          onChange={(event) => onUpdateField(entry.id, "artist", event.target.value)}
          placeholder="アーティスト"
          className="h-8 text-xs"
          disabled={!isSong}
        />
        <div className="relative">
          <Input
            value={getValue(entry, "url")}
            onChange={(event) => {
              const nextValue = event.target.value;
              onUpdateField(entry.id, "url", nextValue);
              if (isSong) {
                onScheduleMetadata(entry.id, nextValue, entry.entry_type);
              }
            }}
            placeholder="URL"
            className="h-8 text-xs"
            disabled={!isSong}
          />
          {fetchingMeta[entry.id] && (
            <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={getValue(entry, "durationMin")}
            onChange={(event) => onUpdateField(entry.id, "durationMin", event.target.value)}
            className="h-8 w-16 text-xs"
          />
          <span className="text-xs text-muted-foreground">:</span>
          <Input
            type="number"
            min={0}
            max={59}
            value={getValue(entry, "durationSec")}
            onChange={(event) => onUpdateField(entry.id, "durationSec", event.target.value)}
            className="h-8 w-16 text-xs"
          />
        </div>
        <Textarea
          rows={2}
          value={getValue(entry, "arrangementNote")}
          onChange={(event) =>
            onUpdateField(entry.id, "arrangementNote", event.target.value)
          }
          placeholder="アレンジ/ソロ等"
          className="text-xs"
          disabled={!isSong}
        />
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          {[
            { key: "lightingSpot", label: "スポット" },
            { key: "lightingStrobe", label: "ストロボ" },
            { key: "lightingMoving", label: "ムービング" },
          ].map((item) => (
            <label key={item.key} className="space-y-1">
              <span className="text-muted-foreground">{item.label}</span>
              <select
                value={getValue(entry, item.key as keyof SongEntry) as string}
                onChange={(event) =>
                  onUpdateField(
                    entry.id,
                    item.key as keyof SongEntry,
                    event.target.value as LightingChoice
                  )
                }
                className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs"
                disabled={!isSong}
              >
                {lightingChoiceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <Textarea
          rows={2}
          value={getValue(entry, "lightingColor")}
          onChange={(event) =>
            onUpdateField(entry.id, "lightingColor", event.target.value)
          }
          placeholder="色の要望"
          className="text-xs"
          disabled={!isSong}
        />
      </div>
    </div>
  );
};

type SortableSongCardProps = {
  entry: SongEntry;
  index: number;
  totalCount: number;
  getValue: SongValueGetter;
  onUpdateField: SongFieldUpdater;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onScheduleMetadata: (id: string, url: string, entryType: EntryType) => void;
  fetchingMeta: Record<string, boolean>;
};

const SortableSongCard = ({
  entry,
  index,
  totalCount,
  getValue,
  onUpdateField,
  onMove,
  onRemove,
  onScheduleMetadata,
  fetchingMeta,
}: SortableSongCardProps) => {
  const sortableId = String(entry.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <SongCard
      entry={entry}
      index={index}
      totalCount={totalCount}
      getValue={getValue}
      onUpdateField={onUpdateField}
      onMove={onMove}
      onRemove={onRemove}
      onScheduleMetadata={onScheduleMetadata}
      fetchingMeta={fetchingMeta}
      dragAttributes={attributes}
      dragListeners={listeners}
      setActivatorRef={setActivatorNodeRef}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
    />
  );
};

const snapToGrid = (value: number) => Math.round(value / GRID_STEP) * GRID_STEP;

const getCollisionRadius = (type: "member" | "item" | "fixed", id?: string) => {
  if (type === "fixed") {
    if (id?.startsWith("fixed-main")) return 8;
    if (id?.startsWith("fixed-mon")) return 7;
    return 7;
  }
  if (type === "item") return 6.5;
  return 6;
};

const normalizePartText = (value: string | null | undefined) =>
  (value ?? "").toLowerCase().replace(/\s+/g, "");

const includesAny = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

const splitMemberLabel = (value: string | null | undefined) => {
  const parts = (value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    base: parts[0] ?? "",
    suffix: parts.slice(1).join(" / "),
  };
};

const getStageCategory = (value: string | null | undefined): StageCategory => {
  const text = normalizePartText(value);
  if (!text) return "other";
  if (includesAny(text, ["dr", "drum", "ドラム"])) return "drums";
  if (text.startsWith("ba") || includesAny(text, ["bass", "ベース"])) return "bass";
  if (includesAny(text, ["gt", "gtr", "guitar", "ギター"])) return "guitar";
  if (includesAny(text, ["key", "keys", "keyboard", "piano", "キーボード", "ピアノ"]))
    return "keyboard";
  if (includesAny(text, ["vo", "vocal", "voca", "ボーカル", "歌"])) return "vocal";
  if (
    includesAny(text, [
      "sax",
      "tp",
      "tb",
      "trumpet",
      "trombone",
      "horn",
      "hr",
      "eup",
      "tu",
      "fl",
      "cl",
      "ob",
      "fg",
      "brass",
      "管",
    ])
  ) {
    return "wind";
  }
  return "other";
};

const getFallbackPosition = (index: number) => {
  const cols = 5;
  const row = Math.floor(index / cols);
  const col = index % cols;
  return {
    x: clampPercent(20 + col * 15),
    y: clampPercent(66 + row * 10),
  };
};

const getAutoPosition = (category: StageCategory, index: number) => {
  const slots = stageSlots[category];
  if (index < slots.length) return slots[index];
  return getFallbackPosition(index - slots.length);
};

const withMemberOrder = (members: StageMember[]) =>
  members.map((member, index) => ({
    ...member,
    orderIndex: index + 1,
  }));

export default function RepertoireSubmitPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;
  const { session } = useAuth();
  const {
    isAdmin,
    isPartLeader,
    isPaLeader,
    isLightingLeader,
    loading: roleLoading,
  } = useRoleFlags();
  const userId = session?.user.id;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [allBands, setAllBands] = useState<BandRow[]>([]);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [songCounts, setSongCounts] = useState<Record<string, number>>({});
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [songDrafts, setSongDrafts] = useState<Record<string, Partial<SongEntry>>>(
    {}
  );
  const [repertoireStatus, setRepertoireStatus] =
    useState<RepertoireStatus>("draft");
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingBandInfo, setSavingBandInfo] = useState(false);
  const [deletingBand, setDeletingBand] = useState(false);
  const [savingPaInfo, setSavingPaInfo] = useState(false);
  const [savingLightingInfo, setSavingLightingInfo] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [newBandName, setNewBandName] = useState("");
  const [newBandInstrument, setNewBandInstrument] = useState("");
  const [creatingBand, setCreatingBand] = useState(false);
  const [joinBandId, setJoinBandId] = useState("");
  const [joinInstrument, setJoinInstrument] = useState("");
  const [joining, setJoining] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bandMembers, setBandMembers] = useState<StageMember[]>([]);
  const [bandMembersLoading, setBandMembersLoading] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [currentProfile, setCurrentProfile] = useState<ProfileOption | null>(null);
  const [currentProfileParts, setCurrentProfileParts] = useState<string[]>([]);
  const [subPartsByProfileId, setSubPartsByProfileId] = useState<Record<string, string[]>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [addMemberId, setAddMemberId] = useState("");
  const [addMemberInstrument, setAddMemberInstrument] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const prevAddMemberIdRef = useRef<string>("");
  const [draggingMemberId, setDraggingMemberId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const stageViewportRef = useRef<HTMLDivElement | null>(null);
  const memberEditInputRef = useRef<HTMLInputElement | null>(null);
  const dragState = useRef<
    { id: string; type: "member" | "item"; offsetX: number; offsetY: number } | null
  >(null);
  const dragRafRef = useRef<number | null>(null);
  const dragPendingRef = useRef<
    { id: string; type: "member" | "item"; x: number; y: number } | null
  >(null);
  const stagePointerMapRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    startDistance: number;
    startZoom: number;
    startPan: { x: number; y: number };
    stageCenter: { x: number; y: number };
  } | null>(null);
  const panStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [stageItems, setStageItems] = useState<StageItem[]>([]);
  const [selectedStageItemId, setSelectedStageItemId] = useState<string | null>(null);
  const [stageEditPreset, setStageEditPreset] = useState("custom");
  const [stageEditLabel, setStageEditLabel] = useState("");
  const [isStageEditOpen, setIsStageEditOpen] = useState(false);
  const [stageEditAnchor, setStageEditAnchor] = useState<{ left: number; top: number } | null>(
    null
  );
  const [selectedMemberEditId, setSelectedMemberEditId] = useState<string | null>(null);
  const [memberEditSuffix, setMemberEditSuffix] = useState("");
  const [isMemberEditOpen, setIsMemberEditOpen] = useState(false);
  const [memberEditAnchor, setMemberEditAnchor] = useState<{ left: number; top: number } | null>(
    null
  );
  const [stageZoom, setStageZoom] = useState(1);
  const [stagePan, setStagePan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const collisionEnabled = false;
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [stagePreset, setStagePreset] = useState(stagePresets[0]?.label ?? "");
  const [customStageLabel, setCustomStageLabel] = useState("");
  const [bandName, setBandName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [soundNote, setSoundNote] = useState("");
  const [lightingNote, setLightingNote] = useState("");
  const [generalNote, setGeneralNote] = useState("");
  const [lightingTotal, setLightingTotal] = useState("");
  const [printMode, setPrintMode] = useState<"pa" | "lighting" | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const urlFetchTimers = useRef<Map<string, number>>(new Map());
  const [autoSavedAt, setAutoSavedAt] = useState<number | null>(null);
  const [autoSaveReadyKey, setAutoSaveReadyKey] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const skipNextAutoSaveRef = useRef(false);

  const selectedBand = useMemo(
    () => bands.find((band) => band.id === selectedBandId) ?? null,
    [bands, selectedBandId]
  );

  const autoSaveKey = useMemo(() => {
    if (!eventId || !selectedBandId) return null;
    return `repertoireDraft:${eventId}:${selectedBandId}`;
  }, [eventId, selectedBandId]);

  const autoSaveLabel = useMemo(() => {
    if (!autoSavedAt) return "";
    return new Date(autoSavedAt).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [autoSavedAt]);

  const effectiveSnap = useMemo(
    () => (isCoarsePointer ? true : snapEnabled && !isShiftPressed),
    [isCoarsePointer, snapEnabled, isShiftPressed]
  );

  useEffect(() => {
    setAutoSavedAt(null);
  }, [autoSaveKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(media.matches);
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") setIsShiftPressed(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") setIsShiftPressed(false);
    };
    const handleBlur = () => setIsShiftPressed(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const canManageBands =
    event?.event_type === "live" || event?.event_type === "camp";

  const hasLeaderPrivileges = isAdmin || isPartLeader || isPaLeader || isLightingLeader;
  const isBandOwner = selectedBand?.created_by === userId;
  const isBandMember = bandMembers.some((member) => member.userId === userId);
  const canEditBandMembers =
    canManageBands && (hasLeaderPrivileges || isBandOwner || isBandMember);
  const canDeleteBand =
    canManageBands && Boolean(selectedBandId) && (isBandOwner || isAdmin || isPaLeader || isLightingLeader);

  const joinableBands = useMemo(() => {
    if (allBands.length === 0) return [];
    const editableIds = new Set(bands.map((band) => band.id));
    return allBands.filter((band) => !editableIds.has(band.id));
  }, [allBands, bands]);

  const filteredProfiles = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    const currentIds = new Set(bandMembers.map((member) => member.userId));
    return profiles
      .filter((profile) => !currentIds.has(profile.id))
      .filter((profile) => {
        if (!term) return true;
        const values = [
          profile.display_name ?? "",
          profile.real_name ?? "",
          profile.part ?? "",
        ];
        return values.some((value) => value.toLowerCase().includes(term));
      });
  }, [bandMembers, memberSearch, profiles]);

  const groupedProfiles = useMemo(() => {
    const groups = [
      { key: "guitar", label: "ギター", items: [] as ProfileOption[] },
      { key: "bass", label: "ベース", items: [] as ProfileOption[] },
      { key: "drums", label: "ドラム", items: [] as ProfileOption[] },
      { key: "keyboard", label: "キーボード", items: [] as ProfileOption[] },
      { key: "wind", label: "管楽器", items: [] as ProfileOption[] },
      { key: "vocal", label: "ボーカル", items: [] as ProfileOption[] },
      { key: "other", label: "その他", items: [] as ProfileOption[] },
      { key: "unknown", label: "未設定", items: [] as ProfileOption[] },
    ];
    const groupMap = new Map(groups.map((group) => [group.key, group]));

    filteredProfiles.forEach((profile) => {
      const partLabel = profile.part?.trim() ?? "";
      const category = partLabel ? getStageCategory(partLabel) : "unknown";
      const key = category === "other" ? "other" : category;
      (groupMap.get(key) ?? groupMap.get("unknown"))?.items.push(profile);
    });

    return groups.filter((group) => group.items.length > 0);
  }, [filteredProfiles]);

  const selectedStageItem = useMemo(
    () => stageItems.find((item) => item.id === selectedStageItemId) ?? null,
    [stageItems, selectedStageItemId]
  );

  const selectedMemberEdit = useMemo(
    () => bandMembers.find((member) => member.id === selectedMemberEditId) ?? null,
    [bandMembers, selectedMemberEditId]
  );
  const memberEditBaseLabel = useMemo(() => {
    if (!selectedMemberEdit) return "";
    const raw = selectedMemberEdit.instrument || selectedMemberEdit.part || "";
    const { base } = splitMemberLabel(raw);
    return base || selectedMemberEdit.part || selectedMemberEdit.instrument || "Part";
  }, [selectedMemberEdit]);

  const addMemberInstrumentOptions = useMemo(() => {
    if (!addMemberId) return [];
    const selectedProfile = profiles.find((profile) => profile.id === addMemberId);
    if (!selectedProfile) return [];
    const options: string[] = [];
    const mainPart = selectedProfile.part?.trim();
    if (mainPart && mainPart !== "none") {
      options.push(mainPart);
    }
    const subParts = subPartsByProfileId[selectedProfile.id] ?? [];
    subParts.forEach((part) => {
      const value = part?.trim();
      if (!value || value === "none") return;
      if (!options.includes(value)) options.push(value);
    });
    return options;
  }, [addMemberId, profiles, subPartsByProfileId]);

  const allInstrumentOptions = useMemo(() => {
    const options = new Set<string>();
    profiles.forEach((profile) => {
      const value = profile.part?.trim();
      if (value && value !== "none") options.add(value);
      (subPartsByProfileId[profile.id] ?? []).forEach((part) => {
        const trimmed = part?.trim();
        if (trimmed && trimmed !== "none") options.add(trimmed);
      });
    });
    currentProfileParts.forEach((part) => {
      const trimmed = part?.trim();
      if (trimmed && trimmed !== "none") options.add(trimmed);
    });
    options.add("Vo.");
    return Array.from(options);
  }, [profiles, subPartsByProfileId, currentProfileParts]);

  const memberInstrumentOptions = useMemo(() => {
    const options = new Set<string>();
    addMemberInstrumentOptions.forEach((part) => options.add(part));
    allInstrumentOptions.forEach((part) => options.add(part));
    return Array.from(options);
  }, [addMemberInstrumentOptions, allInstrumentOptions]);

  const newBandInstrumentOptions = useMemo(() => {
    const options = new Set<string>();
    currentProfileParts.forEach((part) => options.add(part));
    allInstrumentOptions.forEach((part) => options.add(part));
    return Array.from(options);
  }, [currentProfileParts, allInstrumentOptions]);

  const bandCountLabel = (bandId: string) => songCounts[bandId] ?? 0;

  const fixedStageItems = useMemo<StageItem[]>(() => {
    const items: StageItem[] = [
      { id: "fixed-main-l", label: "MAIN L", dashed: true, x: 18, y: 84, fixed: true },
      { id: "fixed-main-r", label: "MAIN R", dashed: true, x: 82, y: 84, fixed: true },
      { id: "fixed-mon-1", label: "MON1", dashed: true, x: 12, y: 68, fixed: true },
      { id: "fixed-mon-2", label: "MON2", dashed: true, x: 58, y: 22, fixed: true },
      { id: "fixed-mon-3", label: "MON3", dashed: true, x: 50, y: 82, fixed: true },
      { id: "fixed-mon-4", label: "MON4", dashed: true, x: 88, y: 68, fixed: true },
    ];
    items.push(
      { id: "fixed-mc-1", label: "MC1", dashed: false, x: 26, y: 84, fixed: true },
      { id: "fixed-mc-2", label: "MC2", dashed: false, x: 58, y: 10, fixed: true }
    );
    return items;
  }, [bandMembers]);

  const stageOccupants = useMemo(() => {
    const occupants: Array<{
      id: string;
      type: "member" | "item" | "fixed";
      x: number;
      y: number;
      radius: number;
    }> = [];
    fixedStageItems.forEach((item) => {
      occupants.push({
        id: item.id,
        type: "fixed",
        x: item.x,
        y: item.y,
        radius: getCollisionRadius("fixed", item.id),
      });
    });
    stageItems.forEach((item) => {
      occupants.push({
        id: item.id,
        type: "item",
        x: item.x,
        y: item.y,
        radius: getCollisionRadius("item"),
      });
    });
    bandMembers.forEach((member) => {
      occupants.push({
        id: member.id,
        type: "member",
        x: member.x,
        y: member.y,
        radius: getCollisionRadius("member"),
      });
    });
    return occupants;
  }, [bandMembers, fixedStageItems, stageItems]);

  const orderedSongs = useMemo(() => songs, [songs]);
  const getSongFieldValue = useCallback(
    <K extends keyof SongEntry>(entry: SongEntry, key: K): SongEntry[K] => {
      const draft = songDrafts[String(entry.id)];
      if (draft && Object.prototype.hasOwnProperty.call(draft, key)) {
        return draft[key] as SongEntry[K];
      }
      return entry[key];
    },
    [songDrafts]
  );
  const totalDurationSec = useMemo(
    () =>
      orderedSongs.reduce((sum, entry) => {
        const durationMin = getSongFieldValue(entry, "durationMin");
        const durationSec = getSongFieldValue(entry, "durationSec");
        const sec = toDurationSec(durationMin, durationSec);
        return sum + (sec ?? 0);
      }, 0),
    [getSongFieldValue, orderedSongs]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeEntry = useMemo(
    () =>
      activeId
        ? songs.find((entry) => String(entry.id) === activeId) ?? null
        : null,
    [activeId, songs]
  );

  const activeIndex = useMemo(() => {
    if (!activeId) return -1;
    return orderedSongs.findIndex((entry) => String(entry.id) === activeId);
  }, [activeId, orderedSongs]);

  const loadSongs = useCallback(async (bandId: string) => {
    setSongsLoading(true);

    const { data, error } = await supabase
      .from("songs")
      .select(
        "id, band_id, title, artist, entry_type, url, order_index, duration_sec, arrangement_note, lighting_spot, lighting_strobe, lighting_moving, lighting_color, memo, created_at"
      )
      .eq("band_id", bandId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setSongs([]);
      setSongDrafts({});
      toast.error("レパートリーの取得に失敗しました。");
    } else {
      setSongs(normalizeSongs((data ?? []) as SongRow[]));
      setSongDrafts({});
    }
    setRemovedIds([]);
    setSongsLoading(false);
  }, []);

  const loadBandMembers = useCallback(async (bandId: string) => {
    setBandMembersLoading(true);
    const { data, error } = await supabase
      .from("band_members")
      .select(
        "id, band_id, user_id, instrument, position_x, position_y, order_index, created_at, monitor_request, monitor_note, is_mc, profiles(display_name, real_name, part)"
      )
      .eq("band_id", bandId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      toast.error("バンドメンバーの取得に失敗しました。");
      setBandMembers([]);
      setBandMembersLoading(false);
      return;
    }

    const counters: Record<StageCategory, number> = {
      drums: 0,
      bass: 0,
      guitar: 0,
      keyboard: 0,
      wind: 0,
      vocal: 0,
      other: 0,
    };

    const rows = (data ?? []) as BandMemberRow[];
    const sortedRows = [...rows].sort((a, b) => {
      const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    });

    const nextMembers = sortedRows.map((row, index) => {
      const memberRow = row as BandMemberRow;
      const profile = Array.isArray(memberRow.profiles)
        ? memberRow.profiles[0] ?? null
        : memberRow.profiles ?? null;
      const instrument = memberRow.instrument ?? "";
      const partLabel = instrument || profile?.part || "";
      const category = getStageCategory(partLabel);
      const categoryIndex = counters[category]++;
      const fallback = getAutoPosition(category, categoryIndex);
      const x = memberRow.position_x ?? fallback.x;
      const y = memberRow.position_y ?? fallback.y;
      return {
        id: memberRow.id,
        userId: memberRow.user_id,
        name: profile?.real_name ?? profile?.display_name ?? "名前未登録",
        realName: profile?.real_name ?? null,
        part: profile?.part ?? null,
        instrument,
        x,
        y,
        orderIndex: memberRow.order_index ?? index + 1,
        monitorRequest: memberRow.monitor_request ?? "",
        monitorNote: memberRow.monitor_note ?? "",
        isMc: Boolean(memberRow.is_mc),
      } satisfies StageMember;
    });

    setBandMembers(withMemberOrder(nextMembers));
    setBandMembersLoading(false);
  }, []);

  const refreshCounts = useCallback(async (bandIds: string[]) => {
    if (bandIds.length === 0) {
      setSongCounts({});
      return;
    }
    const { data, error } = await supabase
      .from("songs")
      .select("id, band_id, entry_type")
      .in("band_id", bandIds);
    if (error) {
      console.error(error);
      return;
    }
    const counts: Record<string, number> = {};
    (data ?? []).forEach((row) => {
      const entry = row as { band_id: string; entry_type?: string | null };
      if (entry.entry_type === "mc") return;
      counts[entry.band_id] = (counts[entry.band_id] ?? 0) + 1;
    });
    setSongCounts(counts);
  }, []);

  const handleCreateBand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newBandName.trim();
    const instrument = newBandInstrument.trim();
    if (!eventId || !name || creatingBand) return;
    if (!canManageBands) {
      toast.error("このイベントではバンドを作成できません。");
      return;
    }
    if (!userId) {
      toast.error("ログイン情報を確認できません。");
      return;
    }
    if (!instrument) {
      toast.error("担当楽器を入力してください。");
      return;
    }
    setCreatingBand(true);
    const { data, error } = await supabase
      .from("bands")
      .insert([
        {
          event_id: eventId,
          name,
          created_by: userId,
          representative_name: currentUserName.trim() || null,
        },
      ])
      .select(
        "id, name, created_by, repertoire_status, stage_plot_data, representative_name, sound_note, lighting_note, general_note, lighting_total_min"
      )
      .maybeSingle();
    if (error || !data) {
      console.error(error);
      toast.error("バンドの作成に失敗しました。");
      setCreatingBand(false);
      return;
    }
    const created = data as BandRow;
    const { error: joinError } = await supabase.from("band_members").insert([
      {
        band_id: created.id,
        user_id: userId,
        instrument,
        order_index: 1,
      },
    ]);
    if (joinError) {
      console.error(joinError);
      toast.error("作成者の参加登録に失敗しました。");
    }
    setAllBands((prev) => [...prev, created]);
    setBands((prev) => [...prev, created]);
    setSelectedBandId(created.id);
    setSongCounts((prev) => ({ ...prev, [created.id]: 0 }));
    setNewBandName("");
    setNewBandInstrument("");
    setCreatingBand(false);
  };

  const handleJoinBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || joining) return;
    if (!canManageBands) {
      toast.error("このイベントでは参加登録できません。");
      return;
    }
    if (!userId) {
      toast.error("ログイン情報を確認できません。");
      return;
    }
    const bandId = joinBandId;
    const instrument = joinInstrument.trim();
    if (!bandId || !instrument) {
      toast.error("参加するバンドと担当楽器を入力してください。");
      return;
    }
    setJoining(true);
    const { error } = await supabase.from("band_members").insert([
      {
        band_id: bandId,
        user_id: userId,
        instrument,
        order_index: null,
      },
    ]);
    if (error) {
      console.error(error);
      toast.error("バンドへの参加に失敗しました。");
      setJoining(false);
      return;
    }
    const joinedBand = allBands.find((band) => band.id === bandId);
    if (joinedBand) {
      setBands((prev) =>
        prev.some((band) => band.id === joinedBand.id) ? prev : [...prev, joinedBand]
      );
      setSelectedBandId(joinedBand.id);
      await refreshCounts(
        Array.from(new Set([...bands.map((band) => band.id), joinedBand.id]))
      );
    }
    setJoinBandId("");
    setJoinInstrument("");
    setJoining(false);
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      const [{ data, error }, { data: leaderRows, error: leaderError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, real_name, part, leader")
          .order("real_name", { ascending: true }),
        supabase
          .from("profile_leaders")
          .select("profile_id, leader")
          .in("leader", ["Administrator"]),
      ]);

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error("部員情報の取得に失敗しました。");
        const fallbackName =
          session.user.user_metadata?.full_name ??
          session.user.user_metadata?.name ??
          session.user.email ??
          "";
        setCurrentUserName(fallbackName);
        setProfiles([]);
        setSubPartsByProfileId({});
        return;
      }
      if (leaderError) {
        console.error(leaderError);
      }
      const adminIds = new Set(
        (leaderRows ?? []).map((row) => (row as { profile_id?: string }).profile_id).filter(Boolean)
      );
      const nextProfiles = (data ?? []) as ProfileOption[];
      const fallbackName =
        session.user.user_metadata?.full_name ??
        session.user.user_metadata?.name ??
        session.user.email ??
        "";
      const currentProfile = nextProfiles.find((profile) => profile.id === session.user.id);
      const resolvedName =
        currentProfile?.real_name ?? currentProfile?.display_name ?? fallbackName;
      setCurrentUserName(resolvedName);
      setCurrentProfile(currentProfile ?? null);
      const filtered = nextProfiles.filter(
        (profile) => !adminIds.has(profile.id) && !adminLeaderSet.has(profile.leader ?? "")
      );
      setProfiles(filtered);
      const currentBaseParts: string[] = [];
      const currentMainPart = currentProfile?.part?.trim();
      if (currentMainPart && currentMainPart !== "none") {
        currentBaseParts.push(currentMainPart);
      }
      const profileIdsForParts = Array.from(
        new Set([...filtered.map((profile) => profile.id), session.user.id])
      );
      if (profileIdsForParts.length === 0) {
        setSubPartsByProfileId({});
        setCurrentProfileParts(currentBaseParts);
        return;
      }

      const { data: partsData, error: partsError } = await supabase
        .from("profile_parts")
        .select("profile_id, part, is_primary")
        .in(
          "profile_id",
          profileIdsForParts
        );

      if (cancelled) return;

      if (partsError) {
        console.error(partsError);
        setSubPartsByProfileId({});
        setCurrentProfileParts(currentBaseParts);
        return;
      }

      const nextMap: Record<string, string[]> = {};
      (partsData ?? []).forEach((row) => {
        const entry = row as ProfilePartRow;
        if (!entry.profile_id) return;
        const partValue = entry.part?.trim();
        if (!partValue || partValue === "none") return;
        if (entry.is_primary) return;
        const bucket = nextMap[entry.profile_id] ?? [];
        if (!bucket.includes(partValue)) {
          bucket.push(partValue);
        }
        nextMap[entry.profile_id] = bucket;
      });
      setSubPartsByProfileId(nextMap);
      const currentParts = [...currentBaseParts];
      const currentSubParts = nextMap[session.user.id] ?? [];
      currentSubParts.forEach((part) => {
        const value = part?.trim();
        if (!value || value === "none") return;
        if (!currentParts.includes(value)) currentParts.push(value);
      });
      setCurrentProfileParts(currentParts);
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!eventId || roleLoading) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const [eventRes, bandsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, event_type")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("bands")
          .select(
            "id, name, created_by, repertoire_status, stage_plot_data, representative_name, sound_note, lighting_note, general_note, lighting_total_min"
          )
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        toast.error("イベント情報の取得に失敗しました。");
        setEvent(null);
      } else {
        setEvent(eventRes.data as EventRow);
      }

      if (bandsRes.error) {
        console.error(bandsRes.error);
        setAllBands([]);
        setBands([]);
        setSelectedBandId(null);
      } else {
        const allBandList = (bandsRes.data ?? []) as BandRow[];
        setAllBands(allBandList);

        let editableBands: BandRow[] = [];

        if (!userId || allBandList.length === 0) {
          editableBands = [];
        } else {
          const { data: memberData, error: memberError } = await supabase
            .from("band_members")
            .select("band_id")
            .eq("user_id", userId)
            .in(
              "band_id",
              allBandList.map((band) => band.id)
            );
          if (memberError) {
            console.error(memberError);
            editableBands = [];
          } else {
            const memberSet = new Set(
              (memberData ?? []).map((row) => (row as { band_id: string }).band_id)
            );
            editableBands = allBandList.filter(
              (band) => band.created_by === userId || memberSet.has(band.id)
            );
          }
        }

        setBands(editableBands);
        setSelectedBandId((prev) => {
          if (!prev) return editableBands[0]?.id ?? null;
          return editableBands.some((band) => band.id === prev)
            ? prev
            : editableBands[0]?.id ?? null;
        });
        await refreshCounts(editableBands.map((band) => band.id));
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, hasLeaderPrivileges, refreshCounts, roleLoading, userId]);

  useEffect(() => {
    if (!selectedBandId) return;
    void loadSongs(selectedBandId);
  }, [loadSongs, selectedBandId]);

  useEffect(() => {
    if (!selectedBandId) {
      setBandMembers([]);
      setAddMemberId("");
      setAddMemberInstrument("");
      setMemberSearch("");
      setSelectedStageItemId(null);
      setIsStageEditOpen(false);
      setSelectedMemberEditId(null);
      setIsMemberEditOpen(false);
      return;
    }
    void loadBandMembers(selectedBandId);
  }, [loadBandMembers, selectedBandId]);

  useEffect(() => {
    if (!selectedBand) return;
    const nextStatus =
      (selectedBand.repertoire_status as RepertoireStatus | null) ?? "draft";
    setRepertoireStatus(nextStatus);
  }, [selectedBand]);

  useEffect(() => {
    if (!selectedBand) {
      setBandName("");
      setRepresentativeName("");
      setSoundNote("");
      setLightingNote("");
      setGeneralNote("");
      setLightingTotal("");
      setStageItems([]);
      return;
    }
    setBandName(selectedBand.name ?? "");
    setSelectedStageItemId(null);
    setIsStageEditOpen(false);
    setSelectedMemberEditId(null);
    setIsMemberEditOpen(false);
    const saved = selectedBand.representative_name ?? "";
    if (saved.trim()) {
      setRepresentativeName(saved);
    } else if (selectedBand.created_by === userId && currentUserName.trim()) {
      setRepresentativeName(currentUserName);
    } else {
      setRepresentativeName("");
    }
    setSoundNote(selectedBand.sound_note ?? "");
    setLightingNote(selectedBand.lighting_note ?? "");
    setGeneralNote(selectedBand.general_note ?? "");
    setLightingTotal(
      selectedBand.lighting_total_min != null
        ? String(selectedBand.lighting_total_min)
        : ""
    );
    const rawItems = selectedBand.stage_plot_data?.items;
    if (Array.isArray(rawItems)) {
      const parsed = rawItems
        .map((item) => {
          const entry = item as {
            id?: string;
            label?: string;
            dashed?: boolean;
            x?: number;
            y?: number;
          };
          if (!entry.label) return null;
          return {
            id: entry.id ?? crypto.randomUUID(),
            label: entry.label,
            dashed: Boolean(entry.dashed),
            x: clampPercent(Number(entry.x ?? 50)),
            y: clampPercent(Number(entry.y ?? 50)),
          } satisfies StageItem;
        })
        .filter(Boolean) as StageItem[];
      setStageItems(parsed);
    } else {
      setStageItems([]);
    }
  }, [selectedBand, currentUserName, userId]);

  useEffect(() => {
    if (!autoSaveKey || autoSaveReadyKey === autoSaveKey) return;
    if (!selectedBandId || songsLoading || bandMembersLoading) return;
    try {
      const raw = localStorage.getItem(autoSaveKey);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<RepertoireDraft>;
        if (draft.bandId === selectedBandId) {
          if (typeof draft.bandName === "string") setBandName(draft.bandName);
          if (typeof draft.representativeName === "string") {
            setRepresentativeName(draft.representativeName);
          }
          if (typeof draft.generalNote === "string") setGeneralNote(draft.generalNote);
          if (typeof draft.soundNote === "string") setSoundNote(draft.soundNote);
          if (typeof draft.lightingNote === "string") setLightingNote(draft.lightingNote);
          if (typeof draft.lightingTotal === "string") setLightingTotal(draft.lightingTotal);
          if (draft.repertoireStatus === "draft" || draft.repertoireStatus === "submitted") {
            setRepertoireStatus(draft.repertoireStatus);
          }
          if (Array.isArray(draft.songs)) setSongs(draft.songs);
          if (Array.isArray(draft.removedSongIds)) setRemovedIds(draft.removedSongIds);
          if (Array.isArray(draft.stageItems)) setStageItems(draft.stageItems);
          if (Array.isArray(draft.bandMembers)) setBandMembers(draft.bandMembers);
          if (typeof draft.updatedAt === "number") setAutoSavedAt(draft.updatedAt);
          toast.info("一時保存を復元しました。");
        }
      }
    } catch {
      // noop
    }
    setAutoSaveReadyKey(autoSaveKey);
  }, [
    autoSaveKey,
    autoSaveReadyKey,
    bandMembersLoading,
    selectedBandId,
    songsLoading,
  ]);

  useEffect(() => {
    if (!autoSaveKey || autoSaveReadyKey !== autoSaveKey) return;
    if (!selectedBandId || loading || songsLoading || bandMembersLoading || savingAll)
      return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    const draft: RepertoireDraft = {
      eventId: eventId ?? "",
      bandId: selectedBandId,
      updatedAt: Date.now(),
      bandName,
      representativeName,
      generalNote,
      soundNote,
      lightingNote,
      lightingTotal,
      repertoireStatus,
      songs,
      removedSongIds: removedIds,
      stageItems,
      bandMembers,
    };
    autoSaveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(autoSaveKey, JSON.stringify(draft));
        setAutoSavedAt(draft.updatedAt);
      } catch {
        // noop
      }
    }, 900);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    autoSaveKey,
    autoSaveReadyKey,
    bandMembers,
    bandMembersLoading,
    bandName,
    eventId,
    generalNote,
    lightingNote,
    lightingTotal,
    loading,
    removedIds,
    repertoireStatus,
    representativeName,
    selectedBandId,
    savingAll,
    songs,
    songsLoading,
    soundNote,
    stageItems,
  ]);

  useEffect(() => {
    if (!selectedStageItemId) return;
    if (!stageItems.some((item) => item.id === selectedStageItemId)) {
      setSelectedStageItemId(null);
      setIsStageEditOpen(false);
    }
  }, [stageItems, selectedStageItemId]);

  useEffect(() => {
    if (!selectedMemberEditId) return;
    if (!bandMembers.some((member) => member.id === selectedMemberEditId)) {
      setSelectedMemberEditId(null);
      setIsMemberEditOpen(false);
    }
  }, [bandMembers, selectedMemberEditId]);

  useEffect(() => {
    if (
      !isStageEditOpen ||
      !selectedStageItem ||
      !stageWrapperRef.current
    ) {
      setStageEditAnchor(null);
      return;
    }
    const metrics = getStageMetrics();
    if (!metrics) {
      setStageEditAnchor(null);
      return;
    }
    const wrapperRect = stageWrapperRef.current.getBoundingClientRect();
    const anchorX =
      (selectedStageItem.x / 100) * metrics.baseWidth * stageZoom +
      stagePan.x +
      (metrics.viewportRect.left - wrapperRect.left);
    const anchorY =
      (selectedStageItem.y / 100) * metrics.baseHeight * stageZoom +
      stagePan.y +
      (metrics.viewportRect.top - wrapperRect.top);
    const panelWidth = 240;
    const panelHeight = 190;
    let left = anchorX + 16;
    if (left + panelWidth > wrapperRect.width - 8) {
      left = anchorX - panelWidth - 16;
    }
    if (left < 8) left = 8;
    let top = anchorY - panelHeight / 2;
    if (top < 8) top = 8;
    if (top + panelHeight > wrapperRect.height - 8) {
      top = wrapperRect.height - panelHeight - 8;
    }
    setStageEditAnchor({ left, top });
  }, [isStageEditOpen, selectedStageItem, stagePan, stageZoom]);

  useEffect(() => {
    if (
      !isMemberEditOpen ||
      !selectedMemberEdit ||
      !stageWrapperRef.current
    ) {
      setMemberEditAnchor(null);
      return;
    }
    const metrics = getStageMetrics();
    if (!metrics) {
      setMemberEditAnchor(null);
      return;
    }
    const wrapperRect = stageWrapperRef.current.getBoundingClientRect();
    const anchorX =
      (selectedMemberEdit.x / 100) * metrics.baseWidth * stageZoom +
      stagePan.x +
      (metrics.viewportRect.left - wrapperRect.left);
    const anchorY =
      (selectedMemberEdit.y / 100) * metrics.baseHeight * stageZoom +
      stagePan.y +
      (metrics.viewportRect.top - wrapperRect.top);
    const panelWidth = 220;
    const panelHeight = 170;
    let left = anchorX + 16;
    if (left + panelWidth > wrapperRect.width - 8) {
      left = anchorX - panelWidth - 16;
    }
    if (left < 8) left = 8;
    let top = anchorY - panelHeight / 2;
    if (top < 8) top = 8;
    if (top + panelHeight > wrapperRect.height - 8) {
      top = wrapperRect.height - panelHeight - 8;
    }
    setMemberEditAnchor({ left, top });
  }, [isMemberEditOpen, selectedMemberEdit, stagePan, stageZoom]);

  useEffect(() => {
    if (!isMemberEditOpen) return;
    const id = window.setTimeout(() => {
      memberEditInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [isMemberEditOpen]);

  useEffect(() => {
    if (!addMemberId) {
      setAddMemberInstrument("");
      prevAddMemberIdRef.current = "";
      return;
    }
    const nextDefault = addMemberInstrumentOptions[0] ?? "";
    if (prevAddMemberIdRef.current !== addMemberId) {
      setAddMemberInstrument(nextDefault);
      prevAddMemberIdRef.current = addMemberId;
      return;
    }
    if (!addMemberInstrument) {
      setAddMemberInstrument(nextDefault);
    }
  }, [addMemberId, addMemberInstrument, addMemberInstrumentOptions]);

  useEffect(() => {
    if (!newBandInstrument && currentProfileParts.length > 0) {
      setNewBandInstrument(currentProfileParts[0]);
    }
  }, [currentProfileParts, newBandInstrument]);

  useEffect(() => {
    return () => {
      urlFetchTimers.current.forEach((timer) => window.clearTimeout(timer));
      urlFetchTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!printMode) return;
    document.body.dataset.printMode = printMode;
    const timer = window.setTimeout(() => {
      window.print();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [printMode]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintMode(null);
      delete document.body.dataset.printMode;
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const updateSongField = <K extends keyof SongEntry>(
    id: string,
    key: K,
    value: SongEntry[K]
  ) => {
    const normalizedId = String(id);
    setSongDrafts((prev) => ({
      ...prev,
      [normalizedId]: { ...(prev[normalizedId] ?? {}), [key]: value },
    }));
    setSongs((prev) =>
      prev.map((entry) =>
        String(entry.id) === normalizedId ? { ...entry, [key]: value } : entry
      )
    );
  };

  const updateBandMemberField = <K extends keyof StageMember>(
    id: string,
    key: K,
    value: StageMember[K]
  ) => {
    setBandMembers((prev) =>
      prev.map((member) => (member.id === id ? { ...member, [key]: value } : member))
    );
  };

  const scheduleMetadataFetch = (id: string, url: string, entryType: EntryType) => {
    if (entryType !== "song") return;
    if (!url.trim()) return;

    const existing = urlFetchTimers.current.get(id);
    if (existing) {
      window.clearTimeout(existing);
    }

    const timer = window.setTimeout(async () => {
      setFetchingMeta((prev) => ({ ...prev, [id]: true }));
      try {
        const res = await fetch("/api/repertoire/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          title?: string | null;
          artist?: string | null;
          duration_sec?: number | null;
        };
        setSongs((prev) =>
          prev.map((entry) => {
            if (entry.id !== id || entry.url.trim() !== url.trim()) return entry;
            const next = { ...entry };
            if (!next.title.trim() && data.title) {
              next.title = data.title;
            }
            if (!next.artist.trim() && data.artist) {
              next.artist = data.artist;
            }
            if (
              !next.durationMin.trim() &&
              !next.durationSec.trim() &&
              data.duration_sec != null
            ) {
              const durationInputs = toDurationInputs(data.duration_sec);
              next.durationMin = durationInputs.durationMin;
              next.durationSec = durationInputs.durationSec;
            }
            return next;
          })
        );
      } catch {
        // noop
      } finally {
        setFetchingMeta((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }, 700);

    urlFetchTimers.current.set(id, timer);
  };

  const addEntry = (entryType: EntryType) => {
    if (!selectedBandId) return;
    const newEntry: SongEntry = {
      id: createTempId(),
      band_id: selectedBandId,
      entry_type: entryType,
      title: entryType === "mc" ? "MC" : "",
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
    setSongs((prev) => [...prev, newEntry]);
  };

  const removeEntry = (id: string) => {
    const normalizedId = String(id);
    setSongs((prev) => prev.filter((entry) => String(entry.id) !== normalizedId));
    setSongDrafts((prev) => {
      if (!prev[normalizedId]) return prev;
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
    if (!isTemp(normalizedId)) {
      setRemovedIds((prev) => [...prev, normalizedId]);
    }
  };

  const moveEntry = (fromIndex: number, toIndex: number) => {
    setSongs((prev) => {
      const next = arrayMove(prev, fromIndex, toIndex);
      return next.map((entry, index) => ({ ...entry, order_index: index + 1 }));
    });
  };

  const moveBandMember = (fromIndex: number, toIndex: number) => {
    setBandMembers((prev) => withMemberOrder(arrayMove(prev, fromIndex, toIndex)));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    const activeIdStr = String(active.id);
    if (!over) return;
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;
    setSongs((prev) => {
      const oldIndex = prev.findIndex((entry) => String(entry.id) === activeIdStr);
      const newIndex = prev.findIndex((entry) => String(entry.id) === overIdStr);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      return next.map((entry, index) => ({ ...entry, order_index: index + 1 }));
    });
  };

  const getNextStagePosition = useCallback(
    (instrument: string) => {
      const category = getStageCategory(instrument);
      const count = bandMembers.filter(
        (member) => getStageCategory(member.instrument || member.part) === category
      ).length;
      return getAutoPosition(category, count);
    },
    [bandMembers]
  );

  const handleAddMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBandId || addingMember) return;
    if (!canEditBandMembers) {
      toast.error("バンドメンバーを編集する権限がありません。");
      return;
    }
    const instrument = addMemberInstrument.trim();
    if (!addMemberId || !instrument) {
      toast.error("追加するメンバーと担当パートを入力してください。");
      return;
    }
    setAddingMember(true);
    const position = getNextStagePosition(instrument);
    const resolved = resolveStagePosition(position.x, position.y, "member");
    const nextOrderIndex = bandMembers.length + 1;
    const { data, error } = await supabase
      .from("band_members")
      .insert([
        {
          band_id: selectedBandId,
          user_id: addMemberId,
          instrument,
          order_index: nextOrderIndex,
          position_x: resolved.x,
          position_y: resolved.y,
          monitor_request: "",
          monitor_note: "",
          is_mc: false,
        },
      ])
      .select(
        "id, band_id, user_id, instrument, position_x, position_y, order_index, monitor_request, monitor_note, is_mc, profiles(display_name, real_name, part)"
      )
      .maybeSingle();
    if (error || !data) {
      console.error(error);
      toast.error("メンバーの追加に失敗しました。");
      setAddingMember(false);
      return;
    }

    const row = data as BandMemberRow;
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0] ?? null
      : row.profiles ?? profiles.find((profileItem) => profileItem.id === row.user_id) ?? null;
    const nextMember: StageMember = {
      id: row.id,
      userId: row.user_id,
      name: profile?.real_name ?? profile?.display_name ?? "名前未登録",
      realName: profile?.real_name ?? null,
      part: profile?.part ?? null,
      instrument: row.instrument,
      x: row.position_x ?? resolved.x,
      y: row.position_y ?? resolved.y,
      orderIndex: row.order_index ?? nextOrderIndex,
      monitorRequest: row.monitor_request ?? "",
      monitorNote: row.monitor_note ?? "",
      isMc: Boolean(row.is_mc),
    };
    setBandMembers((prev) => withMemberOrder([...prev, nextMember]));
    setAddMemberId("");
    setAddMemberInstrument("");
    setMemberSearch("");
    setAddingMember(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedBandId || !canEditBandMembers) return;
    const target = bandMembers.find((member) => member.id === memberId);
    if (!target) return;
    const { error } = await supabase.from("band_members").delete().eq("id", memberId);
    if (error) {
      console.error(error);
      toast.error("メンバーの削除に失敗しました。");
      return;
    }
    setBandMembers((prev) =>
      withMemberOrder(prev.filter((member) => member.id !== memberId))
    );
    if (addMemberId === target.userId) {
      setAddMemberId("");
      setAddMemberInstrument("");
    }
    toast.success("メンバーを削除しました。");
  };

  useEffect(() => {
    if (!canEditBandMembers) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
          return;
        }
        if (target.isContentEditable) return;
      }
      if (selectedStageItemId) {
        event.preventDefault();
        handleRemoveStageItem(selectedStageItemId);
        setSelectedStageItemId(null);
        setIsStageEditOpen(false);
        return;
      }
      if (selectedMemberEditId) {
        event.preventDefault();
        void handleRemoveMember(selectedMemberEditId);
        setSelectedMemberEditId(null);
        setIsMemberEditOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canEditBandMembers, selectedStageItemId, selectedMemberEditId]);

  const saveBandMembers = async (showToast: boolean) => {
    if (!selectedBandId || savingStage) return false;
    if (!canEditBandMembers) {
      if (showToast) {
        toast.error("PA情報を保存する権限がありません。");
      }
      return false;
    }
    setSavingStage(true);
    const orderedMembers = withMemberOrder(bandMembers);
    const updates = orderedMembers.map((member) => ({
      id: member.id,
      band_id: selectedBandId,
      user_id: member.userId,
      instrument: member.instrument,
      position_x: member.x,
      position_y: member.y,
      order_index: member.orderIndex ?? null,
      monitor_request: member.monitorRequest.trim() || null,
      monitor_note: member.monitorNote.trim() || null,
      is_mc: member.isMc,
    }));
    const { error } = await supabase.from("band_members").upsert(updates, {
      onConflict: "id",
    });
    if (error) {
      console.error(error);
      if (showToast) {
        toast.error("PA情報の保存に失敗しました。");
      }
      setSavingStage(false);
      return false;
    }
    setBandMembers(orderedMembers);
    if (showToast) {
      toast.success("PA情報を保存しました。");
    }
    setSavingStage(false);
    return true;
  };

  const handleSaveStagePositions = async () => {
    await saveBandMembers(true);
  };

  const saveBandInfo = async (showToast: boolean) => {
    if (!selectedBandId || savingBandInfo) return false;
    if (!canEditBandMembers) {
      if (showToast) {
        toast.error("基本情報を保存する権限がありません。");
      }
      return false;
    }
    const nextBandName = bandName.trim();
    if (!nextBandName) {
      if (showToast) {
        toast.error("バンド名を入力してください。");
      }
      return false;
    }
    setSavingBandInfo(true);
    const { error } = await supabase
      .from("bands")
      .update({
        name: nextBandName,
        representative_name: representativeName.trim() || null,
        general_note: generalNote.trim() || null,
      })
      .eq("id", selectedBandId);
    if (error) {
      console.error(error);
      if (showToast) {
        toast.error("基本情報の保存に失敗しました。");
      }
      setSavingBandInfo(false);
      return false;
    }
    setBands((prev) =>
      prev.map((band) =>
        band.id === selectedBandId
          ? {
              ...band,
              name: nextBandName,
              representative_name: representativeName.trim() || null,
              general_note: generalNote.trim() || null,
            }
          : band
      )
    );
    setBandName(nextBandName);
    if (showToast) {
      toast.success("基本情報を保存しました。");
    }
    setSavingBandInfo(false);
    return true;
  };

  const handleSaveBandInfo = async () => {
    await saveBandInfo(true);
  };

  const handleDeleteBand = async () => {
    if (!selectedBandId || deletingBand) return;
    if (!canDeleteBand) {
      toast.error("バンドを削除する権限がありません。");
      return;
    }
    const confirmed = window.confirm("このバンドを削除します。よろしいですか？");
    if (!confirmed) return;
    setDeletingBand(true);
    const { error } = await supabase.from("bands").delete().eq("id", selectedBandId);
    if (error) {
      console.error(error);
      toast.error("バンドの削除に失敗しました。");
      setDeletingBand(false);
      return;
    }
    const nextBands = bands.filter((band) => band.id !== selectedBandId);
    setBands(nextBands);
    setAllBands((prev) => prev.filter((band) => band.id !== selectedBandId));
    setSongCounts((prev) => {
      const next = { ...prev };
      delete next[selectedBandId];
      return next;
    });
    setSelectedBandId((prev) => {
      if (prev !== selectedBandId) return prev;
      return nextBands[0]?.id ?? null;
    });
    toast.success("バンドを削除しました。");
    setDeletingBand(false);
  };

  const savePaInfo = async (showToast: boolean) => {
    if (!selectedBandId || savingPaInfo) return false;
    if (!canEditBandMembers) {
      if (showToast) {
        toast.error("PA情報を保存する権限がありません。");
      }
      return false;
    }
    setSavingPaInfo(true);
    const stagePayload = {
      items: stageItems.map((item) => ({
        id: item.id,
        label: item.label,
        dashed: item.dashed,
        x: item.x,
        y: item.y,
      })),
    };
    const { error } = await supabase
      .from("bands")
      .update({
        sound_note: soundNote.trim() || null,
        stage_plot_data: stagePayload,
      })
      .eq("id", selectedBandId);
    if (error) {
      console.error(error);
      if (showToast) {
        toast.error("PA情報の保存に失敗しました。");
      }
      setSavingPaInfo(false);
      return false;
    }
    setBands((prev) =>
      prev.map((band) =>
        band.id === selectedBandId
          ? {
              ...band,
              sound_note: soundNote.trim() || null,
              stage_plot_data: stagePayload,
            }
          : band
      )
    );
    const savedMembers = await saveBandMembers(false);
    if (!savedMembers) {
      if (showToast) {
        toast.error("PA情報の保存に失敗しました。");
      }
      setSavingPaInfo(false);
      return false;
    }
    if (showToast) {
      toast.success("PA情報を保存しました。");
    }
    setSavingPaInfo(false);
    return true;
  };

  const handleSavePaInfo = async () => {
    await savePaInfo(true);
  };

  const saveLightingInfo = async (showToast: boolean) => {
    if (!selectedBandId || savingLightingInfo) return false;
    if (!canEditBandMembers) {
      if (showToast) {
        toast.error("照明情報を保存する権限がありません。");
      }
      return false;
    }
    setSavingLightingInfo(true);
    const totalValue = lightingTotal.trim();
    const totalMinutes = totalValue ? Number(totalValue) : null;
    const { error } = await supabase
      .from("bands")
      .update({
        lighting_note: lightingNote.trim() || null,
        lighting_total_min: Number.isFinite(totalMinutes) ? totalMinutes : null,
      })
      .eq("id", selectedBandId);
    if (error) {
      console.error(error);
      if (showToast) {
        toast.error("照明情報の保存に失敗しました。");
      }
      setSavingLightingInfo(false);
      return false;
    }
    setBands((prev) =>
      prev.map((band) =>
        band.id === selectedBandId
          ? {
              ...band,
              lighting_note: lightingNote.trim() || null,
              lighting_total_min: Number.isFinite(totalMinutes) ? totalMinutes : null,
          }
          : band
      )
    );
    if (showToast) {
      toast.success("照明情報を保存しました。");
    }
    setSavingLightingInfo(false);
    return true;
  };

  const handleSaveLightingInfo = async () => {
    await saveLightingInfo(true);
  };

  const resolveStagePosition = (
    x: number,
    y: number,
    type: "member" | "item",
    excludeId?: string
  ) => {
    let baseX = clampPercent(x);
    let baseY = clampPercent(y);
    if (effectiveSnap) {
      baseX = clampPercent(snapToGrid(baseX));
      baseY = clampPercent(snapToGrid(baseY));
    }
    if (!collisionEnabled) {
      return { x: baseX, y: baseY };
    }
    const radius = getCollisionRadius(type, excludeId);
    const occupants = stageOccupants.filter(
      (entry) => !(entry.type === type && entry.id === excludeId)
    );
    const filteredOccupants =
      type === "member"
        ? occupants.filter((entry) => {
            if (entry.type !== "fixed") return true;
            return entry.id?.startsWith("fixed-main");
          })
        : occupants;
    const isOverlapping = (posX: number, posY: number) =>
      filteredOccupants.some((entry) => {
        const distance = Math.hypot(entry.x - posX, entry.y - posY);
        return distance < entry.radius + radius;
      });
    if (!isOverlapping(baseX, baseY)) {
      return { x: baseX, y: baseY };
    }
    const maxOffset = 30;
    const step = GRID_STEP;
    const candidates: Array<{ x: number; y: number; distance: number }> = [];
    for (let dx = -maxOffset; dx <= maxOffset; dx += step) {
      for (let dy = -maxOffset; dy <= maxOffset; dy += step) {
        const candidateX = clampPercent(
          effectiveSnap ? snapToGrid(baseX + dx) : baseX + dx
        );
        const candidateY = clampPercent(
          effectiveSnap ? snapToGrid(baseY + dy) : baseY + dy
        );
        candidates.push({
          x: candidateX,
          y: candidateY,
          distance: Math.hypot(dx, dy),
        });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    for (const candidate of candidates) {
      if (!isOverlapping(candidate.x, candidate.y)) {
        return { x: candidate.x, y: candidate.y };
      }
    }
    return { x: baseX, y: baseY };
  };

  const getStageMetrics = () => {
    if (!stageViewportRef.current || !stageRef.current) return null;
    const viewportRect = stageViewportRef.current.getBoundingClientRect();
    const baseWidth = stageRef.current.offsetWidth || viewportRect.width;
    const baseHeight = stageRef.current.offsetHeight || viewportRect.height;
    return { viewportRect, baseWidth, baseHeight };
  };

  const applyStageZoom = (nextZoom: number, center?: { x: number; y: number }) => {
    const metrics = getStageMetrics();
    if (!metrics) return;
    const zoom = Math.min(MAX_STAGE_ZOOM, Math.max(MIN_STAGE_ZOOM, nextZoom));
    const centerPoint = center ?? {
      x: metrics.viewportRect.width / 2,
      y: metrics.viewportRect.height / 2,
    };
    const stageCenterX = (centerPoint.x - stagePan.x) / stageZoom;
    const stageCenterY = (centerPoint.y - stagePan.y) / stageZoom;
    const nextPan = {
      x: centerPoint.x - stageCenterX * zoom,
      y: centerPoint.y - stageCenterY * zoom,
    };
    setStageZoom(zoom);
    setStagePan(nextPan);
  };

  const handleStageViewportPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (event.pointerType === "touch") {
      stagePointerMapRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (stagePointerMapRef.current.size === 2) {
        const metrics = getStageMetrics();
        const points = Array.from(stagePointerMapRef.current.values());
        if (metrics && points.length >= 2) {
          const centerX =
            (points[0].x + points[1].x) / 2 - metrics.viewportRect.left;
          const centerY =
            (points[0].y + points[1].y) / 2 - metrics.viewportRect.top;
          const distance = Math.hypot(
            points[0].x - points[1].x,
            points[0].y - points[1].y
          );
          pinchStateRef.current = {
            startDistance: distance,
            startZoom: stageZoom,
            startPan: stagePan,
            stageCenter: {
              x: (centerX - stagePan.x) / stageZoom,
              y: (centerY - stagePan.y) / stageZoom,
            },
          };
          panStateRef.current = null;
          dragState.current = null;
          setDraggingMemberId(null);
        }
      }
    }

    if (event.target !== event.currentTarget) return;
    if (event.pointerType !== "touch" && !panMode) return;
    panStateRef.current = {
      pointerId: event.pointerId,
      originX: stagePan.x,
      originY: stagePan.y,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStageWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const metrics = getStageMetrics();
    if (!metrics) return;
    const center = {
      x: event.clientX - metrics.viewportRect.left,
      y: event.clientY - metrics.viewportRect.top,
    };
    const nextZoom = stageZoom + (event.deltaY < 0 ? 0.1 : -0.1);
    applyStageZoom(nextZoom, center);
  };

  const handleMarkerPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    memberId: string
  ) => {
    setSelectedMemberEditId(memberId);
    setSelectedStageItemId(null);
    setIsStageEditOpen(false);
    if (!canEditBandMembers) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    dragState.current = {
      id: memberId,
      type: "member",
      offsetX: event.clientX - centerX,
      offsetY: event.clientY - centerY,
    };
    setDraggingMemberId(memberId);
    target.setPointerCapture(event.pointerId);
  };

  const handleStageItemPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    itemId: string
  ) => {
    const currentItem = stageItems.find((item) => item.id === itemId);
    if (currentItem) {
      setSelectedStageItemId(itemId);
      setSelectedMemberEditId(null);
      setIsMemberEditOpen(false);
      const presetMatch = stagePresets.find((preset) => preset.label === currentItem.label);
      setStageEditPreset(presetMatch ? presetMatch.label : "custom");
      setStageEditLabel(currentItem.label);
    }
    if (!canEditBandMembers) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    dragState.current = {
      id: itemId,
      type: "item",
      offsetX: event.clientX - centerX,
      offsetY: event.clientY - centerY,
    };
    target.setPointerCapture(event.pointerId);
  };

  const handleStageItemDoubleClick = (itemId: string) => {
    const currentItem = stageItems.find((item) => item.id === itemId);
    if (!currentItem) return;
    setSelectedStageItemId(itemId);
    const presetMatch = stagePresets.find((preset) => preset.label === currentItem.label);
    setStageEditPreset(presetMatch ? presetMatch.label : "custom");
    setStageEditLabel(currentItem.label);
    setIsStageEditOpen(true);
    setSelectedMemberEditId(null);
    setIsMemberEditOpen(false);
  };

  const handleMemberDoubleClick = (memberId: string) => {
    const currentMember = bandMembers.find((member) => member.id === memberId);
    if (!currentMember) return;
    setSelectedMemberEditId(memberId);
    const raw = currentMember.instrument || currentMember.part || "";
    const { suffix } = splitMemberLabel(raw);
    setMemberEditSuffix(suffix);
    setIsMemberEditOpen(true);
    setSelectedStageItemId(null);
    setIsStageEditOpen(false);
  };

  const appendMemberEditValue = (value: string) => {
    const nextValue = value.trim();
    if (!nextValue) return;
    setMemberEditSuffix((currentValue) => {
      const current = currentValue.trim();
      if (!current) return nextValue;
      const parts = current
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.includes(nextValue)) return currentValue;
      return [...parts, nextValue].join(" / ");
    });
  };

  const handleStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      stagePointerMapRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      const pinchState = pinchStateRef.current;
      const metrics = getStageMetrics();
      if (pinchState && metrics && stagePointerMapRef.current.size >= 2) {
        const points = Array.from(stagePointerMapRef.current.values());
        const centerX =
          (points[0].x + points[1].x) / 2 - metrics.viewportRect.left;
        const centerY =
          (points[0].y + points[1].y) / 2 - metrics.viewportRect.top;
        const distance = Math.hypot(
          points[0].x - points[1].x,
          points[0].y - points[1].y
        );
        const scale = distance / pinchState.startDistance;
        const nextZoom = Math.min(
          MAX_STAGE_ZOOM,
          Math.max(MIN_STAGE_ZOOM, pinchState.startZoom * scale)
        );
        const nextPan = {
          x: centerX - pinchState.stageCenter.x * nextZoom,
          y: centerY - pinchState.stageCenter.y * nextZoom,
        };
        panStateRef.current = null;
        dragState.current = null;
        setDraggingMemberId(null);
        setStageZoom(nextZoom);
        setStagePan(nextPan);
        return;
      }
    }

    if (panStateRef.current && panStateRef.current.pointerId === event.pointerId) {
      const nextPan = {
        x: panStateRef.current.originX + (event.clientX - panStateRef.current.startX),
        y: panStateRef.current.originY + (event.clientY - panStateRef.current.startY),
      };
      setStagePan(nextPan);
      return;
    }

    if (!dragState.current) return;
    const metrics = getStageMetrics();
    if (!metrics) return;
    const centerX = event.clientX - dragState.current.offsetX;
    const centerY = event.clientY - dragState.current.offsetY;
    const stageX =
      (centerX - metrics.viewportRect.left - stagePan.x) / stageZoom;
    const stageY =
      (centerY - metrics.viewportRect.top - stagePan.y) / stageZoom;
    const nextX = (stageX / metrics.baseWidth) * 100;
    const nextY = (stageY / metrics.baseHeight) * 100;
    const resolved = resolveStagePosition(
      nextX,
      nextY,
      dragState.current.type,
      dragState.current.id
    );
    const clampedX = resolved.x;
    const clampedY = resolved.y;
    dragPendingRef.current = {
      id: dragState.current.id,
      type: dragState.current.type,
      x: clampedX,
      y: clampedY,
    };
    if (dragRafRef.current == null) {
      dragRafRef.current = window.requestAnimationFrame(() => {
        const pending = dragPendingRef.current;
        if (!pending) {
          dragRafRef.current = null;
          return;
        }
        if (pending.type === "member") {
          setBandMembers((prev) => {
            const index = prev.findIndex((member) => member.id === pending.id);
            if (index < 0) return prev;
            const target = prev[index];
            if (target.x === pending.x && target.y === pending.y) return prev;
            const next = [...prev];
            next[index] = { ...target, x: pending.x, y: pending.y };
            return next;
          });
        } else {
          setStageItems((prev) => {
            const index = prev.findIndex((item) => item.id === pending.id);
            if (index < 0) return prev;
            const target = prev[index];
            if (target.x === pending.x && target.y === pending.y) return prev;
            const next = [...prev];
            next[index] = { ...target, x: pending.x, y: pending.y };
            return next;
          });
        }
        dragRafRef.current = null;
      });
    }
  };

  const handleStagePointerUp = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event?.pointerType === "touch") {
      stagePointerMapRef.current.delete(event.pointerId);
      if (stagePointerMapRef.current.size < 2) {
        pinchStateRef.current = null;
      }
    }
    if (event && panStateRef.current?.pointerId === event.pointerId) {
      panStateRef.current = null;
    }
    dragState.current = null;
    setDraggingMemberId(null);
    dragPendingRef.current = null;
    if (dragRafRef.current != null) {
      window.cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  };

  const handleAddStageItem = () => {
    if (!canEditBandMembers) return;
    const label = customStageLabel.trim() || stagePreset;
    if (!label) return;
    const preset = stagePresets.find((item) => item.label === stagePreset);
    const dashed = preset ? preset.dashed : true;
    const index = stageItems.length;
    const presetPosition = preset ? stagePresetPositions[preset.label] : undefined;
    const position = presetPosition ?? getFallbackPosition(index);
    const resolved = resolveStagePosition(position.x, position.y, "item");
    setStageItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label,
        dashed,
        x: resolved.x,
        y: resolved.y,
      },
    ]);
    setCustomStageLabel("");
  };

  const handleRemoveStageItem = (itemId: string) => {
    if (!canEditBandMembers) return;
    setStageItems((prev) => prev.filter((item) => item.id !== itemId));
    if (selectedStageItemId === itemId) {
      setSelectedStageItemId(null);
      setIsStageEditOpen(false);
    }
  };

  const handleStageEditPresetChange = (value: string) => {
    setStageEditPreset(value);
    if (value !== "custom") {
      setStageEditLabel(value);
    }
  };

  const handleStageEditLabelChange = (value: string) => {
    setStageEditLabel(value);
    if (stageEditPreset !== "custom" && value !== stageEditPreset) {
      setStageEditPreset("custom");
    }
  };

  const handleUpdateStageItem = () => {
    if (!selectedStageItemId || !canEditBandMembers) return;
    const nextLabel = stageEditLabel.trim();
    if (!nextLabel) return;
    const presetMatch =
      stagePresets.find((preset) => preset.label === stageEditPreset) ??
      stagePresets.find((preset) => preset.label === nextLabel);
    setStageItems((prev) =>
      prev.map((item) =>
        item.id === selectedStageItemId
          ? {
              ...item,
              label: nextLabel,
              dashed: presetMatch ? presetMatch.dashed : item.dashed,
            }
          : item
      )
    );
    setIsStageEditOpen(false);
    setSelectedStageItemId(null);
  };

  const handleApplyMemberEdit = () => {
    if (!selectedMemberEditId || !canEditBandMembers) return;
    const baseLabel = memberEditBaseLabel.trim();
    if (!baseLabel) return;
    const suffix = memberEditSuffix.trim();
    const nextLabel = suffix ? `${baseLabel} / ${suffix}` : baseLabel;
    setBandMembers((prev) =>
      prev.map((member) =>
        member.id === selectedMemberEditId ? { ...member, instrument: nextLabel } : member
      )
    );
    setIsMemberEditOpen(false);
    setSelectedMemberEditId(null);
  };

  const clearAutoSaveDraft = useCallback(() => {
    if (!autoSaveKey) return;
    try {
      localStorage.removeItem(autoSaveKey);
      setAutoSavedAt(null);
    } catch {
      // noop
    }
  }, [autoSaveKey]);

  const saveSongs = async (showToast: boolean) => {
    if (!selectedBandId || saving) return false;
    setSaving(true);
    const payloads = orderedSongs.map((entry, index) => {
      const draft = songDrafts[String(entry.id)];
      const resolvedEntry = draft ? { ...entry, ...draft } : entry;
      return {
        id: resolvedEntry.id,
        band_id: selectedBandId,
        title:
          resolvedEntry.title.trim() ||
          (resolvedEntry.entry_type === "mc" ? "MC" : ""),
        artist:
          resolvedEntry.entry_type === "mc"
            ? null
            : resolvedEntry.artist.trim() || null,
        entry_type: resolvedEntry.entry_type,
        url:
          resolvedEntry.entry_type === "mc"
            ? null
            : resolvedEntry.url.trim() || null,
        order_index: index + 1,
        duration_sec: toDurationSec(
          resolvedEntry.durationMin,
          resolvedEntry.durationSec
        ),
        arrangement_note:
          resolvedEntry.entry_type === "mc"
            ? null
            : resolvedEntry.arrangementNote.trim() || null,
        lighting_spot:
          resolvedEntry.entry_type === "mc"
            ? null
            : resolvedEntry.lightingSpot || null,
        lighting_strobe:
          resolvedEntry.entry_type === "mc"
            ? null
            : resolvedEntry.lightingStrobe || null,
        lighting_moving:
          resolvedEntry.entry_type === "mc"
            ? null
            : resolvedEntry.lightingMoving || null,
        lighting_color:
          resolvedEntry.entry_type === "mc"
            ? null
            : resolvedEntry.lightingColor.trim() || null,
        memo: resolvedEntry.memo.trim() || null,
      };
    });

    const updates = payloads.filter((entry) => !isTemp(entry.id));
    const inserts = payloads.filter((entry) => isTemp(entry.id)).map(({ id, ...rest }) => rest);

    if (removedIds.length > 0) {
      const { error } = await supabase.from("songs").delete().in("id", removedIds);
      if (error) {
        console.error(error);
        if (showToast) {
          toast.error("削除に失敗しました。");
        }
        setSaving(false);
        return false;
      }
    }

    if (updates.length > 0) {
      const { error } = await supabase.from("songs").upsert(updates, { onConflict: "id" });
      if (error) {
        console.error(error);
        if (showToast) {
          toast.error("更新に失敗しました。");
        }
        setSaving(false);
        return false;
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("songs").insert(inserts);
      if (error) {
        console.error(error);
        if (showToast) {
          toast.error("追加に失敗しました。");
        }
        setSaving(false);
        return false;
      }
    }

    if (selectedBand && selectedBand.repertoire_status !== repertoireStatus) {
      const { error } = await supabase
        .from("bands")
        .update({ repertoire_status: repertoireStatus })
        .eq("id", selectedBand.id);
      if (error) {
        console.error(error);
        if (showToast) {
          toast.error("提出状態の更新に失敗しました。");
        }
        setSaving(false);
        return false;
      }
      setBands((prev) =>
        prev.map((band) =>
          band.id === selectedBand.id
            ? { ...band, repertoire_status: repertoireStatus }
            : band
        )
      );
    }

    await loadSongs(selectedBandId);
    await refreshCounts(bands.map((band) => band.id));
    if (showToast) {
      toast.success("保存しました。");
    }
    setSaving(false);
    return true;
  };

  const handleSave = async () => {
    await saveSongs(true);
  };

  const handleSaveAll = async () => {
    if (!selectedBandId || savingAll) return;
    if (!canEditBandMembers) {
      toast.error("保存する権限がありません。");
      return;
    }
    setSavingAll(true);
    const bandInfoOk = await saveBandInfo(false);
    const songsOk = await saveSongs(false);
    const paOk = await savePaInfo(false);
    const lightingOk = await saveLightingInfo(false);
    const succeeded = bandInfoOk && songsOk && paOk && lightingOk;
    if (succeeded) {
      toast.success("保存しました。");
      skipNextAutoSaveRef.current = true;
      clearAutoSaveDraft();
    } else {
      toast.error("保存に失敗しました。");
    }
    setSavingAll(false);
  };

  return (
    <AuthGuard>
      <>
        <div className="flex min-h-screen bg-background print-hide">
          <SideNav />

          <main className="flex-1 md:ml-20">
            <PageHeader
              kicker="Repertoire Submit"
              title="レパ表提出"
              description={event ? `${event.name} / ${event.date}` : "レパ表を提出します。"}
              backHref={`/events/${eventId}`}
              backLabel="イベント詳細に戻る"
            />

            <section className="pb-12 md:pb-16">
              <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {event && !canManageBands ? (
                <div className="rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
                  このイベントではレパ表の提出・バンド登録はできません。（ライブ/合宿のみ対応）
                </div>
              ) : (
                <div className="grid lg:grid-cols-[0.9fr,1.6fr] gap-6">
                  <Card className="bg-card/60 border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">バンド一覧</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {loading ? (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          読み込み中...
                        </div>
                      ) : bands.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                          編集できるバンドがありません。
                        </div>
                      ) : (
                        bands.map((band) => {
                          const selected = band.id === selectedBandId;
                          const status = (band.repertoire_status as RepertoireStatus | null) ?? "draft";
                          return (
                            <button
                              key={band.id}
                              type="button"
                              onClick={() => setSelectedBandId(band.id)}
                              className={cn(
                                "w-full text-left rounded-lg border border-border px-4 py-3 transition-colors",
                                selected
                                  ? "border-primary/50 bg-primary/10"
                                  : "bg-card/60 hover:bg-muted/40"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{band.name}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    曲数: {bandCountLabel(band.id)}
                                  </div>
                                </div>
                                <Badge variant={status === "submitted" ? "default" : "secondary"}>
                                  {status === "submitted" ? "提出済み" : "下書き"}
                                </Badge>
                              </div>
                            </button>
                          );
                        })
                      )}

                      <div className="pt-3 border-t border-border/60 space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">既存バンドに参加する</p>
                          {joinableBands.length === 0 ? (
                            <p className="text-xs text-muted-foreground">参加できるバンドがありません。</p>
                          ) : (
                            <form onSubmit={handleJoinBand} className="flex flex-col gap-2">
                                  <select
                                    value={joinBandId}
                                    onChange={(event) => {
                                      setJoinBandId(event.target.value);
                                    }}
                                    className="h-10 w-full rounded-md border border-input bg-card px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                  >
                                <option value="">バンドを選択</option>
                                {joinableBands.map((band) => (
                                  <option key={band.id} value={band.id}>
                                    {band.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex flex-col sm:flex-row gap-2">
                                  <Input
                                    list="band-join-instruments"
                                    value={joinInstrument}
                                    onChange={(event) => {
                                      setJoinInstrument(event.target.value);
                                    }}
                                    placeholder="担当楽器/パート"
                                  />
                                  <datalist id="band-join-instruments">
                                    {allInstrumentOptions.map((part) => (
                                      <option key={part} value={part} />
                                    ))}
                                  </datalist>
                                <Button
                                  type="submit"
                                  disabled={!joinBandId || !joinInstrument.trim() || joining}
                                  className="gap-2"
                                >
                                  {joining ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Plus className="w-4 h-4" />
                                  )}
                                  参加する
                                </Button>
                              </div>
                            </form>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">新しくバンドを作成する</p>
                          <form onSubmit={handleCreateBand} className="flex flex-col gap-2">
                            <div className="flex flex-col gap-2">
                              <Input
                                value={newBandName}
                                onChange={(event) => {
                                  setNewBandName(event.target.value);
                                }}
                                placeholder="バンド名を入力"
                              />
                              <Input
                                list="band-create-instruments"
                                value={newBandInstrument}
                                onChange={(event) => {
                                  setNewBandInstrument(event.target.value);
                                }}
                                placeholder="担当楽器/パート"
                              />
                              <datalist id="band-create-instruments">
                                {newBandInstrumentOptions.map((part) => (
                                  <option key={part} value={part} />
                                ))}
                              </datalist>
                              <Button
                                type="submit"
                                disabled={
                                  !newBandName.trim() ||
                                  !newBandInstrument.trim() ||
                                  creatingBand
                                }
                                className="gap-2"
                              >
                                {creatingBand ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Plus className="w-4 h-4" />
                                )}
                                作成
                              </Button>
                            </div>
                          </form>
                        </div>
                      </div>
                    </CardContent>
                  </Card>


                  <Tabs defaultValue="common" className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <TabsList className="w-full sm:w-auto">
                        <TabsTrigger value="common">共通</TabsTrigger>
                        <TabsTrigger value="pa">PA</TabsTrigger>
                        <TabsTrigger value="lighting">照明</TabsTrigger>
                      </TabsList>
                      <div className="flex flex-wrap items-center gap-3">
                        {autoSaveLabel ? (
                          <span className="text-xs text-muted-foreground">
                            一時保存: {autoSaveLabel}
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          onClick={handleSaveAll}
                          disabled={!selectedBandId || savingAll}
                          className="gap-2"
                        >
                          {savingAll ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          保存
                        </Button>
                      </div>
                    </div>

                    <TabsContent value="common" className="space-y-6">
                      <Card className="bg-card/60 border-border">
                        <CardHeader className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-lg">基本情報</CardTitle>
                          </div>
                          {selectedBandId && !canEditBandMembers && (
                            <p className="text-xs text-muted-foreground">
                              基本情報の編集はバンドメンバーまたはパートリーダー以上が行えます。
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {!selectedBandId ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              バンドを選択してください。
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1 text-sm">
                                  <span className="text-muted-foreground">イベント名</span>
                                  <p className="font-medium">{event?.name ?? "-"}</p>
                                </div>
                                <label className="space-y-1 text-sm">
                                  <span className="text-muted-foreground">バンド名</span>
                                  <Input
                                    value={bandName}
                                    onChange={(event) => setBandName(event.target.value)}
                                    placeholder="バンド名を入力"
                                    disabled={!canEditBandMembers}
                                  />
                                </label>
                              </div>
                              <label className="space-y-1 text-sm">
                                <span className="text-muted-foreground">代表者氏名</span>
                                <Input
                                  value={representativeName}
                                  onChange={(event) => setRepresentativeName(event.target.value)}
                                  placeholder="代表者名を入力"
                                  disabled={!canEditBandMembers}
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-muted-foreground">全体メモ</span>
                                <Textarea
                                  rows={3}
                                  value={generalNote}
                                  onChange={(event) => setGeneralNote(event.target.value)}
                                  placeholder="全体を通した相談・備考など"
                                  disabled={!canEditBandMembers}
                                />
                              </label>
                            </div>
                          )}
                          {selectedBandId && canDeleteBand && (
                            <div className="pt-2 flex justify-end">
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDeleteBand}
                                disabled={deletingBand}
                                className="gap-2"
                              >
                                {deletingBand ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                                バンド削除
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="bg-card/60 border-border">
                        <CardHeader className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-lg">セットリスト</CardTitle>
                              <p className="text-xs text-muted-foreground mt-1">
                                自動合計: {formatDuration(totalDurationSec)}
                              </p>
                            </div>
                            <select
                              value={repertoireStatus}
                              onChange={(event) =>
                                setRepertoireStatus(event.target.value as RepertoireStatus)
                              }
                              className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                              disabled={!selectedBandId}
                            >
                              {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => addEntry("song")}
                              disabled={!selectedBandId}
                              className="gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              曲を追加
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => addEntry("mc")}
                              disabled={!selectedBandId}
                              className="gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              MCを追加
                            </Button>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                          {!selectedBandId ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              バンドを選択してください。
                            </div>
                          ) : songsLoading ? (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              読み込み中...
                            </div>
                          ) : orderedSongs.length === 0 ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              まだ曲が登録されていません。
                            </div>
                          ) : (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onDragCancel={handleDragCancel}
                            >
                              <SortableContext
                                items={orderedSongs.map((entry) => String(entry.id))}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="space-y-3">
                                  {orderedSongs.map((entry, index) => (
                                    <SortableSongCard
                                      key={String(entry.id)}
                                      entry={entry}
                                      index={index}
                                      totalCount={orderedSongs.length}
                                      getValue={getSongFieldValue}
                                      onUpdateField={updateSongField}
                                      onMove={moveEntry}
                                      onRemove={removeEntry}
                                      onScheduleMetadata={scheduleMetadataFetch}
                                      fetchingMeta={fetchingMeta}
                                    />
                                  ))}
                                </div>
                              </SortableContext>
                              <DragOverlay>
                                {activeEntry ? (
                                  <SongCard
                                    entry={activeEntry}
                                    index={Math.max(0, activeIndex)}
                                    totalCount={orderedSongs.length}
                                    getValue={getSongFieldValue}
                                    onUpdateField={updateSongField}
                                    onMove={moveEntry}
                                    onRemove={removeEntry}
                                    onScheduleMetadata={scheduleMetadataFetch}
                                    fetchingMeta={fetchingMeta}
                                    isOverlay
                                  />
                                ) : null}
                              </DragOverlay>
                            </DndContext>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="pa" className="space-y-6">
                      <Card className="bg-card/60 border-border">
                        <CardHeader className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-lg">PAセクション</CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setPrintMode("pa")}
                                disabled={!selectedBandId}
                              >
                                PDF出力
                              </Button>
                            </div>
                          </div>
                          {selectedBandId && !canEditBandMembers && (
                            <p className="text-xs text-muted-foreground">
                              メンバー追加・配置変更・返しの編集はバンドメンバーまたはパートリーダー以上が行えます。
                            </p>
                          )}
                        </CardHeader>
                        <CardContent>
                          {!selectedBandId ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              バンドを選択してください。
                            </div>
                          ) : bandMembersLoading ? (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              読み込み中...
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr,1fr]">
                              <div className="space-y-3">
                                <div ref={stageWrapperRef} className="relative">
                                  <div
                                    ref={stageViewportRef}
                                    onPointerDown={handleStageViewportPointerDown}
                                    onPointerMove={handleStagePointerMove}
                                    onPointerUp={handleStagePointerUp}
                                    onPointerLeave={handleStagePointerUp}
                                    onPointerCancel={handleStagePointerUp}
                                    onWheel={handleStageWheel}
                                    className={cn(
                                      "relative w-full h-[280px] sm:h-[360px] rounded-lg border border-border overflow-hidden touch-none",
                                      panMode ? "cursor-grab" : "cursor-default"
                                    )}
                                  >
                                    <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-md border border-border bg-background/80 p-1 text-[10px] text-muted-foreground shadow-sm">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          applyStageZoom(stageZoom - 0.1)
                                        }
                                        className="h-7 w-7"
                                        aria-label="ズームアウト"
                                      >
                                        <ZoomOut className="h-4 w-4" />
                                      </Button>
                                      <span className="min-w-[38px] text-center">
                                        {Math.round(stageZoom * 100)}%
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          applyStageZoom(stageZoom + 0.1)
                                        }
                                        className="h-7 w-7"
                                        aria-label="ズームイン"
                                      >
                                        <ZoomIn className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setStagePan({ x: 0, y: 0 });
                                          setStageZoom(1);
                                        }}
                                        className="h-7 w-7"
                                        aria-label="リセット"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                      {!isCoarsePointer && (
                                        <Button
                                          type="button"
                                          variant={panMode ? "secondary" : "ghost"}
                                          size="icon"
                                          onClick={() =>
                                            setPanMode((prev) => !prev)
                                          }
                                          className="h-7 w-7"
                                          aria-label="パン"
                                        >
                                          <Hand className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {!isCoarsePointer && (
                                        <Button
                                          type="button"
                                          variant={snapEnabled ? "secondary" : "ghost"}
                                          size="icon"
                                          onClick={() =>
                                            setSnapEnabled((prev) => !prev)
                                          }
                                          className="h-7 w-7"
                                          aria-label="スナップ"
                                          title="Shiftで一時解除"
                                        >
                                          <Grid3x3 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                    <div
                                      className="absolute inset-0"
                                      style={{
                                        transform: `translate(${stagePan.x}px, ${stagePan.y}px)`,
                                      }}
                                    >
                                      <div
                                        className="absolute inset-0"
                                        style={{
                                          transform: `scale(${stageZoom})`,
                                          transformOrigin: "0 0",
                                        }}
                                      >
                                        <div
                                          ref={stageRef}
                                          className="relative w-full h-full bg-gradient-to-b from-muted/20 to-muted/40"
                                        >
                                          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
                                            STAGE
                                          </div>
                                          <div className="absolute top-2 left-3 text-[10px] text-muted-foreground">
                                            舞台奥
                                          </div>
                                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground z-10 bg-background/80 px-1 rounded">
                                            客席
                                          </div>
                                          {fixedStageItems.map((item) => (
                                            <div
                                              key={item.id}
                                              className={cn(
                                                "absolute -translate-x-1/2 -translate-y-1/2 border text-[13px] font-semibold shadow-sm bg-muted/60 text-muted-foreground pointer-events-none",
                                                item.id === "fixed-drums"
                                                  ? "h-40 w-44 rounded-2xl flex items-center justify-center"
                                                  : "rounded-md px-2 py-1",
                                                item.dashed ? "border-dashed" : "border-solid"
                                              )}
                                              style={{
                                                left: `${item.x}%`,
                                                top: `${item.y}%`,
                                              }}
                                            >
                                              {item.label}
                                            </div>
                                          ))}
                                          {stageItems.map((item) => (
                                            <button
                                              key={item.id}
                                              type="button"
                                              onPointerDown={(event) =>
                                                handleStageItemPointerDown(
                                                  event,
                                                  item.id
                                                )
                                              }
                                              onDoubleClick={() =>
                                                handleStageItemDoubleClick(item.id)
                                              }
                                              className={cn(
                                                "absolute -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-[13px] font-semibold shadow-sm touch-none bg-card/90",
                                                item.dashed
                                                  ? "border-dashed"
                                                  : "border-solid",
                                                canEditBandMembers
                                                  ? "cursor-grab active:cursor-grabbing"
                                                  : "cursor-default",
                                                selectedStageItemId === item.id
                                                  ? "ring-2 ring-primary"
                                                  : "hover:border-primary/40"
                                              )}
                                              style={{
                                                left: `${item.x}%`,
                                                top: `${item.y}%`,
                                              }}
                                            >
                                              {item.label}
                                            </button>
                                          ))}
                                          {bandMembers.map((member) => (
                                            <button
                                              key={member.id}
                                              type="button"
                                              onPointerDown={(event) =>
                                                handleMarkerPointerDown(
                                                  event,
                                                  member.id
                                                )
                                              }
                                              onDoubleClick={() =>
                                                handleMemberDoubleClick(member.id)
                                              }
                                              className={cn(
                                                "absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-card/90 px-2 py-1 text-left shadow-sm touch-none",
                                                canEditBandMembers
                                                  ? "cursor-grab active:cursor-grabbing"
                                                  : "cursor-default",
                                                draggingMemberId === member.id ||
                                                selectedMemberEditId === member.id
                                                  ? "ring-2 ring-primary"
                                                  : "hover:border-primary/40"
                                              )}
                                              style={{
                                                left: `${member.x}%`,
                                                top: `${member.y}%`,
                                              }}
                                            >
                                      <span className="block text-[13px] font-semibold leading-tight">
                                        {member.instrument || member.part || "Part"}
                                      </span>
                                      <span className="block text-[12px] text-muted-foreground leading-tight">
                                        {member.name}
                                      </span>
                                            </button>
                                          ))}
                                          <div className="absolute bottom-2 left-3 text-[10px] text-muted-foreground">
                                            下手
                                          </div>
                                          <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
                                            上手
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                {selectedStageItem &&
                                  isStageEditOpen &&
                                  stageEditAnchor && (
                                    <div
                                      className="absolute z-30 w-60 rounded-lg border border-border bg-card/95 p-3 shadow-lg"
                                      style={{
                                        left: `${stageEditAnchor.left}px`,
                                        top: `${stageEditAnchor.top}px`,
                                      }}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-medium text-foreground">
                                          編集
                                        </p>
                                        <Badge variant="secondary">箱</Badge>
                                      </div>
                                      <div className="mt-2 space-y-2">
                                        <div className="space-y-1 text-[11px] text-muted-foreground">
                                          <span>プリセット</span>
                                          <select
                                            value={stageEditPreset}
                                            onChange={(event) =>
                                              handleStageEditPresetChange(event.target.value)
                                            }
                                            disabled={!canEditBandMembers}
                                            className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                                          >
                                            <option value="custom">カスタム</option>
                                            {stagePresets.map((preset) => (
                                              <option key={preset.label} value={preset.label}>
                                                {preset.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="space-y-1 text-[11px] text-muted-foreground">
                                          <span>表示名</span>
                                          <Input
                                            value={stageEditLabel}
                                            onChange={(event) =>
                                              handleStageEditLabelChange(event.target.value)
                                            }
                                            disabled={!canEditBandMembers}
                                            placeholder="表示名を入力"
                                            className="h-8 text-xs"
                                          />
                                        </div>
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-2 justify-end">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setSelectedStageItemId(null);
                                            setIsStageEditOpen(false);
                                          }}
                                        >
                                          閉じる
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={handleUpdateStageItem}
                                          disabled={!canEditBandMembers}
                                        >
                                          適用
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="destructive"
                                          onClick={() =>
                                            handleRemoveStageItem(selectedStageItem.id)
                                          }
                                          disabled={!canEditBandMembers}
                                        >
                                          削除
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                {selectedMemberEdit &&
                                  isMemberEditOpen &&
                                  memberEditAnchor && (
                                    <div
                                      className="absolute z-30 w-56 rounded-lg border border-border bg-card/95 p-3 shadow-lg"
                                      style={{
                                        left: `${memberEditAnchor.left}px`,
                                        top: `${memberEditAnchor.top}px`,
                                      }}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-medium text-foreground">
                                          メンバー表示
                                        </p>
                                        <Badge variant="secondary">編集</Badge>
                                      </div>
                                      <div className="mt-2 space-y-2">
                                        <div className="space-y-1 text-[11px] text-muted-foreground">
                                          <span>表示内容</span>
                                          <div className="flex items-center gap-2 rounded-md border border-input bg-card px-2 py-1">
                                            <span className="text-xs font-semibold text-foreground">
                                              {memberEditBaseLabel}
                                            </span>
                                            <span className="text-xs text-muted-foreground">/</span>
                                            <Input
                                              ref={memberEditInputRef}
                                              value={memberEditSuffix}
                                              onChange={(event) =>
                                                setMemberEditSuffix(event.target.value)
                                              }
                                              disabled={!canEditBandMembers}
                                              placeholder="LINE1 / 管1 など"
                                              className="h-7 border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
                                              autoFocus
                                            />
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {["LINE1", "LINE2", "LINE3", "LINE4"].map((value) => (
                                            <button
                                              key={value}
                                              type="button"
                                              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                                              onMouseDown={(event) => event.preventDefault()}
                                              onClick={() => {
                                                appendMemberEditValue(value);
                                                memberEditInputRef.current?.focus();
                                              }}
                                            >
                                              {value}
                                            </button>
                                          ))}
                                          {["管1", "管2", "管3", "管4"].map((value) => (
                                            <button
                                              key={value}
                                              type="button"
                                              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                                              onMouseDown={(event) => event.preventDefault()}
                                              onClick={() => {
                                                appendMemberEditValue(value);
                                                memberEditInputRef.current?.focus();
                                              }}
                                            >
                                              {value}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setSelectedMemberEditId(null);
                                            setIsMemberEditOpen(false);
                                          }}
                                        >
                                          閉じる
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={handleApplyMemberEdit}
                                          disabled={!canEditBandMembers}
                                        >
                                          適用
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span>左が下手 / 右が上手</span>
                                <span>メンバー数: {bandMembers.length}人</span>
                              </div>
                                {canEditBandMembers && (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-foreground">
                                      箱プリセットを追加
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <select
                                        value={stagePreset}
                                        onChange={(event) => setStagePreset(event.target.value)}
                                        className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                      >
                                        {stagePresets.map((preset) => (
                                          <option key={preset.label} value={preset.label}>
                                            {preset.label}
                                          </option>
                                        ))}
                                      </select>
                                      <Input
                                        value={customStageLabel}
                                        onChange={(event) =>
                                          setCustomStageLabel(event.target.value)
                                        }
                                        placeholder="カスタム名 (任意)"
                                        className="h-9 min-w-[160px]"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleAddStageItem}
                                        className="gap-2"
                                      >
                                        <Plus className="h-4 w-4" />
                                        追加
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {stageItems.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {stageItems.map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex items-center gap-1 rounded-full border border-border bg-card/70 px-2 py-1 text-xs"
                                      >
                                        <span>{item.label}</span>
                                        {canEditBandMembers && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveStageItem(item.id)}
                                            className="text-muted-foreground hover:text-destructive"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3">
                                {canEditBandMembers && (
                                  <form onSubmit={handleAddMember} className="space-y-2">
                                    <p className="text-sm font-medium text-foreground">
                                      メンバーを追加
                                    </p>
                                    <Input
                                      value={memberSearch}
                                      onChange={(event) => setMemberSearch(event.target.value)}
                                      placeholder="名前/パートで検索"
                                    />
                                    <div className="text-xs text-muted-foreground">
                                      検索結果: {filteredProfiles.length}件
                                    </div>
                                    <div className="rounded-lg border border-border bg-card/40 max-h-64 overflow-y-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>名前</TableHead>
                                            <TableHead>パート</TableHead>
                                            <TableHead className="text-right">選択</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {groupedProfiles.every(
                                            (group) => group.items.length === 0
                                          ) ? (
                                            <TableRow>
                                              <TableCell
                                                colSpan={3}
                                                className="text-sm text-muted-foreground"
                                              >
                                                該当するメンバーがいません。
                                              </TableCell>
                                            </TableRow>
                                          ) : (
                                            groupedProfiles.map((group) =>
                                              group.items.length === 0 ? null : (
                                                <Fragment key={group.key}>
                                                  <TableRow className="bg-muted/30">
                                                    <TableCell
                                                      colSpan={3}
                                                      className="text-xs font-medium text-muted-foreground"
                                                    >
                                                      {group.label}
                                                    </TableCell>
                                                  </TableRow>
                                                  {group.items.map((profile) => {
                                                    const isSelected =
                                                      profile.id === addMemberId;
                                                    return (
                                                      <TableRow
                                                        key={profile.id}
                                                        className={cn(
                                                          "cursor-pointer",
                                                          isSelected
                                                            ? "bg-primary/10"
                                                            : "hover:bg-muted/40"
                                                        )}
                                                        onClick={() =>
                                                          setAddMemberId(profile.id)
                                                        }
                                                      >
                                                        <TableCell className="font-medium">
                                                          {profile.real_name ??
                                                            profile.display_name ??
                                                            "名前未登録"}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                          {profile.part ?? "-"}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                          <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={
                                                              isSelected ? "default" : "outline"
                                                            }
                                                            onClick={(event) => {
                                                              event.stopPropagation();
                                                              setAddMemberId(profile.id);
                                                            }}
                                                          >
                                                            {isSelected ? "選択中" : "選択"}
                                                          </Button>
                                                        </TableCell>
                                                      </TableRow>
                                                    );
                                                  })}
                                                </Fragment>
                                              )
                                            )
                                          )}
                                        </TableBody>
                                      </Table>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <div className="flex-1">
                                        <Input
                                          list="member-instrument-options"
                                          value={addMemberInstrument}
                                          onChange={(event) =>
                                            setAddMemberInstrument(event.target.value)
                                          }
                                          disabled={!addMemberId}
                                          placeholder="担当楽器/パート"
                                          className="h-10"
                                        />
                                        <datalist id="member-instrument-options">
                                          {memberInstrumentOptions.map((part) => (
                                            <option key={part} value={part} />
                                          ))}
                                        </datalist>
                                      </div>
                                      <Button
                                        type="submit"
                                        disabled={
                                          addingMember ||
                                          !addMemberId ||
                                          !addMemberInstrument.trim()
                                        }
                                        className="gap-2"
                                      >
                                        {addingMember ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Plus className="w-4 h-4" />
                                        )}
                                        追加
                                      </Button>
                                    </div>
                                  </form>
                                )}

                                <div className="rounded-lg border border-border bg-card/40 p-3 space-y-4">
                                  <div className="text-sm font-medium text-foreground">PA要望</div>
                                  <label className="space-y-1 text-sm">
                                    <span className="text-muted-foreground">
                                      PA機材・返しの要望
                                    </span>
                                    <Textarea
                                      rows={4}
                                      value={soundNote}
                                      onChange={(event) => setSoundNote(event.target.value)}
                                      placeholder="返し/PA機材などの要望を入力"
                                      disabled={!canEditBandMembers}
                                    />
                                  </label>
                                  <div className="space-y-1 text-sm">
                                    <span className="text-muted-foreground">全体メモ（共通）</span>
                                    <div className="rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
                                      {generalNote.trim() ? generalNote : "未入力"}
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-border bg-card/40 overflow-x-auto max-w-full">
                                  <Table className="min-w-[520px] w-full">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[120px]">パート</TableHead>
                                        <TableHead>名前</TableHead>
                                        <TableHead>返しの希望</TableHead>
                                        <TableHead>備考</TableHead>
                                        <TableHead className="text-center">MC</TableHead>
                                        <TableHead className="text-center w-[90px]">並び</TableHead>
                                        <TableHead className="text-right">削除</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {bandMembers.length === 0 ? (
                                        <TableRow>
                                          <TableCell
                                            colSpan={7}
                                            className="text-center text-sm text-muted-foreground"
                                          >
                                            メンバーが登録されていません。
                                          </TableCell>
                                        </TableRow>
                                      ) : (
                                        bandMembers.map((member, index) => (
                                          <TableRow key={member.id}>
                                            <TableCell className="text-xs font-medium">
                                              {member.instrument || member.part || "Part"}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                              {member.name}
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                value={member.monitorRequest}
                                                onChange={(event) =>
                                                  updateBandMemberField(
                                                    member.id,
                                                    "monitorRequest",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="返しの希望"
                                                className="h-8 text-xs"
                                                disabled={!canEditBandMembers}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                value={member.monitorNote}
                                                onChange={(event) =>
                                                  updateBandMemberField(
                                                    member.id,
                                                    "monitorNote",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="備考"
                                                className="h-8 text-xs"
                                                disabled={!canEditBandMembers}
                                              />
                                            </TableCell>
                                            <TableCell className="text-center">
                                              <input
                                                type="checkbox"
                                                className="h-4 w-4 accent-primary"
                                                checked={member.isMc}
                                                onChange={(event) =>
                                                  updateBandMemberField(
                                                    member.id,
                                                    "isMc",
                                                    event.target.checked
                                                  )
                                                }
                                                disabled={!canEditBandMembers}
                                              />
                                            </TableCell>
                                            <TableCell className="text-center">
                                              <div className="inline-flex items-center justify-center gap-1">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() =>
                                                    moveBandMember(index, Math.max(0, index - 1))
                                                  }
                                                  disabled={
                                                    !canEditBandMembers || index === 0
                                                  }
                                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                >
                                                  <ArrowUp className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() =>
                                                    moveBandMember(
                                                      index,
                                                      Math.min(bandMembers.length - 1, index + 1)
                                                    )
                                                  }
                                                  disabled={
                                                    !canEditBandMembers ||
                                                    index === bandMembers.length - 1
                                                  }
                                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                >
                                                  <ArrowDown className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveMember(member.id)}
                                                disabled={!canEditBandMembers}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ))
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="lighting" className="space-y-6">
                      <Card className="bg-card/60 border-border">
                        <CardHeader className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-lg">照明セットリスト</CardTitle>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span>自動合計: {formatDuration(totalDurationSec)}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span>指定時間</span>
                              <Input
                                value={lightingTotal}
                                onChange={(event) => setLightingTotal(event.target.value)}
                                placeholder="分"
                                className="h-8 w-20 text-xs"
                                disabled={!canEditBandMembers}
                              />
                              <div className="flex items-center gap-1">
                                {[5, 10, 15].map((value) => (
                                  <Button
                                    key={value}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setLightingTotal(String(value))}
                                    disabled={!canEditBandMembers}
                                  >
                                    {value}分
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {!selectedBandId ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              バンドを選択してください。
                            </div>
                          ) : songsLoading ? (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              読み込み中...
                            </div>
                          ) : orderedSongs.length === 0 ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              まだ曲が登録されていません。
                            </div>
                          ) : (
                            <>
                              <div className="space-y-3 md:hidden">
                                {orderedSongs.map((entry, index) => (
                                  <LightingEntryCard
                                    key={entry.id}
                                    entry={entry}
                                    index={index}
                                    getValue={getSongFieldValue}
                                    onUpdateField={updateSongField}
                                    onScheduleMetadata={scheduleMetadataFetch}
                                    fetchingMeta={fetchingMeta}
                                  />
                                ))}
                              </div>
                              <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-card/40">
                                <Table className="min-w-[920px]">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[48px]">#</TableHead>
                                      <TableHead>曲名 / アーティスト / URL</TableHead>
                                      <TableHead className="w-[140px]">時間</TableHead>
                                      <TableHead className="w-[180px]">アレンジ等</TableHead>
                                      <TableHead className="w-[200px]">ライト要望</TableHead>
                                      <TableHead className="w-[180px]">色要望</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {orderedSongs.map((entry, index) => {
                                      const isSong = entry.entry_type === "song";
                                      return (
                                        <TableRow key={entry.id}>
                                          <TableCell className="text-xs text-muted-foreground">
                                            {String(index + 1).padStart(2, "0")}
                                          </TableCell>
                                          <TableCell className="min-w-[240px]">
                                            <div className="space-y-1">
                                              <Input
                                                value={getSongFieldValue(entry, "title")}
                                                onChange={(event) =>
                                                  updateSongField(
                                                    entry.id,
                                                    "title",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder={isSong ? "曲名" : "MC"}
                                                className="h-8 text-xs"
                                              />
                                              <Input
                                                value={getSongFieldValue(entry, "artist")}
                                                onChange={(event) =>
                                                  updateSongField(
                                                    entry.id,
                                                    "artist",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="アーティスト"
                                                className="h-8 text-xs"
                                                disabled={!isSong}
                                              />
                                              <div className="relative">
                                                <Input
                                                  value={getSongFieldValue(entry, "url")}
                                                  onChange={(event) => {
                                                    const nextValue = event.target.value;
                                                    updateSongField(
                                                      entry.id,
                                                      "url",
                                                      nextValue
                                                    );
                                                    if (isSong) {
                                                      scheduleMetadataFetch(
                                                        entry.id,
                                                        nextValue,
                                                        entry.entry_type
                                                      );
                                                    }
                                                  }}
                                                  placeholder="URL"
                                                  className="h-8 text-xs"
                                                  disabled={!isSong}
                                                />
                                                {fetchingMeta[entry.id] && (
                                                  <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                                                )}
                                              </div>
                                            </div>
                                          </TableCell>
                                          <TableCell className="min-w-[140px]">
                                            <div className="flex items-center gap-1">
                                              <Input
                                                type="number"
                                                min={0}
                                                value={getSongFieldValue(entry, "durationMin")}
                                                onChange={(event) =>
                                                  updateSongField(
                                                    entry.id,
                                                    "durationMin",
                                                    event.target.value
                                                  )
                                                }
                                                className="h-8 w-16 text-xs"
                                              />
                                              <span className="text-xs text-muted-foreground">
                                                :
                                              </span>
                                              <Input
                                                type="number"
                                                min={0}
                                                max={59}
                                                value={getSongFieldValue(entry, "durationSec")}
                                                onChange={(event) =>
                                                  updateSongField(
                                                    entry.id,
                                                    "durationSec",
                                                    event.target.value
                                                  )
                                                }
                                                className="h-8 w-16 text-xs"
                                              />
                                            </div>
                                          </TableCell>
                                          <TableCell className="min-w-[180px]">
                                            <Textarea
                                              rows={2}
                                              value={getSongFieldValue(entry, "arrangementNote")}
                                              onChange={(event) =>
                                                updateSongField(
                                                  entry.id,
                                                  "arrangementNote",
                                                  event.target.value
                                                )
                                              }
                                              placeholder="アレンジ/ソロ等"
                                              className="text-xs"
                                              disabled={!isSong}
                                            />
                                          </TableCell>
                                          <TableCell className="min-w-[200px]">
                                            <div className="grid gap-1 text-xs">
                                              {[
                                                { key: "lightingSpot", label: "スポット" },
                                                { key: "lightingStrobe", label: "ストロボ" },
                                                { key: "lightingMoving", label: "ムービング" },
                                              ].map((item) => (
                                                <label
                                                  key={item.key}
                                                  className="flex items-center justify-between gap-2"
                                                >
                                                  <span>{item.label}</span>
                                                  <select
                                                    value={
                                                      entry[item.key as keyof SongEntry] as string
                                                    }
                                                    onChange={(event) =>
                                                      updateSongField(
                                                        entry.id,
                                                        item.key as keyof SongEntry,
                                                        event.target.value as LightingChoice
                                                      )
                                                    }
                                                    className="h-7 rounded-md border border-input bg-card px-2 text-xs"
                                                    disabled={!isSong}
                                                  >
                                                    {lightingChoiceOptions.map((option) => (
                                                      <option
                                                        key={option.value}
                                                        value={option.value}
                                                      >
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>
                                              ))}
                                            </div>
                                          </TableCell>
                                          <TableCell className="min-w-[180px]">
                                            <Textarea
                                              rows={2}
                                              value={getSongFieldValue(entry, "lightingColor")}
                                              onChange={(event) =>
                                                updateSongField(
                                                  entry.id,
                                                  "lightingColor",
                                                  event.target.value
                                                )
                                              }
                                              placeholder="色の要望"
                                              className="text-xs"
                                              disabled={!isSong}
                                            />
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="bg-card/60 border-border">
                        <CardHeader className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-lg">照明メモ</CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setPrintMode("lighting")}
                                disabled={!selectedBandId}
                              >
                                PDF出力
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <label className="space-y-1 text-sm">
                            <span className="text-muted-foreground">照明要望</span>
                            <Textarea
                              rows={4}
                              value={lightingNote}
                              onChange={(event) => setLightingNote(event.target.value)}
                              placeholder="照明演出の要望を入力"
                              disabled={!canEditBandMembers}
                            />
                          </label>
                          <div className="space-y-1 text-sm">
                            <span className="text-muted-foreground">全体メモ（共通）</span>
                            <div className="rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
                              {generalNote.trim() ? generalNote : "未入力"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
            </section>
          </main>
        </div>

        <div className="print-only print-pa">
          <div className="print-page">
            <div className="print-title">PA用</div>
            <div className="print-header">
              <div className="print-field">
                <strong>イベント名:</strong> {event?.name ?? ""}
              </div>
              <div className="print-field">
                <strong>バンド名:</strong> {bandName || selectedBand?.name || ""}
              </div>
              <div className="print-field">
                <strong>代表者氏名:</strong> {representativeName || ""}
              </div>
              <div className="print-field">
                <strong>PA長確認欄:</strong>
                <span className="print-blank-line" />
              </div>
            </div>

            <div>
              <div className="print-section-title">ステージ配置図</div>
              <div className="print-stage">
                <div className="print-stage-label" style={{ top: "2mm", left: "50%", transform: "translateX(-50%)" }}>
                  舞台奥側
                </div>
                <div className="print-stage-label" style={{ bottom: "2mm", left: "50%", transform: "translateX(-50%)" }}>
                  客席側
                </div>
                <div className="print-stage-label" style={{ bottom: "2mm", left: "2mm" }}>
                  下手
                </div>
                <div className="print-stage-label" style={{ bottom: "2mm", right: "2mm" }}>
                  上手
                </div>
                {fixedStageItems.map((item) => (
                  <div
                    key={item.id}
                    className="print-stage-item"
                    style={{
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      borderStyle: item.dashed ? "dashed" : "solid",
                      opacity: 0.7,
                    }}
                  >
                    {item.label}
                  </div>
                ))}
                {stageItems.map((item) => (
                  <div
                    key={item.id}
                    className="print-stage-item"
                    style={{
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      borderStyle: item.dashed ? "dashed" : "solid",
                    }}
                  >
                    {item.label}
                  </div>
                ))}
                {bandMembers.map((member) => (
                  <div
                    key={member.id}
                    className="print-stage-member"
                    style={{ left: `${member.x}%`, top: `${member.y}%` }}
                  >
                    <div>{member.instrument || member.part || "Part"}</div>
                    <div>{member.name}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="print-section-title">メンバーリスト & 返しの希望（MC担当者は○）</div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>パート</th>
                    <th>名前</th>
                    <th>返しの希望</th>
                    <th>備考</th>
                    <th>MC</th>
                  </tr>
                </thead>
                <tbody>
                  {bandMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5}>メンバー未登録</td>
                    </tr>
                  ) : (
                    bandMembers.map((member) => (
                      <tr key={member.id}>
                        <td>{member.instrument || member.part || "-"}</td>
                        <td>{member.name}</td>
                        <td>{member.monitorRequest || "-"}</td>
                        <td>{member.monitorNote || "-"}</td>
                        <td>{member.isMc ? "○" : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <div className="print-section-title">セットリスト（MCも記入）</div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>曲名 / アーティスト</th>
                    <th>時間</th>
                    <th>備考</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSongs.length === 0 ? (
                    <tr>
                      <td colSpan={4}>未登録</td>
                    </tr>
                  ) : (
                    orderedSongs.map((entry, index) => (
                      <tr key={entry.id}>
                        <td>{index + 1}</td>
                        <td>
                          {getSongFieldValue(entry, "artist")
                            ? `${getSongFieldValue(entry, "title")} / ${getSongFieldValue(
                                entry,
                                "artist"
                              )}`
                            : getSongFieldValue(entry, "title")}
                        </td>
                        <td>
                          {formatDuration(
                            toDurationSec(
                              getSongFieldValue(entry, "durationMin"),
                              getSongFieldValue(entry, "durationSec")
                            )
                          )}
                        </td>
                        <td>{getSongFieldValue(entry, "memo") || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <div className="print-section-title">その他音響関係の要望</div>
              <div className="print-note">{soundNote || ""}</div>
            </div>

            <div className="print-footer">Tokyo University of Technology - Jacla</div>
          </div>
        </div>

        <div className="print-only print-lighting">
          <div className="print-page">
            <div className="print-title">照明用</div>
            <div className="print-header">
              <div className="print-field">
                <strong>イベント名:</strong> {event?.name ?? ""}
              </div>
              <div className="print-field">
                <strong>バンド名:</strong> {bandName || selectedBand?.name || ""}
              </div>
              <div className="print-field">
                <strong>代表者氏名:</strong> {representativeName || ""}
              </div>
              <div className="print-field">
                <strong>照明長確認欄:</strong>
                <span className="print-blank-line" />
              </div>
            </div>

            <div>
              <div className="print-section-title">セットリスト（照明用）</div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>曲名 / アーティスト / URL</th>
                    <th>時間</th>
                    <th>アレンジ等</th>
                    <th>ライト要望</th>
                    <th>色要望</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSongs.length === 0 ? (
                    <tr>
                      <td colSpan={6}>未登録</td>
                    </tr>
                  ) : (
                    orderedSongs.map((entry, index) => (
                      <tr key={entry.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div>
                            {getSongFieldValue(entry, "artist")
                              ? `${getSongFieldValue(entry, "title")} / ${getSongFieldValue(
                                  entry,
                                  "artist"
                                )}`
                              : getSongFieldValue(entry, "title")}
                          </div>
                          {entry.url && <div>{entry.url}</div>}
                        </td>
                        <td>
                          {formatDuration(
                            toDurationSec(
                              getSongFieldValue(entry, "durationMin"),
                              getSongFieldValue(entry, "durationSec")
                            )
                          )}
                        </td>
                        <td>{entry.arrangementNote || "-"}</td>
                        <td>
                          <div>スポット: {formatLightingChoice(entry.lightingSpot)}</div>
                          <div>ストロボ: {formatLightingChoice(entry.lightingStrobe)}</div>
                          <div>ムービング: {formatLightingChoice(entry.lightingMoving)}</div>
                        </td>
                        <td>{entry.lightingColor || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="print-field" style={{ marginTop: "3mm" }}>
                合計: {formatDuration(totalDurationSec)} / 指定: {lightingTotal ? `${lightingTotal}分` : "-"}
              </div>
            </div>

            <div>
              <div className="print-section-title">その他照明関係の要望</div>
              <div className="print-note">{lightingNote || ""}</div>
            </div>

            <div>
              <div className="print-section-title">全体を通した相談/備考</div>
              <div className="print-note">{generalNote || ""}</div>
            </div>

            <div className="print-footer">Tokyo University of Technology - Jacla</div>
          </div>
        </div>
      </>
    </AuthGuard>
  );
}
