"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  GripVertical,
  MapPin,
  PencilLine,
  Plus,
  Save,
  RefreshCw,
  Trash2,
  Users,
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
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useIsAdministrator } from "@/lib/useIsAdministrator";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/PageHeader";

type EventRow = {
  id: string;
  name: string;
  date: string;
  status: string;
  event_type: string;
  venue: string | null;
  open_time: string | null;
  start_time: string | null;
  note: string | null;
  default_changeover_min: number;
  tt_is_published: boolean;
  tt_is_provisional: boolean;
};

type Band = {
  id: string;
  event_id: string;
  name: string;
  note_pa: string | null;
  note_lighting: string | null;
  stage_plot_data: Record<string, any> | null;
  created_by: string | null;
};

type ProfileOption = {
  id: string;
  display_name: string;
  email?: string | null;
  discord?: string | null;
  crew?: string | null;
};

type BandMember = {
  id: string;
  band_id: string;
  user_id: string;
  instrument: string;
};

type Song = {
  id: string;
  band_id: string;
  title: string;
  artist: string | null;
  entry_type: "song" | "mc" | null;
  url: string | null;
  order_index: number | null;
  duration_sec: number | null;
  memo: string | null;
};

type EventSlot = {
  id: string;
  event_id: string;
  band_id: string | null;
  slot_type: string;
  order_in_event: number | null;
  start_time: string | null;
  end_time: string | null;
  changeover_min: number | null;
  note: string | null;
};

type EventStaffMember = {
  id: string;
  event_id: string;
  profile_id: string;
  can_pa: boolean;
  can_light: boolean;
  note: string | null;
};

type SlotStaffAssignment = {
  id: string;
  event_slot_id: string;
  profile_id: string;
  role: "pa" | "light";
  is_fixed: boolean;
  note: string | null;
};

const statusOptions = [
  { value: "draft", label: "下書き" },
  { value: "recruiting", label: "募集中" },
  { value: "fixed", label: "確定" },
  { value: "closed", label: "終了" },
];

const eventTypeOptions = [
  { value: "live", label: "ライブ" },
  { value: "workshop", label: "講習会" },
  { value: "briefing", label: "説明会" },
  { value: "camp", label: "合宿" },
  { value: "other", label: "その他" },
];

const slotTypeOptions = [
  { value: "band", label: "バンド" },
  { value: "break", label: "休憩" },
  { value: "mc", label: "MC" },
  { value: "other", label: "その他" },
];

function statusBadge(status: string) {
  if (status === "recruiting") return "default";
  if (status === "fixed") return "secondary";
  return "outline";
}

function statusLabel(status: string) {
  return statusOptions.find((s) => s.value === status)?.label ?? status;
}

function eventTypeLabel(eventType: string) {
  return eventTypeOptions.find((t) => t.value === eventType)?.label ?? eventType;
}

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
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-80")}>
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
}

export default function AdminEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isAdministrator: viewerIsAdministrator } = useIsAdministrator();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [eventForm, setEventForm] = useState<EventRow | null>(null);
  const [bands, setBands] = useState<Band[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [bandForm, setBandForm] = useState({
    name: "",
    note_pa: "",
    note_lighting: "",
    stagePlotNote: "",
  });
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [members, setMembers] = useState<BandMember[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [slots, setSlots] = useState<EventSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsSaving, setSlotsSaving] = useState(false);
  const [slotsGenerating, setSlotsGenerating] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});
  const [eventStaff, setEventStaff] = useState<EventStaffMember[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<SlotStaffAssignment[]>([]);
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [newBandName, setNewBandName] = useState("");
  const [memberForm, setMemberForm] = useState({ profileId: "", instrument: "" });
  const [songForm, setSongForm] = useState({
    title: "",
    artist: "",
    url: "",
    entry_type: "song",
    duration_sec: "",
    memo: "",
  });
  const [staffForm, setStaffForm] = useState({
    profileId: "",
    can_pa: false,
    can_light: false,
    note: "",
  });
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingBand, setSavingBand] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [savingSong, setSavingSong] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBandDeleteConfirm, setShowBandDeleteConfirm] = useState(false);
  const [bandDeleteText, setBandDeleteText] = useState("");
  const [deletingBand, setDeletingBand] = useState(false);

  const selectedBand = useMemo(
    () => bands.find((b) => b.id === selectedBandId) ?? null,
    [bands, selectedBandId]
  );

  const profilesMap = useMemo(() => {
    const map = new Map<string, ProfileOption>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const bandNameMap = useMemo(() => {
    const map = new Map<string, string>();
    bands.forEach((band) => map.set(band.id, band.name));
    return map;
  }, [bands]);

  const availableStaffOptions = useMemo(() => {
    const assigned = new Set(eventStaff.map((staff) => staff.profile_id));
    return profiles.filter((profile) => !assigned.has(profile.id));
  }, [eventStaff, profiles]);

  const assignmentsBySlot = useMemo(() => {
    const map = new Map<string, { pa: SlotStaffAssignment[]; light: SlotStaffAssignment[] }>();
    staffAssignments.forEach((assignment) => {
      const bucket = map.get(assignment.event_slot_id) ?? { pa: [], light: [] };
      if (assignment.role === "pa") {
        bucket.pa.push(assignment);
      } else {
        bucket.light.push(assignment);
      }
      map.set(assignment.event_slot_id, bucket);
    });
    return map;
  }, [staffAssignments]);

  const slotLabel = (slot: EventSlot) => {
    if (slot.slot_type === "band") {
      return bandNameMap.get(slot.band_id ?? "") ?? "バンド未設定";
    }
    if (slot.slot_type === "break") return "休憩";
    if (slot.slot_type === "mc") return "MC";
    return slot.note?.trim() || "その他";
  };

  const slotTimeLabel = (slot: EventSlot) => {
    if (!slot.start_time && !slot.end_time) return "時間未設定";
    if (slot.start_time && slot.end_time) return `${slot.start_time} - ${slot.end_time}`;
    return slot.start_time ?? slot.end_time ?? "時間未設定";
  };

  const slotsById = useMemo(() => {
    const map = new Map<string, EventSlot>();
    slots.forEach((slot) => map.set(slot.id, slot));
    return map;
  }, [slots]);

  const doubleBookings = useMemo(() => {
    const toMinutes = (value: string | null) => {
      if (!value) return null;
      const [h, m] = value.split(":").map((part) => Number(part));
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    const buckets = new Map<string, { profileId: string; role: string; slots: EventSlot[] }>();
    staffAssignments.forEach((assignment) => {
      const slot = slotsById.get(assignment.event_slot_id);
      if (!slot?.start_time || !slot.end_time) return;
      const key = `${assignment.profile_id}:${assignment.role}`;
      const bucket = buckets.get(key) ?? {
        profileId: assignment.profile_id,
        role: assignment.role,
        slots: [],
      };
      bucket.slots.push(slot);
      buckets.set(key, bucket);
    });

    const conflicts: {
      profileId: string;
      role: string;
      slotA: EventSlot;
      slotB: EventSlot;
    }[] = [];

    buckets.forEach((bucket) => {
      const ordered = [...bucket.slots].sort((a, b) => {
        const startA = toMinutes(a.start_time) ?? Number.MAX_SAFE_INTEGER;
        const startB = toMinutes(b.start_time) ?? Number.MAX_SAFE_INTEGER;
        return startA - startB;
      });
      for (let i = 0; i < ordered.length - 1; i += 1) {
        const current = ordered[i];
        const next = ordered[i + 1];
        const currentEnd = toMinutes(current.end_time);
        const nextStart = toMinutes(next.start_time);
        if (currentEnd != null && nextStart != null && nextStart < currentEnd) {
          conflicts.push({
            profileId: bucket.profileId,
            role: bucket.role,
            slotA: current,
            slotB: next,
          });
        }
      }
    });

    return conflicts;
  }, [staffAssignments, slotsById]);

  const selectedBandMembers = useMemo(
    () => members.filter((m) => m.band_id === selectedBandId),
    [members, selectedBandId]
  );

  const selectedBandSongs = useMemo(() => {
    const list = songs.filter((s) => s.band_id === selectedBandId);
    return list.sort((a, b) => {
      const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title, "ja");
    });
  }, [songs, selectedBandId]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    setError(null);
  }, [error]);

  useEffect(() => {
    if (!deleteError) return;
    toast.error(deleteError);
    setDeleteError(null);
  }, [deleteError]);

  const orderedSlots = useMemo(() => {
    return [...slots].sort((a, b) => {
      const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const startA = a.start_time ?? "";
      const startB = b.start_time ?? "";
      if (startA !== startB) return startA.localeCompare(startB);
      return (a.note ?? "").localeCompare(b.note ?? "");
    });
  }, [slots]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

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
  useEffect(() => {
    if (!eventId || adminLoading || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setSlotsLoading(true);

      const [eventRes, bandsRes, profilesRes, slotsRes, staffRes] = await Promise.all([
        supabase
          .from("events")
          .select(
            "id, name, date, status, event_type, venue, open_time, start_time, note, default_changeover_min, tt_is_published, tt_is_provisional"
          )
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("bands")
          .select("id, event_id, name, note_pa, note_lighting, stage_plot_data, created_by")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("*").order("display_name", { ascending: true }),
        supabase
          .from("event_slots")
          .select(
            "id, event_id, band_id, slot_type, order_in_event, start_time, end_time, changeover_min, note"
          )
          .eq("event_id", eventId)
          .order("order_in_event", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("event_staff_members")
          .select("id, event_id, profile_id, can_pa, can_light, note")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        setError("イベント情報の取得に失敗しました。");
        setEvent(null);
        setBands([]);
        setProfiles([]);
        setMembers([]);
        setSongs([]);
        setSlots([]);
        setSlotsLoading(false);
        setLoading(false);
        return;
      }

      setEvent(eventRes.data as EventRow);
      setEventForm(eventRes.data as EventRow);

      const bandList = (bandsRes.data ?? []) as Band[];
      setBands(bandList);
      setSelectedBandId((prev) => prev ?? bandList[0]?.id ?? null);

      const profileList = (profilesRes.data ?? []).map((p: any) => ({
        id: p.id,
        display_name:
          p.display_name ??
          p.full_name ??
          p.name ??
          (viewerIsAdministrator ? p.email : null) ??
          "名前未登録",
        email: viewerIsAdministrator ? p.email ?? null : null,
        discord: p.discord_username ?? p.discord ?? null,
        crew: p.crew ?? null,
      }));
      setProfiles(profileList);

      if (slotsRes.error) {
        console.error(slotsRes.error);
        setError((prev) => prev ?? "タイムテーブルの取得に失敗しました。");
        setSlots([]);
      } else {
        setSlots((slotsRes.data ?? []) as EventSlot[]);
      }
      setSlotsLoading(false);

      if (staffRes.error) {
        console.error(staffRes.error);
        setError((prev) => prev ?? "当日スタッフの取得に失敗しました。");
        setEventStaff([]);
      } else {
        setEventStaff((staffRes.data ?? []) as EventStaffMember[]);
      }

      const slotIds = (slotsRes.data ?? []).map((slot: any) => slot.id).filter(Boolean);
      if (slotIds.length > 0) {
        const assignmentsRes = await supabase
          .from("slot_staff_assignments")
          .select("id, event_slot_id, profile_id, role, is_fixed, note")
          .in("event_slot_id", slotIds);
        if (!cancelled) {
          if (assignmentsRes.error) {
            console.error(assignmentsRes.error);
            setError((prev) => prev ?? "シフト割当の取得に失敗しました。");
            setStaffAssignments([]);
          } else {
            setStaffAssignments((assignmentsRes.data ?? []) as SlotStaffAssignment[]);
          }
        }
      } else {
        setStaffAssignments([]);
      }

      const bandIds = bandList.map((b) => b.id);
      if (bandIds.length === 0) {
        setMembers([]);
        setSongs([]);
        setLoading(false);
        return;
      }

      const [membersRes, songsRes] = await Promise.all([
        supabase.from("band_members").select("id, band_id, user_id, instrument").in("band_id", bandIds),
        supabase
          .from("songs")
          .select("id, band_id, title, artist, entry_type, url, order_index, duration_sec, memo, created_at")
          .in("band_id", bandIds)
          .order("order_index", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

      if (!cancelled) {
        if (membersRes.error) {
          console.error(membersRes.error);
          setError("バンドメンバーの取得に失敗しました。");
        } else {
          setMembers((membersRes.data ?? []) as BandMember[]);
        }

        if (songsRes.error) {
          console.error(songsRes.error);
          setError((prev) => prev ?? "セットリストの取得に失敗しました。");
        } else {
          setSongs((songsRes.data ?? []) as Song[]);
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [adminLoading, eventId, isAdmin, viewerIsAdministrator]);

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
      changeover_min: eventForm?.default_changeover_min ?? 15,
      note: "",
    };
    setSlots((prev) => [...prev, newSlot]);
  };

  const handleSlotChange = <K extends keyof EventSlot>(id: string, key: K, value: EventSlot[K]) => {
    setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, [key]: value } : slot)));
  };

  const toggleSlotExpanded = (slotId: string) => {
    setExpandedSlots((prev) => ({ ...prev, [slotId]: !prev[slotId] }));
  };

  const handleSaveSlots = async () => {
    if (!eventId || slotsSaving) return;
    setSlotsSaving(true);
    setError(null);

    const payloads = slots.map((slot, index) => ({
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
      setSlotsSaving(false);
      return;
    }

    setSlots((data ?? []) as EventSlot[]);
    toast.success("タイムテーブルを保存しました。");
    setSlotsSaving(false);
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!slotId) return;
    const { error } = await supabase.from("event_slots").delete().eq("id", slotId);
    if (error) {
      console.error(error);
      setError("タイムテーブルの削除に失敗しました。");
      return;
    }
    setSlots((prev) => prev.filter((slot) => slot.id !== slotId));
    setStaffAssignments((prev) => prev.filter((assignment) => assignment.event_slot_id !== slotId));
    toast.success("スロットを削除しました。");
  };

  const handleGenerateSlots = async () => {
    if (!eventId || slotsGenerating) return;
    if (bands.length === 0) {
      setError("バンドが登録されていません。");
      return;
    }
    if (slots.length > 0) {
      const confirmed = window.confirm("既存のスロットを上書きしますか？");
      if (!confirmed) return;
    }

    setSlotsGenerating(true);
    setError(null);

    if (slots.length > 0) {
      const { error } = await supabase.from("event_slots").delete().eq("event_id", eventId);
      if (error) {
        console.error(error);
        setError("既存スロットの削除に失敗しました。");
        setSlotsGenerating(false);
        return;
      }
      setStaffAssignments([]);
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

    const baseStart = parseTime(eventForm?.start_time ?? null);
    let cursor = baseStart;
    const changeover = eventForm?.default_changeover_min ?? 15;

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
      setSlotsGenerating(false);
      return;
    }

    setSlots((data ?? []) as EventSlot[]);
    toast.success("スロットを自動生成しました。");
    setSlotsGenerating(false);
  };

  const handleAutoAssign = async () => {
    if (!eventId || savingAssignments) return;
    setSavingAssignments(true);
    setError(null);

    const ordered = [...orderedSlots];
    if (ordered.length === 0) {
      setError("スロットがありません。");
      setSavingAssignments(false);
      return;
    }

    const addAssignments: Array<{
      event_slot_id: string;
      profile_id: string;
      role: "pa" | "light";
      is_fixed: boolean;
      note: null;
    }> = [];

    (["pa", "light"] as const).forEach((role) => {
      const eligible = eventStaff
        .filter((staff) => (role === "pa" ? staff.can_pa : staff.can_light))
        .map((staff) => staff.profile_id);
      if (eligible.length === 0) return;

      const existingBySlot = new Set(
        staffAssignments
          .filter((assignment) => assignment.role === role)
          .map((assignment) => assignment.event_slot_id)
      );

      let cursor = 0;
      ordered.forEach((slot) => {
        if (existingBySlot.has(slot.id)) return;
        const profileId = eligible[cursor % eligible.length];
        addAssignments.push({
          event_slot_id: slot.id,
          profile_id: profileId,
          role,
          is_fixed: false,
          note: null,
        });
        cursor += 1;
      });
    });

    if (addAssignments.length === 0) {
      toast.success("割当済みのため追加はありません。");
      setSavingAssignments(false);
      return;
    }

    const { data, error } = await supabase
      .from("slot_staff_assignments")
      .insert(addAssignments)
      .select("id, event_slot_id, profile_id, role, is_fixed, note");

    if (error || !data) {
      console.error(error);
      setError("シフトの自動割当に失敗しました。");
      setSavingAssignments(false);
      return;
    }

    setStaffAssignments((prev) => [...prev, ...(data as SlotStaffAssignment[])]);
    toast.success("シフトを自動割当しました。");
    setSavingAssignments(false);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !staffForm.profileId || savingStaff) return;
    setSavingStaff(true);
    setError(null);

    const payload = {
      event_id: eventId,
      profile_id: staffForm.profileId,
      can_pa: staffForm.can_pa,
      can_light: staffForm.can_light,
      note: staffForm.note.trim() || null,
    };

    const { data, error } = await supabase
      .from("event_staff_members")
      .insert([payload])
      .select("id, event_id, profile_id, can_pa, can_light, note")
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("当日スタッフの追加に失敗しました。");
      setSavingStaff(false);
      return;
    }

    setEventStaff((prev) => [...prev, data as EventStaffMember]);
    setStaffForm({ profileId: "", can_pa: false, can_light: false, note: "" });
    toast.success("当日スタッフを追加しました。");
    setSavingStaff(false);
  };

  const handleUpdateStaffLocal = (id: string, patch: Partial<EventStaffMember>) => {
    setEventStaff((prev) => prev.map((staff) => (staff.id === id ? { ...staff, ...patch } : staff)));
  };

  const handleSaveStaff = async () => {
    if (!eventId || savingStaff) return;
    setSavingStaff(true);
    setError(null);

    const payloads = eventStaff.map((staff) => ({
      id: staff.id,
      event_id: eventId,
      profile_id: staff.profile_id,
      can_pa: Boolean(staff.can_pa),
      can_light: Boolean(staff.can_light),
      note: staff.note?.trim() || null,
    }));

    const { data, error } = await supabase
      .from("event_staff_members")
      .upsert(payloads, { onConflict: "id" })
      .select("id, event_id, profile_id, can_pa, can_light, note");

    if (error || !data) {
      console.error(error);
      setError("当日スタッフの保存に失敗しました。");
      setSavingStaff(false);
      return;
    }

    setEventStaff((data ?? []) as EventStaffMember[]);
    toast.success("当日スタッフを保存しました。");
    setSavingStaff(false);
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!staffId || savingStaff) return;
    setSavingStaff(true);
    setError(null);

    const staff = eventStaff.find((item) => item.id === staffId);
    const { error } = await supabase.from("event_staff_members").delete().eq("id", staffId);
    if (error) {
      console.error(error);
      setError("当日スタッフの削除に失敗しました。");
      setSavingStaff(false);
      return;
    }

    setEventStaff((prev) => prev.filter((staff) => staff.id !== staffId));
    if (staff?.profile_id) {
      const slotIds = slots.map((slot) => slot.id);
      if (slotIds.length > 0) {
        const { error: assignmentError } = await supabase
          .from("slot_staff_assignments")
          .delete()
          .eq("profile_id", staff.profile_id)
          .in("event_slot_id", slotIds);
        if (assignmentError) {
          console.error(assignmentError);
        }
      }
      setStaffAssignments((prev) =>
        prev.filter((assignment) => assignment.profile_id !== staff.profile_id)
      );
    }
    toast.success("当日スタッフを削除しました。");
    setSavingStaff(false);
  };

  const handleAddAssignment = async (slotId: string, role: "pa" | "light", profileId: string) => {
    if (!slotId || !profileId || savingAssignments) return;
    setSavingAssignments(true);
    setError(null);

    const payload = {
      event_slot_id: slotId,
      profile_id: profileId,
      role,
      is_fixed: false,
      note: null,
    };

    const { data, error } = await supabase
      .from("slot_staff_assignments")
      .insert([payload])
      .select("id, event_slot_id, profile_id, role, is_fixed, note")
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("シフト割当の追加に失敗しました。");
      setSavingAssignments(false);
      return;
    }

    setStaffAssignments((prev) => [...prev, data as SlotStaffAssignment]);
    const key = `${slotId}:${role}`;
    setAssignmentDrafts((prev) => ({ ...prev, [key]: "" }));
    toast.success("シフトを追加しました。");
    setSavingAssignments(false);
  };

  const handleUpdateAssignment = async (
    assignmentId: string,
    patch: Partial<Pick<SlotStaffAssignment, "is_fixed" | "note">>
  ) => {
    if (!assignmentId || savingAssignments) return;
    setSavingAssignments(true);
    setError(null);

    const updatePayload: { is_fixed?: boolean; note?: string | null } = {};
    if (typeof patch.is_fixed === "boolean") {
      updatePayload.is_fixed = patch.is_fixed;
    }
    if ("note" in patch) {
      updatePayload.note = patch.note?.trim() || null;
    }
    if (Object.keys(updatePayload).length === 0) {
      setSavingAssignments(false);
      return;
    }

    const { data, error } = await supabase
      .from("slot_staff_assignments")
      .update(updatePayload)
      .eq("id", assignmentId)
      .select("id, event_slot_id, profile_id, role, is_fixed, note")
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("シフト割当の更新に失敗しました。");
      setSavingAssignments(false);
      return;
    }

    setStaffAssignments((prev) =>
      prev.map((assignment) => (assignment.id === assignmentId ? (data as SlotStaffAssignment) : assignment))
    );
    setSavingAssignments(false);
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!assignmentId || savingAssignments) return;
    setSavingAssignments(true);
    setError(null);

    const { error } = await supabase.from("slot_staff_assignments").delete().eq("id", assignmentId);
    if (error) {
      console.error(error);
      setError("シフト割当の削除に失敗しました。");
      setSavingAssignments(false);
      return;
    }

    setStaffAssignments((prev) => prev.filter((assignment) => assignment.id !== assignmentId));
    toast.success("シフトを削除しました。");
    setSavingAssignments(false);
  };

  useEffect(() => {
    if (!selectedBand) {
      setBandForm({
        name: "",
        note_pa: "",
        note_lighting: "",
        stagePlotNote: "",
      });
      return;
    }
    setBandForm({
      name: selectedBand.name,
      note_pa: selectedBand.note_pa ?? "",
      note_lighting: selectedBand.note_lighting ?? "",
      stagePlotNote:
        (selectedBand.stage_plot_data?.note as string) ??
        (selectedBand.stage_plot_data?.stage_plot as string) ??
        "",
    });
  }, [selectedBand]);

  useEffect(() => {
    setShowBandDeleteConfirm(false);
    setBandDeleteText("");
  }, [selectedBandId]);
  const handleEventChange = (key: keyof EventRow, value: string | number) => {
    if (!eventForm) return;
    setEventForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm || savingEvent) return;
    setSavingEvent(true);
    setError(null);

    const payload = {
      name: eventForm.name.trim(),
      date: eventForm.date,
      status: eventForm.status,
      event_type: eventForm.event_type,
      venue: eventForm.venue || null,
      open_time: eventForm.open_time || null,
      start_time: eventForm.start_time || null,
      note: eventForm.note || null,
      default_changeover_min: Number(eventForm.default_changeover_min) || 15,
    };

    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", eventId)
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("イベントの更新に失敗しました。");
    } else {
      setEvent(data as EventRow);
      setEventForm(data as EventRow);
      toast.success("イベントを更新しました。");
    }
    setSavingEvent(false);
  };

  const handleDeleteRequest = () => {
    setShowDeleteConfirm(true);
    setDeleteConfirmText("");
    setDeleteError(null);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeleteConfirmText("");
    setDeleteError(null);
  };

  const handleDeleteEvent = async () => {
    if (!event || deleting) return;
    if (deleteConfirmText.trim() !== event.name.trim()) {
      setDeleteError("イベント名が一致しません。");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) {
      console.error(error);
      setDeleteError("イベントの削除に失敗しました。");
      setDeleting(false);
      return;
    }
    toast.success("イベントを削除しました。");
    router.replace("/admin/events");
  };

  const handleBandDeleteRequest = () => {
    setShowBandDeleteConfirm(true);
    setBandDeleteText("");
  };

  const handleBandDeleteCancel = () => {
    setShowBandDeleteConfirm(false);
    setBandDeleteText("");
  };

  const handleDeleteBand = async () => {
    if (!selectedBandId || !selectedBand || deletingBand) return;
    const targetName = selectedBand.name.trim();
    if (bandDeleteText.trim() !== targetName) {
      setError("バンド名が一致しません。");
      return;
    }
    setDeletingBand(true);
    setError(null);

    const { error } = await supabase.from("bands").delete().eq("id", selectedBandId);
    if (error) {
      console.error(error);
      setError("バンドの削除に失敗しました。");
      setDeletingBand(false);
      return;
    }

    const nextBands = bands.filter((band) => band.id !== selectedBandId);
    setBands(nextBands);
    setMembers((prev) => prev.filter((member) => member.band_id !== selectedBandId));
    setSongs((prev) => prev.filter((song) => song.band_id !== selectedBandId));
    setSelectedBandId(nextBands[0]?.id ?? null);
    setShowBandDeleteConfirm(false);
    setBandDeleteText("");
    toast.success("バンドを削除しました。");
    setDeletingBand(false);
  };

  const handleCreateBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBandName.trim() || savingBand) return;
    setSavingBand(true);
    setError(null);

    const { data, error } = await supabase
      .from("bands")
      .insert([
        {
          event_id: eventId,
          name: newBandName.trim(),
          created_by: userId ?? null,
        },
      ])
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("バンドの作成に失敗しました。");
      setSavingBand(false);
      return;
    }

    const added = data as Band;
    setBands((prev) => [...prev, added]);
    setSelectedBandId(added.id);
    setNewBandName("");
    toast.success("バンドを作成しました。");
    setSavingBand(false);
  };

  const handleUpdateBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBandId || savingBand) return;
    setSavingBand(true);
    setError(null);

    const payload = {
      name: bandForm.name.trim() || "未命名バンド",
      note_pa: bandForm.note_pa || null,
      note_lighting: bandForm.note_lighting || null,
      stage_plot_data: bandForm.stagePlotNote ? { note: bandForm.stagePlotNote } : {},
    };

    const { data, error } = await supabase
      .from("bands")
      .update(payload)
      .eq("id", selectedBandId)
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("バンド情報の更新に失敗しました。");
      setSavingBand(false);
      return;
    }

    const updated = data as Band;
    setBands((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    toast.success("バンドを更新しました。");
    setSavingBand(false);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBandId || !memberForm.profileId || !memberForm.instrument.trim() || savingMember) {
      return;
    }
    setSavingMember(true);
    setError(null);

    const { data, error } = await supabase
      .from("band_members")
      .insert([
        {
          band_id: selectedBandId,
          user_id: memberForm.profileId,
          instrument: memberForm.instrument.trim(),
        },
      ])
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("メンバーの追加に失敗しました。");
      setSavingMember(false);
      return;
    }

    setMembers((prev) => [...prev, data as BandMember]);
    setMemberForm({ profileId: "", instrument: "" });
    toast.success("メンバーを追加しました。");
    setSavingMember(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!memberId) return;
    const { error } = await supabase.from("band_members").delete().eq("id", memberId);
    if (error) {
      console.error(error);
      setError("メンバーの削除に失敗しました。");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.success("メンバーを削除しました。");
  };

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBandId || !songForm.title.trim() || savingSong) return;
    setSavingSong(true);
    setError(null);
    const orderIndex = selectedBandSongs.length + 1;

    const { data, error } = await supabase
      .from("songs")
      .insert([
        {
          band_id: selectedBandId,
          title: songForm.title.trim(),
          artist: songForm.entry_type === "mc" ? null : songForm.artist || null,
          entry_type: songForm.entry_type,
          url: songForm.entry_type === "mc" ? null : songForm.url || null,
          order_index: orderIndex,
          duration_sec: songForm.duration_sec ? Number(songForm.duration_sec) : null,
          memo: songForm.memo || null,
        },
      ])
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("セットリストの追加に失敗しました。");
      setSavingSong(false);
      return;
    }

    setSongs((prev) => [...prev, data as Song]);
    setSongForm({ title: "", artist: "", url: "", entry_type: "song", duration_sec: "", memo: "" });
    toast.success("セットリストに追加しました。");
    setSavingSong(false);
  };

  const handleRemoveSong = async (songId: string) => {
    if (!songId) return;
    const { error } = await supabase.from("songs").delete().eq("id", songId);
    if (error) {
      console.error(error);
      setError("曲の削除に失敗しました。");
      return;
    }
    setSongs((prev) => prev.filter((s) => s.id !== songId));
    toast.success("曲を削除しました。");
  };
  if (adminLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">権限を確認しています...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">管理者のみアクセスできます</p>
            <p className="text-sm text-muted-foreground">管理者に問い合わせてください。</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (loading || !eventForm) {
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

  const deleteTargetName = (event?.name ?? eventForm.name ?? "").trim();
  const deleteMatches = deleteConfirmText.trim() === deleteTargetName;
  const bandDeleteTargetName = selectedBand?.name?.trim() ?? "";
  const bandDeleteMatches = bandDeleteText.trim() === bandDeleteTargetName;
  const shiftUnlocked = event?.tt_is_provisional ?? false;

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Admin"
            title="イベント編集"
            description="イベント情報・バンド・メンバー・セットリストを管理します。"
            backHref="/admin/events"
            backLabel="イベント一覧に戻る"
            meta={
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={statusBadge(eventForm.status)}>{statusLabel(eventForm.status)}</Badge>
                <Badge variant="outline">{eventTypeLabel(eventForm.event_type)}</Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{eventForm.date}</span>
                </div>
                {eventForm.venue && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{eventForm.venue}</span>
                  </div>
                )}
              </div>
            }
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-8 md:space-y-10">
              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">編集ガイド</CardTitle>
                  <CardDescription>迷ったときはこの順番で進めてください。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="grid gap-2 text-sm md:grid-cols-2">
                    <li className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                      1. イベント情報を入力
                    </li>
                    <li className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                      2. バンドとメンバーを登録
                    </li>
                    <li className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                      3. タイムテーブルを調整
                    </li>
                    <li className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                      4. 当日スタッフを割り当て
                    </li>
                  </ol>
                  <p className="text-xs text-muted-foreground">
                    ヒント: タイムテーブルとシフトは専用ページで編集します。
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">タイムテーブルとシフト</CardTitle>
                    <CardDescription>作成・割当は専用ページでまとめて管理します。</CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-4 h-4" />
                    PAL / LL 以上
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/events/${eventId}/tt/edit`}
                    className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
                  >
                    TTを編集する
                  </Link>
                  <Link
                    href={`/admin/events/${eventId}/shift/pa`}
                    className={`inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors ${
                      shiftUnlocked
                        ? "hover:border-primary/60 hover:text-primary"
                        : "pointer-events-none opacity-60"
                    }`}
                  >
                    PAシフト作成
                  </Link>
                  <Link
                    href={`/admin/events/${eventId}/shift/lighting`}
                    className={`inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors ${
                      shiftUnlocked
                        ? "hover:border-primary/60 hover:text-primary"
                        : "pointer-events-none opacity-60"
                    }`}
                  >
                    照明シフト作成
                  </Link>
                  {!shiftUnlocked && (
                    <span className="text-xs text-muted-foreground">
                      仮確定前のためシフト作成はロック中です。
                    </span>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-xl">イベント情報</CardTitle>
                    <CardDescription>基本情報とデフォルト設定を更新します。</CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-4 h-4" />
                    Admin only
                  </Badge>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateEvent} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">イベント名</span>
                        <Input
                          required
                          value={eventForm.name}
                          onChange={(e) => handleEventChange("name", e.target.value)}
                          placeholder="春ライブ 2025"
                        />
                      </label>
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">ステータス</span>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-card px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                          value={eventForm.status}
                          onChange={(e) => handleEventChange("status", e.target.value)}
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">イベント種別</span>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-card px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                        value={eventForm.event_type}
                        onChange={(e) => handleEventChange("event_type", e.target.value)}
                      >
                        {eventTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid md:grid-cols-2 gap-4">
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">開催日</span>
                        <Input
                          type="date"
                          required
                          value={eventForm.date}
                          onChange={(e) => handleEventChange("date", e.target.value)}
                        />
                      </label>
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">会場</span>
                        <Input
                          value={eventForm.venue ?? ""}
                          onChange={(e) => handleEventChange("venue", e.target.value)}
                          placeholder="大学ホール"
                        />
                      </label>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block text-sm">
                        <span className="text-foreground">集合時間</span>
                          <Input
                            type="time"
                            value={eventForm.open_time ?? ""}
                            onChange={(e) => handleEventChange("open_time", e.target.value)}
                          />
                        </label>
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">開演時間</span>
                          <Input
                            type="time"
                            value={eventForm.start_time ?? ""}
                            onChange={(e) => handleEventChange("start_time", e.target.value)}
                          />
                        </label>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">デフォルト転換時間（分）</span>
                          <Input
                            type="number"
                            min={0}
                            value={eventForm.default_changeover_min}
                            onChange={(e) =>
                              handleEventChange("default_changeover_min", Number(e.target.value))
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">メモ</span>
                      <Textarea
                        rows={3}
                        value={eventForm.note ?? ""}
                        onChange={(e) => handleEventChange("note", e.target.value)}
                        placeholder="備考や出演条件など"
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={savingEvent} className="gap-2">
                        {savingEvent ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PencilLine className="w-4 h-4" />}
                        保存する
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEventForm(event ?? null)}
                        disabled={savingEvent}
                      >
                        変更を戻す
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-destructive/40">
                <CardHeader>
                  <CardTitle className="text-lg text-destructive">イベント削除</CardTitle>
                  <CardDescription>削除すると元に戻せません。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!showDeleteConfirm ? (
                    <Button type="button" variant="destructive" className="gap-2" onClick={handleDeleteRequest}>
                      <Trash2 className="w-4 h-4" />
                      イベントを削除
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        削除するにはイベント名「{deleteTargetName}」を入力してください。
                      </p>
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => {
                          setDeleteConfirmText(e.target.value);
                        }}
                        placeholder={deleteTargetName}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={!deleteMatches || deleting}
                          onClick={handleDeleteEvent}
                        >
                          {deleting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          削除する
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleDeleteCancel}
                          disabled={deleting}
                        >
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="grid lg:grid-cols-[320px,1fr] gap-6">
                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">バンド</CardTitle>
                    <CardDescription>選択または新規作成</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {bands.length === 0 ? (
                        <p className="text-sm text-muted-foreground">まだバンドがありません。</p>
                      ) : (
                        <div className="space-y-2">
                          {bands.map((band) => (
                            <button
                              key={band.id}
                              type="button"
                              onClick={() => setSelectedBandId(band.id)}
                              className={cn(
                                "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                                selectedBandId === band.id
                                  ? "border-primary/60 bg-primary/10"
                                  : "border-border hover:border-primary/40 hover:bg-muted/50"
                              )}
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm">{band.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {band.note_pa ? "PAメモあり" : "PAメモなし"}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleCreateBand} className="space-y-2">
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">新規バンド名</span>
                        <Input
                          value={newBandName}
                          onChange={(e) => setNewBandName(e.target.value)}
                          placeholder="バンド名を入力"
                        />
                      </label>
                      <Button type="submit" disabled={savingBand || !newBandName.trim()} className="gap-2 w-full">
                        {savingBand ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        追加
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="bg-card/60 border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">バンド詳細</CardTitle>
                      <CardDescription>PA/照明メモ・ステージプロット</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!selectedBand ? (
                        <p className="text-sm text-muted-foreground">バンドを選択してください。</p>
                      ) : (
                        <form onSubmit={handleUpdateBand} className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <label className="space-y-1 block text-sm">
                              <span className="text-foreground">バンド名</span>
                              <Input
                                value={bandForm.name}
                                onChange={(e) => setBandForm((prev) => ({ ...prev, name: e.target.value }))}
                              />
                            </label>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <label className="space-y-1 block text-sm">
                              <span className="text-foreground">PAメモ</span>
                              <Textarea
                                rows={3}
                                value={bandForm.note_pa}
                                onChange={(e) => setBandForm((prev) => ({ ...prev, note_pa: e.target.value }))}
                                placeholder="マイアンプ / インプット本数 / 注意点など"
                              />
                            </label>
                            <label className="space-y-1 block text-sm">
                              <span className="text-foreground">照明メモ</span>
                              <Textarea
                                rows={3}
                                value={bandForm.note_lighting}
                                onChange={(e) => setBandForm((prev) => ({ ...prev, note_lighting: e.target.value }))}
                                placeholder="曲の雰囲気、色の希望など"
                              />
                            </label>
                          </div>

                          <label className="space-y-1 block text-sm">
                            <span className="text-foreground">ステージプロット / 機材図</span>
                            <Textarea
                              rows={3}
                              value={bandForm.stagePlotNote}
                              onChange={(e) => setBandForm((prev) => ({ ...prev, stagePlotNote: e.target.value }))}
                              placeholder="共有リンクやテキストで記載（画像URLでもOK）"
                            />
                          </label>

                          <div className="flex flex-wrap items-center gap-3">
                            <Button type="submit" disabled={savingBand} className="gap-2">
                              {savingBand ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PencilLine className="w-4 h-4" />}
                              バンド情報を保存
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setBandForm({
                                  name: selectedBand.name,
                                  note_pa: selectedBand.note_pa ?? "",
                                  note_lighting: selectedBand.note_lighting ?? "",
                                  stagePlotNote:
                                    (selectedBand.stage_plot_data?.note as string) ??
                                    (selectedBand.stage_plot_data?.stage_plot as string) ??
                                    "",
                                });
                              }}
                            >
                              変更を戻す
                            </Button>
                          </div>
                          <div className="rounded-lg border border-destructive/40 p-3 space-y-2">
                            {!showBandDeleteConfirm ? (
                              <Button
                                type="button"
                                variant="destructive"
                                className="gap-2"
                                onClick={handleBandDeleteRequest}
                              >
                                <Trash2 className="w-4 h-4" />
                                バンドを削除
                              </Button>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">
                                  削除するにはバンド名「{bandDeleteTargetName}」を入力してください。
                                </p>
                                <Input
                                  value={bandDeleteText}
                                  onChange={(e) => setBandDeleteText(e.target.value)}
                                  placeholder={bandDeleteTargetName}
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={!bandDeleteMatches || deletingBand}
                                    onClick={handleDeleteBand}
                                  >
                                    {deletingBand ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                    削除する
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleBandDeleteCancel}
                                    disabled={deletingBand}
                                  >
                                    キャンセル
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </form>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="bg-card/60 border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">メンバー</CardTitle>
                        <CardDescription>Discord連携を優先して表示します。</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {!selectedBand ? (
                          <p className="text-sm text-muted-foreground">バンドを選択してください。</p>
                        ) : (
                          <>
                            <form onSubmit={handleAddMember} className="space-y-3">
                              <div className="space-y-1 text-sm">
                                <span className="text-foreground">プロフィール</span>
                                <select
                                  required
                                  className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                                  value={memberForm.profileId}
                                  onChange={(e) => setMemberForm((prev) => ({ ...prev, profileId: e.target.value }))}
                                >
                                  <option value="">選択してください</option>
                                  {profiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>
                                      {profile.display_name}
                                      {profile.crew ? ` / ${profile.crew}` : ""}
                                    </option>
                                  ))}
                                </select>
                                {memberForm.profileId && (
                                  <p className="text-xs text-muted-foreground">
                                    Discord: {profilesMap.get(memberForm.profileId)?.discord ?? "未連携"}
                                  </p>
                                )}
                              </div>
                              <label className="space-y-1 block text-sm">
                                <span className="text-foreground">パート / 担当</span>
                                <Input
                                  required
                                  value={memberForm.instrument}
                                  onChange={(e) => setMemberForm((prev) => ({ ...prev, instrument: e.target.value }))}
                                  placeholder="Gt. / Vo. / Dr. など"
                                />
                              </label>
                              <Button
                                type="submit"
                                disabled={savingMember || !memberForm.profileId || !memberForm.instrument.trim()}
                                className="gap-2 w-full"
                              >
                                {savingMember ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                メンバーを追加
                              </Button>
                            </form>

                            <div className="space-y-2">
                              {selectedBandMembers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">追加されたメンバーはいません。</p>
                              ) : (
                                selectedBandMembers.map((member) => {
                                  const profile = profilesMap.get(member.user_id);
                                  return (
                                    <div
                                      key={member.id}
                                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                                    >
                                      <div className="space-y-1">
                                        <p className="font-medium text-sm">{profile?.display_name ?? "不明なユーザー"}</p>
                                        <p className="text-xs text-muted-foreground">{member.instrument}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Discord: {profile?.discord ?? "未連携"}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveMember(member.id)}
                                        className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                        aria-label="メンバーを削除"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-card/60 border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">セットリスト</CardTitle>
                        <CardDescription>演奏曲と所要時間を管理します。</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {!selectedBand ? (
                          <p className="text-sm text-muted-foreground">バンドを選択してください。</p>
                        ) : (
                          <>
                            <form onSubmit={handleAddSong} className="space-y-3">
                              <div className="grid md:grid-cols-2 gap-3">
                                <label className="space-y-1 block text-sm">
                                  <span className="text-foreground">曲名</span>
                                  <Input
                                    required
                                    value={songForm.title}
                                    onChange={(e) => setSongForm((prev) => ({ ...prev, title: e.target.value }))}
                                    placeholder={songForm.entry_type === "mc" ? "MCタイトル" : "曲名を入力"}
                                  />
                                </label>
                                <label className="space-y-1 block text-sm">
                                  <span className="text-foreground">タイプ</span>
                                  <select
                                    value={songForm.entry_type}
                                    onChange={(e) =>
                                      setSongForm((prev) => ({ ...prev, entry_type: e.target.value }))
                                    }
                                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                                  >
                                    <option value="song">曲</option>
                                    <option value="mc">MC</option>
                                  </select>
                                </label>
                              </div>
                              <div className="grid md:grid-cols-2 gap-3">
                                <label className="space-y-1 block text-sm">
                                  <span className="text-foreground">アーティスト</span>
                                  <Input
                                    value={songForm.artist}
                                    onChange={(e) => setSongForm((prev) => ({ ...prev, artist: e.target.value }))}
                                    placeholder={songForm.entry_type === "mc" ? "-" : "任意"}
                                    disabled={songForm.entry_type === "mc"}
                                  />
                                </label>
                                <label className="space-y-1 block text-sm">
                                  <span className="text-foreground">URL</span>
                                  <Input
                                    value={songForm.url}
                                    onChange={(e) => setSongForm((prev) => ({ ...prev, url: e.target.value }))}
                                    placeholder={songForm.entry_type === "mc" ? "-" : "YouTube / Spotify / Apple Music"}
                                    disabled={songForm.entry_type === "mc"}
                                  />
                                </label>
                              </div>
                              <div className="grid md:grid-cols-2 gap-3">
                                <label className="space-y-1 block text-sm">
                                  <span className="text-foreground">演奏時間（秒）</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={songForm.duration_sec}
                                    onChange={(e) => setSongForm((prev) => ({ ...prev, duration_sec: e.target.value }))}
                                    placeholder="未設定の場合はデフォルト時間"
                                  />
                                </label>
                                <label className="space-y-1 block text-sm">
                                  <span className="text-foreground">メモ</span>
                                  <Input
                                    value={songForm.memo}
                                    onChange={(e) => setSongForm((prev) => ({ ...prev, memo: e.target.value }))}
                                    placeholder="Key変更 / 繰り返し回数 など"
                                  />
                                </label>
                              </div>
                              <Button
                                type="submit"
                                disabled={savingSong || !songForm.title.trim()}
                                className="gap-2 w-full"
                              >
                                {savingSong ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {songForm.entry_type === "mc" ? "MCを追加" : "曲を追加"}
                              </Button>
                            </form>

                            <div className="space-y-2">
                              {selectedBandSongs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">セットリストがありません。</p>
                              ) : (
                                selectedBandSongs.map((song) => (
                                  <div
                                    key={song.id}
                                    className="flex items-start justify-between rounded-lg border border-border px-3 py-2"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline">
                                          {song.entry_type === "mc" ? "MC" : "曲"}
                                        </Badge>
                                        <p className="font-medium text-sm">{song.title}</p>
                                      </div>
                                      {song.entry_type !== "mc" && (
                                        <p className="text-xs text-muted-foreground">
                                          {song.artist ?? "アーティスト未設定"}
                                        </p>
                                      )}
                                      <p className="text-xs text-muted-foreground">
                                        {song.duration_sec ? `${song.duration_sec} 秒` : "時間未設定"}
                                      </p>
                                      {song.url && (
                                        <p className="text-xs text-muted-foreground">URL: {song.url}</p>
                                      )}
                                      {song.memo && (
                                        <p className="text-xs text-muted-foreground">メモ: {song.memo}</p>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSong(song.id)}
                                      className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                      aria-label="曲を削除"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}


