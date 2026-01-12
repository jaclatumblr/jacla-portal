import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  EventRow,
  BandNoteRow,
  BandMemberRow,
  SongRow,
  EventGroup,
  StageItem,
  StageMember,
  BandMemberDetail,
  EventSlotRow,
  SlotStaffAssignmentRow,
  InstructionProfileRow,
} from "../types/instructions";

const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

const parseStageItems = (
  value: Record<string, unknown> | null | undefined
): StageItem[] => {
  const rawItems = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item, index) => {
      const entry = item as {
        id?: string;
        label?: string;
        dashed?: boolean;
        x?: number;
        y?: number;
      };
      if (!entry.label) return null;
      return {
        id: entry.id ?? `stage-${index}`,
        label: entry.label,
        dashed: Boolean(entry.dashed),
        x: clampPercent(Number(entry.x ?? 50)),
        y: clampPercent(Number(entry.y ?? 50)),
      } satisfies StageItem;
    })
    .filter(Boolean) as StageItem[];
};

export function useEventInstructions() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [bands, setBands] = useState<BandNoteRow[]>([]);
  const [bandMembers, setBandMembers] = useState<BandMemberRow[]>([]);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [eventSlots, setEventSlots] = useState<EventSlotRow[]>([]);
  const [slotAssignments, setSlotAssignments] = useState<SlotStaffAssignmentRow[]>([]);
  const [instructionProfiles, setInstructionProfiles] = useState<InstructionProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBands, setExpandedBands] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [eventsRes, bandsRes, membersRes, songsRes] = await Promise.all([
          supabase.from("events").select("id, name, date").order("date", { ascending: true }),
          supabase
            .from("bands")
            .select(
              "id, name, event_id, sound_note, lighting_note, general_note, repertoire_status, stage_plot_data"
            )
            .eq("band_type", "event")
            .order("created_at", { ascending: true }),
          supabase
            .from("band_members")
            .select(
              "id, band_id, instrument, position_x, position_y, is_mc, monitor_request, monitor_note, order_index, profiles(display_name, real_name, part)"
            )
            .order("created_at", { ascending: true }),
          supabase
            .from("songs")
            .select(
              "id, band_id, title, artist, entry_type, url, order_index, duration_sec, arrangement_note, lighting_spot, lighting_strobe, lighting_moving, lighting_color, memo, created_at"
            )
            .order("created_at", { ascending: true }),
        ]);

        if (cancelled) return;

        if (eventsRes.error || bandsRes.error || membersRes.error || songsRes.error) {
          console.error(
            eventsRes.error ?? bandsRes.error ?? membersRes.error ?? songsRes.error
          );
          setError("指示の取得に失敗しました。時間をおいて再度お試しください。");
          setEvents([]);
          setBands([]);
          setBandMembers([]);
          setSongs([]);
          setEventSlots([]);
          setSlotAssignments([]);
          setInstructionProfiles([]);
          setLoading(false);
          return;
        }

        const eventsData = (eventsRes.data ?? []) as EventRow[];
        const bandsData = (bandsRes.data ?? []) as BandNoteRow[];
        const membersData = (membersRes.data ?? []) as BandMemberRow[];
        const songsData = (songsRes.data ?? []) as SongRow[];

        setEvents(eventsData);
        setBands(bandsData);
        setBandMembers(membersData);
        setSongs(songsData);

        const eventIds = eventsData.map((event) => event.id).filter(Boolean);
        if (eventIds.length === 0) {
          setEventSlots([]);
          setSlotAssignments([]);
          setInstructionProfiles([]);
          setLoading(false);
          return;
        }

        const slotsRes = await supabase
          .from("event_slots")
          .select(
            "id, event_id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, note"
          )
          .in("event_id", eventIds)
          .order("order_in_event", { ascending: true })
          .order("start_time", { ascending: true });

        if (cancelled) return;

        if (slotsRes.error) {
          console.error(slotsRes.error);
          setError("シフト情報の取得に失敗しました。時間をおいて再度お試しください。");
          setEventSlots([]);
          setSlotAssignments([]);
          setInstructionProfiles([]);
          setLoading(false);
          return;
        }

        const slotsData = (slotsRes.data ?? []) as EventSlotRow[];
        setEventSlots(slotsData);

        const slotIds = slotsData.map((slot) => slot.id).filter(Boolean);
        if (slotIds.length === 0) {
          setSlotAssignments([]);
          setInstructionProfiles([]);
          setLoading(false);
          return;
        }

        const assignmentsRes = await supabase
          .from("slot_staff_assignments")
          .select("id, event_slot_id, profile_id, role")
          .in("event_slot_id", slotIds);

        if (cancelled) return;

        if (assignmentsRes.error) {
          console.error(assignmentsRes.error);
          setError("シフト情報の取得に失敗しました。時間をおいて再度お試しください。");
          setSlotAssignments([]);
          setInstructionProfiles([]);
          setLoading(false);
          return;
        }

        const assignmentData = (assignmentsRes.data ?? []) as SlotStaffAssignmentRow[];
        setSlotAssignments(assignmentData);

        const profileIds = Array.from(
          new Set(assignmentData.map((assignment) => assignment.profile_id).filter(Boolean))
        );
        if (profileIds.length === 0) {
          setInstructionProfiles([]);
          setLoading(false);
          return;
        }

        const profilesRes = await supabase
          .from("profiles")
          .select("id, display_name, real_name")
          .in("id", profileIds);

        if (cancelled) return;

        if (profilesRes.error) {
          console.error(profilesRes.error);
          setError("シフト情報の取得に失敗しました。時間をおいて再度お試しください。");
          setInstructionProfiles([]);
          setLoading(false);
          return;
        }

        setInstructionProfiles((profilesRes.data ?? []) as InstructionProfileRow[]);
        setLoading(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("指示の取得に失敗しました。時間をおいて再度お試しください。");
          setEvents([]);
          setBands([]);
          setBandMembers([]);
          setSongs([]);
          setEventSlots([]);
          setSlotAssignments([]);
          setInstructionProfiles([]);
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const groupedEvents = useMemo<EventGroup[]>(() => {
    const map = new Map<string, EventGroup>();
    events.forEach((event) => {
      map.set(event.id, { ...event, bands: [] });
    });
    bands.forEach((band) => {
      const entry = map.get(band.event_id);
      if (entry) entry.bands.push(band);
    });
    return Array.from(map.values()).map((group) => ({
      ...group,
      bands: group.bands.sort((a, b) => a.name.localeCompare(b.name, "ja")),
    }));
  }, [events, bands]);

  const stageItemsByBand = useMemo<Record<string, StageItem[]>>(() => {
    const next: Record<string, StageItem[]> = {};
    bands.forEach((band) => {
      next[band.id] = parseStageItems(band.stage_plot_data);
    });
    return next;
  }, [bands]);

  const bandMembersByBand = useMemo<Record<string, StageMember[]>>(() => {
    const next: Record<string, StageMember[]> = {};
    const counters: Record<string, number> = {};

    bandMembers.forEach((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null;
      const name = profile?.real_name ?? profile?.display_name ?? "名前未登録";
      const instrument = row.instrument ?? profile?.part ?? null;
      const count = counters[row.band_id] ?? 0;
      counters[row.band_id] = count + 1;
      const fallbackX = clampPercent(50 + ((count % 3) - 1) * 8);
      const fallbackY = clampPercent(60 + Math.floor(count / 3) * 8);
      const x = row.position_x ?? fallbackX;
      const y = row.position_y ?? fallbackY;
      if (!next[row.band_id]) next[row.band_id] = [];
      next[row.band_id].push({
        id: row.id,
        name,
        instrument,
        x: clampPercent(Number(x ?? 50)),
        y: clampPercent(Number(y ?? 50)),
        isMc: Boolean(row.is_mc),
      });
    });

    return next;
  }, [bandMembers]);

  const bandMemberDetailsByBand = useMemo<Record<string, BandMemberDetail[]>>(() => {
    const next: Record<string, BandMemberDetail[]> = {};
    bandMembers.forEach((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null;
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
    return next;
  }, [songs]);

  const slotsByEvent = useMemo<Record<string, EventSlotRow[]>>(() => {
    const next: Record<string, EventSlotRow[]> = {};
    eventSlots.forEach((slot) => {
      if (!next[slot.event_id]) next[slot.event_id] = [];
      next[slot.event_id].push(slot);
    });
    Object.values(next).forEach((list) => {
      list.sort((a, b) => {
        const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return (a.start_time ?? "").localeCompare(b.start_time ?? "");
      });
    });
    return next;
  }, [eventSlots]);

  const assignmentsBySlot = useMemo<Record<string, SlotStaffAssignmentRow[]>>(() => {
    const next: Record<string, SlotStaffAssignmentRow[]> = {};
    slotAssignments.forEach((assignment) => {
      if (!next[assignment.event_slot_id]) next[assignment.event_slot_id] = [];
      next[assignment.event_slot_id].push(assignment);
    });
    return next;
  }, [slotAssignments]);

  const profilesById = useMemo<Record<string, InstructionProfileRow>>(() => {
    const next: Record<string, InstructionProfileRow> = {};
    instructionProfiles.forEach((profile) => {
      next[profile.id] = profile;
    });
    return next;
  }, [instructionProfiles]);

  const toggleBand = (bandId: string) => {
    setExpandedBands((prev) => ({ ...prev, [bandId]: !prev[bandId] }));
  };

  return {
    loading,
    error,
    groupedEvents,
    stageItemsByBand,
    bandMembersByBand,
    bandMemberDetailsByBand,
    songsByBand,
    slotsByEvent,
    assignmentsBySlot,
    profilesById,
    toggleBand,
    expandedBands,
  };
}
