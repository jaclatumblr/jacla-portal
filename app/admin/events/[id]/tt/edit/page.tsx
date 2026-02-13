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
  tt_is_provisional: boolean;
  tt_is_published: boolean;
  normal_rehearsal_order: "same" | "reverse";
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
  slot_phase: "show" | "rehearsal_normal" | "rehearsal_pre";
  order_in_event: number | null;
  start_time: string | null;
  end_time: string | null;
  changeover_min: number | null;
  note: string | null;
};

const slotTypeOptions = [
  { value: "band", label: "バンド" },
  { value: "break", label: "転換" },
  { value: "other", label: "付帯作業" },
];

const slotPhaseOptions = [
  { value: "show", label: "本番" },
  { value: "rehearsal_normal", label: "通常リハ" },
  { value: "rehearsal_pre", label: "直前リハ" },
];

const TEMPLATE_PREP_MINUTES = 60;
const TEMPLATE_BREAK_MINUTES = 10;
const TEMPLATE_CLEANUP_MINUTES = 60;
const DEFAULT_BAND_DURATION_MIN = 10;
const MIN_REHEARSAL_MIN = 10;
const DAY_MINUTES = 24 * 60;

const parseTimeValue = (value: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const formatTimeValue = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const formatTimeText = (value: string | null) => {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return value;
};

const normalizeDayMinutes = (minutes: number) => {
  const value = minutes % DAY_MINUTES;
  return value < 0 ? value + DAY_MINUTES : value;
};

const compactConsecutiveTimedSlots = <
  T extends { start_time: string | null; end_time: string | null }
>(
  source: T[]
) => {
  let cursor: number | null = null;
  return source.map((slot) => {
    const start = parseTimeValue(slot.start_time ?? null);
    const end = parseTimeValue(slot.end_time ?? null);
    if (start == null || end == null) {
      cursor = null;
      return slot;
    }
    let duration = end - start;
    if (duration < 0) duration += DAY_MINUTES;
    if (duration <= 0) {
      cursor = null;
      return slot;
    }
    const nextStart = cursor ?? start;
    const nextEnd = nextStart + duration;
    cursor = nextEnd;
    return {
      ...slot,
      start_time: formatTimeValue(normalizeDayMinutes(nextStart)),
      end_time: formatTimeValue(normalizeDayMinutes(nextEnd)),
    };
  });
};

const applyDurationToSlot = <
  T extends { start_time: string | null; end_time: string | null }
>(
  slot: T,
  durationMin: number
) => {
  if (!Number.isFinite(durationMin) || durationMin <= 0) return slot;
  const start = parseTimeValue(slot.start_time ?? null);
  const end = parseTimeValue(slot.end_time ?? null);
  if (start == null && end == null) return slot;
  if (start != null) {
    return {
      ...slot,
      end_time: formatTimeValue(normalizeDayMinutes(start + durationMin)),
    };
  }
  return {
    ...slot,
    start_time: formatTimeValue(normalizeDayMinutes((end ?? 0) - durationMin)),
  };
};


const phaseLabel = (phase: EventSlot["slot_phase"]) =>
  slotPhaseOptions.find((opt) => opt.value === phase)?.label ?? phase;

const phaseBadgeVariant = (phase: EventSlot["slot_phase"]) => {
  if (phase === "show") return "default" as const;
  if (phase === "rehearsal_pre") return "secondary" as const;
  return "outline" as const;
};

type PhaseKey = EventSlot["slot_phase"] | "prep" | "cleanup" | "rest";

const slotPhaseKey = (slot: EventSlot): PhaseKey => {
  const note = slot.note?.trim();
  if (note === "集合～準備") return "prep";
  if (note === "終了～撤収" || note === "終了～解散") return "cleanup";
  if (note === "休憩") return "rest";
  return slot.slot_phase ?? "show";
};

const slotPhaseLabel = (slot: EventSlot) => {
  const note = slot.note?.trim();
  if (note === "集合～準備") return "集合～準備";
  if (note === "終了～撤収" || note === "終了～解散") return note;
  if (note === "休憩") return "休憩";
  return phaseLabel(slot.slot_phase);
};

const slotPhaseBadgeVariant = (slot: EventSlot) => {
  const key = slotPhaseKey(slot);
  if (key === "prep" || key === "cleanup" || key === "rest") return "outline" as const;
  return phaseBadgeVariant(slot.slot_phase);
};

const slotAccentClass = (slot: EventSlot) => {
  const note = slot.note?.trim() ?? "";
  if (note === "集合～準備" || note === "終了～撤収" || note === "終了～解散" || note === "休憩") {
    return "border-l-4 border-l-amber-400/80";
  }
  if (slot.slot_type === "break" || note.includes("転換")) {
    return "border-l-4 border-l-amber-400/80";
  }
  if (slot.slot_phase === "rehearsal_normal" || slot.slot_phase === "rehearsal_pre") {
    return "border-l-4 border-l-sky-400/80";
  }
  if (slot.slot_phase === "show") {
    return "border-l-4 border-l-fuchsia-400/80";
  }
  return "border-l-4 border-l-muted";
};

const phaseBarClass = (phase: PhaseKey) => {
  if (phase === "show") return "bg-fuchsia-400/80";
  if (phase === "rehearsal_normal" || phase === "rehearsal_pre") return "bg-sky-400/80";
  if (phase === "prep" || phase === "cleanup" || phase === "rest") return "bg-amber-400/80";
  return "bg-muted";
};

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

type SlotSeed = {
  slot_type: EventSlot["slot_type"];
  slot_phase: EventSlot["slot_phase"];
  band_id?: string | null;
  note?: string | null;
  changeover_min?: number | null;
  duration_min?: number | null;
  start_time?: string | null;
  end_time?: string | null;
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
  const [templating, setTemplating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [rehearsalOrder, setRehearsalOrder] = useState<"same" | "reverse">("same");
  const [savingRehearsalOrder, setSavingRehearsalOrder] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

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

  const selectedSlot = useMemo(
    () => orderedSlots.find((slot) => slot.id === selectedSlotId) ?? orderedSlots[0] ?? null,
    [orderedSlots, selectedSlotId]
  );

  useEffect(() => {
    if (!selectedSlotId && orderedSlots.length > 0) {
      setSelectedSlotId(orderedSlots[0].id);
      return;
    }
    if (selectedSlotId && !orderedSlots.some((slot) => slot.id === selectedSlotId)) {
      setSelectedSlotId(orderedSlots[0]?.id ?? null);
    }
  }, [orderedSlots, selectedSlotId]);

  const slotLabel = (slot: EventSlot) => {
    if (slot.slot_type === "band") {
      return bandMap.get(slot.band_id ?? "") ?? "バンド未設定";
    }
    const note = slot.note?.trim() ?? "";
    if (slot.slot_type === "break" || note.includes("転換")) return "転換";
    if (slot.slot_type === "mc") return "付帯作業";
    return note || "付帯作業";
  };

  const resolveSlotTypeValue = (slot: EventSlot) => {
    if (slot.slot_type === "band") return "band";
    if (slot.slot_type === "break") return "break";
    const note = slot.note?.trim() ?? "";
    if (note.includes("転換")) return "break";
    return "other";
  };

  const slotTypeLabel = (slot: EventSlot) => {
    const value = resolveSlotTypeValue(slot);
    return slotTypeOptions.find((opt) => opt.value === value)?.label ?? value;
  };

  const handleSlotTypeSelect = (slot: EventSlot, nextType: "band" | "break" | "other") => {
    const note = slot.note?.trim() ?? "";
    if (nextType === "band") {
      handleSlotChange(slot.id, "slot_type", "band");
      return;
    }
    if (nextType === "break") {
      handleSlotChange(slot.id, "slot_type", "break");
      handleSlotChange(slot.id, "band_id", null);
      handleSlotChange(slot.id, "note", "転換");
      return;
    }
    handleSlotChange(slot.id, "slot_type", "other");
    handleSlotChange(slot.id, "band_id", null);
    if (note === "転換") {
      handleSlotChange(slot.id, "note", "");
    }
  };

  const slotDurationMin = (slot: EventSlot) => {
    const start = parseTimeValue(slot.start_time ?? null);
    const end = parseTimeValue(slot.end_time ?? null);
    if (start == null || end == null) return null;
    let duration = end - start;
    if (duration < 0) duration += DAY_MINUTES;
    if (duration <= 0) return null;
    return duration;
  };

  const slotDurationLabel = (slot: EventSlot) => {
    const duration = slotDurationMin(slot);
    if (duration == null) return "";
    return `(${duration})`;
  };

  const slotTimeRangeLabel = (slot: EventSlot) => {
    if (!slot.start_time && !slot.end_time) return "時間未設定";
    if (slot.start_time && slot.end_time) return `${formatTimeText(slot.start_time)}-${formatTimeText(slot.end_time)}`;
    return slot.start_time ?? slot.end_time ?? "時間未設定";
  };

  const slotTimeLabel = (slot: EventSlot) => {
    if (!slot.start_time && !slot.end_time) return "時間未設定";
    if (slot.start_time && slot.end_time) {
      return `${formatTimeText(slot.start_time)}-${formatTimeText(slot.end_time)}${slotDurationLabel(slot)}`;
    }
    return slot.start_time ?? slot.end_time ?? "時間未設定";
  };

  const timelineSegments = useMemo(() => {
    const segments = orderedSlots.map((slot) => {
      const start = parseTimeValue(slot.start_time ?? null);
      const end = parseTimeValue(slot.end_time ?? null);
      let duration = 8;
      if (start != null && end != null && end > start) {
        duration = end - start;
      } else if (slot.changeover_min != null && slot.changeover_min > 0) {
        duration = slot.changeover_min;
      }
      const note = slot.note?.trim() ?? "";
      const tone =
        note === "集合～準備" ||
        note === "終了～撤収" ||
        note === "終了～解散" ||
        note === "休憩" ||
        slot.slot_type === "break" ||
        note.includes("転換")
          ? "amber"
          : slot.slot_phase === "show"
            ? "show"
            : "rehearsal";
      return {
        id: slot.id,
        label: slotLabel(slot),
        time: slotTimeRangeLabel(slot),
        phase: slotPhaseKey(slot),
        type: slot.slot_type,
        tone,
        duration,
      };
    });
    const total = segments.reduce((sum, seg) => sum + seg.duration, 0);
    return { segments, total };
  }, [orderedSlots]);

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
            "id, name, date, status, event_type, venue, open_time, start_time, default_changeover_min, tt_is_provisional, tt_is_published, normal_rehearsal_order"
          )
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("bands")
          .select("id, name")
          .eq("event_id", eventId)
          .eq("band_type", "event")
          .order("created_at", { ascending: true }),
        supabase
          .from("event_slots")
          .select(
            "id, event_id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, changeover_min, note"
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
        setRehearsalOrder(
          (eventRes.data as EventRow).normal_rehearsal_order ?? "same"
        );
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

  const buildSlot = (overrides: Partial<EventSlot> = {}): EventSlot => ({
    id: crypto.randomUUID(),
    event_id: eventId,
    band_id: null,
    slot_type: "band",
    slot_phase: "show",
    order_in_event: 1,
    start_time: null,
    end_time: null,
    changeover_min: event?.default_changeover_min ?? 15,
    note: "",
    ...overrides,
  });

  const insertSlotAt = (index: number, slot: EventSlot) => {
    const next = [...orderedSlots];
    next.splice(index, 0, slot);
    const normalized = next.map((item, idx) => ({
      ...item,
      order_in_event: idx + 1,
    }));
    setSlots(normalized);
    setSelectedSlotId(slot.id);
  };

  const handleInsertAbove = (slotId: string) => {
    const index = orderedSlots.findIndex((slot) => slot.id === slotId);
    if (index < 0) return;
    const base = orderedSlots[index];
    insertSlotAt(index, buildSlot({ slot_phase: base.slot_phase }));
  };

  const handleInsertBelow = (slotId: string) => {
    const index = orderedSlots.findIndex((slot) => slot.id === slotId);
    if (index < 0) return;
    const base = orderedSlots[index];
    insertSlotAt(index + 1, buildSlot({ slot_phase: base.slot_phase }));
  };

  const handleDuplicateSlot = (slotId: string) => {
    const index = orderedSlots.findIndex((slot) => slot.id === slotId);
    if (index < 0) return;
    const base = orderedSlots[index];
    insertSlotAt(
      index + 1,
      buildSlot({
        slot_type: base.slot_type,
        slot_phase: base.slot_phase,
        band_id: base.band_id,
        start_time: base.start_time,
        end_time: base.end_time,
        changeover_min: base.changeover_min,
        note: base.note,
      })
    );
  };

  const handleInsertChangeover = (slotId: string) => {
    const index = orderedSlots.findIndex((slot) => slot.id === slotId);
    if (index < 0) return;
    const base = orderedSlots[index];
    insertSlotAt(
      index + 1,
      buildSlot({
        slot_type: "break",
        slot_phase: base.slot_phase,
        band_id: null,
        changeover_min: event?.default_changeover_min ?? 15,
        note: "転換",
      })
    );
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
      slot_phase: "show",
      order_in_event: nextOrder,
      start_time: null,
      end_time: null,
      changeover_min: event?.default_changeover_min ?? 15,
      note: "",
    };
    setSlots((prev) => [...prev, newSlot]);
  };

  const handleAddRehearsalSlots = (
    phase: EventSlot["slot_phase"],
    orderOverride?: "same" | "reverse"
  ) => {
    if (!eventId) return;
    if (bands.length === 0) {
      setError("バンドが登録されていません。");
      return;
    }
    const nextOrder =
      slots.reduce((max, slot) => Math.max(max, slot.order_in_event ?? 0), 0) + 1;
    const order = orderOverride ?? rehearsalOrder;
    const list = order === "reverse" ? [...bands].reverse() : [...bands];
    const newSlots = list.map((band, index) => ({
      id: crypto.randomUUID(),
      event_id: eventId,
      band_id: band.id,
      slot_type: "band" as const,
      slot_phase: phase,
      order_in_event: nextOrder + index,
      start_time: null,
      end_time: null,
      changeover_min: event?.default_changeover_min ?? 15,
      note: "",
    }));
    setSlots((prev) => [...prev, ...newSlots]);
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

  const handleSlotDurationChange = (id: string, raw: string) => {
    const duration = Number.parseInt(raw, 10);
    if (!Number.isFinite(duration) || duration <= 0) return;
    setSlots((prev) =>
      prev.map((slot) => (slot.id === id ? applyDurationToSlot(slot, duration) : slot))
    );
  };

  const handleCompactSlotTimes = () => {
    if (orderedSlots.length === 0) return;
    const compacted = compactConsecutiveTimedSlots(orderedSlots);
    const changed = compacted.reduce((count, slot, index) => {
      const prev = orderedSlots[index];
      if (!prev) return count;
      return slot.start_time !== prev.start_time || slot.end_time !== prev.end_time
        ? count + 1
        : count;
    }, 0);
    if (changed === 0) {
      toast.info("時間のズレは見つかりませんでした。");
      return;
    }
    setSlots(compacted);
    toast.success(`時間を補正しました（${changed}件）。`);
  };

  const handleSaveSlots = async () => {
    if (!eventId || saving) return;
    setSaving(true);
    setError(null);

    const compactedSlots = compactConsecutiveTimedSlots(orderedSlots);
    const payloads = compactedSlots.map((slot, index) => {
      const note = slot.note?.trim() ?? "";
      let slotType = slot.slot_type;
      let nextNote = slot.note || null;
      if (slotType === "mc") slotType = "other";
      if (slotType === "other" && note.includes("転換")) {
        slotType = "break";
        nextNote = "転換";
      }
      if (slotType === "break") {
        nextNote = "転換";
      }
      return {
        id: slot.id,
        event_id: eventId,
        band_id: slotType === "band" ? slot.band_id ?? null : null,
        slot_type: slotType,
        slot_phase: slot.slot_phase ?? "show",
        order_in_event: slot.order_in_event ?? index + 1,
        start_time: slot.start_time || null,
        end_time: slot.end_time || null,
        changeover_min:
          slot.changeover_min == null || Number.isNaN(Number(slot.changeover_min))
            ? null
            : Number(slot.changeover_min),
        note: nextNote,
      };
    });

    const { data, error } = await supabase
      .from("event_slots")
      .upsert(payloads, { onConflict: "id" })
      .select(
        "id, event_id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, changeover_min, note"
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
    setSelectedSlotId((prev) => (prev === slotId ? null : prev));
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

    const baseStart = parseTimeValue(event?.start_time ?? null);
    let cursor = baseStart;
    const changeover = event?.default_changeover_min ?? 15;

    const payloads: any[] = [];
    let orderIndex = 1;

    bands.forEach((band, index) => {
      const durationSec = durationMap.get(band.id) ?? 0;
      const durationMin = durationSec > 0 ? Math.ceil(durationSec / 60) : null;
      let startTime: string | null = null;
      let endTime: string | null = null;
      if (cursor != null) {
        startTime = formatTimeValue(cursor);
        if (durationMin != null) {
          endTime = formatTimeValue(cursor + durationMin);
        }
      }

      payloads.push({
        event_id: eventId,
        band_id: band.id,
        slot_type: "band",
        slot_phase: "show",
        order_in_event: orderIndex++,
        start_time: startTime,
        end_time: endTime,
        changeover_min: changeover,
        note: null,
      });

      if (cursor != null && durationMin != null) {
        cursor += durationMin;
      }

      if (index < bands.length - 1 && changeover > 0) {
        let changeoverStart: string | null = null;
        let changeoverEnd: string | null = null;
        if (cursor != null) {
          changeoverStart = formatTimeValue(cursor);
          changeoverEnd = formatTimeValue(cursor + changeover);
        }
        payloads.push({
          event_id: eventId,
          band_id: null,
          slot_type: "break",
          slot_phase: "show",
          order_in_event: orderIndex++,
          start_time: changeoverStart,
          end_time: changeoverEnd,
          changeover_min: changeover,
          note: "転換",
        });

        if (cursor != null) {
          cursor += changeover;
        }
      }
    });

    const { data, error } = await supabase
      .from("event_slots")
      .insert(payloads)
      .select(
        "id, event_id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, changeover_min, note"
      );

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

  const handleGenerateTemplate = async () => {
    if (!eventId || templating) return;
    if (bands.length === 0) {
      setError("バンドが登録されていません。");
      return;
    }
    if (slots.length > 0) {
      const confirmed = window.confirm("既存のスロットを上書きしますか？");
      if (!confirmed) return;
    }

    setTemplating(true);
    setError(null);

    if (slots.length > 0) {
      const { error: deleteError } = await supabase.from("event_slots").delete().eq("event_id", eventId);
      if (deleteError) {
        console.error(deleteError);
        setError("既存スロットの削除に失敗しました。");
        setTemplating(false);
        return;
      }
    }

    const durationMap = new Map<string, number>();
    songs.forEach((song) => {
      if (!song.band_id || !song.duration_sec) return;
      const current = durationMap.get(song.band_id) ?? 0;
      durationMap.set(song.band_id, current + song.duration_sec);
    });

    const changeover = event?.default_changeover_min ?? 15;
    const getBandDurationMin = (bandId: string) => {
      const durationSec = durationMap.get(bandId) ?? 0;
      if (durationSec > 0) return Math.ceil(durationSec / 60);
      return DEFAULT_BAND_DURATION_MIN;
    };

    const buildBandSeeds = (list: BandRow[], phase: EventSlot["slot_phase"]) => {
      const seeds: SlotSeed[] = [];
      list.forEach((band, index) => {
        const baseDuration = getBandDurationMin(band.id);
        const duration =
          phase === "rehearsal_normal" || phase === "rehearsal_pre"
            ? Math.max(MIN_REHEARSAL_MIN, baseDuration)
            : baseDuration;
        seeds.push({
          slot_type: "band",
          slot_phase: phase,
          band_id: band.id,
          changeover_min: null,
          note: null,
          duration_min: duration,
        });
        if (index < list.length - 1) {
          seeds.push({
            slot_type: "break",
            slot_phase: phase,
            band_id: null,
            changeover_min: changeover,
            note: "転換",
            duration_min: changeover,
          });
        }
      });
      return seeds;
    };

    const rehearsalList = rehearsalOrder === "reverse" ? [...bands].reverse() : [...bands];
    const preShowSeeds: SlotSeed[] = [
      {
        slot_type: "other",
        slot_phase: "rehearsal_normal",
        note: "集合～準備",
        changeover_min: null,
        duration_min: TEMPLATE_PREP_MINUTES,
      },
      ...buildBandSeeds(rehearsalList, "rehearsal_normal"),
      {
        slot_type: "other",
        slot_phase: "rehearsal_normal",
        note: "休憩",
        changeover_min: null,
        duration_min: TEMPLATE_BREAK_MINUTES,
      },
    ];
    const showSeeds: SlotSeed[] = [
      ...buildBandSeeds(bands, "show"),
      {
        slot_type: "other",
        slot_phase: "show",
        note: "終了～撤収",
        changeover_min: null,
        duration_min: TEMPLATE_CLEANUP_MINUTES,
      },
    ];

    const preShowDuration = preShowSeeds.reduce((sum, seed) => sum + (seed.duration_min ?? 0), 0);
    const gatherStart = parseTimeValue(event?.open_time ?? null);
    const showStartBase = parseTimeValue(event?.start_time ?? null);
    let preShowStart = gatherStart ?? (showStartBase != null ? showStartBase - preShowDuration : null);
    if (preShowStart != null && preShowStart < 0) preShowStart = null;
    let showStart = showStartBase;
    if (showStart == null && preShowStart != null) {
      showStart = preShowStart + preShowDuration;
    }

    const applyTimes = (items: SlotSeed[], startMin: number | null) => {
      let cursor = startMin;
      return items.map((item) => {
        let start_time: string | null = null;
        let end_time: string | null = null;
        if (cursor != null && item.duration_min != null) {
          start_time = formatTimeValue(cursor);
          end_time = formatTimeValue(cursor + item.duration_min);
          cursor += item.duration_min;
        }
        return { ...item, start_time, end_time };
      });
    };

    const preShowTimed = applyTimes(preShowSeeds, preShowStart);
    const showTimed = applyTimes(showSeeds, showStart ?? null);
    const merged = [...preShowTimed, ...showTimed];

    const payloads = merged.map((slot, index) => ({
      event_id: eventId,
      band_id: slot.slot_type === "band" ? slot.band_id ?? null : null,
      slot_type: slot.slot_type,
      slot_phase: slot.slot_phase,
      order_in_event: index + 1,
      start_time: slot.start_time ?? null,
      end_time: slot.end_time ?? null,
      changeover_min:
        slot.changeover_min == null || Number.isNaN(Number(slot.changeover_min))
          ? null
          : Number(slot.changeover_min),
      note: slot.note ?? null,
    }));

    const { data, error } = await supabase
      .from("event_slots")
      .insert(payloads)
      .select(
        "id, event_id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, changeover_min, note"
      );

    if (error || !data) {
      console.error(error);
      setError("テンプレートの作成に失敗しました。");
      setTemplating(false);
      return;
    }

    setSlots((data ?? []) as EventSlot[]);
    toast.success("テンプレートを作成しました。");
    setTemplating(false);
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

    setEvent((prev) =>
      prev
        ? {
            ...prev,
            tt_is_published: nextValue,
            tt_is_provisional: nextValue ? true : prev.tt_is_provisional,
          }
        : prev
    );
    toast.success(nextValue ? "タイムテーブルを公開しました。" : "タイムテーブルを非公開にしました。");
    setPublishing(false);
  };

  const handleToggleProvisional = async () => {
    if (!eventId || !event || provisioning) return;
    if (event.tt_is_published && event.tt_is_provisional) {
      toast.error("公開中は仮確定を解除できません。");
      return;
    }
    setProvisioning(true);
    setError(null);

    const nextValue = !event.tt_is_provisional;
    const { error: provisionalError } = await supabase.rpc("set_event_tt_provisional", {
      event_id: eventId,
      is_provisional: nextValue,
    });

    if (provisionalError) {
      console.error(provisionalError);
      setError("仮確定の更新に失敗しました。");
      setProvisioning(false);
      return;
    }

    setEvent((prev) => (prev ? { ...prev, tt_is_provisional: nextValue } : prev));
    toast.success(nextValue ? "仮確定にしました。" : "仮確定を解除しました。");
    setProvisioning(false);
  };

  const handleSaveRehearsalOrder = async () => {
    if (!eventId || savingRehearsalOrder) return;
    setSavingRehearsalOrder(true);
    const { error: updateError } = await supabase
      .from("events")
      .update({ normal_rehearsal_order: rehearsalOrder })
      .eq("id", eventId);

    if (updateError) {
      console.error(updateError);
      setError("通常リハ順序の保存に失敗しました。");
      setSavingRehearsalOrder(false);
      return;
    }

    setEvent((prev) =>
      prev ? { ...prev, normal_rehearsal_order: rehearsalOrder } : prev
    );
    toast.success("通常リハ順序を保存しました。");
    setSavingRehearsalOrder(false);
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

        <main className="flex-1 md:ml-20 flex flex-col min-h-screen">
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
                  {event.open_time && (
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      集合 {formatTimeText(event.open_time) ?? event.open_time}
                    </span>
                  )}
                  {event.start_time && (
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      開演 {formatTimeText(event.start_time) ?? event.start_time}
                    </span>
                  )}
                  <Badge variant={event.tt_is_published ? "default" : "outline"}>
                    {event.tt_is_published ? "公開中" : "非公開"}
                  </Badge>
                  <Badge variant={event.tt_is_provisional ? "secondary" : "outline"}>
                    {event.tt_is_provisional ? "仮確定" : "仮確定前"}
                  </Badge>
                </div>
              )
            }
          />

          <section className="flex-1 pb-6 md:pb-8 md:overflow-hidden">
            <div className="container mx-auto px-4 sm:px-6 flex flex-col gap-6 md:h-full">
              <Card className="bg-card/60 border-border shrink-0">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">公開・仮確定</CardTitle>
                    <CardDescription>仮確定でシフト作成を解放し、公開で全員が閲覧できます。</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={event?.tt_is_provisional ? "outline" : "default"}
                      onClick={handleToggleProvisional}
                      disabled={provisioning}
                    >
                      {provisioning ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : event?.tt_is_provisional ? (
                        "仮確定を解除"
                      ) : (
                        "仮確定にする"
                      )}
                    </Button>
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
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  仮確定にするとシフト作成が解放されます。公開は閲覧用です。
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border flex flex-col min-h-0">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">タイムテーブル</CardTitle>
                    <CardDescription>ドラッグで順番を調整し、保存で反映します。</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground"
                        value={rehearsalOrder}
                        onChange={(e) =>
                          setRehearsalOrder(e.target.value as "same" | "reverse")
                        }
                      >
                        <option value="same">通常リハ: 同順</option>
                        <option value="reverse">通常リハ: 逆順</option>
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSaveRehearsalOrder}
                        disabled={savingRehearsalOrder}
                      >
                        {savingRehearsalOrder ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          "順序保存"
                        )}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleAddRehearsalSlots("rehearsal_normal")}
                    >
                      通常リハ追加
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleAddRehearsalSlots("rehearsal_pre")}
                    >
                      直前リハ追加
                    </Button>
                    <Button type="button" variant="outline" onClick={handleGenerateSlots} disabled={generating}>
                      {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      自動生成
                    </Button>
                    <Button type="button" variant="outline" onClick={handleGenerateTemplate} disabled={templating}>
                      {templating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      テンプレート作成
                    </Button>
                    <Button type="button" variant="outline" onClick={handleAddSlot}>
                      <Plus className="w-4 h-4" />
                      本番追加
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCompactSlotTimes}
                      disabled={orderedSlots.length === 0}
                    >
                      時間補正
                    </Button>
                    <Button type="button" onClick={handleSaveSlots} disabled={saving || orderedSlots.length === 0}>
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      保存
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 md:overflow-auto">
                  {orderedSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      スロットがまだありません。テンプレート作成か追加ボタンで枠を用意してください。
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>タイムライン</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={phaseBadgeVariant("show")}>本番</Badge>
                            <Badge variant={phaseBadgeVariant("rehearsal_normal")}>通常リハ</Badge>
                            <Badge variant={phaseBadgeVariant("rehearsal_pre")}>直前リハ</Badge>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-6 rounded-full bg-fuchsia-400/80" />
                            本番
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-6 rounded-full bg-sky-400/80" />
                            リハ
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-6 rounded-full bg-amber-400/80" />
                            転換/休憩/付帯作業（準備・撤収など）
                          </span>
                        </div>
                        <div className="mt-3 flex gap-1 overflow-x-auto">
                          {timelineSegments.segments.map((segment) => (
                            <button
                              key={segment.id}
                              type="button"
                              onClick={() => setSelectedSlotId(segment.id)}
                              className={cn(
                                "group min-w-[80px] flex-1 rounded-md border px-2 py-2 text-left text-[11px] transition-colors",
                                segment.tone === "show"
                                  ? "border-primary/40 bg-primary/15 text-primary"
                                  : segment.tone === "rehearsal"
                                    ? "border-secondary/40 bg-secondary/20 text-foreground"
                                    : "border-amber-400/40 bg-amber-500/10 text-amber-200",
                                selectedSlotId === segment.id && "ring-2 ring-primary/40"
                              )}
                              style={{ flexGrow: segment.duration, flexBasis: 0 }}
                              title={`${segment.label} ${segment.time}`}
                            >
                              <p className="truncate font-medium text-foreground/90">{segment.label}</p>
                              <p className="truncate">{segment.time}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),320px]">
                        <div className="space-y-2">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSlotDragEnd}>
                            <SortableContext
                              items={orderedSlots.map((slot) => slot.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2">
                                {orderedSlots.map((slot, index) => {
                                  const currentPhase = slotPhaseKey(slot);
                                  const prevPhase = orderedSlots[index - 1]
                                    ? slotPhaseKey(orderedSlots[index - 1])
                                    : currentPhase;
                                  const showPhaseSeparator = index === 0 || prevPhase !== currentPhase;

                                  return (
                                    <div key={slot.id} className="space-y-2">
                                      {showPhaseSeparator && (
                                        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                                          <span className="font-semibold">{slotPhaseLabel(slot)}</span>
                                          <div className={`h-1 flex-1 rounded-full ${phaseBarClass(currentPhase)}`} />
                                        </div>
                                      )}
                                      <SortableItem id={slot.id}>
                                        {({ attributes, listeners, setActivatorNodeRef, isDragging }) => (
                                          <div
                                            className={cn(
                                              "flex flex-wrap items-start gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-3",
                                              slotAccentClass(slot),
                                              selectedSlotId === slot.id && "border-primary/40 bg-primary/5",
                                              isDragging && "ring-1 ring-primary/40"
                                            )}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedSlotId(slot.id)}
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                setSelectedSlotId(slot.id);
                                              }
                                            }}
                                          >
                                            <button
                                              type="button"
                                              ref={setActivatorNodeRef}
                                              className="mt-0.5 inline-flex items-center justify-center rounded-md border border-border p-1 text-muted-foreground hover:text-foreground"
                                              {...attributes}
                                              {...listeners}
                                              aria-label="並び替え"
                                              onClick={(event) => event.stopPropagation()}
                                            >
                                              <GripVertical className="w-4 h-4" />
                                            </button>
                                            <div className="flex-1 min-w-[180px] space-y-1">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline">#{slot.order_in_event ?? index + 1}</Badge>
                                                <Badge variant={slotPhaseBadgeVariant(slot)}>
                                                  {slotPhaseLabel(slot)}
                                                </Badge>
                                                <Badge variant={slot.slot_type === "band" ? "default" : "outline"}>
                                                  {slotTypeLabel(slot)}
                                                </Badge>
                                              </div>
                                              <p className="text-sm font-semibold text-foreground">{slotLabel(slot)}</p>
                                          <p className="text-sm text-muted-foreground">{slotTimeLabel(slot)}</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1 text-xs">
                                              <button
                                                type="button"
                                                className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleInsertAbove(slot.id);
                                                }}
                                              >
                                                上に追加
                                              </button>
                                              <button
                                                type="button"
                                                className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleInsertBelow(slot.id);
                                                }}
                                              >
                                                下に追加
                                              </button>
                                              <button
                                                type="button"
                                                className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleInsertChangeover(slot.id);
                                                }}
                                              >
                                                転換
                                              </button>
                                              <button
                                                type="button"
                                                className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleDuplicateSlot(slot.id);
                                                }}
                                              >
                                                複製
                                              </button>
                                              <button
                                                type="button"
                                                className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:border-destructive/60 hover:text-destructive"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleDeleteSlot(slot.id);
                                                }}
                                              >
                                                削除
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </SortableItem>
                                    </div>
                                  );
                                })}
                              </div>
                            </SortableContext>
                          </DndContext>
                          <p className="text-xs text-muted-foreground">
                            ドラッグで順番変更、クリックで詳細編集できます。
                          </p>
                        </div>

                        <div className="rounded-lg border border-border/70 bg-background/40 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">詳細編集</p>
                            {selectedSlot && (
                              <Badge variant={slotPhaseBadgeVariant(selectedSlot)}>
                                {slotPhaseLabel(selectedSlot)}
                              </Badge>
                            )}
                          </div>
                          {!selectedSlot ? (
                            <p className="text-sm text-muted-foreground">左のリストから選択してください。</p>
                          ) : (
                            <div className="space-y-3">
                              <label className="space-y-1 text-xs block">
                                <span className="text-muted-foreground">並び順</span>
                                <Input
                                  type="number"
                                  min={1}
                                  value={selectedSlot.order_in_event ?? ""}
                                  onChange={(e) =>
                                    handleSlotChange(
                                      selectedSlot.id,
                                      "order_in_event",
                                      Number(e.target.value)
                                    )
                                  }
                                />
                              </label>
                              <label className="space-y-1 text-xs block">
                                <span className="text-muted-foreground">区分</span>
                                <select
                                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                  value={selectedSlot.slot_phase}
                                  onChange={(e) =>
                                    handleSlotChange(
                                      selectedSlot.id,
                                      "slot_phase",
                                      e.target.value as EventSlot["slot_phase"]
                                    )
                                  }
                                >
                                  {slotPhaseOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="space-y-1 text-xs block">
                                <span className="text-muted-foreground">種別</span>
                                <select
                                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                  value={resolveSlotTypeValue(selectedSlot)}
                                  onChange={(e) =>
                                    handleSlotTypeSelect(
                                      selectedSlot,
                                      e.target.value as "band" | "break" | "other"
                                    )
                                  }
                                >
                                  {slotTypeOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {selectedSlot.slot_type === "band" && (
                                <label className="space-y-1 text-xs block">
                                  <span className="text-muted-foreground">バンド</span>
                                  <select
                                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    value={selectedSlot.band_id ?? ""}
                                    onChange={(e) =>
                                      handleSlotChange(selectedSlot.id, "band_id", e.target.value || null)
                                    }
                                  >
                                    <option value="">バンドを選択</option>
                                    {bands.map((band) => (
                                      <option key={band.id} value={band.id}>
                                        {band.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1 text-xs">
                                  <span className="text-muted-foreground">開始</span>
                                  <Input
                                    type="time"
                                    value={selectedSlot.start_time ?? ""}
                                    onChange={(e) =>
                                      handleSlotChange(selectedSlot.id, "start_time", e.target.value || null)
                                    }
                                  />
                                </label>
                                <label className="space-y-1 text-xs">
                                  <span className="text-muted-foreground">終了</span>
                                  <Input
                                    type="time"
                                    value={selectedSlot.end_time ?? ""}
                                    onChange={(e) =>
                                      handleSlotChange(selectedSlot.id, "end_time", e.target.value || null)
                                    }
                                  />
                                </label>
                              </div>
                              <label className="space-y-1 text-xs block">
                                <span className="text-muted-foreground">持ち時間(分)</span>
                                <Input
                                  type="number"
                                  min={1}
                                  value={slotDurationMin(selectedSlot) ?? ""}
                                  onChange={(e) =>
                                    handleSlotDurationChange(selectedSlot.id, e.target.value)
                                  }
                                  disabled={!selectedSlot.start_time && !selectedSlot.end_time}
                                />
                              </label>
                              <label className="space-y-1 text-xs block">
                                <span className="text-muted-foreground">転換(分)</span>
                                <Input
                                  type="number"
                                  min={0}
                                  value={selectedSlot.changeover_min ?? ""}
                                  onChange={(e) =>
                                    handleSlotChange(selectedSlot.id, "changeover_min", Number(e.target.value))
                                  }
                                />
                              </label>
                              <label className="space-y-1 text-xs block">
                                <span className="text-muted-foreground">メモ</span>
                                <Input
                                  value={selectedSlot.note ?? ""}
                                  onChange={(e) => handleSlotChange(selectedSlot.id, "note", e.target.value)}
                                  placeholder="付帯作業のメモ"
                                />
                              </label>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleDeleteSlot(selectedSlot.id)}
                                className="text-destructive border-destructive/40 hover:border-destructive hover:text-destructive"
                              >
                                この枠を削除
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
