"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import type { EventRow, EventBandSummary } from "../types";

type UseEventBandsResult = {
    events: EventRow[];
    selectedEventId: string;
    setSelectedEventId: (id: string) => void;
    selectedEvent: EventRow | null;
    eventBands: EventBandSummary[];
    loading: boolean;
    refreshEventBands: () => Promise<void>;
};

export function useEventBands(): UseEventBandsResult {
    const { session } = useAuth();
    const userId = session?.user.id ?? null;

    const [events, setEvents] = useState<EventRow[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("");
    const [eventBands, setEventBands] = useState<EventBandSummary[]>([]);
    const [loading, setLoading] = useState(false);

    const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

    // イベント一覧を取得
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        (async () => {
            const { data, error } = await supabase
                .from("events")
                .select("id, name, date, event_type")
                .in("event_type", ["live", "camp"])
                .order("date", { ascending: false });

            if (cancelled) return;

            if (error) {
                console.error(error);
                toast.error("イベント一覧の取得に失敗しました。");
            } else {
                const list = (data ?? []) as EventRow[];
                setEvents(list);
                if (list.length > 0 && !selectedEventId) {
                    setSelectedEventId(list[0].id);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId, selectedEventId]);

    // イベントバンド取得
    const refreshEventBands = useCallback(async () => {
        if (!selectedEventId || !userId) return;
        setLoading(true);

        const { data: bandsData, error } = await supabase
            .from("bands")
            .select("id, name, created_by")
            .eq("event_id", selectedEventId)
            .eq("band_type", "event")
            .order("created_at", { ascending: true });

        if (error) {
            console.error(error);
            toast.error("イベントバンドの取得に失敗しました。");
            setEventBands([]);
            setLoading(false);
            return;
        }

        const bandIds = (bandsData ?? []).map((band) => band.id);
        if (bandIds.length === 0) {
            setEventBands([]);
            setLoading(false);
            return;
        }

        const { data: membersData, error: membersError } = await supabase
            .from("band_members")
            .select("band_id, user_id")
            .in("band_id", bandIds);

        if (membersError) {
            console.error(membersError);
        }

        const memberCounts = new Map<string, Set<string>>();
        (membersData ?? []).forEach((row) => {
            const entry = row as { band_id: string; user_id: string };
            const set = memberCounts.get(entry.band_id) ?? new Set<string>();
            set.add(entry.user_id);
            memberCounts.set(entry.band_id, set);
        });

        const list = (bandsData ?? []).map((band) => ({
            id: band.id,
            name: band.name,
            created_by: band.created_by ?? null,
            members: memberCounts.get(band.id)?.size ?? 0,
            isMember: memberCounts.get(band.id)?.has(userId) ?? false,
        }));

        setEventBands(list);
        setLoading(false);
    }, [selectedEventId, userId]);

    // 選択イベント変更時にバンド取得
    useEffect(() => {
        if (selectedEventId) {
            refreshEventBands();
        } else {
            setEventBands([]);
        }
    }, [selectedEventId, refreshEventBands]);

    return {
        events,
        selectedEventId,
        setSelectedEventId,
        selectedEvent,
        eventBands,
        loading,
        refreshEventBands,
    };
}
