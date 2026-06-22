"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Clock,
  Download,
  Lightbulb,
  MapPin,
  Monitor,
  Printer,
} from "@/lib/icons";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { formatTimeText } from "@/lib/time";
import { getDepartmentConfig, type DepartmentKey } from "@/lib/departments";
import {
  getTimetableTone,
  TIMETABLE_LEGEND_ITEMS,
  TIMETABLE_TONE_STYLES,
} from "@/lib/timetableTone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstructionPanel } from "@/components/instructions/InstructionPanel";
import { instructionTheme, type InstructionRole } from "@/components/instructions/theme";
import { phaseLabel, slotTimeLabel } from "@/components/instructions/helpers";
import { DepartmentBandSubmissionDetail } from "@/components/department/DepartmentBandSubmissionDetail";
import {
  STATIC_STAGE_MARKERS,
  applyStagePlotAssignments,
  applyStagePlotMemberPositions,
  readStagePlotData,
} from "@/lib/stagePlot";
import { downloadShiftStaffExcel } from "@/lib/shiftStaffExport";
import {
  BandMemberDetail,
  InstructionProfileRow,
  SongRow,
  SlotStaffAssignmentRow,
  StageItem,
  StageMember,
  StagePlot,
} from "@/app/types/instructions";

type EventRow = {
  id: string;
  name: string;
  date: string;
  status: string;
  venue: string | null;
  assembly_time: string | null;
  open_time: string | null;
  start_time: string | null;
};

type SlotRow = {
  id: string;
  event_id: string;
  band_id: string | null;
  slot_type: "band" | "break" | "mc" | "other";
  slot_phase: "show" | "rehearsal_normal" | "rehearsal_pre" | null;
  order_in_event: number | null;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  bands?: { id: string; name: string } | null;
};

type BandRow = {
  id: string;
  name: string;
  repertoire_status: string | null;
  representative_name: string | null;
  general_note: string | null;
  sound_note: string | null;
  lighting_note: string | null;
  lighting_total_min: number | null;
  stage_plot_data?: Record<string, unknown> | null;
};

type BandMemberQueryRow = {
  id: string;
  band_id: string;
  instrument: string | null;
  position_x: number | null;
  position_y: number | null;
  is_mc: boolean | null;
  monitor_request: string | null;
  monitor_note: string | null;
  order_index: number | null;
  profiles?: { display_name: string | null; real_name: string | null; part: string | null } | null;
};

const dateLabel = (value: string | null) => (value ? value.slice(0, 10) : "");
const clampPercent = (value: number) => Math.min(95, Math.max(5, value));
const clampPrintStagePercent = (value: number) =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 50));
const hasText = (value: string | null | undefined) => Boolean(value?.trim());
const printText = (value: string | null | undefined) => (hasText(value) ? value!.trim() : "-");
const PA_SHIFT_ROLES = [
  { value: "pa_main", label: "PA1" },
  { value: "pa_sub", label: "PA2" },
  { value: "pa_extra", label: "PA3" },
] as const;
const LIGHTING_SHIFT_ROLES = [
  { value: "light_op1", label: "卓操作①" },
  { value: "light_op2", label: "卓操作②" },
  { value: "light_spot", label: "スポット" },
  { value: "light_assist", label: "補助" },
] as const;

const slotTypeLabel = (slot: SlotRow) => {
  if (slot.slot_type === "band") return "バンド";
  const note = slot.note?.trim() ?? "";
  if (slot.slot_type === "break" || note.includes("転換")) return "転換";
  if (slot.slot_type === "mc") return "付帯作業";
  return "付帯作業";
};

const slotDisplayLabel = (slot: SlotRow) => {
  if (slot.slot_type === "band") {
    return slot.bands?.name ?? "バンド";
  }
  const note = slot.note?.trim() ?? "";
  if (slot.slot_type === "break" || note.includes("転換")) return "転換";
  if (slot.slot_type === "mc") return "付帯作業";
  return note || "付帯作業";
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

const songTitle = (song: SongRow) =>
  song.title?.trim() || (song.entry_type === "mc" ? "MC" : "未入力");

const formatDuration = (seconds: number | null) => {
  if (seconds == null) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const formatLightingChoice = (value: string | null) => {
  if (!value) return "-";
  if (value === "o") return "あり";
  if (value === "x") return "なし";
  if (value === "auto") return "おまかせ";
  return value;
};

const hasLightingCue = (song: SongRow) =>
  Boolean(song.lighting_spot || song.lighting_strobe || song.lighting_moving || song.lighting_color);

const formatLightingSummary = (song: SongRow) => {
  const parts: string[] = [];
  if (song.lighting_spot) parts.push(`Spot:${formatLightingChoice(song.lighting_spot)}`);
  if (song.lighting_strobe) parts.push(`Strobe:${formatLightingChoice(song.lighting_strobe)}`);
  if (song.lighting_moving) parts.push(`Moving:${formatLightingChoice(song.lighting_moving)}`);
  if (hasText(song.lighting_color)) parts.push(`Color:${song.lighting_color!.trim()}`);
  return parts.length > 0 ? parts.join(" / ") : "-";
};

const waitForPrintLayout = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

export function DepartmentEventDetailPage({
  department,
  layout = "default",
}: {
  department: DepartmentKey;
  layout?: "default" | "shift";
}) {
  const config = getDepartmentConfig(department);
  const role: InstructionRole = department === "pa" ? "pa" : "lighting";
  const theme = instructionTheme[role];
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const eventId = (params?.id as string | undefined) ?? "";
  const targetBandId = searchParams?.get("bandId") ?? null;
  const isShiftOverview = layout === "shift";

  const [event, setEvent] = useState<EventRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [bandMembers, setBandMembers] = useState<BandMemberQueryRow[]>([]);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [slotStaffAssignments, setSlotStaffAssignments] = useState<SlotStaffAssignmentRow[]>([]);
  const [instructionProfiles, setInstructionProfiles] = useState<InstructionProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualSelectedBandId, setManualSelectedBandId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"detail" | "timeline">("detail");
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [eventRes, slotsRes, bandsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, status, venue, assembly_time, open_time, start_time")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("event_slots")
          .select(
            "id, event_id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, note, bands(id, name)"
          )
          .eq("event_id", eventId)
          .order("order_in_event", { ascending: true }),
        supabase
          .from("bands")
          .select(
            "id, name, repertoire_status, representative_name, general_note, sound_note, lighting_note, lighting_total_min, stage_plot_data"
          )
          .eq("event_id", eventId)
          .eq("band_type", "event"),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        toast.error("イベント情報の取得に失敗しました。");
        setLoading(false);
        return;
      }
      if (slotsRes.error || bandsRes.error) {
        console.error(slotsRes.error ?? bandsRes.error);
        toast.error("イベント詳細の取得に失敗しました。");
        setLoading(false);
        return;
      }

      setEvent(eventRes.data as EventRow);

      type SlotResponse = Omit<SlotRow, "bands"> & {
        bands: { id: string; name: string } | { id: string; name: string }[] | null;
      };

      const slotList = (slotsRes.data ?? []).map((slot: SlotResponse) => ({
        ...slot,
        bands: Array.isArray(slot.bands) ? slot.bands[0] : slot.bands,
      })) as SlotRow[];
      setSlots(slotList);
      const slotIds = slotList.map((slot) => slot.id).filter(Boolean);

      const bandList = (bandsRes.data ?? []) as BandRow[];
      setBands(bandList);

      const bandIds = bandList.map((band) => band.id);
      if (bandIds.length === 0) {
        setBandMembers([]);
        setSongs([]);
        setSlotStaffAssignments([]);
        setInstructionProfiles([]);
        setLoading(false);
        return;
      }

      const assignmentsPromise =
        slotIds.length > 0
          ? supabase
              .from("slot_staff_assignments")
              .select("id, event_slot_id, profile_id, role")
              .in("event_slot_id", slotIds)
          : Promise.resolve({ data: [], error: null });

      const [membersRes, songsRes, assignmentsRes] = await Promise.all([
        supabase
          .from("band_members")
          .select(
            "id, band_id, instrument, position_x, position_y, is_mc, monitor_request, monitor_note, order_index, profiles(display_name, real_name, part)"
          )
          .in("band_id", bandIds),
        supabase
          .from("songs")
          .select(
            "id, band_id, title, artist, entry_type, url, order_index, duration_sec, arrangement_note, lighting_spot, lighting_strobe, lighting_moving, lighting_color, memo, created_at"
          )
          .in("band_id", bandIds)
          .order("order_index", { ascending: true }),
        assignmentsPromise,
      ]);

      if (cancelled) return;
      if (membersRes.error || songsRes.error || assignmentsRes.error) {
        console.error(membersRes.error ?? songsRes.error ?? assignmentsRes.error);
        toast.error("イベント詳細の取得に失敗しました。");
        setLoading(false);
        return;
      }

      type MemberResponse = Omit<BandMemberQueryRow, "profiles"> & {
        profiles: BandMemberQueryRow["profiles"] | BandMemberQueryRow["profiles"][] | null;
      };

      setBandMembers(
        (membersRes.data ?? []).map((member: MemberResponse) => ({
          ...member,
          profiles: Array.isArray(member.profiles) ? member.profiles[0] : member.profiles,
        })) as BandMemberQueryRow[]
      );
      setSongs((songsRes.data ?? []) as SongRow[]);

      const assignmentData = (assignmentsRes.data ?? []) as SlotStaffAssignmentRow[];
      setSlotStaffAssignments(assignmentData);

      const profileIds = Array.from(
        new Set(assignmentData.map((assignment) => assignment.profile_id).filter(Boolean))
      );

      if (profileIds.length > 0) {
        const [profilesRes, enrollmentYearsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name, real_name")
            .in("id", profileIds),
          supabase
            .from("profile_private")
            .select("profile_id, enrollment_year")
            .in("profile_id", profileIds),
        ]);

        if (!cancelled) {
          if (profilesRes.error) {
            console.error(profilesRes.error);
            setInstructionProfiles([]);
          } else {
            if (enrollmentYearsRes.error) {
              console.error(enrollmentYearsRes.error);
            }
            const enrollmentYearByProfileId = new Map<string, number | null>();
            if (!enrollmentYearsRes.error) {
              (enrollmentYearsRes.data ?? []).forEach(
                (row: { profile_id?: string | null; enrollment_year?: number | null }) => {
                  if (!row.profile_id) return;
                  enrollmentYearByProfileId.set(row.profile_id, row.enrollment_year ?? null);
                }
              );
            }
            setInstructionProfiles(
              ((profilesRes.data ?? []) as InstructionProfileRow[]).map((profile) => ({
                ...profile,
                enrollment_year: enrollmentYearByProfileId.get(profile.id) ?? null,
              }))
            );
          }
        }
      } else {
        setInstructionProfiles([]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const availableBandIds = useMemo(
    () =>
      slots
      .filter((slot) => slot.slot_type === "band" && Boolean(slot.band_id))
      .map((slot) => slot.band_id as string),
    [slots]
  );

  const selectedBandId = useMemo(() => {
    if (manualSelectedBandId && availableBandIds.includes(manualSelectedBandId)) {
      return manualSelectedBandId;
    }
    if (targetBandId && availableBandIds.includes(targetBandId)) return targetBandId;
    return availableBandIds[0] ?? null;
  }, [availableBandIds, manualSelectedBandId, targetBandId]);

  const bandsById = useMemo(
    () => Object.fromEntries(bands.map((band) => [band.id, band])),
    [bands]
  );

  const stagePlotsByBand = useMemo<Record<string, StagePlot[]>>(() => {
    const next: Record<string, StagePlot[]> = {};
    bands.forEach((band) => {
      next[band.id] = readStagePlotData<StageItem>(band.stage_plot_data).plots as StagePlot[];
    });
    return next;
  }, [bands]);

  const stageMembersByBand = useMemo<Record<string, StageMember[]>>(() => {
    const next: Record<string, StageMember[]> = {};
    const counters: Record<string, number> = {};

    bandMembers.forEach((row) => {
      const profile = row.profiles;
      const name = profile?.real_name ?? profile?.display_name ?? "名前未登録";
      const instrument = row.instrument ?? profile?.part ?? null;
      const count = counters[row.band_id] ?? 0;
      counters[row.band_id] = count + 1;
      const fallbackX = clampPercent(50 + ((count % 3) - 1) * 8);
      const fallbackY = clampPercent(60 + Math.floor(count / 3) * 8);

      if (!next[row.band_id]) next[row.band_id] = [];
      next[row.band_id].push({
        id: row.id,
        name,
        instrument,
        x: clampPercent(Number(row.position_x ?? fallbackX)),
        y: clampPercent(Number(row.position_y ?? fallbackY)),
        isMc: Boolean(row.is_mc),
      });
    });

    return next;
  }, [bandMembers]);

  const memberDetailsByBand = useMemo<Record<string, BandMemberDetail[]>>(() => {
    const next: Record<string, BandMemberDetail[]> = {};

    bandMembers.forEach((row) => {
      const profile = row.profiles;
      const name = profile?.real_name ?? profile?.display_name ?? "名前未登録";
      const instrument = row.instrument ?? profile?.part ?? null;
      if (!next[row.band_id]) next[row.band_id] = [];
      next[row.band_id].push({
        id: row.id,
        name,
        instrument,
        monitorRequest: row.monitor_request ?? null,
        monitorNote: row.monitor_note ?? null,
        isMc: Boolean(row.is_mc),
        orderIndex: row.order_index ?? null,
      });
    });

    Object.values(next).forEach((list) => {
      list.sort((a, b) => {
        const orderA = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, "ja");
      });
    });

    return next;
  }, [bandMembers]);

  const songsByBand = useMemo<Record<string, SongRow[]>>(() => {
    const next: Record<string, SongRow[]> = {};
    const stagePlotDataByBand = new Map(
      bands.map((band) => {
        const plotData = readStagePlotData<StageItem>(band.stage_plot_data);
        return [band.id, plotData] as const;
      })
    );

    songs.forEach((song) => {
      if (!next[song.band_id]) next[song.band_id] = [];
      next[song.band_id].push(song);
    });

    Object.values(next).forEach((list) => {
      list.sort((a, b) => {
        const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      });
    });

    Object.entries(next).forEach(([bandId, list]) => {
      const plotData = stagePlotDataByBand.get(bandId);
      if (!plotData) return;
      next[bandId] = applyStagePlotAssignments(
        list,
        plotData.plots,
        plotData.songPlotAssignments
      );
    });

    return next;
  }, [bands, songs]);

  const activeBand = selectedBandId ? bandsById[selectedBandId] : null;
  const activeBandSlots = useMemo(
    () =>
      activeBand
        ? slots.filter((slot) => slot.slot_type === "band" && slot.band_id === activeBand.id)
        : [],
    [activeBand, slots]
  );

  const activeMemberDetails = activeBand ? memberDetailsByBand[activeBand.id] ?? [] : [];
  const activeSongs = activeBand ? songsByBand[activeBand.id] ?? [] : [];
  const activeStagePlots = activeBand ? stagePlotsByBand[activeBand.id] ?? [] : [];
  const activeStageMembers = activeBand ? stageMembersByBand[activeBand.id] ?? [] : [];
  const shiftRoles = role === "pa" ? PA_SHIFT_ROLES : LIGHTING_SHIFT_ROLES;
  const summaryShiftRoles =
    role === "pa"
      ? PA_SHIFT_ROLES.filter((shiftRole) => shiftRole.value !== "pa_extra")
      : LIGHTING_SHIFT_ROLES;
  const requiredShiftRoleCount = summaryShiftRoles.length;
  const slotAssignmentsBySlot = useMemo<Record<string, SlotStaffAssignmentRow[]>>(() => {
    const next: Record<string, SlotStaffAssignmentRow[]> = {};
    slotStaffAssignments.forEach((assignment) => {
      if (!next[assignment.event_slot_id]) next[assignment.event_slot_id] = [];
      next[assignment.event_slot_id].push(assignment);
    });
    return next;
  }, [slotStaffAssignments]);
  const instructionProfilesById = useMemo<Record<string, InstructionProfileRow>>(() => {
    const next: Record<string, InstructionProfileRow> = {};
    instructionProfiles.forEach((profile) => {
      next[profile.id] = profile;
    });
    return next;
  }, [instructionProfiles]);
  const displayShiftProfileName = (profileId?: string | null) => {
    if (!profileId) return "未割当";
    const profile = instructionProfilesById[profileId];
    return profile?.real_name ?? profile?.display_name ?? "未割当";
  };
  const activeShiftAssignmentsBySlot = useMemo<Record<string, SlotStaffAssignmentRow[]>>(() => {
    const next: Record<string, SlotStaffAssignmentRow[]> = {};
    activeBandSlots.forEach((slot) => {
      next[slot.id] = slotAssignmentsBySlot[slot.id] ?? [];
    });
    return next;
  }, [activeBandSlots, slotAssignmentsBySlot]);
  const printBandContexts = useMemo(() => {
    const seenBandIds = new Set<string>();

    return availableBandIds.flatMap((bandId) => {
      if (seenBandIds.has(bandId)) return [];
      seenBandIds.add(bandId);

      const band = bandsById[bandId];
      if (!band) return [];

      const bandSlots = slots.filter((slot) => slot.slot_type === "band" && slot.band_id === band.id);
      const memberDetails = memberDetailsByBand[band.id] ?? [];
      const songs = songsByBand[band.id] ?? [];
      const stagePlots = stagePlotsByBand[band.id] ?? [];
      const stageMembers = stageMembersByBand[band.id] ?? [];
      const stagePlotNameById = Object.fromEntries(stagePlots.map((plot) => [plot.id, plot.name]));
      const printStagePlot =
        stagePlots.find((plot) => songs.some((song) => song.stagePlotId === plot.id)) ??
        stagePlots[0] ??
        null;
      const printStageMembers = printStagePlot
        ? applyStagePlotMemberPositions(stageMembers, printStagePlot.memberPositions)
        : stageMembers.map((member) => ({ ...member }));
      const shiftAssignmentsBySlotForBand = Object.fromEntries(
        bandSlots.map((slot) => [slot.id, slotAssignmentsBySlot[slot.id] ?? []])
      );
      const carryInEntries = memberDetails.filter((member) => hasText(member.monitorNote));
      const monitorEntries = memberDetails.filter((member) => hasText(member.monitorRequest));
      const songCount = songs.filter((song) => song.entry_type !== "mc").length;
      const mcCount = songs.length - songCount;

      return [
        {
          band,
          bandSlots,
          memberDetails,
          songs,
          stagePlots,
          stagePlotNameById,
          printStagePlot,
          printStageMembers,
          shiftAssignmentsBySlotForBand,
          carryInEntries,
          monitorEntries,
          songCount,
          mcCount,
          paMemoCount: songs.filter((song) => hasText(song.memo)).length,
          lightingCueCount: songs.filter(
            (song) => song.entry_type !== "mc" && hasLightingCue(song)
          ).length,
        },
      ];
    });
  }, [
    availableBandIds,
    bandsById,
    memberDetailsByBand,
    slotAssignmentsBySlot,
    slots,
    songsByBand,
    stageMembersByBand,
    stagePlotsByBand,
  ]);
  const bandShiftItems = useMemo(() => {
    const grouped = new Map<string, SlotRow[]>();

    slots.forEach((slot) => {
      if (slot.slot_type !== "band" || !slot.band_id) return;
      const current = grouped.get(slot.band_id) ?? [];
      current.push(slot);
      grouped.set(slot.band_id, current);
    });

    return Array.from(grouped.entries())
      .map(([bandId, bandSlots]) => {
        const assignments = shiftRoles.map((shiftRole) => {
          const profileIds = Array.from(
            new Set(
              bandSlots.flatMap((slot) =>
                (slotAssignmentsBySlot[slot.id] ?? [])
                  .filter((assignment) => assignment.role === shiftRole.value)
                  .map((assignment) => assignment.profile_id)
                  .filter((profileId): profileId is string => Boolean(profileId))
              )
            )
          );
          const assignedSlotCount = bandSlots.filter((slot) =>
            (slotAssignmentsBySlot[slot.id] ?? []).some(
              (assignment) => assignment.role === shiftRole.value
            )
          ).length;

          return {
            ...shiftRole,
            profileIds,
            assignedSlotCount,
          };
        });

        return {
          bandId,
          bandName: bandsById[bandId]?.name ?? bandSlots[0]?.bands?.name ?? "バンド",
          slots: [...bandSlots].sort((a, b) => {
            const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
          }),
          assignments,
          assignedShiftCount: assignments.filter(
            (assignment) =>
              summaryShiftRoles.some((shiftRole) => shiftRole.value === assignment.value) &&
              assignment.assignedSlotCount === bandSlots.length
          ).length,
          mismatchedShiftCount: assignments.filter((assignment) => assignment.profileIds.length > 1).length,
          orderInEvent: Math.min(...bandSlots.map((slot) => slot.order_in_event ?? Number.MAX_SAFE_INTEGER)),
        };
      })
      .sort((a, b) => {
        if (a.orderInEvent !== b.orderInEvent) return a.orderInEvent - b.orderInEvent;
        return a.bandName.localeCompare(b.bandName, "ja");
      });
  }, [bandsById, shiftRoles, slotAssignmentsBySlot, slots, summaryShiftRoles]);
  const incompleteShiftBandCount = bandShiftItems.filter(
    (item) => item.assignedShiftCount < requiredShiftRoleCount
  ).length;
  const mismatchedShiftBandCount = bandShiftItems.filter((item) => item.mismatchedShiftCount > 0).length;
  const fullyAssignedShiftRoleCount = bandShiftItems.reduce(
    (sum, item) => sum + item.assignedShiftCount,
    0
  );
  const totalShiftRoleCount = bandShiftItems.length * requiredShiftRoleCount;
  const timeTableBandCount = new Set(
    slots
      .filter((slot) => slot.slot_type === "band" && Boolean(slot.band_id))
      .map((slot) => slot.band_id as string)
  ).size;
  const buildEventHref = (bandId?: string | null, shift = false) => {
    const base = `/${department}/events/${eventId}${shift ? "/shift" : ""}`;
    return bandId ? `${base}?bandId=${bandId}` : base;
  };
  const handleSelectBand = (bandId: string | null) => {
    if (!bandId) return;
    setManualSelectedBandId(bandId);
    setMobileTab("detail");
  };
  const sidebarPanelClass = "xl:flex xl:h-full xl:min-h-0 xl:flex-col";
  const sidebarScrollableBodyClass = "xl:flex-1 xl:min-h-0 xl:overflow-y-auto";
  const handleExportShiftList = () => {
    const exportItems = [...bandShiftItems].sort((a, b) => {
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
      items: exportItems.map((item) => ({
        bandName: item.bandName,
        staffCells: item.assignments.map((assignment) => ({
          label: assignment.label,
          staff: assignment.profileIds.map((profileId) => ({
            name: displayShiftProfileName(profileId),
            enrollmentYear: instructionProfilesById[profileId]?.enrollment_year ?? null,
          })),
        })),
      })),
    }).catch((error) => {
      console.error(error);
      toast.error("Excel出力に失敗しました。");
    });
  };
  const fitPrintToOnePage = async () => {
    const sheets = Array.from(
      printAreaRef.current?.querySelectorAll<HTMLElement>(".department-print-sheet") ?? []
    );
    if (sheets.length === 0) return;

    sheets.forEach((sheet) => {
      sheet.style.setProperty("--department-print-scale", "1");
    });

    for (let i = 0; i < 4; i += 1) {
      await waitForPrintLayout();
      sheets.forEach((sheet) => {
        const content = sheet.querySelector<HTMLElement>(".department-print-fit-content");
        if (!content) return;
        const sheetWidth = sheet.clientWidth || 1;
        const sheetHeight = sheet.clientHeight || 1;
        const contentWidth = Math.max(content.scrollWidth, content.offsetWidth, 1);
        const contentHeight = Math.max(content.scrollHeight, content.offsetHeight, 1);
        const scale = Math.min(1, sheetWidth / contentWidth, sheetHeight / contentHeight);
        sheet.style.setProperty("--department-print-scale", String(Number(scale.toFixed(4))));
      });
    }
  };
  const handlePrintBandDetail = () => {
    if (printBandContexts.length === 0) {
      toast.error("印刷するバンドがありません。");
      return;
    }

    const previousPrintMode = document.body.dataset.printMode;
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (previousPrintMode) {
        document.body.dataset.printMode = previousPrintMode;
      } else {
        delete document.body.dataset.printMode;
      }
      printAreaRef.current
        ?.querySelectorAll<HTMLElement>(".department-print-sheet")
        .forEach((sheet) => sheet.style.removeProperty("--department-print-scale"));
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.dataset.printMode = "department-detail";
    window.addEventListener("afterprint", cleanup);
    void fitPrintToOnePage().then(() => {
      window.print();
      window.setTimeout(cleanup, 30000);
    });
  };

  const timeTablePanel = (
    <InstructionPanel
      title="タイムテーブル"
      role={role}
      icon={Calendar}
      compact
      description="バンド枠を選ぶと右側が切り替わります。"
      className={sidebarPanelClass}
      bodyClassName={sidebarScrollableBodyClass}
      headerRight={
        <Badge variant="outline" className={cn("h-5 text-[9px]", theme.chip)}>
          {timeTableBandCount} バンド
        </Badge>
      }
    >
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          {TIMETABLE_LEGEND_ITEMS.map((item) => (
            <span
              key={item.key}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5",
                TIMETABLE_TONE_STYLES[item.key].chipClass
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full", TIMETABLE_TONE_STYLES[item.key].barClass)}
              />
              {item.label}
            </span>
          ))}
        </div>
        {slots.map((slot) => {
          const isBand = slot.slot_type === "band" && slot.band_id;
          const isSelected = Boolean(isBand && slot.band_id === selectedBandId);
          const tone = getTimetableTone({
            slotType: slot.slot_type,
            slotPhase: slot.slot_phase,
            note: slot.note,
          });

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => isBand && handleSelectBand(slot.band_id)}
              className={cn(
                "relative w-full rounded-lg px-2.5 py-2 pl-5 text-left transition-colors",
                "before:absolute before:bottom-2 before:left-2 before:top-2 before:w-1 before:rounded-full before:content-['']",
                isBand ? "cursor-pointer hover:border-primary/40" : "cursor-default",
                tone.railClass,
                tone.cardClass,
                isSelected ? "border-primary ring-2 ring-primary/20" : ""
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {slotTimeLabel(slot)}
                </span>
                <Badge variant="outline" className={cn("h-4.5 px-1.5 text-[9px]", tone.badgeClass)}>
                  {phaseLabel(slot.slot_phase)}
                </Badge>
                <Badge
                  variant="outline"
                  className="h-4.5 px-1.5 text-[9px]"
                >
                  {slotTypeLabel(slot)}
                </Badge>
              </div>
              <div className="mt-1 text-[12px] font-semibold text-foreground">
                {slotDisplayLabel(slot)}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                {isSelected ? <span>選択中</span> : null}
              </div>
            </button>
          );
        })}
      </div>
    </InstructionPanel>
  );

  const shiftListPanel = (
    <InstructionPanel
      title={role === "pa" ? "PAシフト一覧" : "照明シフト一覧"}
      role={role}
      icon={role === "pa" ? Monitor : Lightbulb}
      compact
      description="バンドごとの担当を一覧しています。"
      headerRight={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px]"
            onClick={handleExportShiftList}
            disabled={bandShiftItems.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Excel出力
          </Button>
          <Badge variant="outline" className={cn("h-5 text-[9px]", theme.chip)}>
            {bandShiftItems.length} バンド
          </Badge>
        </div>
      }
    >
      {bandShiftItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/60 px-3 py-3 text-sm text-muted-foreground">
          シフト一覧はまだありません。
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                対象バンド
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">{bandShiftItems.length}</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        全枠割当済み役割
                      </div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {fullyAssignedShiftRoleCount} / {totalShiftRoleCount}
                      </div>
                    </div>
            <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                未割当あり
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">{incompleteShiftBandCount}</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                枠差異
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">{mismatchedShiftBandCount}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/70">
            <div
              className={cn(
                "hidden border-b border-border/70 bg-background/80 px-3 py-2 text-[11px] font-semibold text-muted-foreground md:grid",
                role === "pa"
                  ? "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_repeat(3,minmax(0,0.72fr))]"
                  : "md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_repeat(4,minmax(0,0.68fr))]"
              )}
            >
              <div>バンド</div>
              <div>リハ / 本番</div>
              {shiftRoles.map((shiftRole) => (
                <div key={`shift-head-${shiftRole.value}`}>{shiftRole.label}</div>
              ))}
            </div>

            <div className="divide-y divide-border/60">
              {bandShiftItems.map((item) => (
                <div
                  key={`shift-list-${item.bandId}`}
                  className={cn(
                    "px-3 py-3",
                    selectedBandId === item.bandId ? theme.accentSurfaceStrong : "bg-background/30"
                  )}
                >
                  <div
                    className={cn(
                      "grid gap-2.5",
                      role === "pa"
                        ? "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_repeat(3,minmax(0,0.72fr))]"
                        : "md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_repeat(4,minmax(0,0.68fr))]"
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="truncate text-sm font-semibold text-foreground">{item.bandName}</div>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[9px]">
                          {item.assignedShiftCount}/{requiredShiftRoleCount}
                        </Badge>
                        {item.mismatchedShiftCount > 0 ? (
                          <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
                            差異 {item.mismatchedShiftCount}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.assignedShiftCount < requiredShiftRoleCount ? "一部未割当あり" : "全役割割当済み"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {item.slots.map((slot) => (
                        <Badge
                          key={`shift-list-slot-${item.bandId}-${slot.id}`}
                          variant="outline"
                          className="h-5 px-1.5 text-[9px]"
                        >
                          {phaseLabel(slot.slot_phase)} {slotTimeLabel(slot)}
                        </Badge>
                      ))}
                    </div>

                    {item.assignments.map((assignment) => (
                      <div
                        key={`${item.bandId}-${assignment.value}`}
                        className="rounded-md border border-border/60 bg-card/60 px-2.5 py-2"
                      >
                        <div className="text-[10px] text-muted-foreground md:hidden">{assignment.label}</div>
                        <div className="truncate text-sm font-medium text-foreground">
                          {assignment.profileIds.length > 0
                            ? assignment.profileIds.map((profileId) => displayShiftProfileName(profileId)).join(" / ")
                            : "未割当"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </InstructionPanel>
  );
  const shiftOverviewCallout = !isShiftOverview ? (
    <section
      className={cn(
        "mb-3 rounded-xl border px-3 py-3 shadow-sm",
        theme.accentBorder,
        theme.accentSurfaceStrong
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {role === "pa" ? (
              <Monitor className="h-4 w-4 text-blue-700 dark:text-blue-300" />
            ) : (
              <Lightbulb className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            )}
            {role === "pa" ? "PAシフト一覧ページ" : "照明シフト一覧ページ"}
          </div>
          <p className="text-sm text-muted-foreground">
            バンドごとの担当を一覧で見たいときは専用ページを使えます。通常画面では TT と詳細に集中できます。
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={cn("h-5 px-1.5 text-[9px]", theme.chip)}>
              {bandShiftItems.length} バンド
            </Badge>
            <Badge variant="secondary" className="h-5 px-1.5 text-[9px]">
              全枠割当済み {fullyAssignedShiftRoleCount}/{totalShiftRoleCount}
            </Badge>
            {incompleteShiftBandCount > 0 ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
                未割当あり {incompleteShiftBandCount}
              </Badge>
            ) : null}
          </div>
        </div>

        <Link
          href={buildEventHref(selectedBandId, true)}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-background/90 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          {role === "pa" ? "PAシフト一覧を見る" : "照明シフト一覧を見る"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  ) : null;

  const renderBandDetailContent = () =>
    activeBand ? (
      <DepartmentBandSubmissionDetail
        eventId={eventId}
        role={role}
        label={config.label}
        noteTitle={config.noteTitle}
        band={activeBand}
        slots={activeBandSlots}
        memberDetails={activeMemberDetails}
        stageMembers={activeStageMembers}
        stagePlots={activeStagePlots}
        songs={activeSongs}
        slotAssignmentsBySlot={activeShiftAssignmentsBySlot}
        profilesById={instructionProfilesById}
      />
    ) : (
      <div className="rounded-xl border border-border/70 bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
        タイムテーブルからバンド枠を選択してください。
      </div>
    );
  const bandDetailContent = renderBandDetailContent();
  const renderPrintBandPage = (printBand: (typeof printBandContexts)[number]) => {
    const printStageMarkers = printBand.printStageMembers.some((member) => member.isMc)
      ? [...STATIC_STAGE_MARKERS, { id: "mc-area", label: "MC", x: 50, y: 75, kind: "monitor" as const }]
      : STATIC_STAGE_MARKERS;
    const stagePlotSection = (
      <section className="department-print-card">
        <h2>配置図</h2>
        <p className="department-print-stage-caption">
          {printBand.printStagePlot?.name ??
            (printBand.printStageMembers.length > 0 ? "配置図" : "-")}
        </p>
        <div className="department-print-stage-plot">
          {printBand.printStagePlot || printBand.printStageMembers.length > 0 ? (
            <>
              <span className="department-print-stage-axis department-print-stage-axis-back">
                舞台奥
              </span>
              <span className="department-print-stage-axis department-print-stage-axis-left">
                下手
              </span>
              <span className="department-print-stage-axis department-print-stage-axis-right">
                上手
              </span>
              <span className="department-print-stage-axis department-print-stage-axis-front">
                客席
              </span>
              {printStageMarkers.map((marker) => (
                <span
                  key={`print-stage-marker-${printBand.band.id}-${marker.id}`}
                  className={cn(
                    "department-print-stage-marker",
                    marker.kind === "main" && "department-print-stage-marker-main"
                  )}
                  style={{
                    left: `${clampPrintStagePercent(marker.x)}%`,
                    top: `${clampPrintStagePercent(marker.y)}%`,
                  }}
                >
                  {marker.label}
                </span>
              ))}
              {printBand.printStagePlot?.items.map((item) => (
                <span
                  key={`print-stage-item-${printBand.band.id}-${item.id}`}
                  className={cn(
                    "department-print-stage-item",
                    item.variant === "backline" || item.variant === "split-backline"
                      ? "department-print-stage-item-backline"
                      : "department-print-stage-item-circle",
                    item.dashed && "department-print-stage-item-dashed"
                  )}
                  style={{
                    left: `${clampPrintStagePercent(item.x)}%`,
                    top: `${clampPrintStagePercent(item.y)}%`,
                  }}
                >
                  {item.label}
                </span>
              ))}
              {printBand.printStageMembers.map((member) => (
                <span
                  key={`print-stage-member-${printBand.band.id}-${member.id}`}
                  className="department-print-stage-member"
                  style={{
                    left: `${clampPrintStagePercent(member.x)}%`,
                    top: `${clampPrintStagePercent(member.y)}%`,
                  }}
                >
                  <strong>{member.instrument || "Part"}</strong>
                  <em>{member.name}</em>
                  {member.isMc ? <b>MC</b> : null}
                </span>
              ))}
            </>
          ) : (
            <span className="department-print-stage-empty">配置データなし</span>
          )}
        </div>
      </section>
    );

    return (
      <div key={`department-print-sheet-${printBand.band.id}`} className="department-print-sheet">
        <div className="department-print-fit">
          <div className="department-print-fit-content">
            <article className="department-print-one-page">
              <header className="department-print-compact-header">
                <div>
                  <p className="department-print-kicker">{config.label} A4一枚</p>
                  <h1 className="department-print-title">{event?.name ?? config.noteTitle}</h1>
                  <p className="department-print-subtitle">{printBand.band.name}</p>
                </div>
                <dl className="department-print-meta">
                  <div>
                    <dt>日付</dt>
                    <dd>{dateLabel(event?.date ?? null) || "-"}</dd>
                  </div>
                  <div>
                    <dt>会場</dt>
                    <dd>{event?.venue ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>集合</dt>
                    <dd>
                      {event?.assembly_time
                        ? formatTimeText(event.assembly_time) ?? event.assembly_time
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>開場 / 開演</dt>
                    <dd>
                      {[
                        event?.open_time ? formatTimeText(event.open_time) ?? event.open_time : null,
                        event?.start_time ? formatTimeText(event.start_time) ?? event.start_time : null,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </dd>
                  </div>
                </dl>
              </header>

              <div className="department-print-stats">
                <span>代表者: {printText(printBand.band.representative_name)}</span>
                <span>枠: {printBand.bandSlots.length}</span>
                <span>メンバー: {printBand.memberDetails.length}</span>
                <span>
                  曲: {printBand.songCount} / MC: {printBand.mcCount}
                </span>
                <span>返し: {printBand.monitorEntries.length}</span>
                <span>持込: {printBand.carryInEntries.length}</span>
                <span>PAメモ: {printBand.paMemoCount}</span>
                <span>照明キュー: {printBand.lightingCueCount}</span>
                {printBand.band.lighting_total_min != null ? (
                  <span>照明打合せ: {printBand.band.lighting_total_min}分</span>
                ) : null}
              </div>

              <div className="department-print-columns">
                <div className="department-print-column">
                  <section className="department-print-card">
                    <h2>進行 / 打合せ</h2>
                    <table className="department-print-table">
                      <tbody>
                        {printBand.bandSlots.length === 0 ? (
                          <tr>
                            <td>バンド枠なし</td>
                          </tr>
                        ) : (
                          printBand.bandSlots.map((slot) => (
                            <tr key={`print-slot-${printBand.band.id}-${slot.id}`}>
                              <th>{phaseLabel(slot.slot_phase)}</th>
                              <td>{slotTimeLabel(slot)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </section>

                  <section className="department-print-card">
                    <h2>{role === "pa" ? "PAシフト" : "照明シフト"}</h2>
                    <table className="department-print-table">
                      <tbody>
                        {shiftRoles.map((shiftRole) => {
                          const profileIds = Array.from(
                            new Set(
                              printBand.bandSlots.flatMap((slot) =>
                                (printBand.shiftAssignmentsBySlotForBand[slot.id] ?? [])
                                  .filter((assignment) => assignment.role === shiftRole.value)
                                  .map((assignment) => assignment.profile_id)
                                  .filter((profileId): profileId is string => Boolean(profileId))
                              )
                            )
                          );

                          return (
                            <tr key={`print-shift-${printBand.band.id}-${shiftRole.value}`}>
                              <th>{shiftRole.label}</th>
                              <td>
                                {profileIds.length > 0
                                  ? profileIds.map((profileId) => displayShiftProfileName(profileId)).join(" / ")
                                  : "未割当"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>

                  <section className="department-print-card">
                    <h2>メンバー / 返し / 持込</h2>
                    <table className="department-print-table department-print-member-table">
                      <thead>
                        <tr>
                          <th>Part</th>
                          <th>名前</th>
                          <th>返し</th>
                          <th>持込</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printBand.memberDetails.length === 0 ? (
                          <tr>
                            <td colSpan={4}>メンバー情報なし</td>
                          </tr>
                        ) : (
                          printBand.memberDetails.map((member, index) => (
                            <tr key={`print-member-${printBand.band.id}-${member.id}`}>
                              <td>
                                {member.instrument || `Part ${index + 1}`}
                                {member.isMc ? " / MC" : ""}
                              </td>
                              <td>{member.name}</td>
                              <td>{printText(member.monitorRequest)}</td>
                              <td>{printText(member.monitorNote)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </section>
                </div>

                <div className="department-print-column">
                  {stagePlotSection}

                  <section className="department-print-card">
                    <h2>共通メモ</h2>
                    <p className="department-print-note">{printText(printBand.band.general_note)}</p>
                  </section>

                  <section className="department-print-card department-print-notes-grid">
                    <div>
                      <h2>PAへの指示</h2>
                      <p className="department-print-note">{printText(printBand.band.sound_note)}</p>
                    </div>
                    <div>
                      <h2>照明への指示</h2>
                      <p className="department-print-note">{printText(printBand.band.lighting_note)}</p>
                    </div>
                  </section>

                  <section className="department-print-card department-print-setlist-card">
                    <h2>セットリスト詳細</h2>
                    <table className="department-print-table department-print-setlist-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>曲 / MC</th>
                          <th>分</th>
                          <th>配置</th>
                          <th>補足</th>
                          <th>PA</th>
                          <th>照明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printBand.songs.length === 0 ? (
                          <tr>
                            <td colSpan={7}>セットリストなし</td>
                          </tr>
                        ) : (
                          printBand.songs.map((song, index) => {
                            const assignedPlotName =
                              song.stagePlotId && printBand.stagePlotNameById[song.stagePlotId]
                                ? printBand.stagePlotNameById[song.stagePlotId]
                                : printBand.stagePlots.length > 1
                                  ? "未指定"
                                  : printBand.stagePlots[0]?.name ?? "-";

                            return (
                              <tr key={`print-song-${printBand.band.id}-${song.id}`}>
                                <td>{index + 1}</td>
                                <td>
                                  <strong>{song.entry_type === "mc" ? "MC" : songTitle(song)}</strong>
                                  {hasText(song.artist) ? <span> / {song.artist!.trim()}</span> : null}
                                </td>
                                <td>{formatDuration(song.duration_sec)}</td>
                                <td>{assignedPlotName}</td>
                                <td>{printText(song.arrangement_note)}</td>
                                <td>{printText(song.memo)}</td>
                                <td>{formatLightingSummary(song)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </section>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20 xl:flex xl:h-screen xl:flex-col xl:overflow-hidden">
          <PageHeader
            kicker={config.label}
            title={
              isShiftOverview
                ? `${event?.name ?? config.noteTitle} ${role === "pa" ? "PAシフト一覧" : "照明シフト一覧"}`
                : event?.name ?? config.noteTitle
            }
            description={isShiftOverview ? "バンドごとの担当を全画面で確認できます。" : undefined}
            backHref={isShiftOverview ? buildEventHref(selectedBandId) : `/${department}`}
            backLabel={isShiftOverview ? `${config.label}詳細へ戻る` : `${config.label}ダッシュボードへ戻る`}
            tone={config.tone}
            size="sm"
            meta={
              event ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {dateLabel(event.date)}
                  </span>
                  {event.venue ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      {event.venue}
                    </span>
                  ) : null}
                  {event.assembly_time ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      集合 {formatTimeText(event.assembly_time) ?? event.assembly_time}
                    </span>
                  ) : null}
                  {event.open_time ? (
                    <span>開場 {formatTimeText(event.open_time) ?? event.open_time}</span>
                  ) : null}
                  {event.start_time ? (
                    <span>開演 {formatTimeText(event.start_time) ?? event.start_time}</span>
                  ) : null}
                </div>
              ) : null
            }
            actions={
              !isShiftOverview ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="print-hide"
                  onClick={handlePrintBandDetail}
                  disabled={printBandContexts.length === 0}
                >
                  <Printer className="h-4 w-4" />
                  全バンド A4印刷 / PDF
                </Button>
              ) : undefined
            }
          />

          <section className="pb-8 md:pb-12 xl:flex-1 xl:min-h-0 xl:overflow-hidden xl:pb-4">
            <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6 xl:flex xl:h-full xl:flex-col xl:px-5 2xl:px-6">
              {loading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  読み込み中...
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  タイムテーブルが設定されていません。
                </div>
              ) : isShiftOverview ? (
                <div className="pb-2">{shiftListPanel}</div>
              ) : (
                <>
                  {shiftOverviewCallout}

                  <Tabs
                    value={mobileTab}
                    onValueChange={(value) => setMobileTab(value as "detail" | "timeline")}
                    className="space-y-2.5 xl:hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          現在の表示
                        </div>
                        <div className="truncate text-sm font-semibold text-foreground">
                          {mobileTab === "detail" ? activeBand?.name ?? "バンド未選択" : "タイムテーブル"}
                        </div>
                      </div>
                      <TabsList className="grid h-8 w-full grid-cols-2 p-0.5 sm:w-auto sm:min-w-[180px]">
                        <TabsTrigger value="detail" className="h-7 px-2 text-[11px]">
                          詳細
                        </TabsTrigger>
                        <TabsTrigger value="timeline" className="h-7 px-2 text-[11px]">
                          タイムテーブル
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="detail" className="mt-0">
                      {bandDetailContent}
                    </TabsContent>
                    <TabsContent value="timeline" className="mt-0">
                      {timeTablePanel}
                    </TabsContent>
                  </Tabs>

                  <div className="hidden gap-3 xl:grid xl:min-h-0 xl:flex-1 xl:grid-cols-[248px_minmax(0,1fr)]">
                    <aside className="xl:min-h-0 xl:h-full">{timeTablePanel}</aside>
                    <div className="min-w-0 xl:min-h-0 xl:h-full">{bandDetailContent}</div>
                  </div>
                </>
              )}

              {!isShiftOverview && printBandContexts.length > 0 ? (
                <div ref={printAreaRef} className="department-print-area hidden" aria-hidden="true">
                  {printBandContexts.map((printBand) => renderPrintBandPage(printBand))}
                </div>
              ) : null}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
