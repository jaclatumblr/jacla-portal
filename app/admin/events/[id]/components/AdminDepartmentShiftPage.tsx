"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/lib/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { SideNav } from "@/components/SideNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Download, RefreshCw, Users } from "@/lib/icons";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { formatTimeText } from "@/lib/time";
import { downloadShiftStaffExcel } from "@/lib/shiftStaffExport";
import {
  isBinaryProfileGender,
  normalizeProfileGender,
  type BinaryProfileGender,
  type ProfileGender,
} from "@/lib/profileGender";
import { isMissingColumnError } from "@/lib/supabaseErrors";
import { useRoleFlags } from "@/lib/useRoleFlags";

type Department = "pa" | "lighting";

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
  real_name?: string | null;
  discord?: string | null;
  crew?: string | null;
};

type ProfileRow = {
  id: string;
  display_name?: string | null;
  real_name?: string | null;
  discord_username?: string | null;
  crew?: string | null;
};

type ProfileGenderRow = {
  profile_id?: string;
  gender?: string | null;
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

const PA_ROLE_OPTIONS = [
  { value: "pa_main", label: "PA1" },
  { value: "pa_sub", label: "PA2" },
  { value: "pa_extra", label: "PA3 (任意)" },
] as const;

const LIGHTING_ROLE_OPTIONS = [
  { value: "light_op1", label: "卓操作①" },
  { value: "light_op2", label: "卓操作②" },
  { value: "light_spot", label: "スポット" },
  { value: "light_assist", label: "補助 (任意)" },
] as const;

type PaRoleValue = (typeof PA_ROLE_OPTIONS)[number]["value"];
type LightingRoleValue = (typeof LIGHTING_ROLE_OPTIONS)[number]["value"];
type RoleValue = PaRoleValue | LightingRoleValue;

type SlotStaffAssignment = {
  id: string;
  event_slot_id: string;
  profile_id: string;
  role: RoleValue;
  is_fixed: boolean;
  note: string | null;
};

type BandShiftItem = {
  bandId: string;
  bandName: string;
  slots: EventSlot[];
  orderInEvent: number;
  memberCount: number;
};

type BandRoleSummary = {
  profileIds: string[];
  assignedSlotCount: number;
};

const PHASE_LABELS: Record<string, string> = {
  rehearsal_normal: "通常リハ",
  rehearsal_pre: "直前リハ",
  show: "本番",
};

const BIG_BAND_MEMBER_THRESHOLD = 8;

const buildRandomRankMap = (values: string[]) => {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return new Map(shuffled.map((value, index) => [value, index] as const));
};

const parseTimeValue = (value: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const sortSlots = (slots: EventSlot[]) =>
  [...slots].sort((a, b) => {
    const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (a.start_time ?? "").localeCompare(b.start_time ?? "");
  });

const phaseLabel = (phase?: EventSlot["slot_phase"]) => {
  if (!phase) return "本番";
  return PHASE_LABELS[phase] ?? "本番";
};

const slotDurationLabel = (slot: EventSlot) => {
  const start = parseTimeValue(slot.start_time ?? null);
  const end = parseTimeValue(slot.end_time ?? null);
  if (start == null || end == null) return "";
  let duration = end - start;
  if (duration < 0) duration += 24 * 60;
  if (duration <= 0) return "";
  return ` (${duration}分)`;
};

const slotTimeLabel = (slot: EventSlot) => {
  const startText = formatTimeText(slot.start_time);
  const endText = formatTimeText(slot.end_time);
  if (!startText && !endText) return "時刻未設定";
  if (startText && endText) return `${startText}-${endText}${slotDurationLabel(slot)}`;
  return startText ?? endText ?? "時刻未設定";
};

const slotTimeRange = (slot: Pick<EventSlot, "start_time" | "end_time">) => {
  const start = parseTimeValue(slot.start_time ?? null);
  const end = parseTimeValue(slot.end_time ?? null);
  if (start == null || end == null) return null;
  let normalizedEnd = end;
  if (normalizedEnd <= start) normalizedEnd += 24 * 60;
  return { start, end: normalizedEnd };
};

const slotsOverlap = (
  left: Pick<EventSlot, "start_time" | "end_time">,
  right: Pick<EventSlot, "start_time" | "end_time">
) => {
  const leftRange = slotTimeRange(left);
  const rightRange = slotTimeRange(right);
  if (!leftRange || !rightRange) return false;
  return leftRange.start < rightRange.end && rightRange.start < leftRange.end;
};

const slotTypeLabel = (slot: EventSlot) => {
  if (slot.slot_type === "band") return "バンド";
  const note = slot.note?.trim() ?? "";
  if (slot.slot_type === "break" || note.includes("転換")) return "転換";
  return "付帯作業";
};

const slotOrderValue = (slot: { order_in_event: number | null }) =>
  slot.order_in_event ?? Number.MAX_SAFE_INTEGER;

const bandShowOrderValue = (
  bandSlots: Array<{
    slot_phase?: "show" | "rehearsal_normal" | "rehearsal_pre" | null;
    order_in_event: number | null;
  }>
) => {
  const showSlots = bandSlots.filter((slot) => slot.slot_phase === "show");
  const targetSlots = showSlots.length > 0 ? showSlots : bandSlots;
  return Math.min(...targetSlots.map(slotOrderValue));
};

const profileDisplayName = (
  profile?: Pick<ProfileOption, "display_name" | "real_name"> | null
) => profile?.real_name?.trim() || profile?.display_name?.trim() || "未登録";

const pageConfig = {
  pa: {
    kicker: "PA Shift",
    title: "PAシフト作成",
    staffTitle: "PAスタッフ",
    staffDescription:
      "出演メンバーのうち PA ロールの人は自動追加されます。User は必要な場合だけ手動で追加してください。",
    note: "バンド単位で管理し、リハと本番を同じ担当に揃えます。",
    crewName: "PA",
    tabs: PA_ROLE_OPTIONS,
    path: "pa",
  },
  lighting: {
    kicker: "Lighting Shift",
    title: "照明シフト作成",
    staffTitle: "照明スタッフ",
    staffDescription:
      "出演メンバーのうち照明ロールの人は自動追加されます。User は必要な場合だけ手動で追加してください。",
    note: "バンド単位で管理し、リハと本番を同じ担当に揃えます。",
    crewName: "Lighting",
    tabs: LIGHTING_ROLE_OPTIONS,
    path: "lighting",
  },
} as const;

export function AdminDepartmentShiftPage({ department }: { department: Department }) {
  const params = useParams();
  const eventId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { isAdmin, isPaLeader, isLightingLeader, canAccessAdmin, loading: roleLoading } =
    useRoleFlags();

  const config = pageConfig[department];
  const roleOptions = config.tabs as readonly { value: RoleValue; label: string }[];
  const canEditRole = isAdmin || (department === "pa" ? isPaLeader : isLightingLeader);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [bandMembers, setBandMembers] = useState<BandMemberRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profileGenders, setProfileGenders] = useState<Record<string, ProfileGender | null>>({});
  const [profileEnrollmentYears, setProfileEnrollmentYears] = useState<
    Record<string, number | null>
  >({});
  const [eventStaff, setEventStaff] = useState<EventStaffMember[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<SlotStaffAssignment[]>([]);
  const [slots, setSlots] = useState<EventSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [syncingPerformers, setSyncingPerformers] = useState(false);
  const [staffForm, setStaffForm] = useState({ profileId: "" });
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [bandMembersLoadError, setBandMembersLoadError] = useState<string | null>(null);
  const performerSyncLockRef = useRef(false);

  const shiftUnlocked = event?.tt_is_provisional ?? false;
  const canManageStaff = canEditRole && !bandMembersLoadError;
  const canManageAssignments = canEditRole && !bandMembersLoadError;

  const eligibleProfiles = useMemo(() => {
    return profiles.filter(
      (profile) =>
        profile.crew == null || profile.crew === "User" || profile.crew === config.crewName
    );
  }, [config.crewName, profiles]);

  const eligibleProfileIds = useMemo(
    () => new Set(eligibleProfiles.map((profile) => profile.id)),
    [eligibleProfiles]
  );
  const autoAssignableProfileIds = useMemo(
    () =>
      new Set(
        profiles
          .filter((profile) => profile.crew === config.crewName)
          .map((profile) => profile.id)
      ),
    [config.crewName, profiles]
  );

  const performerIds = useMemo(
    () => new Set(bandMembers.map((member) => member.user_id)),
    [bandMembers]
  );

  const bandMembersMap = useMemo(() => {
    const next = new Map<string, Set<string>>();
    bandMembers.forEach((member) => {
      const current = next.get(member.band_id) ?? new Set<string>();
      current.add(member.user_id);
      next.set(member.band_id, current);
    });
    return next;
  }, [bandMembers]);

  const bandMemberCounts = useMemo(() => {
    const next = new Map<string, number>();
    bandMembersMap.forEach((memberIds, bandId) => {
      next.set(bandId, memberIds.size);
    });
    return next;
  }, [bandMembersMap]);

  const eligiblePerformerIds = useMemo(
    () =>
      new Set(
        bandMembers
          .filter((member) => autoAssignableProfileIds.has(member.user_id))
          .map((member) => member.user_id)
      ),
    [autoAssignableProfileIds, bandMembers]
  );

  const assignedStaffIds = useMemo(() => {
    return new Set(
      eventStaff
        .filter((staff) => (department === "pa" ? staff.can_pa : staff.can_light))
        .map((staff) => staff.profile_id)
    );
  }, [department, eventStaff]);

  const profileMap = useMemo(() => {
    const next = new Map<string, ProfileOption>();
    profiles.forEach((profile) => next.set(profile.id, profile));
    return next;
  }, [profiles]);

  const helperOptions = useMemo(() => {
    return eligibleProfiles
      .filter((profile) => !assignedStaffIds.has(profile.id) && !performerIds.has(profile.id))
      .sort((a, b) => profileDisplayName(a).localeCompare(profileDisplayName(b), "ja"));
  }, [assignedStaffIds, eligibleProfiles, performerIds]);

  const departmentStaffOptions = useMemo(() => {
    return eventStaff
      .filter(
        (staff) =>
          (department === "pa" ? staff.can_pa : staff.can_light) &&
          eligibleProfileIds.has(staff.profile_id)
      )
      .sort((a, b) =>
        profileDisplayName(profileMap.get(a.profile_id)).localeCompare(
          profileDisplayName(profileMap.get(b.profile_id)),
          "ja"
        )
      );
  }, [department, eligibleProfileIds, eventStaff, profileMap]);

  const bandNameMap = useMemo(() => {
    const next = new Map<string, string>();
    bands.forEach((band) => next.set(band.id, band.name));
    return next;
  }, [bands]);

  const missingGenderProfileIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...eventStaff.map((staff) => staff.profile_id),
          ...bandMembers.map((member) => member.user_id),
        ])
      ).filter((profileId) => !Object.prototype.hasOwnProperty.call(profileGenders, profileId)),
    [bandMembers, eventStaff, profileGenders]
  );

  const missingEnrollmentYearProfileIds = useMemo(
    () =>
      Array.from(new Set(eventStaff.map((staff) => staff.profile_id))).filter(
        (profileId) => !Object.prototype.hasOwnProperty.call(profileEnrollmentYears, profileId)
      ),
    [eventStaff, profileEnrollmentYears]
  );

  const managedSlots = useMemo(
    () => sortSlots(slots.filter((slot) => slot.slot_type === "band" && Boolean(slot.band_id))),
    [slots]
  );

  const orderedSlots = useMemo(() => sortSlots(slots), [slots]);

  const managedSlotIds = useMemo(
    () => managedSlots.map((slot) => slot.id).filter(Boolean),
    [managedSlots]
  );

  const bandItems = useMemo<BandShiftItem[]>(() => {
    const grouped = new Map<string, EventSlot[]>();
    managedSlots.forEach((slot) => {
      if (!slot.band_id) return;
      const current = grouped.get(slot.band_id) ?? [];
      current.push(slot);
      grouped.set(slot.band_id, current);
    });

    return Array.from(grouped.entries())
      .map(([bandId, bandSlots]) => ({
        bandId,
        bandName: bands.find((band) => band.id === bandId)?.name ?? "バンド",
        slots: sortSlots(bandSlots),
        orderInEvent: Math.min(
          ...bandSlots.map((slot) => slot.order_in_event ?? Number.MAX_SAFE_INTEGER)
        ),
        memberCount: bandMemberCounts.get(bandId) ?? 0,
      }))
      .sort((a, b) => {
        if (a.orderInEvent !== b.orderInEvent) return a.orderInEvent - b.orderInEvent;
        return a.bandName.localeCompare(b.bandName, "ja");
      });
  }, [bandMemberCounts, bands, managedSlots]);

  const autoAssignRoleOptionsMap = useMemo(() => {
    const next = new Map<string, readonly { value: RoleValue; label: string }[]>();

    bandItems.forEach((band) => {
      if (department !== "pa" || band.memberCount >= BIG_BAND_MEMBER_THRESHOLD) {
        next.set(band.bandId, roleOptions);
        return;
      }

      next.set(
        band.bandId,
        roleOptions.filter((role) => role.value !== "pa_extra")
      );
    });

    return next;
  }, [bandItems, department, roleOptions]);

  const summaryRoleOptions = useMemo(
    () =>
      department === "pa"
        ? roleOptions.filter((role) => role.value !== "pa_extra")
        : roleOptions,
    [department, roleOptions]
  );

  const preferredGenderByBand = useMemo(() => {
    const next = new Map<string, BinaryProfileGender | null>();

    bandItems.forEach((band) => {
      let maleCount = 0;
      let femaleCount = 0;

      bandMembersMap.get(band.bandId)?.forEach((profileId) => {
        const gender = profileGenders[profileId] ?? null;
        if (!isBinaryProfileGender(gender)) return;
        if (gender === "male") maleCount += 1;
        if (gender === "female") femaleCount += 1;
      });

      if (maleCount > femaleCount) {
        next.set(band.bandId, "male");
      } else if (femaleCount > maleCount) {
        next.set(band.bandId, "female");
      } else {
        next.set(band.bandId, null);
      }
    });

    return next;
  }, [bandItems, bandMembersMap, profileGenders]);

  const assignmentsByBandRole = useMemo(() => {
    const next: Record<string, Partial<Record<RoleValue, BandRoleSummary>>> = {};

    bandItems.forEach((item) => {
      const roleSummary: Partial<Record<RoleValue, BandRoleSummary>> = {};

      roleOptions.forEach((role) => {
        const profileIds = Array.from(
          new Set(
            item.slots.flatMap((slot) =>
              staffAssignments
                .filter(
                  (assignment) =>
                    assignment.event_slot_id === slot.id && assignment.role === role.value
                )
                .map((assignment) => assignment.profile_id)
                .filter((profileId): profileId is string => Boolean(profileId))
            )
          )
        );

        roleSummary[role.value] = {
          profileIds,
          assignedSlotCount: item.slots.filter((slot) =>
            staffAssignments.some(
              (assignment) =>
                assignment.event_slot_id === slot.id && assignment.role === role.value
            )
          ).length,
        };
      });

      next[item.bandId] = roleSummary;
    });

    return next;
  }, [bandItems, roleOptions, staffAssignments]);

  const incompleteBandCount = useMemo(
    () =>
      bandItems.filter((item) =>
        summaryRoleOptions.some((role) => {
          const summary = assignmentsByBandRole[item.bandId]?.[role.value];
          return !summary || summary.assignedSlotCount < item.slots.length;
        })
      ).length,
    [assignmentsByBandRole, bandItems, summaryRoleOptions]
  );

  const mismatchedBandCount = useMemo(
    () =>
      bandItems.filter((item) =>
        summaryRoleOptions.some((role) => {
          const summary = assignmentsByBandRole[item.bandId]?.[role.value];
          return (summary?.profileIds.length ?? 0) > 1;
        })
      ).length,
    [assignmentsByBandRole, bandItems, summaryRoleOptions]
  );

  const assignedBandRoleCount = useMemo(
    () =>
      bandItems.reduce((sum, item) => {
        return (
          sum +
          summaryRoleOptions.filter((role) => {
            const summary = assignmentsByBandRole[item.bandId]?.[role.value];
            return Boolean(summary && summary.assignedSlotCount === item.slots.length);
          }).length
        );
      }, 0),
    [assignmentsByBandRole, bandItems, summaryRoleOptions]
  );

  const totalBandRoleCount = useMemo(
    () => bandItems.length * summaryRoleOptions.length,
    [bandItems.length, summaryRoleOptions.length]
  );

  const managedSlotMap = useMemo(() => {
    const next = new Map<string, EventSlot>();
    managedSlots.forEach((slot) => next.set(slot.id, slot));
    return next;
  }, [managedSlots]);

  const staffShiftSummaries = useMemo(() => {
    return departmentStaffOptions
      .map((staff) => {
        const assigned = staffAssignments.filter((assignment) => assignment.profile_id === staff.profile_id);
        const bandIds = new Set<string>();
        let rehearsalCount = 0;
        let showCount = 0;
        const roleCounts = new Map<RoleValue, number>();

        assigned.forEach((assignment) => {
          const slot = managedSlotMap.get(assignment.event_slot_id);
          if (!slot) return;
          if (slot.band_id) bandIds.add(slot.band_id);
          if (slot.slot_phase === "show") {
            showCount += 1;
          } else {
            rehearsalCount += 1;
          }
          roleCounts.set(assignment.role, (roleCounts.get(assignment.role) ?? 0) + 1);
        });

        const roleSummary = roleOptions
          .map((role) => {
            const count = roleCounts.get(role.value) ?? 0;
            return count > 0 ? `${role.label}:${count}` : null;
          })
          .filter((value): value is string => Boolean(value))
          .join(" / ");

        return {
          staffId: staff.id,
          profileId: staff.profile_id,
          enrollmentYear: profileEnrollmentYears[staff.profile_id] ?? null,
          name: profileDisplayName(profileMap.get(staff.profile_id)),
          totalCount: assigned.length,
          bandCount: bandIds.size,
          rehearsalCount,
          showCount,
          roleSummary,
        };
      })
      .sort((a, b) => {
        const aEnrollmentYear = a.enrollmentYear ?? Number.MAX_SAFE_INTEGER;
        const bEnrollmentYear = b.enrollmentYear ?? Number.MAX_SAFE_INTEGER;
        if (aEnrollmentYear !== bEnrollmentYear) return aEnrollmentYear - bEnrollmentYear;
        if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
        if (b.showCount !== a.showCount) return b.showCount - a.showCount;
        return a.name.localeCompare(b.name, "ja");
      });
  }, [
    departmentStaffOptions,
    managedSlotMap,
    profileEnrollmentYears,
    profileMap,
    roleOptions,
    staffAssignments,
  ]);

  const isPerformerInBand = (bandId: string, profileId: string) =>
    bandMembersMap.get(bandId)?.has(profileId) ?? false;

  const displayProfileName = (profileId?: string | null) => {
    if (!profileId) return "未割当";
    return profileDisplayName(profileMap.get(profileId));
  };

  const handleExportShiftList = () => {
    const exportItems = [...bandItems].sort((a, b) => {
      const showOrderA = bandShowOrderValue(a.slots);
      const showOrderB = bandShowOrderValue(b.slots);
      if (showOrderA !== showOrderB) return showOrderA - showOrderB;
      if (a.orderInEvent !== b.orderInEvent) return a.orderInEvent - b.orderInEvent;
      return a.bandName.localeCompare(b.bandName, "ja");
    });

    void downloadShiftStaffExcel({
      department,
      eventName: event?.name,
      eventDate: event?.date,
      items: exportItems.map((band) => ({
        bandName: band.bandName,
        staffCells: roleOptions.map((role) => ({
          label: role.label,
          staff: (assignmentsByBandRole[band.bandId]?.[role.value]?.profileIds ?? []).map(
            (profileId) => ({
              name: displayProfileName(profileId),
              enrollmentYear: profileEnrollmentYears[profileId] ?? null,
            })
          ),
        })),
      })),
    }).catch((error) => {
      console.error(error);
      toast.error("Excel出力に失敗しました。");
    });
  };

  const fetchAssignments = useCallback(async (slotIds: string[]) => {
    if (slotIds.length === 0) {
      setStaffAssignments([]);
      return;
    }
    const { data, error } = await supabase
      .from("slot_staff_assignments")
      .select("id, event_slot_id, profile_id, role, is_fixed, note")
      .in("event_slot_id", slotIds)
      .in(
        "role",
        roleOptions.map((role) => role.value)
      );

    if (error) {
      console.error(error);
      toast.error("シフト割当の取得に失敗しました。");
      return;
    }

    setStaffAssignments((data ?? []) as SlotStaffAssignment[]);
  }, [roleOptions]);

  const restoreAssignments = async (assignmentsToRestore: SlotStaffAssignment[]) => {
    if (assignmentsToRestore.length === 0) return true;
    const payload = assignmentsToRestore.map((assignment) => ({
      event_slot_id: assignment.event_slot_id,
      profile_id: assignment.profile_id,
      role: assignment.role,
      is_fixed: assignment.is_fixed,
      note: assignment.note,
    }));
    const { error } = await supabase.from("slot_staff_assignments").insert(payload);
    if (error) {
      console.error(error);
      return false;
    }
    return true;
  };

  const replaceBandRoleAssignments = async (
    snapshot: SlotStaffAssignment[],
    slotIds: string[],
    role: RoleValue,
    profileId: string
  ) => {
    const slotIdSet = new Set(slotIds);
    const scopedAssignments = snapshot.filter(
      (assignment) => slotIdSet.has(assignment.event_slot_id) && assignment.role === role
    );
    const retainedAssignments = snapshot.filter(
      (assignment) => !(slotIdSet.has(assignment.event_slot_id) && assignment.role === role)
    );
    const noteBySlotId = new Map<string, string | null>();
    scopedAssignments.forEach((assignment) => {
      if (!noteBySlotId.has(assignment.event_slot_id)) {
        noteBySlotId.set(assignment.event_slot_id, assignment.note);
      }
    });

    if (!profileId) {
      if (scopedAssignments.length === 0) {
        return { ok: true, nextAssignments: retainedAssignments };
      }
      const { error: deleteError } = await supabase
        .from("slot_staff_assignments")
        .delete()
        .in(
          "id",
          scopedAssignments.map((assignment) => assignment.id)
        );
      if (deleteError) {
        console.error(deleteError);
        return { ok: false, nextAssignments: snapshot };
      }
      return { ok: true, nextAssignments: retainedAssignments };
    }

    const payload = slotIds.map((slotId) => ({
      event_slot_id: slotId,
      profile_id: profileId,
      role,
      is_fixed: true,
      note: noteBySlotId.get(slotId) ?? null,
    }));

    const { data, error } = await supabase
      .from("slot_staff_assignments")
      .insert(payload)
      .select("id, event_slot_id, profile_id, role, is_fixed, note");

    if (error || !data) {
      console.error(error);
      return { ok: false, nextAssignments: snapshot };
    }

    if (scopedAssignments.length > 0) {
      const { error: deleteError } = await supabase
        .from("slot_staff_assignments")
        .delete()
        .in(
          "id",
          scopedAssignments.map((assignment) => assignment.id)
        );
      if (deleteError) {
        console.error(deleteError);
        const { error: rollbackError } = await supabase
          .from("slot_staff_assignments")
          .delete()
          .in(
            "id",
            data.map((assignment) => assignment.id)
          );
        if (rollbackError) console.error(rollbackError);
        return { ok: false, nextAssignments: snapshot };
      }
    }

    return {
      ok: true,
      nextAssignments: [...retainedAssignments, ...((data ?? []) as SlotStaffAssignment[])],
    };
  };

  useEffect(() => {
    if (!eventId || roleLoading || !canAccessAdmin) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setBandMembersLoadError(null);

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
          .eq("band_type", "event")
          .order("created_at", { ascending: true }),
        supabase
          .from("event_slots")
          .select("id, event_id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, note")
          .eq("event_id", eventId)
          .order("order_in_event", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("event_staff_members")
          .select("id, event_id, profile_id, can_pa, can_light, note")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("id, display_name, real_name, discord_username, crew").order("display_name"),
      ]);

      if (cancelled) {
        performerSyncLockRef.current = false;
        return;
      }

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        toast.error("イベント情報の取得に失敗しました。");
        setLoading(false);
        return;
      }

      if (bandsRes.error || slotsRes.error || staffRes.error || profilesRes.error) {
        console.error(bandsRes.error ?? slotsRes.error ?? staffRes.error ?? profilesRes.error);
        toast.error("シフト作成用のデータ取得に失敗しました。");
        setLoading(false);
        return;
      }

      const eventData = eventRes.data as EventRow;
      const bandList = (bandsRes.data ?? []) as BandRow[];
      const slotList = (slotsRes.data ?? []) as EventSlot[];
      const bandSlotIds = slotList
        .filter((slot) => slot.slot_type === "band" && Boolean(slot.band_id))
        .map((slot) => slot.id);

      setEvent(eventData);
      setBands(bandList);
      setSlots(slotList);
      setEventStaff((staffRes.data ?? []) as EventStaffMember[]);
      setProfiles(
        ((profilesRes.data ?? []) as ProfileRow[]).map((row) => ({
          id: row.id,
          display_name: row.display_name ?? "未登録",
          real_name: row.real_name ?? null,
          discord: row.discord_username ?? null,
          crew: row.crew ?? null,
        }))
      );

      const bandIds = bandList.map((band) => band.id).filter(Boolean);
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
            setBandMembersLoadError(
              "出演メンバー情報の取得に失敗しました。削除可否を安全に確認できないため、この画面は閲覧のみになります。"
            );
          } else {
            setBandMembers((membersRes.data ?? []) as BandMemberRow[]);
            setBandMembersLoadError(null);
          }
        }
      } else {
        setBandMembers([]);
        setBandMembersLoadError(null);
      }

      if (!cancelled) {
        await fetchAssignments(bandSlotIds);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canAccessAdmin, eventId, fetchAssignments, roleLoading]);

  useEffect(() => {
    if (!canAccessAdmin || missingGenderProfileIds.length === 0) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("profile_private")
        .select("profile_id, gender")
        .in("profile_id", missingGenderProfileIds);

      if (cancelled) return;

      if (error && !isMissingColumnError(error, "gender")) {
        console.error(error);
      }

      setProfileGenders((prev) => {
        const next = { ...prev };
        missingGenderProfileIds.forEach((profileId) => {
          if (!Object.prototype.hasOwnProperty.call(next, profileId)) {
            next[profileId] = null;
          }
        });

        if (!error) {
          ((data ?? []) as ProfileGenderRow[]).forEach((row) => {
            if (!row?.profile_id) return;
            next[row.profile_id] = normalizeProfileGender(row.gender);
          });
        }

        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [canAccessAdmin, missingGenderProfileIds]);

  useEffect(() => {
    if (!canAccessAdmin || missingEnrollmentYearProfileIds.length === 0) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("profile_private")
        .select("profile_id, enrollment_year")
        .in("profile_id", missingEnrollmentYearProfileIds);

      if (cancelled) return;

      if (error) {
        console.error(error);
      }

      setProfileEnrollmentYears((prev) => {
        const next = { ...prev };
        missingEnrollmentYearProfileIds.forEach((profileId) => {
          if (!Object.prototype.hasOwnProperty.call(next, profileId)) {
            next[profileId] = null;
          }
        });

        if (!error) {
          (data ?? []).forEach((row: { profile_id?: string; enrollment_year?: number | null }) => {
            if (!row?.profile_id) return;
            next[row.profile_id] = row.enrollment_year ?? null;
          });
        }

        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [canAccessAdmin, missingEnrollmentYearProfileIds]);

  useEffect(() => {
    if (
      !eventId ||
      !canManageStaff ||
      eligiblePerformerIds.size === 0 ||
      syncingPerformers ||
      performerSyncLockRef.current
    ) {
      return;
    }

    const performerSet = eligiblePerformerIds;
    const staffMap = new Map(eventStaff.map((staff) => [staff.profile_id, staff]));
    const payload = Array.from(performerSet)
      .map((profileId) => {
        const existing = staffMap.get(profileId);
        if (department === "pa") {
          if (existing?.can_pa) return null;
          return {
            event_id: eventId,
            profile_id: profileId,
            can_pa: true,
            can_light: existing?.can_light ?? false,
            note: existing?.note ?? null,
          };
        }

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
    performerSyncLockRef.current = true;

    (async () => {
      setSyncingPerformers(true);
      const { data, error } = await supabase
        .from("event_staff_members")
        .upsert(payload, { onConflict: "event_id,profile_id" })
        .select("id, event_id, profile_id, can_pa, can_light, note");

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error("出演メンバーの自動追加に失敗しました。");
        setSyncingPerformers(false);
        performerSyncLockRef.current = false;
        return;
      }

      if (data) {
        setEventStaff((prev) => {
          const next = new Map(prev.map((staff) => [staff.profile_id, staff]));
          data.forEach((staff) => next.set(staff.profile_id, staff as EventStaffMember));
          return Array.from(next.values());
        });
      }

      setSyncingPerformers(false);
      performerSyncLockRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [canManageStaff, department, eligiblePerformerIds, eventId, eventStaff, syncingPerformers]);

  useEffect(() => {
    if (!eventId || !canManageStaff || syncingPerformers || performerSyncLockRef.current) return;

    const stalePerformerStaff = eventStaff.filter((staff) => {
      const hasDepartmentFlag = department === "pa" ? staff.can_pa : staff.can_light;
      return hasDepartmentFlag && performerIds.has(staff.profile_id) && !eligiblePerformerIds.has(staff.profile_id);
    });
    if (stalePerformerStaff.length === 0) return;

    const stalePatchIds = stalePerformerStaff
      .filter((staff) => (department === "pa" ? staff.can_light : staff.can_pa))
      .map((staff) => staff.id);
    const staleDeleteIds = stalePerformerStaff
      .filter((staff) => !(department === "pa" ? staff.can_light : staff.can_pa))
      .map((staff) => staff.id);

    let cancelled = false;
    performerSyncLockRef.current = true;

    (async () => {
      setSyncingPerformers(true);

      try {
        if (stalePatchIds.length > 0) {
          const patch = department === "pa" ? { can_pa: false } : { can_light: false };
          const { data, error } = await supabase
            .from("event_staff_members")
            .update(patch)
            .in("id", stalePatchIds)
            .select("id, event_id, profile_id, can_pa, can_light, note");

          if (cancelled) return;

          if (error) {
            console.error(error);
            toast.error("対象外になった出演メンバーのスタッフ権限更新に失敗しました。");
            return;
          }

          if (data) {
            setEventStaff((prev) => {
              const next = new Map(prev.map((staff) => [staff.id, staff]));
              data.forEach((staff) => next.set(staff.id, staff as EventStaffMember));
              return Array.from(next.values());
            });
          }
        }

        if (staleDeleteIds.length > 0) {
          const { error } = await supabase.from("event_staff_members").delete().in("id", staleDeleteIds);

          if (cancelled) return;

          if (error) {
            console.error(error);
            toast.error("対象外になった出演メンバーのスタッフ削除に失敗しました。");
            return;
          }

          setEventStaff((prev) => prev.filter((staff) => !staleDeleteIds.includes(staff.id)));
        }
      } finally {
        performerSyncLockRef.current = false;
        if (!cancelled) {
          setSyncingPerformers(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    canManageStaff,
    department,
    eligiblePerformerIds,
    eventId,
    eventStaff,
    performerIds,
    syncingPerformers,
  ]);

  const handleAddStaff = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!eventId || !staffForm.profileId || savingStaff || !canManageStaff) return;

    if (!eligibleProfileIds.has(staffForm.profileId)) {
      toast.error(`${config.staffTitle}には ${config.crewName} ロールか User のみ追加できます。`);
      return;
    }

    if (performerIds.has(staffForm.profileId)) {
      toast.success("出演メンバーは自動追加されます。");
      return;
    }

    setSavingStaff(true);

    const existing = eventStaff.find((staff) => staff.profile_id === staffForm.profileId);
    if (existing) {
      const patch = department === "pa" ? { can_pa: true } : { can_light: true };
      const { data, error } = await supabase
        .from("event_staff_members")
        .update(patch)
        .eq("id", existing.id)
        .select("id, event_id, profile_id, can_pa, can_light, note")
        .maybeSingle();

      if (error || !data) {
        console.error(error);
        toast.error("当日スタッフの追加に失敗しました。");
        setSavingStaff(false);
        return;
      }

      setEventStaff((prev) =>
        prev.map((staff) => (staff.id === existing.id ? (data as EventStaffMember) : staff))
      );
    } else {
      const payload = {
        event_id: eventId,
        profile_id: staffForm.profileId,
        can_pa: department === "pa",
        can_light: department === "lighting",
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
        setSavingStaff(false);
        return;
      }

      setEventStaff((prev) => [...prev, data as EventStaffMember]);
    }

    setStaffForm({ profileId: "" });
    setSavingStaff(false);
    toast.success(`${config.staffTitle}を追加しました。`);
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!staffId || savingStaff || !canManageStaff) return;
    const staff = eventStaff.find((item) => item.id === staffId);
    if (!staff) return;
    if (performerIds.has(staff.profile_id)) {
      toast.error("出演メンバーは外せません。");
      return;
    }

    setSavingStaff(true);

    const profileAssignments = staffAssignments.filter(
      (assignment) =>
        assignment.profile_id === staff.profile_id &&
        managedSlotIds.includes(assignment.event_slot_id) &&
        roleOptions.some((role) => role.value === assignment.role)
    );

    if (profileAssignments.length > 0) {
      const { error: assignmentError } = await supabase
        .from("slot_staff_assignments")
        .delete()
        .eq("profile_id", staff.profile_id)
        .in("event_slot_id", managedSlotIds)
        .in(
          "role",
          roleOptions.map((role) => role.value)
        );

      if (assignmentError) {
        console.error(assignmentError);
        toast.error("シフト割当の削除に失敗しました。");
        setSavingStaff(false);
        return;
      }
    }

    if (department === "pa" ? staff.can_light : staff.can_pa) {
      const patch = department === "pa" ? { can_pa: false } : { can_light: false };
      const { data, error } = await supabase
        .from("event_staff_members")
        .update(patch)
        .eq("id", staffId)
        .select("id, event_id, profile_id, can_pa, can_light, note")
        .maybeSingle();

      if (error || !data) {
        console.error(error);
        if (profileAssignments.length > 0) {
          const restored = await restoreAssignments(profileAssignments);
          if (!restored) {
            await fetchAssignments(managedSlotIds);
          }
        }
        toast.error("当日スタッフの更新に失敗しました。");
        setSavingStaff(false);
        return;
      }

      setEventStaff((prev) => prev.map((item) => (item.id === staffId ? (data as EventStaffMember) : item)));
    } else {
      const { error } = await supabase.from("event_staff_members").delete().eq("id", staffId);
      if (error) {
        console.error(error);
        if (profileAssignments.length > 0) {
          const restored = await restoreAssignments(profileAssignments);
          if (!restored) {
            await fetchAssignments(managedSlotIds);
          }
        }
        toast.error("当日スタッフの削除に失敗しました。");
        setSavingStaff(false);
        return;
      }

      setEventStaff((prev) => prev.filter((item) => item.id !== staffId));
    }

    if (profileAssignments.length > 0) {
      setStaffAssignments((prev) =>
        prev.filter(
          (assignment) =>
            assignment.profile_id !== staff.profile_id ||
            !roleOptions.some((role) => role.value === assignment.role)
        )
      );
      setAssignmentDrafts({});
    }

    setSavingStaff(false);
    toast.success(`${config.staffTitle}を削除しました。`);
  };

  const applyBandRoleAssignment = async (
    snapshot: SlotStaffAssignment[],
    slotIds: string[],
    role: RoleValue,
    profileId: string
  ) => replaceBandRoleAssignments(snapshot, slotIds, role, profileId);

  const handleSetBandAssignment = async (bandId: string, role: RoleValue, profileId: string) => {
    if (!canManageAssignments || savingAssignments) return;

    const band = bandItems.find((item) => item.bandId === bandId);
    if (!band) return;

    if (profileId && isPerformerInBand(bandId, profileId)) {
      toast.error("演奏中のメンバーは割り当てできません。");
      return;
    }

    setSavingAssignments(true);

    const result = await applyBandRoleAssignment(
      staffAssignments,
      band.slots.map((slot) => slot.id),
      role,
      profileId
    );

    if (!result.ok) {
      await fetchAssignments(managedSlotIds);
      setSavingAssignments(false);
      toast.error("割当の更新に失敗しました。");
      return;
    }

    setStaffAssignments(result.nextAssignments);
    setAssignmentDrafts((prev) => {
      const next = { ...prev };
      delete next[`${bandId}:${role}`];
      return next;
    });
    setSavingAssignments(false);
    toast.success(profileId ? "担当を更新しました。" : "担当を解除しました。");
  };

  const handleResetBandAssignments = async (bandId: string) => {
    if (!canManageAssignments || savingAssignments) return;

    const band = bandItems.find((item) => item.bandId === bandId);
    if (!band) return;

    const hasAssignments = roleOptions.some((role) => {
      const summary = assignmentsByBandRole[bandId]?.[role.value];
      return Boolean(summary && summary.assignedSlotCount > 0);
    });

    if (!hasAssignments) {
      toast.error("このバンドに解除できる配置はありません。");
      return;
    }

    const confirmed = window.confirm(
      `${band.bandName} のシフト配置をすべて解除します。リハと本番の割当がまとめて消えます。`
    );
    if (!confirmed) return;

    setSavingAssignments(true);

    let nextAssignments = [...staffAssignments];
    for (const role of roleOptions) {
      const result = await applyBandRoleAssignment(
        nextAssignments,
        band.slots.map((slot) => slot.id),
        role.value,
        ""
      );

      if (!result.ok) {
        await fetchAssignments(managedSlotIds);
        setSavingAssignments(false);
        toast.error("バンド配置のリセットに失敗しました。");
        return;
      }

      nextAssignments = result.nextAssignments;
    }

    setStaffAssignments(nextAssignments);
    setAssignmentDrafts((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([key]) => !key.startsWith(`${bandId}:`))
      )
    );
    setSavingAssignments(false);
    toast.success("バンド単位で配置をリセットしました。");
  };

  const handleAutoAssign = async () => {
    if (!canManageAssignments || autoAssigning) return;
    if (bandItems.length === 0) {
      toast.error("割り当て対象のバンド枠がありません。");
      return;
    }

    const confirmed = window.confirm(
      "現在の割当を、バンド単位でリハ/本番共通の担当に揃えて自動割当しますか？"
    );
    if (!confirmed) return;

    const staffPool = departmentStaffOptions
      .map((staff) => staff.profile_id)
      .filter((profileId) => autoAssignableProfileIds.has(profileId));

    if (staffPool.length === 0) {
      toast.error("割り当て可能なスタッフがいません。");
      return;
    }

    setAutoAssigning(true);

    const randomRankByProfileId = buildRandomRankMap(staffPool);
    const assignmentCounts = new Map<string, number>();
    staffPool.forEach((profileId) => assignmentCounts.set(profileId, 0));
    let lastAssigned: string | null = null;
    let nextAssignments = [...staffAssignments];

    const hasOverlappingAssignment = (bandId: string, bandSlots: EventSlot[], profileId: string) =>
      nextAssignments.some((assignment) => {
        if (assignment.profile_id !== profileId) return false;
        const assignedSlot = managedSlotMap.get(assignment.event_slot_id);
        if (!assignedSlot || assignedSlot.band_id === bandId) return false;
        return bandSlots.some((bandSlot) => slotsOverlap(assignedSlot, bandSlot));
      });

    const pickStaff = (
      bandId: string,
      bandSlots: EventSlot[],
      role: RoleValue,
      usedInBand: Set<string>,
      preferredGender: BinaryProfileGender | null
    ) => {
      const candidates = staffPool.filter(
        (profileId) =>
          !usedInBand.has(profileId) &&
          !isPerformerInBand(bandId, profileId) &&
          !hasOverlappingAssignment(bandId, bandSlots, profileId)
      );
      const currentProfileIds = new Set(assignmentsByBandRole[bandId]?.[role]?.profileIds ?? []);

      if (candidates.length === 0) return "";

      candidates.sort((a, b) => {
        const diff = (assignmentCounts.get(a) ?? 0) - (assignmentCounts.get(b) ?? 0);
        if (diff !== 0) return diff;
        if (preferredGender) {
          const aMatches = profileGenders[a] === preferredGender;
          const bMatches = profileGenders[b] === preferredGender;
          if (aMatches !== bMatches) return aMatches ? -1 : 1;
        }
        const aIsCurrent = currentProfileIds.has(a);
        const bIsCurrent = currentProfileIds.has(b);
        if (aIsCurrent !== bIsCurrent) return aIsCurrent ? 1 : -1;
        if (lastAssigned === a) return 1;
        if (lastAssigned === b) return -1;
        return (randomRankByProfileId.get(a) ?? Number.MAX_SAFE_INTEGER) -
          (randomRankByProfileId.get(b) ?? Number.MAX_SAFE_INTEGER);
      });

      const chosen = candidates[0];
      assignmentCounts.set(chosen, (assignmentCounts.get(chosen) ?? 0) + 1);
      lastAssigned = chosen;
      usedInBand.add(chosen);
      return chosen;
    };

    for (const band of bandItems) {
      const usedInBand = new Set<string>();
      const bandRoleOptions = autoAssignRoleOptionsMap.get(band.bandId) ?? roleOptions;
      const preferredGender = preferredGenderByBand.get(band.bandId) ?? null;

      if (department === "pa" && !bandRoleOptions.some((role) => role.value === "pa_extra")) {
        const clearExtraResult = await applyBandRoleAssignment(
          nextAssignments,
          band.slots.map((slot) => slot.id),
          "pa_extra",
          ""
        );

        if (!clearExtraResult.ok) {
          await fetchAssignments(managedSlotIds);
          setAutoAssigning(false);
          toast.error("自動割当の途中で保存に失敗しました。");
          return;
        }

        nextAssignments = clearExtraResult.nextAssignments;
      }

      const bandPlans = bandRoleOptions.map((role) => ({
        role: role.value,
        profileId: pickStaff(band.bandId, band.slots, role.value, usedInBand, preferredGender),
      }));

      for (const plan of bandPlans) {
        const result = await applyBandRoleAssignment(
          nextAssignments,
          band.slots.map((slot) => slot.id),
          plan.role,
          plan.profileId
        );

        if (!result.ok) {
          await fetchAssignments(managedSlotIds);
          setAutoAssigning(false);
          toast.error("自動割当の途中で保存に失敗しました。");
          return;
        }

        nextAssignments = result.nextAssignments;
      }
    }

    setStaffAssignments(nextAssignments);
    setAssignmentDrafts({});
    setAutoAssigning(false);
    toast.success("自動割当を実行しました。");
  };

  if (roleLoading || loading) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-background">
          <SideNav />
          <main className="flex-1 md:ml-20">
            <PageHeader
              kicker={config.kicker}
              title={config.title}
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
              kicker={config.kicker}
              title={config.title}
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
            kicker={config.kicker}
            title={config.title}
            description={config.note}
            backHref={`/admin/events/${eventId}`}
            backLabel="イベント編集"
          />

          <div className="container mx-auto px-4 sm:px-6">
            <div className="grid w-full max-w-md grid-cols-2 rounded-lg bg-muted p-[3px] sm:inline-grid sm:w-auto">
              <Link
                href={`/admin/events/${eventId}/shift?department=pa`}
                className={`flex min-w-0 items-center justify-center rounded-md px-3 py-1 text-center text-sm font-medium whitespace-nowrap transition-colors ${
                  department === "pa"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                PAシフト
              </Link>
              <Link
                href={`/admin/events/${eventId}/shift?department=lighting`}
                className={`flex min-w-0 items-center justify-center rounded-md px-3 py-1 text-center text-sm font-medium whitespace-nowrap transition-colors ${
                  department === "lighting"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                照明シフト
              </Link>
            </div>
          </div>

          <section className="flex-1 py-6 md:py-8">
            <div className="container mx-auto px-4 sm:px-6 flex flex-col gap-6">
              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">イベント情報</CardTitle>
                    <CardDescription>
                      {event?.name ?? "イベント"} {event?.date ? `(${event.date})` : ""}
                      {(event?.open_time || event?.start_time) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {event.open_time ? `集合 ${formatTimeText(event.open_time) ?? event.open_time}` : ""}
                          {event.open_time && event.start_time ? " / " : ""}
                          {event.start_time ? `開演 ${formatTimeText(event.start_time) ?? event.start_time}` : ""}
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
                  <span>{config.note}</span>
                  <Badge variant="outline" className="h-6 px-2 text-[10px]">
                    バンド {bandItems.length}
                  </Badge>
                  <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                    配置済み {assignedBandRoleCount}/{totalBandRoleCount}
                  </Badge>
                  {incompleteBandCount > 0 ? (
                    <Badge variant="outline" className="h-6 px-2 text-[10px]">
                      未完了 {incompleteBandCount}
                    </Badge>
                  ) : null}
                  {mismatchedBandCount > 0 ? (
                    <Badge variant="outline" className="h-6 px-2 text-[10px]">
                      枠差異 {mismatchedBandCount}
                    </Badge>
                  ) : null}
                  {bandMembersLoadError ? (
                    <span className="text-destructive">{bandMembersLoadError}</span>
                  ) : null}
                  {!shiftUnlocked ? (
                    <>
                      <span>TT編集中でもシフトを組めます。枠を変えた後は割当を見直してください。</span>
                      <Link href={`/admin/events/${eventId}/tt/edit`} className="text-primary hover:underline">
                        TT編集へ
                      </Link>
                    </>
                  ) : null}
                </CardContent>
              </Card>

              {false ? (
              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">TT</CardTitle>
                    <CardDescription>このイベントのタイムテーブルを同じ画面で確認できます。</CardDescription>
                  </div>
                  <Link
                    href={`/admin/events/${eventId}/tt/edit`}
                    className="text-sm text-primary hover:underline"
                  >
                    TT編集へ
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="h-6 px-2 text-[10px]">
                      全 {orderedSlots.length} 枠
                    </Badge>
                    <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                      バンド {bandItems.length}
                    </Badge>
                  </div>
                  {orderedSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">TT がまだ設定されていません。</p>
                  ) : (
                    <div className="rounded-lg border border-border/60">
                      {orderedSlots.map((slot, index) => {
                        const note = slot.note?.trim() ?? "";
                        const slotTitle =
                          slot.slot_type === "band" && slot.band_id
                            ? bandNameMap.get(slot.band_id) ?? "未設定バンド"
                            : slot.slot_type === "break" || note.includes("転換")
                              ? "転換"
                              : note || "付帯作業";
                        const detailText =
                          note && slot.slot_type === "band" ? note : note && note !== slotTitle ? note : "";

                        return (
                          <div
                            key={slot.id}
                            className={`flex flex-col gap-2 px-3 py-3 ${
                              index > 0 ? "border-t border-border/60" : ""
                            }`}
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium tabular-nums text-foreground">
                                  {slotTimeLabel(slot)}
                                </span>
                                <Badge variant={slot.slot_type === "band" ? "default" : "outline"}>
                                  {slotTypeLabel(slot)}
                                </Badge>
                                <Badge variant="outline">{phaseLabel(slot.slot_phase)}</Badge>
                              </div>
                              <div className="text-sm font-medium text-foreground">{slotTitle}</div>
                            </div>
                            {detailText ? (
                              <p className="text-xs text-muted-foreground">{detailText}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
              ) : null}

              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <div>
                    <CardTitle className="text-lg">{config.staffTitle.replace("スタッフ", "")}稼働集計</CardTitle>
                    <CardDescription>誰が何枠担当しているかを一覧できます。</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {staffShiftSummaries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">まだ集計できるスタッフがいません。</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-muted/30 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">スタッフ</th>
                            <th className="px-3 py-2 text-right font-medium">合計枠</th>
                            <th className="px-3 py-2 text-right font-medium">バンド数</th>
                            <th className="px-3 py-2 text-right font-medium">リハ</th>
                            <th className="px-3 py-2 text-right font-medium">本番</th>
                            <th className="px-3 py-2 text-left font-medium">役割内訳</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffShiftSummaries.map((item) => (
                            <tr key={item.staffId} className="border-t border-border/50">
                              <td className="px-3 py-2">
                                <div className="font-medium text-foreground">{item.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  入学年度: {profileEnrollmentYears[item.profileId] ?? "-"}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{item.totalCount}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{item.bandCount}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{item.rehearsalCount}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{item.showCount}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {item.roleSummary || "未割当"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">{config.staffTitle}</CardTitle>
                    <CardDescription>{config.staffDescription}</CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-4 h-4" />
                    {department === "pa" ? "PAL / Admin" : "LL / Admin"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleAddStaff} className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-muted-foreground">
                      お手伝いメンバー
                        <select
                          className="mt-1 h-9 w-full sm:min-w-[220px] rounded-md border border-input bg-card px-2 text-xs text-foreground"
                          value={staffForm.profileId}
                          onChange={(selectEvent) => setStaffForm({ profileId: selectEvent.target.value })}
                          disabled={!canManageStaff}
                        >
                        <option value="">選択してください</option>
                        {helperOptions.length > 0 && (
                          <optgroup label="手伝いメンバー">
                            {helperOptions.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profileDisplayName(profile)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </label>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!staffForm.profileId || savingStaff || !canManageStaff}
                    >
                      {savingStaff ? <RefreshCw className="w-4 h-4 animate-spin" /> : "追加"}
                    </Button>
                  </form>

                  {syncingPerformers ? (
                    <p className="text-xs text-muted-foreground">出演メンバーを自動追加中です...</p>
                  ) : null}

                  {departmentStaffOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{config.staffTitle}が未登録です。</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {departmentStaffOptions.map((staff) => {
                        const profile = profileMap.get(staff.profile_id);
                        const isPerformer = performerIds.has(staff.profile_id);
                        return (
                          <span
                            key={staff.id}
                            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
                          >
                            {profileDisplayName(profile)}
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
                              disabled={!canManageStaff || isPerformer}
                              aria-label="削除"
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

              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">{config.staffTitle.replace("スタッフ", "")}シフト割当</CardTitle>
                    <CardDescription>
                      バンド単位で管理します。TT編集中でも割当できます。更新すると対象バンドのリハと本番を同じ担当に揃えます。自動割当は担当数を均しつつ、性別情報が入っている場合は同数時に同性を優先します。PA3 は手動で任意追加でき、自動割当では 8 人以上のバンドだけ対象にします。
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleExportShiftList}
                      disabled={bandItems.length === 0}
                    >
                      <Download className="w-4 h-4" />
                      Excel出力
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAutoAssign}
                      disabled={!canManageAssignments || autoAssigning}
                    >
                      {autoAssigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : "自動割当"}
                    </Button>
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {event?.date ?? "日程未登録"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bandItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">TT にバンド枠がまだありません。</p>
                  ) : (
                    bandItems.map((band) => {
                      const completedRoleCount = summaryRoleOptions.filter((role) => {
                        const summary = assignmentsByBandRole[band.bandId]?.[role.value];
                        return Boolean(summary && summary.assignedSlotCount === band.slots.length);
                      }).length;
                      const hasBandAssignments = roleOptions.some((role) => {
                        const summary = assignmentsByBandRole[band.bandId]?.[role.value];
                        return Boolean(summary && summary.assignedSlotCount > 0);
                      });
                      const bandMismatchCount = summaryRoleOptions.filter((role) => {
                        const summary = assignmentsByBandRole[band.bandId]?.[role.value];
                        return (summary?.profileIds.length ?? 0) > 1;
                      }).length;

                      return (
                        <div key={band.bandId} className="rounded-xl border border-border/70 bg-background/60 p-4 space-y-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold text-foreground">{band.bandName}</h3>
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                  配置 {completedRoleCount}/{summaryRoleOptions.length}
                                </Badge>
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                  メンバー {band.memberCount}
                                </Badge>
                                {department === "pa" && band.memberCount >= BIG_BAND_MEMBER_THRESHOLD ? (
                                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                    自動PA3対象
                                  </Badge>
                                ) : null}
                                {bandMismatchCount > 0 ? (
                                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                    枠差異 {bandMismatchCount}
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {band.slots.map((slot) => (
                                  <Badge key={slot.id} variant="outline" className="h-5 px-1.5 text-[10px]">
                                    {phaseLabel(slot.slot_phase)} {slotTimeLabel(slot)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleResetBandAssignments(band.bandId)}
                                disabled={!canManageAssignments || savingAssignments || !hasBandAssignments}
                              >
                                このバンドをリセット
                              </Button>
                            </div>
                          </div>

                          <div
                            className={
                              department === "pa"
                                ? "grid gap-3 md:grid-cols-3"
                                : "grid gap-3 md:grid-cols-2 xl:grid-cols-4"
                            }
                          >
                              {roleOptions.map((role) => {
                                const summary = assignmentsByBandRole[band.bandId]?.[role.value] ?? {
                                  profileIds: [],
                                  assignedSlotCount: 0,
                                };
                              const draftKey = `${band.bandId}:${role.value}`;
                              const currentValue = summary.profileIds.length === 1 ? summary.profileIds[0] : "";
                              const draftValue = assignmentDrafts[draftKey] ?? currentValue;
                              const hasMismatch = summary.profileIds.length > 1;
                              const isFullyAssigned = summary.assignedSlotCount === band.slots.length;
                              const canSaveDraft = Boolean(
                                draftValue &&
                                  (!isFullyAssigned || hasMismatch || draftValue !== currentValue)
                              );

                              return (
                                <div key={role.value} className="rounded-lg border border-border/60 p-3 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {role.label}
                                    </span>
                                    {hasMismatch ? (
                                      <Badge variant="outline">枠差異</Badge>
                                    ) : isFullyAssigned ? (
                                      <Badge variant="secondary">割当済み</Badge>
                                    ) : summary.assignedSlotCount > 0 ? (
                                      <Badge variant="outline">一部割当</Badge>
                                    ) : (
                                      <Badge variant="outline">未割当</Badge>
                                    )}
                                  </div>

                                  {summary.profileIds.length > 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                      現在:{" "}
                                      {summary.profileIds.map((profileId) => displayProfileName(profileId)).join(" / ")}
                                    </p>
                                  ) : null}

                                  <div className="flex flex-wrap items-center gap-2">
                                    <select
                                      className="h-9 flex-1 min-w-[180px] rounded-md border border-input bg-card px-2 text-xs text-foreground"
                                      value={draftValue}
                                      onChange={(selectEvent) =>
                                        setAssignmentDrafts((prev) => ({
                                          ...prev,
                                          [draftKey]: selectEvent.target.value,
                                        }))
                                      }
                                      disabled={!canManageAssignments}
                                    >
                                      <option value="">未割当</option>
                                      {departmentStaffOptions
                                        .filter((staff) => !isPerformerInBand(band.bandId, staff.profile_id))
                                        .map((staff) => {
                                        const profile = profileMap.get(staff.profile_id);
                                        return (
                                          <option
                                            key={staff.id}
                                            value={staff.profile_id}
                                          >
                                            {profileDisplayName(profile)}
                                          </option>
                                        );
                                      })}
                                    </select>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => handleSetBandAssignment(band.bandId, role.value, draftValue)}
                                      disabled={
                                        !canManageAssignments || savingAssignments || !canSaveDraft
                                      }
                                    >
                                      更新
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSetBandAssignment(band.bandId, role.value, "")}
                                      disabled={
                                        !canManageAssignments ||
                                        savingAssignments ||
                                        (summary.profileIds.length === 0 && summary.assignedSlotCount === 0)
                                      }
                                    >
                                      解除
                                    </Button>
                                  </div>

                                  {hasMismatch ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      更新すると、このバンドのリハと本番を同じ担当に揃えます。
                                    </p>
                                  ) : summary.assignedSlotCount > 0 && summary.assignedSlotCount < band.slots.length ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      同じ担当を残りの枠にも適用できます。
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
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
