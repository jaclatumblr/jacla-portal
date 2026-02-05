"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import type {
    EventRow,
    Band,
    ProfileOption,
    EventSlot,
    EventStaffMember,
    SlotStaffAssignment,
    BandMember,
    Song,
} from "../types";

type UseAdminEventDataResult = {
    loading: boolean;
    error: string | null;
    event: EventRow | null;
    bands: Band[];
    profiles: ProfileOption[];
    slots: EventSlot[];
    eventStaff: EventStaffMember[];
    staffAssignments: SlotStaffAssignment[];
    members: BandMember[];
    songs: Song[];
    refreshData: () => Promise<void>;
    setSlots: (slots: EventSlot[] | ((prev: EventSlot[]) => EventSlot[])) => void;
    setStaffAssignments: (
        assignments:
            | SlotStaffAssignment[]
            | ((prev: SlotStaffAssignment[]) => SlotStaffAssignment[])
    ) => void;
};

export function useAdminEventData(
    eventId: string,
    isAdmin: boolean,
    isAdministrator: boolean
): UseAdminEventDataResult {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [event, setEvent] = useState<EventRow | null>(null);
    const [bands, setBands] = useState<Band[]>([]);
    const [profiles, setProfiles] = useState<ProfileOption[]>([]);
    const [slots, setSlots] = useState<EventSlot[]>([]);
    const [eventStaff, setEventStaff] = useState<EventStaffMember[]>([]);
    const [staffAssignments, setStaffAssignments] = useState<SlotStaffAssignment[]>([]);
    const [members, setMembers] = useState<BandMember[]>([]);
    const [songs, setSongs] = useState<Song[]>([]);

    const refreshData = useCallback(async () => {
        if (!eventId || !isAdmin) return;
        setLoading(true);
        setError(null);

        try {
            const eventColumns =
                "id, name, date, status, event_type, repertoire_deadline, repertoire_is_closed, venue, assembly_time, open_time, start_time, rehearsal_start_time, end_time, note, default_changeover_min, tt_is_published, tt_is_provisional, normal_rehearsal_order";
            const fallbackColumns =
                "id, name, date, status, event_type, repertoire_deadline, repertoire_is_closed, venue, assembly_time, open_time, start_time, note, default_changeover_min, tt_is_published, tt_is_provisional, normal_rehearsal_order";
            const [eventRes, bandsRes, profilesRes, slotsRes, staffRes] = await Promise.all([
                supabase.from("events").select(eventColumns).eq("id", eventId).maybeSingle(),
                supabase
                    .from("bands")
                    .select("id, event_id, name, note_pa, note_lighting, stage_plot_data, created_by")
                    .eq("event_id", eventId)
                    .eq("band_type", "event")
                    .order("created_at", { ascending: true }),
                supabase.from("profiles").select("*").order("display_name", { ascending: true }),
                supabase
                    .from("event_slots")
                    .select(
                        "id, event_id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, changeover_min, note"
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
            let resolvedEvent = eventRes;
            if (resolvedEvent.error?.code === "42703") {
                const variants = [
                    eventColumns.replace(", end_time", ""),
                    eventColumns.replace(", rehearsal_start_time", ""),
                    fallbackColumns,
                ];
                for (const columns of variants) {
                    resolvedEvent = await supabase
                        .from("events")
                        .select(columns)
                        .eq("id", eventId)
                        .maybeSingle();
                    if (!resolvedEvent.error || resolvedEvent.error?.code !== "42703") {
                        break;
                    }
                }
            }

            if (resolvedEvent.error || !resolvedEvent.data) {
                throw new Error(resolvedEvent.error?.message || "event fetch failed");
            }

            setEvent(resolvedEvent.data as EventRow);
            const bandList = (bandsRes.data ?? []) as Band[];
            setBands(bandList);

            const profileList = (profilesRes.data ?? []).map((p: any) => ({
                id: p.id,
                display_name:
                    p.display_name ??
                    p.full_name ??
                    p.name ??
                    (isAdministrator ? p.email : null) ??
                    "名前未登録",
                email: isAdministrator ? p.email ?? null : null,
                discord: p.discord_username ?? p.discord ?? null,
                crew: p.crew ?? null,
            }));
            setProfiles(profileList);

            setSlots((slotsRes.data ?? []) as EventSlot[]);
            setEventStaff((staffRes.data ?? []) as EventStaffMember[]);

            // Assignments
            const slotIds = (slotsRes.data ?? []).map((s: any) => s.id).filter(Boolean);
            if (slotIds.length > 0) {
                const { data: assignData, error: assignError } = await supabase
                    .from("slot_staff_assignments")
                    .select("id, event_slot_id, profile_id, role, is_fixed, note")
                    .in("event_slot_id", slotIds);

                if (assignError) console.error(assignError);
                setStaffAssignments((assignData ?? []) as SlotStaffAssignment[]);
            } else {
                setStaffAssignments([]);
            }

            // Band details
            const bandIds = bandList.map((b) => b.id);
            if (bandIds.length > 0) {
                const [membersRes, songsRes] = await Promise.all([
                    supabase
                        .from("band_members")
                        .select("id, band_id, user_id, instrument")
                        .in("band_id", bandIds),
                    supabase
                        .from("songs")
                        .select(
                            "id, band_id, title, artist, entry_type, url, order_index, duration_sec, memo, created_at"
                        )
                        .in("band_id", bandIds)
                        .order("order_index", { ascending: true })
                        .order("created_at", { ascending: true }),
                ]);

                if (membersRes.error) console.error(membersRes.error);
                if (songsRes.error) console.error(songsRes.error);

                setMembers((membersRes.data ?? []) as BandMember[]);
                setSongs((songsRes.data ?? []) as Song[]);
            } else {
                setMembers([]);
                setSongs([]);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "データ取得エラー");
            toast.error("データの読み込みに失敗しました。");
        } finally {
            setLoading(false);
        }
    }, [eventId, isAdmin, isAdministrator]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    return {
        loading,
        error,
        event,
        bands,
        profiles,
        slots,
        eventStaff,
        staffAssignments,
        members,
        songs,
        refreshData,
        setSlots,
        setStaffAssignments,
    };
}
