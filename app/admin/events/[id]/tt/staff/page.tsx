
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Calendar, RefreshCw, Save, Users } from "lucide-react";
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

type EventRow = {
  id: string;
  name: string;
  date: string;
  venue: string | null;
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

type SlotStaffAssignment = {
  id: string;
  event_slot_id: string;
  profile_id: string;
  role: "pa" | "light";
  is_fixed: boolean;
  note: string | null;
};

export default function AdminEventStaffPage() {
  const params = useParams();
  const eventId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { canAccessAdmin, loading: roleLoading } = useRoleFlags();

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
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [staffForm, setStaffForm] = useState({
    profileId: "",
    can_pa: false,
    can_light: false,
    note: "",
  });

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

  const orderedSlots = useMemo(() => {
    return [...slots].sort((a, b) => {
      const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });
  }, [slots]);

  const performerIds = useMemo(() => {
    return new Set(bandMembers.map((member) => member.user_id));
  }, [bandMembers]);

  const availableStaffOptions = useMemo(() => {
    const assigned = new Set(eventStaff.map((staff) => staff.profile_id));
    return profiles.filter((profile) => !assigned.has(profile.id));
  }, [eventStaff, profiles]);

  const performerOptions = useMemo(() => {
    return availableStaffOptions.filter((profile) => performerIds.has(profile.id));
  }, [availableStaffOptions, performerIds]);

  const helperOptions = useMemo(() => {
    return availableStaffOptions.filter((profile) => !performerIds.has(profile.id));
  }, [availableStaffOptions, performerIds]);

  useEffect(() => {
    if (!eventId || roleLoading || !canAccessAdmin) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const [eventRes, bandsRes, slotsRes, staffRes, profilesRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, venue")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("bands")
          .select("id, name")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase
          .from("event_slots")
          .select("id, event_id, band_id, slot_type, order_in_event, start_time, end_time, note")
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
          .in("event_slot_id", slotIds);
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

  const handleAddStaff = async (e: FormEvent) => {
    e.preventDefault();
    if (!eventId || !staffForm.profileId || savingStaff) return;
    setSavingStaff(true);

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
      toast.error("当日スタッフの追加に失敗しました。");
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
      toast.error("当日スタッフの保存に失敗しました。");
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

    const staff = eventStaff.find((item) => item.id === staffId);
    const { error } = await supabase.from("event_staff_members").delete().eq("id", staffId);
    if (error) {
      console.error(error);
      toast.error("当日スタッフの削除に失敗しました。");
      setSavingStaff(false);
      return;
    }

    setEventStaff((prev) => prev.filter((item) => item.id !== staffId));
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
      setStaffAssignments((prev) => prev.filter((assignment) => assignment.profile_id !== staff.profile_id));
    }

    toast.success("当日スタッフを削除しました。");
    setSavingStaff(false);
  };

  const handleAddAssignment = async (slotId: string, role: "pa" | "light", profileId: string) => {
    if (!slotId || !profileId || savingAssignments) return;
    setSavingAssignments(true);

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
      toast.error("シフト割当の追加に失敗しました。");
      setSavingAssignments(false);
      return;
    }

    setStaffAssignments((prev) => [...prev, data as SlotStaffAssignment]);
    const key = `${slotId}:${role}`;
    setAssignmentDrafts((prev) => ({ ...prev, [key]: "" }));
    toast.success("シフトを追加しました。");
    setSavingAssignments(false);
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!assignmentId || savingAssignments) return;
    setSavingAssignments(true);

    const { error } = await supabase.from("slot_staff_assignments").delete().eq("id", assignmentId);
    if (error) {
      console.error(error);
      toast.error("シフト割当の削除に失敗しました。");
      setSavingAssignments(false);
      return;
    }

    setStaffAssignments((prev) => prev.filter((assignment) => assignment.id !== assignmentId));
    toast.success("シフトを削除しました。");
    setSavingAssignments(false);
  };

  const handleAutoAssign = async () => {
    if (!eventId || savingAssignments) return;
    setSavingAssignments(true);

    const ordered = [...orderedSlots];
    if (ordered.length === 0) {
      toast.error("スロットがありません。");
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
      toast.error("シフトの自動割当に失敗しました。");
      setSavingAssignments(false);
      return;
    }

    setStaffAssignments((prev) => [...prev, ...(data as SlotStaffAssignment[])]);
    toast.success("シフトを自動割当しました。");
    setSavingAssignments(false);
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

  if (!eventId || !event) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">イベントが見つかりません。</p>
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
            title="当日スタッフ割当"
            description="出演メンバーを中心に当日スタッフの割当を作成します。"
            backHref={`/admin/events/${eventId}`}
            backLabel="イベント編集に戻る"
            meta={
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {event.date}
                </span>
                <Badge variant="outline" className="gap-1">
                  <Users className="w-4 h-4" />
                  {eventStaff.length} 名
                </Badge>
              </div>
            }
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">当日スタッフ</CardTitle>
                    <CardDescription>出演者を中心にスタッフ登録を行います。</CardDescription>
                  </div>
                  <Button type="button" onClick={handleSaveStaff} disabled={savingStaff}>
                    {savingStaff ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    保存
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  <form onSubmit={handleAddStaff} className="grid gap-3 md:grid-cols-[1fr,140px,140px,1fr,auto]">
                    <label className="space-y-1 text-xs">
                      <span className="text-muted-foreground">スタッフ</span>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        value={staffForm.profileId}
                        onChange={(e) => setStaffForm((prev) => ({ ...prev, profileId: e.target.value }))}
                      >
                        <option value="">選択してください</option>
                        {performerOptions.length > 0 && (
                          <optgroup label="出演メンバー">
                            {performerOptions.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.display_name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {helperOptions.length > 0 && (
                          <optgroup label="サポート">
                            {helperOptions.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.display_name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={staffForm.can_pa}
                        onChange={(e) => setStaffForm((prev) => ({ ...prev, can_pa: e.target.checked }))}
                        className="h-4 w-4 rounded border-border text-primary"
                      />
                      PA対応
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={staffForm.can_light}
                        onChange={(e) => setStaffForm((prev) => ({ ...prev, can_light: e.target.checked }))}
                        className="h-4 w-4 rounded border-border text-primary"
                      />
                      照明対応
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-muted-foreground">備考</span>
                      <Input
                        value={staffForm.note}
                        onChange={(e) => setStaffForm((prev) => ({ ...prev, note: e.target.value }))}
                        placeholder="得意分野や備考"
                      />
                    </label>
                    <Button type="submit" disabled={savingStaff || !staffForm.profileId}>
                      追加
                    </Button>
                  </form>

                  <div className="space-y-3">
                    {eventStaff.length === 0 ? (
                      <p className="text-sm text-muted-foreground">当日スタッフがまだ登録されていません。</p>
                    ) : (
                      eventStaff.map((staff) => {
                        const profile = profileMap.get(staff.profile_id);
                        const isPerformer = performerIds.has(staff.profile_id);
                        return (
                          <div
                            key={staff.id}
                            className="flex flex-col gap-3 rounded-lg border border-border bg-background/40 p-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">
                                  {profile?.display_name ?? "名前未登録"}
                                </p>
                                {profile?.crew && <Badge variant="outline">{profile.crew}</Badge>}
                                <Badge variant={isPerformer ? "secondary" : "outline"}>
                                  {isPerformer ? "出演" : "サポート"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Discord: {profile?.discord ?? "未連携"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={staff.can_pa}
                                  onChange={(e) => handleUpdateStaffLocal(staff.id, { can_pa: e.target.checked })}
                                  className="h-4 w-4 rounded border-border text-primary"
                                />
                                PA
                              </label>
                              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={staff.can_light}
                                  onChange={(e) => handleUpdateStaffLocal(staff.id, { can_light: e.target.checked })}
                                  className="h-4 w-4 rounded border-border text-primary"
                                />
                                照明
                              </label>
                              <Input
                                value={staff.note ?? ""}
                                onChange={(e) => handleUpdateStaffLocal(staff.id, { note: e.target.value })}
                                placeholder="備考"
                                className="min-w-[160px]"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleRemoveStaff(staff.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                削除
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">シフト割当</CardTitle>
                    <CardDescription>タイムテーブルごとに担当者を割り当てます。</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={handleAutoAssign} disabled={savingAssignments}>
                      {savingAssignments ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      自動割当
                    </Button>
                    <Link
                      href={`/admin/events/${eventId}/tt/edit`}
                      className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-xs text-foreground hover:border-primary/60 hover:text-primary transition-colors"
                    >
                      タイムテーブル編集へ
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orderedSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">スロットがまだありません。</p>
                  ) : (
                    orderedSlots.map((slot) => {
                      const assignments = assignmentsBySlot.get(slot.id) ?? { pa: [], light: [] };
                      const paOptions = eventStaff.filter((staff) => staff.can_pa);
                      const lightOptions = eventStaff.filter((staff) => staff.can_light);
                      const paDraftKey = `${slot.id}:pa`;
                      const lightDraftKey = `${slot.id}:light`;

                      return (
                        <div key={slot.id} className="rounded-lg border border-border bg-background/40 p-4 space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{slotLabel(slot)}</p>
                              <p className="text-xs text-muted-foreground">{slotTimeLabel(slot)}</p>
                            </div>
                            <Badge variant="outline">{slot.slot_type.toUpperCase()}</Badge>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-medium text-muted-foreground">PA</span>
                                <div className="flex items-center gap-2">
                                  <select
                                    className="h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground"
                                    value={assignmentDrafts[paDraftKey] ?? ""}
                                    onChange={(e) =>
                                      setAssignmentDrafts((prev) => ({ ...prev, [paDraftKey]: e.target.value }))
                                    }
                                  >
                                    <option value="">追加する人を選択</option>
                                    {paOptions.map((staff) => (
                                      <option key={staff.id} value={staff.profile_id}>
                                        {profileMap.get(staff.profile_id)?.display_name ?? "未登録"}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleAddAssignment(slot.id, "pa", assignmentDrafts[paDraftKey] ?? "")}
                                    disabled={!assignmentDrafts[paDraftKey]}
                                  >
                                    追加
                                  </Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {assignments.pa.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">未割当</span>
                                ) : (
                                  assignments.pa.map((assignment) => {
                                    const name = profileMap.get(assignment.profile_id)?.display_name ?? "未登録";
                                    return (
                                      <span
                                        key={assignment.id}
                                        className="inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs"
                                      >
                                        {name}
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveAssignment(assignment.id)}
                                          className="text-muted-foreground hover:text-destructive"
                                          aria-label="削除"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-medium text-muted-foreground">照明</span>
                                <div className="flex items-center gap-2">
                                  <select
                                    className="h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground"
                                    value={assignmentDrafts[lightDraftKey] ?? ""}
                                    onChange={(e) =>
                                      setAssignmentDrafts((prev) => ({ ...prev, [lightDraftKey]: e.target.value }))
                                    }
                                  >
                                    <option value="">追加する人を選択</option>
                                    {lightOptions.map((staff) => (
                                      <option key={staff.id} value={staff.profile_id}>
                                        {profileMap.get(staff.profile_id)?.display_name ?? "未登録"}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      handleAddAssignment(slot.id, "light", assignmentDrafts[lightDraftKey] ?? "")
                                    }
                                    disabled={!assignmentDrafts[lightDraftKey]}
                                  >
                                    追加
                                  </Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {assignments.light.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">未割当</span>
                                ) : (
                                  assignments.light.map((assignment) => {
                                    const name = profileMap.get(assignment.profile_id)?.display_name ?? "未登録";
                                    return (
                                      <span
                                        key={assignment.id}
                                        className="inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs"
                                      >
                                        {name}
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveAssignment(assignment.id)}
                                          className="text-muted-foreground hover:text-destructive"
                                          aria-label="削除"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
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
