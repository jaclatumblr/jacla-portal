"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Calendar,
  Clock,
  GripVertical,
  Plus,
  RefreshCw,
  Save,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabaseClient";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  name: string;
  date: string;
  status: string;
  event_type: string;
  venue: string | null;
  open_time: string | null;
  start_time: string | null;
  default_changeover_min: number;
  tt_is_published: boolean;
};

type BandRow = {
  id: string;
  name: string;
};

type SongRow = {
  band_id: string;
  duration_sec: number | null;
};

type EventSlot = {
  id: string;
  event_id: string;
  band_id: string | null;
  slot_type: "band" | "break" | "mc" | "other";
  order_in_event: number | null;
  start_time: string | null;
  end_time: string | null;
  changeover_min: number | null;
  note: string | null;
};

const slotTypeOptions = [
  { value: "band", label: "バンド" },
  { value: "break", label: "休憩" },
  { value: "mc", label: "MC" },
  { value: "other", label: "その他" },
];

type SortableItemRenderProps = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  isDragging: boolean;
};

type SortableItemProps = {
  id: string;
  children: (props: SortableItemRenderProps) => ReactNode;
};

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-80")}
    >
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
}

export default function AdminEventTimetableEditPage() {
  const params = useParams();
  const eventId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { canAccessAdmin, loading: roleLoading } = useRoleFlags();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [slots, setSlots] = useState<EventSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const bandMap = useMemo(() => {
    const map = new Map<string, string>();
    bands.forEach((band) => map.set(band.id, band.name));
    return map;
  }, [bands]);

  const orderedSlots = useMemo(() => {
    return [...slots].sort((a, b) => {
      const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });
  }, [slots]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    if (!eventId || roleLoading || !canAccessAdmin) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const [eventRes, bandsRes, slotsRes] = await Promise.all([
        supabase
          .from("events")
          .select(
            "id, name, date, status, event_type, venue, open_time, start_time, default_changeover_min, tt_is_published"
          )
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("bands")
          .select("id, name")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase
          .from("event_slots")
          .select(
            "id, event_id, band_id, slot_type, order_in_event, start_time, end_time, changeover_min, note"
          )
          .eq("event_id", eventId)
          .order("order_in_event", { ascending: true })
          .order("start_time", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        setError("イベント情報の取得に失敗しました。");
        setEvent(null);
      } else {
        setEvent(eventRes.data as EventRow);
      }

      if (bandsRes.error) {
        console.error(bandsRes.error);
        setError((prev) => prev ?? "バンドの取得に失敗しました。");
        setBands([]);
        setSongs([]);
      } else {
        const bandList = (bandsRes.data ?? []) as BandRow[];
        setBands(bandList);
        const bandIds = bandList.map((band) => band.id).filter(Boolean);
        if (bandIds.length > 0) {
          const songsRes = await supabase
            .from("songs")
            .select("band_id, duration_sec")
            .in("band_id", bandIds);
          if (!cancelled) {
            if (songsRes.error) {
              console.error(songsRes.error);
              setError((prev) => prev ?? "曲情報の取得に失敗しました。");
              setSongs([]);
            } else {
              setSongs((songsRes.data ?? []) as SongRow[]);
            }
          }
        } else {
          setSongs([]);
        }
      }

      if (slotsRes.error) {
        console.error(slotsRes.error);
        setError((prev) => prev ?? "タイムテーブルの取得に失敗しました。");
        setSlots([]);
      } else {
        setSlots((slotsRes.data ?? []) as EventSlot[]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, roleLoading, canAccessAdmin]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    setError(null);
  }, [error]);

  const handleSlotDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIndex = orderedSlots.findIndex((slot) => slot.id === activeId);
    const newIndex = orderedSlots.findIndex((slot) => slot.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(orderedSlots, oldIndex, newIndex).map((slot, index) => ({
      ...slot,
      order_in_event: index + 1,
    }));
    setSlots(reordered);
  };

  const handleAddSlot = () => {
    if (!eventId) return;
    const nextOrder =
      slots.reduce((max, slot) => Math.max(max, slot.order_in_event ?? 0), 0) + 1;
    const newSlot: EventSlot = {
      id: crypto.randomUUID(),
      event_id: eventId,
      band_id: null,
      slot_type: "band",
      order_in_event: nextOrder,
      start_time: null,
      end_time: null,
      changeover_min: event?.default_changeover_min ?? 15,
      note: "",
    };
    setSlots((prev) => [...prev, newSlot]);
  };

  const handleSlotChange = <K extends keyof EventSlot>(id: string, key: K, value: EventSlot[K]) => {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== id) return slot;
        if (key === "slot_type") {
          const nextType = value as EventSlot["slot_type"];
          return {
            ...slot,
            slot_type: nextType,
            band_id: nextType === "band" ? slot.band_id : null,
          };
        }
        return { ...slot, [key]: value };
      })
    );
  };

  const handleSaveSlots = async () => {
    if (!eventId || saving) return;
    setSaving(true);
    setError(null);

    const payloads = orderedSlots.map((slot, index) => ({
      id: slot.id,
      event_id: eventId,
      band_id: slot.slot_type === "band" ? slot.band_id ?? null : null,
      slot_type: slot.slot_type,
      order_in_event: slot.order_in_event ?? index + 1,
      start_time: slot.start_time || null,
      end_time: slot.end_time || null,
      changeover_min:
        slot.changeover_min == null || Number.isNaN(Number(slot.changeover_min))
          ? null
          : Number(slot.changeover_min),
      note: slot.note || null,
    }));

    const { data, error } = await supabase
      .from("event_slots")
      .upsert(payloads, { onConflict: "id" })
      .select(
        "id, event_id, band_id, slot_type, order_in_event, start_time, end_time, changeover_min, note"
      );

    if (error || !data) {
      console.error(error);
      setError("タイムテーブルの保存に失敗しました。");
      setSaving(false);
      return;
    }

    setSlots((data ?? []) as EventSlot[]);
    toast.success("タイムテーブルを保存しました。");
    setSaving(false);
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!slotId) return;
    const { error: deleteError } = await supabase.from("event_slots").delete().eq("id", slotId);
    if (deleteError) {
      console.error(deleteError);
      setError("タイムテーブルの削除に失敗しました。");
      return;
    }
    setSlots((prev) => prev.filter((slot) => slot.id !== slotId));
    toast.success("スロットを削除しました。");
  };

  const handleGenerateSlots = async () => {
    if (!eventId || generating) return;
    if (bands.length === 0) {
      setError("バンドが登録されていません。");
      return;
    }
    if (slots.length > 0) {
      const confirmed = window.confirm("既存のスロットを上書きしますか？");
      if (!confirmed) return;
    }

    setGenerating(true);
    setError(null);

    if (slots.length > 0) {
      const { error: deleteError } = await supabase.from("event_slots").delete().eq("event_id", eventId);
      if (deleteError) {
        console.error(deleteError);
        setError("既存スロットの削除に失敗しました。");
        setGenerating(false);
        return;
      }
    }

    const durationMap = new Map<string, number>();
    songs.forEach((song) => {
      if (!song.band_id || !song.duration_sec) return;
      const current = durationMap.get(song.band_id) ?? 0;
      durationMap.set(song.band_id, current + song.duration_sec);
    });

    const parseTime = (value: string | null) => {
      if (!value) return null;
      const [h, m] = value.split(":").map((part) => Number(part));
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };
    const formatTime = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const baseStart = parseTime(event?.start_time ?? null);
    let cursor = baseStart;
    const changeover = event?.default_changeover_min ?? 15;

    const payloads = bands.map((band, index) => {
      const durationSec = durationMap.get(band.id) ?? 0;
      const durationMin = durationSec > 0 ? Math.ceil(durationSec / 60) : null;
      let startTime: string | null = null;
      let endTime: string | null = null;
      if (cursor != null) {
        startTime = formatTime(cursor);
        if (durationMin != null) {
          endTime = formatTime(cursor + durationMin);
          cursor += durationMin + changeover;
        }
      }

      return {
        event_id: eventId,
        band_id: band.id,
        slot_type: "band",
        order_in_event: index + 1,
        start_time: startTime,
        end_time: endTime,
        changeover_min: changeover,
        note: null,
      };
    });

    const { data, error } = await supabase
      .from("event_slots")
      .insert(payloads)
      .select("id, event_id, band_id, slot_type, order_in_event, start_time, end_time, changeover_min, note");

    if (error || !data) {
      console.error(error);
      setError("スロットの自動生成に失敗しました。");
      setGenerating(false);
      return;
    }

    setSlots((data ?? []) as EventSlot[]);
    toast.success("スロットを自動生成しました。");
    setGenerating(false);
  };

  const handleTogglePublish = async () => {
    if (!eventId || !event || publishing) return;
    setPublishing(true);
    setError(null);

    const nextValue = !event.tt_is_published;
    const { error: publishError } = await supabase.rpc("set_event_tt_publish", {
      event_id: eventId,
      is_published: nextValue,
    });

    if (publishError) {
      console.error(publishError);
      setError("公開設定の更新に失敗しました。");
      setPublishing(false);
      return;
    }

    setEvent((prev) => (prev ? { ...prev, tt_is_published: nextValue } : prev));
    toast.success(nextValue ? "タイムテーブルを公開しました。" : "タイムテーブルを非公開にしました。");
    setPublishing(false);
  };

  if (roleLoading || loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            読み込み中です...
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!canAccessAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">編集権限がありません。</p>
            <p className="text-sm text-muted-foreground">PAL / LL 以上の権限が必要です。</p>
            <Link
              href="/admin/events"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              イベント一覧に戻る
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Admin"
            title="タイムテーブル編集"
            description="スロットの並び順や時間を調整して公開できます。"
            backHref={`/admin/events/${eventId}`}
            backLabel="イベント編集に戻る"
            meta={
              event && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {event.date}
                  </span>
                  {event.start_time && (
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {event.start_time}
                    </span>
                  )}
                  <Badge variant={event.tt_is_published ? "default" : "outline"}>
                    {event.tt_is_published ? "公開中" : "非公開"}
                  </Badge>
                </div>
              )
            }
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">公開設定</CardTitle>
                    <CardDescription>公開中は全員がタイムテーブルを閲覧できます。</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant={event?.tt_is_published ? "outline" : "default"}
                    onClick={handleTogglePublish}
                    disabled={publishing}
                  >
                    {publishing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : event?.tt_is_published ? (
                      "非公開にする"
                    ) : (
                      "公開する"
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  公開/非公開の切り替えはこのページからいつでも変更できます。
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">タイムテーブル</CardTitle>
                    <CardDescription>ドラッグで順番を調整し、保存で反映します。</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={handleGenerateSlots} disabled={generating}>
                      {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      自動生成
                    </Button>
                    <Button type="button" variant="outline" onClick={handleAddSlot}>
                      <Plus className="w-4 h-4" />
                      追加
                    </Button>
                    <Button type="button" onClick={handleSaveSlots} disabled={saving || orderedSlots.length === 0}>
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      保存
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {orderedSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">スロットがまだありません。</p>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSlotDragEnd}>
                      <SortableContext items={orderedSlots.map((slot) => slot.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">
                          {orderedSlots.map((slot, index) => (
                            <SortableItem key={slot.id} id={slot.id}>
                              {({ attributes, listeners, setActivatorNodeRef, isDragging }) => (
                                <div
                                  className={cn(
                                    "rounded-lg border border-border bg-background/50 p-4 space-y-3",
                                    isDragging && "ring-2 ring-primary/40"
                                  )}
                                >
                                  <div className="flex flex-wrap items-start gap-4">
                                    <button
                                      type="button"
                                      ref={setActivatorNodeRef}
                                      className="mt-1 rounded-md border border-border p-1 text-muted-foreground hover:text-foreground"
                                      {...attributes}
                                      {...listeners}
                                      aria-label="順番を変更"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Badge variant="outline">#{slot.order_in_event ?? index + 1}</Badge>
                                    </div>

                                    <div className="flex-1 grid gap-3 md:grid-cols-[160px,1fr]">
                                      <label className="space-y-1 text-xs">
                                        <span className="text-muted-foreground">種別</span>
                                        <select
                                          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                          value={slot.slot_type}
                                          onChange={(e) =>
                                            handleSlotChange(slot.id, "slot_type", e.target.value as EventSlot["slot_type"])
                                          }
                                        >
                                          {slotTypeOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                              {opt.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      {slot.slot_type === "band" && (
                                        <label className="space-y-1 text-xs">
                                          <span className="text-muted-foreground">バンド</span>
                                          <select
                                            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                            value={slot.band_id ?? ""}
                                            onChange={(e) => handleSlotChange(slot.id, "band_id", e.target.value || null)}
                                          >
                                            <option value="">選択してください</option>
                                            {bands.map((band) => (
                                              <option key={band.id} value={band.id}>
                                                {band.name}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))]">
                                    <label className="space-y-1 text-xs">
                                      <span className="text-muted-foreground">開始</span>
                                      <Input
                                        type="time"
                                        value={slot.start_time ?? ""}
                                        onChange={(e) => handleSlotChange(slot.id, "start_time", e.target.value || null)}
                                      />
                                    </label>
                                    <label className="space-y-1 text-xs">
                                      <span className="text-muted-foreground">終了</span>
                                      <Input
                                        type="time"
                                        value={slot.end_time ?? ""}
                                        onChange={(e) => handleSlotChange(slot.id, "end_time", e.target.value || null)}
                                      />
                                    </label>
                                    <label className="space-y-1 text-xs">
                                      <span className="text-muted-foreground">転換(分)</span>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={slot.changeover_min ?? ""}
                                        onChange={(e) =>
                                          handleSlotChange(slot.id, "changeover_min", Number(e.target.value))
                                        }
                                      />
                                    </label>
                                    <label className="space-y-1 text-xs">
                                      <span className="text-muted-foreground">メモ</span>
                                      <Input
                                        value={slot.note ?? ""}
                                        onChange={(e) => handleSlotChange(slot.id, "note", e.target.value)}
                                        placeholder="MC / 休憩など"
                                      />
                                    </label>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">
                                      {slot.slot_type === "band"
                                        ? bandMap.get(slot.band_id ?? "") ?? "バンド未設定"
                                        : slotTypeOptions.find((opt) => opt.value === slot.slot_type)?.label}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() => handleDeleteSlot(slot.id)}
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      削除
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </SortableItem>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
