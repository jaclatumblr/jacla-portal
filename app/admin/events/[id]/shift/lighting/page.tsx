"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Calendar, RefreshCw, Users } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabaseClient";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type EventRow = {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  open_time: string | null;
  start_time: string | null;
  tt_is_published: boolean;
  tt_is_provisional: boolean;
};

type BandRow = {
  id: string;
  name: string;
};

type BandMemberRow = {
  id: string;
  band_id: string;
  user_id: string;
};

type ProfileOption = {
  id: string;
  display_name: string;
  discord?: string | null;
  crew?: string | null;
};

type EventSlot = {
  id: string;
  event_id: string;
  band_id: string | null;
  slot_type: "band" | "break" | "mc" | "other";
  slot_phase?: "show" | "rehearsal_normal" | "rehearsal_pre";
  order_in_event: number | null;
  start_time: string | null;
  end_time: string | null;
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

type EventStaffUpsert = {
  event_id: string;
  profile_id: string;
  can_pa: boolean;
  can_light: boolean;
  note: string | null;
};

const roleOptions = [
  { value: "light_op1", label: "卓操作①" },
  { value: "light_op2", label: "卓操作②" },
  { value: "light_spot", label: "スポット" },
  { value: "light_assist", label: "補助 (任意)" },
] as const;

type RoleValue = (typeof roleOptions)[number]["value"];

type SlotStaffAssignment = {
  id: string;
  event_slot_id: string;
  profile_id: string;
  role: RoleValue;
  is_fixed: boolean;
  note: string | null;
};

const emptyRoleAssignments = (): Record<RoleValue, SlotStaffAssignment | null> => ({
  light_op1: null,
  light_op2: null,
  light_spot: null,
  light_assist: null,
});

const parseTimeValue = (value: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const isEligibleCrew = (crew?: string | null) => crew == null || crew === "User" || crew === "Lighting";
const hiddenShiftNotes = new Set(["転換"]);

export default function AdminEventShiftLightingPage() {
  const params = useParams();
  const eventId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { isAdmin, isLightingLeader, canAccessAdmin, loading: roleLoading } = useRoleFlags();
  const canEditRole = isAdmin || isLightingLeader;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [bandMembers, setBandMembers] = useState<BandMemberRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [eventStaff, setEventStaff] = useState<EventStaffMember[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<SlotStaffAssignment[]>([]);
  const [slots, setSlots] = useState<EventSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [syncingPerformers, setSyncingPerformers] = useState(false);
  const [staffForm, setStaffForm] = useState({ profileId: "" });
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});

  const shiftUnlocked = event?.tt_is_provisional ?? false;
  const canEdit = canEditRole && shiftUnlocked;

  const bandNameMap = useMemo(() => {
    const map = new Map<string, string>();
    bands.forEach((band) => map.set(band.id, band.name));
    return map;
  }, [bands]);

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileOption>();
    profiles.forEach((profile) => map.set(profile.id, profile));
    return map;
  }, [profiles]);

  const orderedSlots = useMemo(() => {
    const filtered = slots.filter((slot) => {
      if (slot.slot_type !== "other") return true;
      const note = slot.note?.trim();
      if (!note) return true;
      if (hiddenShiftNotes.has(note)) return false;
      if (note.includes("転換")) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });
  }, [slots]);

  const eligibleProfiles = useMemo(() => {
    return profiles.filter((profile) => isEligibleCrew(profile.crew));
  }, [profiles]);

  const eligibleProfileIds = useMemo(() => {
    return new Set(eligibleProfiles.map((profile) => profile.id));
  }, [eligibleProfiles]);

  const performerIds = useMemo(() => {
    return new Set(bandMembers.map((member) => member.user_id));
  }, [bandMembers]);

  const eligiblePerformerIds = useMemo(() => {
    return new Set(
      bandMembers
        .filter((member) => eligibleProfileIds.has(member.user_id))
        .map((member) => member.user_id)
    );
  }, [bandMembers, eligibleProfileIds]);

  const assignedLightIds = useMemo(() => {
    return new Set(eventStaff.filter((staff) => staff.can_light).map((staff) => staff.profile_id));
  }, [eventStaff]);

  const helperOptions = useMemo(() => {
    return eligibleProfiles.filter(
      (profile) => !assignedLightIds.has(profile.id) && !eligiblePerformerIds.has(profile.id)
    );
  }, [assignedLightIds, eligiblePerformerIds, eligibleProfiles]);

  const lightStaffOptions = useMemo(() => {
    return eventStaff.filter(
      (staff) => staff.can_light && eligibleProfileIds.has(staff.profile_id)
    );
  }, [eventStaff, eligibleProfileIds]);

  const assignmentsBySlotRole = useMemo(() => {
    const map = new Map<string, Record<RoleValue, SlotStaffAssignment | null>>();
    staffAssignments.forEach((assignment) => {
      const current = map.get(assignment.event_slot_id) ?? emptyRoleAssignments();
      if (!current[assignment.role]) {
        current[assignment.role] = assignment;
      }
      map.set(assignment.event_slot_id, current);
    });
    return map;
  }, [staffAssignments]);

  useEffect(() => {
    if (!eventId || roleLoading || !canAccessAdmin) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const [eventRes, bandsRes, slotsRes, staffRes, profilesRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, venue, open_time, start_time, tt_is_published, tt_is_provisional")
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
            "id, event_id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, note"
          )
          .eq("event_id", eventId)
          .order("order_in_event", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("event_staff_members")
          .select("id, event_id, profile_id, can_pa, can_light, note")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("id, display_name, discord_username, crew").order("display_name"),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        toast.error("イベント情報の取得に失敗しました。");
        setLoading(false);
        return;
      }

      setEvent(eventRes.data as EventRow);
      setBands((bandsRes.data ?? []) as BandRow[]);
      setSlots((slotsRes.data ?? []) as EventSlot[]);
      setEventStaff((staffRes.data ?? []) as EventStaffMember[]);

      const profilesList = (profilesRes.data ?? []).map((row: any) => ({
        id: row.id,
        display_name: row.display_name ?? "未登録",
        discord: row.discord_username ?? null,
        crew: row.crew ?? null,
      }));
      setProfiles(profilesList);

      const bandIds = (bandsRes.data ?? []).map((band: any) => band.id).filter(Boolean);
      if (bandIds.length > 0) {
        const membersRes = await supabase
          .from("band_members")
          .select("id, band_id, user_id")
          .in("band_id", bandIds);
        if (!cancelled) {
          if (membersRes.error) {
            console.error(membersRes.error);
            toast.error("バンドメンバーの取得に失敗しました。");
            setBandMembers([]);
          } else {
            setBandMembers((membersRes.data ?? []) as BandMemberRow[]);
          }
        }
      } else {
        setBandMembers([]);
      }

      const slotIds = (slotsRes.data ?? []).map((slot: any) => slot.id).filter(Boolean);
      if (slotIds.length > 0) {
        const assignmentsRes = await supabase
          .from("slot_staff_assignments")
          .select("id, event_slot_id, profile_id, role, is_fixed, note")
          .in("event_slot_id", slotIds)
          .in("role", roleOptions.map((role) => role.value));
        if (!cancelled) {
          if (assignmentsRes.error) {
            console.error(assignmentsRes.error);
            toast.error("シフト割当の取得に失敗しました。");
            setStaffAssignments([]);
          } else {
            setStaffAssignments((assignmentsRes.data ?? []) as SlotStaffAssignment[]);
          }
        }
      } else {
        setStaffAssignments([]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, roleLoading, canAccessAdmin]);

  useEffect(() => {
    if (!eventId || !canEditRole || eligiblePerformerIds.size === 0 || syncingPerformers) return;
    const performerSet = eligiblePerformerIds;
    const staffMap = new Map(eventStaff.map((staff) => [staff.profile_id, staff]));
    const payload = Array.from(performerSet)
      .map((profileId) => {
        const existing = staffMap.get(profileId);
        if (existing?.can_light) return null;
        return {
          event_id: eventId,
          profile_id: profileId,
          can_pa: existing?.can_pa ?? false,
          can_light: true,
          note: existing?.note ?? null,
        };
      })
      .filter((entry): entry is EventStaffUpsert => entry !== null);

    if (payload.length === 0) return;
    let cancelled = false;
    setSyncingPerformers(true);

    (async () => {
      const { data, error } = await supabase
        .from("event_staff_members")
        .upsert(payload, { onConflict: "event_id,profile_id" })
        .select("id, event_id, profile_id, can_pa, can_light, note");

      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error("出演メンバーの自動追加に失敗しました。");
        setSyncingPerformers(false);
        return;
      }

      if (data) {
        setEventStaff((prev) => {
          const next = new Map(prev.map((staff) => [staff.profile_id, staff]));
          data.forEach((staff) => {
            next.set(staff.profile_id, staff as EventStaffMember);
          });
          return Array.from(next.values());
        });
      }

      setSyncingPerformers(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, canEditRole, eligiblePerformerIds, eventStaff, syncingPerformers]);

  const slotLabel = (slot: EventSlot) => {
    if (slot.slot_type === "band") {
      return bandNameMap.get(slot.band_id ?? "") ?? "バンド未設定";
    }
    if (slot.slot_type === "break") return "休憩";
    if (slot.slot_type === "mc") return "MC";
    return slot.note?.trim() || "その他";
  };

  const slotDurationLabel = (slot: EventSlot) => {
    const start = parseTimeValue(slot.start_time ?? null);
    const end = parseTimeValue(slot.end_time ?? null);
    if (start == null || end == null) return "";
    let duration = end - start;
    if (duration < 0) duration += 24 * 60;
    if (duration <= 0) return "";
    return `(${duration})`;
  };

  const slotTimeLabel = (slot: EventSlot) => {
    if (!slot.start_time && !slot.end_time) return "時間未設定";
    if (slot.start_time && slot.end_time) {
      return `${slot.start_time}-${slot.end_time}${slotDurationLabel(slot)}`;
    }
    return slot.start_time ?? slot.end_time ?? "時間未設定";
  };

  const phaseLabel = (phase?: EventSlot["slot_phase"]) => {
    const normalized = phase ?? "show";
    if (normalized === "rehearsal_normal") return "通常リハ";
    if (normalized === "rehearsal_pre") return "直前リハ";
    return "本番";
  };

  const phaseBadgeVariant = (phase?: EventSlot["slot_phase"]) => {
    const normalized = phase ?? "show";
    if (normalized === "show") return "default" as const;
    if (normalized === "rehearsal_pre") return "secondary" as const;
    return "outline" as const;
  };

  type PhaseKey = EventSlot["slot_phase"] | "prep" | "cleanup";

  const slotPhaseKey = (slot: EventSlot): PhaseKey => {
    const note = slot.note?.trim();
    if (note === "集合～準備") return "prep";
    if (note === "終了～撤収" || note === "終了～解散") return "cleanup";
    return slot.slot_phase ?? "show";
  };

  const slotPhaseLabel = (slot: EventSlot) => {
    const note = slot.note?.trim();
    if (note === "集合～準備") return "集合～準備";
    if (note === "終了～撤収" || note === "終了～解散") return note;
    return phaseLabel(slot.slot_phase);
  };

  const slotPhaseBadgeVariant = (slot: EventSlot) => {
    const key = slotPhaseKey(slot);
    if (key === "prep" || key === "cleanup") return "outline" as const;
    return phaseBadgeVariant(slot.slot_phase);
  };

  const phaseBarClass = (phase: PhaseKey) => {
    if (phase === "show") return "bg-fuchsia-400/80";
    if (phase === "rehearsal_normal" || phase === "rehearsal_pre") return "bg-sky-400/80";
    if (phase === "prep" || phase === "cleanup") return "bg-amber-400/80";
    return "bg-muted";
  };

  const slotAccentClass = (slot: EventSlot) => {
    const note = slot.note?.trim() ?? "";
    if (note === "集合～準備" || note === "終了～撤収" || note === "終了～解散") {
      return "border-l-4 border-l-amber-400/80";
    }
    if (slot.slot_type === "break" || note.includes("転換")) {
      return "border-l-4 border-l-amber-400/80";
    }
    const phase = slot.slot_phase ?? "show";
    if (phase === "rehearsal_normal" || phase === "rehearsal_pre") {
      return "border-l-4 border-l-sky-400/80";
    }
    if (phase === "show") {
      return "border-l-4 border-l-fuchsia-400/80";
    }
    return "border-l-4 border-l-muted";
  };

  const handleAddStaff = async (event: FormEvent) => {
    event.preventDefault();
    if (!eventId || !staffForm.profileId || savingStaff || !canEdit) return;
    if (!eligibleProfileIds.has(staffForm.profileId)) {
      toast.error("照明シフトには照明ロールかUserのみ追加できます。");
      return;
    }
    if (performerIds.has(staffForm.profileId)) {
      toast.success("出演メンバーは自動追加されます。");
      return;
    }
    setSavingStaff(true);

    const existing = eventStaff.find((staff) => staff.profile_id === staffForm.profileId);
    if (existing) {
      const { data, error } = await supabase
        .from("event_staff_members")
        .update({ can_light: true })
        .eq("id", existing.id)
        .select("id, event_id, profile_id, can_pa, can_light, note")
        .maybeSingle();
      if (error || !data) {
        console.error(error);
        toast.error("当日スタッフの追加に失敗しました。");
      } else {
        setEventStaff((prev) => prev.map((staff) => (staff.id === existing.id ? (data as EventStaffMember) : staff)));
        toast.success("照明スタッフを追加しました。");
      }
    } else {
      const payload = {
        event_id: eventId,
        profile_id: staffForm.profileId,
        can_pa: false,
        can_light: true,
        note: null,
      };
      const { data, error } = await supabase
        .from("event_staff_members")
        .insert([payload])
        .select("id, event_id, profile_id, can_pa, can_light, note")
        .maybeSingle();
      if (error || !data) {
        console.error(error);
        toast.error("当日スタッフの追加に失敗しました。");
      } else {
        setEventStaff((prev) => [...prev, data as EventStaffMember]);
        toast.success("照明スタッフを追加しました。");
      }
    }

    setStaffForm({ profileId: "" });
    setSavingStaff(false);
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!staffId || savingStaff || !canEdit) return;
    const staff = eventStaff.find((item) => item.id === staffId);
    if (!staff) return;
    if (performerIds.has(staff.profile_id)) {
      toast.error("出演メンバーは外せません。");
      return;
    }
    setSavingStaff(true);

    if (staff.can_pa) {
      const { data, error } = await supabase
        .from("event_staff_members")
        .update({ can_light: false })
        .eq("id", staffId)
        .select("id, event_id, profile_id, can_pa, can_light, note")
        .maybeSingle();
      if (error || !data) {
        console.error(error);
        toast.error("当日スタッフの更新に失敗しました。");
        setSavingStaff(false);
        return;
      }
      setEventStaff((prev) => prev.map((item) => (item.id === staffId ? (data as EventStaffMember) : item)));
    } else {
      const { error } = await supabase.from("event_staff_members").delete().eq("id", staffId);
      if (error) {
        console.error(error);
        toast.error("当日スタッフの削除に失敗しました。");
        setSavingStaff(false);
        return;
      }
      setEventStaff((prev) => prev.filter((item) => item.id !== staffId));
    }

    if (staff.profile_id) {
      const slotIds = slots.map((slot) => slot.id);
      if (slotIds.length > 0) {
        const { error: assignmentError } = await supabase
          .from("slot_staff_assignments")
          .delete()
          .eq("profile_id", staff.profile_id)
          .in("event_slot_id", slotIds)
          .in("role", roleOptions.map((role) => role.value));
        if (assignmentError) {
          console.error(assignmentError);
          toast.error("シフト割当の削除に失敗しました。");
        } else {
          setStaffAssignments((prev) =>
            prev.filter(
              (assignment) =>
                assignment.profile_id !== staff.profile_id ||
                !roleOptions.some((role) => role.value === assignment.role)
            )
          );
        }
      }
    }

    toast.success("照明スタッフを削除しました。");
    setSavingStaff(false);
  };

  const handleSetAssignment = async (slotId: string, role: RoleValue, profileId: string) => {
    if (!canEdit || savingAssignments) return;
    setSavingAssignments(true);

    const existing = staffAssignments.filter(
      (assignment) => assignment.event_slot_id === slotId && assignment.role === role
    );

    if (!profileId) {
      if (existing.length === 0) {
        setSavingAssignments(false);
        return;
      }
      const { error } = await supabase
        .from("slot_staff_assignments")
        .delete()
        .in(
          "id",
          existing.map((assignment) => assignment.id)
        );
      if (error) {
        console.error(error);
        toast.error("割当の解除に失敗しました。");
        setSavingAssignments(false);
        return;
      }
      setStaffAssignments((prev) =>
        prev.filter((assignment) => !(assignment.event_slot_id === slotId && assignment.role === role))
      );
      setAssignmentDrafts((prev) => ({ ...prev, [`${slotId}:${role}`]: "" }));
      setSavingAssignments(false);
      return;
    }

    const primary = existing[0];
    if (primary && primary.profile_id === profileId && existing.length === 1) {
      setSavingAssignments(false);
      return;
    }

    if (primary) {
      const { data, error } = await supabase
        .from("slot_staff_assignments")
        .update({ profile_id: profileId })
        .eq("id", primary.id)
        .select("id, event_slot_id, profile_id, role, is_fixed, note")
        .maybeSingle();
      if (error || !data) {
        console.error(error);
        toast.error("割当の更新に失敗しました。");
        setSavingAssignments(false);
        return;
      }
      setStaffAssignments((prev) =>
        prev.map((assignment) => (assignment.id === primary.id ? (data as SlotStaffAssignment) : assignment))
      );
      if (existing.length > 1) {
        const extras = existing.slice(1).map((assignment) => assignment.id);
        await supabase.from("slot_staff_assignments").delete().in("id", extras);
        setStaffAssignments((prev) => prev.filter((assignment) => !extras.includes(assignment.id)));
      }
    } else {
      const payload = {
        event_slot_id: slotId,
        profile_id: profileId,
        role,
        is_fixed: true,
        note: null,
      };
      const { data, error } = await supabase
        .from("slot_staff_assignments")
        .insert([payload])
        .select("id, event_slot_id, profile_id, role, is_fixed, note")
        .maybeSingle();
      if (error || !data) {
        console.error(error);
        toast.error("割当の追加に失敗しました。");
        setSavingAssignments(false);
        return;
      }
      setStaffAssignments((prev) => [...prev, data as SlotStaffAssignment]);
    }

    setAssignmentDrafts((prev) => ({ ...prev, [`${slotId}:${role}`]: profileId }));
    setSavingAssignments(false);
  };

  if (roleLoading || loading) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-background">
          <SideNav />
          <main className="flex-1 md:ml-20">
            <PageHeader
              kicker="Lighting Shift"
              title="照明シフト作成"
              description="読み込み中..."
              backHref={`/admin/events/${eventId}`}
              backLabel="イベント編集"
            />
          </main>
        </div>
      </AuthGuard>
    );
  }

  if (!canAccessAdmin) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-background">
          <SideNav />
          <main className="flex-1 md:ml-20">
            <PageHeader
              kicker="Lighting Shift"
              title="照明シフト作成"
              description="このページを閲覧する権限がありません。"
              backHref={`/admin/events/${eventId}`}
              backLabel="イベント編集"
            />
          </main>
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
            kicker="Lighting Shift"
            title="照明シフト作成"
            description="TTが仮確定されると編集できます。"
            backHref={`/admin/events/${eventId}`}
            backLabel="イベント編集"
          />

          <section className="flex-1 overflow-hidden py-6 md:py-8">
            <div className="container mx-auto px-4 sm:px-6 h-full flex flex-col gap-6 md:gap-8">
              <Card className="bg-card/60 border-border shrink-0">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">イベント情報</CardTitle>
                    <CardDescription>
                      {event?.name ?? "イベント"} {event?.date ? `(${event.date})` : ""}
                      {(event?.open_time || event?.start_time) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {event.open_time ? `集合 ${event.open_time}` : ""}
                          {event.open_time && event.start_time ? " / " : ""}
                          {event.start_time ? `開演 ${event.start_time}` : ""}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={shiftUnlocked ? "default" : "outline"}>
                      {shiftUnlocked ? "仮確定済み" : "仮確定前"}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Users className="w-4 h-4" />
                      {canEditRole ? "編集可能" : "閲覧のみ"}
                    </Badge>
                  </div>
                </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {shiftUnlocked ? (
                  "照明シフトは本番/リハの枠ごとに割り当てます。"
                ) : (
                    <>
                      TTを仮確定するとシフト作成が解放されます。
                      <Link
                        href={`/admin/events/${eventId}/tt/edit`}
                        className="text-primary hover:underline"
                      >
                        TT編集へ
                      </Link>
                    </>
                  )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
                    転換/休憩/準備/解散
                  </span>
                </div>
              </CardContent>
              </Card>

              <Card className="bg-card/60 border-border flex flex-col min-h-0">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">照明スタッフ</CardTitle>
                    <CardDescription>
                      出演メンバーは自動追加されます。お手伝いは照明ロールまたはUserのみ追加できます。
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-4 h-4" />
                    LL / Admin
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[36vh] overflow-auto">
                  <form onSubmit={handleAddStaff} className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-muted-foreground">
                      お手伝いメンバー
                      <select
                        className="mt-1 h-9 min-w-[220px] rounded-md border border-input bg-card px-2 text-xs text-foreground"
                        value={staffForm.profileId}
                        onChange={(event) => setStaffForm({ profileId: event.target.value })}
                        disabled={!canEdit}
                      >
                        <option value="">選択してください</option>
                        {helperOptions.length > 0 && (
                          <optgroup label="手伝いメンバー">
                            {helperOptions.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.display_name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </label>
                    <Button type="submit" size="sm" disabled={!staffForm.profileId || savingStaff || !canEdit}>
                      {savingStaff ? <RefreshCw className="w-4 h-4 animate-spin" /> : "追加"}
                    </Button>
                  </form>
                  {syncingPerformers && (
                    <p className="text-xs text-muted-foreground">出演メンバーを自動追加中です...</p>
                  )}

                  {lightStaffOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">照明スタッフが未登録です。</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {lightStaffOptions.map((staff) => {
                        const profile = profileMap.get(staff.profile_id);
                        const isPerformer = performerIds.has(staff.profile_id);
                        return (
                          <span
                            key={staff.id}
                            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
                          >
                            {profile?.display_name ?? "未登録"}
                            {isPerformer ? (
                              <Badge variant="secondary" className="text-[10px]">
                                出演
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                お手伝い
                              </Badge>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveStaff(staff.id)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="削除"
                              disabled={!canEdit || isPerformer}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border flex flex-col min-h-0 flex-1">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">照明シフト割当</CardTitle>
                    <CardDescription>各枠に照明担当を割り当てます。</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {event?.date ?? "日程未登録"}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 min-h-0 overflow-auto">
                  {orderedSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">スロットがまだありません。</p>
                  ) : (
                    orderedSlots.map((slot, index) => {
                      const phase = slotPhaseKey(slot);
                      const prevPhase = orderedSlots[index - 1]
                        ? slotPhaseKey(orderedSlots[index - 1])
                        : phase;
                      const showPhaseHeader = index === 0 || prevPhase !== phase;
                      const roleAssignments =
                        assignmentsBySlotRole.get(slot.id) ?? emptyRoleAssignments();

                      return (
                        <Fragment key={slot.id}>
                          {showPhaseHeader && (
                            <div className="flex items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                              <span>{slotPhaseLabel(slot)}</span>
                              <div className={`h-1 flex-1 rounded-full ${phaseBarClass(phase)}`} />
                            </div>
                          )}
                          <div
                            className={`rounded-lg border border-border bg-background/40 p-4 space-y-4 ${slotAccentClass(
                              slot
                            )}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1">
                                <p className="text-sm font-medium">{slotLabel(slot)}</p>
                                <p className="text-sm text-muted-foreground">{slotTimeLabel(slot)}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={slotPhaseBadgeVariant(slot)}>{slotPhaseLabel(slot)}</Badge>
                                <Badge variant="outline">{slot.slot_type.toUpperCase()}</Badge>
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              {roleOptions.map((role) => {
                                const current = roleAssignments[role.value];
                                const draftKey = `${slot.id}:${role.value}`;
                                const currentValue = current?.profile_id ?? "";
                                const draftValue = assignmentDrafts[draftKey] ?? currentValue;

                                return (
                                  <div key={role.value} className="space-y-2 rounded-md border border-border/60 p-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium text-muted-foreground">
                                        {role.label}
                                      </span>
                                      {currentValue ? (
                                        <Badge variant="secondary">割当済み</Badge>
                                      ) : (
                                        <Badge variant="outline">未割当</Badge>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <select
                                        className="h-9 flex-1 min-w-[180px] rounded-md border border-input bg-card px-2 text-xs text-foreground"
                                        value={draftValue}
                                        onChange={(event) =>
                                          setAssignmentDrafts((prev) => ({
                                            ...prev,
                                            [draftKey]: event.target.value,
                                          }))
                                        }
                                        disabled={!canEdit}
                                      >
                                        <option value="">未割当</option>
                                        {lightStaffOptions.map((staff) => (
                                          <option key={staff.id} value={staff.profile_id}>
                                            {profileMap.get(staff.profile_id)?.display_name ?? "未登録"}
                                          </option>
                                        ))}
                                      </select>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleSetAssignment(slot.id, role.value, draftValue)}
                                        disabled={!canEdit || savingAssignments || draftValue === currentValue}
                                      >
                                        更新
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleSetAssignment(slot.id, role.value, "")}
                                        disabled={!canEdit || savingAssignments || !currentValue}
                                      >
                                        解除
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </Fragment>
                      );
                    })
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
