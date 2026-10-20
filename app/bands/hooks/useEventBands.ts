"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import type { EventRow, EventBandSummary, BandMemberRow } from "../types";

type UseEventBandsResult = {
    events: EventRow[];
    selectedEventId: string;
    setSelectedEventId: (id: string) => void;
    selectedEvent: EventRow | null;
    eventBands: EventBandSummary[];
    loading: boolean;
    refreshEventBands: () => Promise<void>;
};

type UseEventBandsOptions = {
    initialEventId?: string | null;
};

export function useEventBands(options: UseEventBandsOptions = {}): UseEventBandsResult {
    const { session } = useAuth();
    const userId = session?.user.id ?? null;
    const initialEventId = options.initialEventId?.trim() ?? "";

    const [events, setEvents] = useState<EventRow[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId);
    const [eventBands, setEventBands] = useState<EventBandSummary[]>([]);
    const [loading, setLoading] = useState(false);

    const requestVersion = useRef(0);
    const activeScope = useRef("");
    useLayoutEffect(() => {
        activeScope.current = `${userId}:${selectedEventId}`;
        return () => { activeScope.current = ""; requestVersion.current += 1; };
    }, [userId, selectedEventId]);
    const [loadedEventId, setLoadedEventId] = useState("");
    const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

    // イベント一覧を取得
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        (async () => {
            const { data, error } = await supabase
                .from("events")
                .select("id, name, date, event_type, repertoire_deadline, repertoire_is_closed")
                .in("event_type", ["live", "camp"])
                .order("date", { ascending: false });

            if (cancelled) return;

            if (error) {
                console.error(error);
                toast.error("イベント一覧の取得に失敗しました。");
            } else {
                const list = (data ?? []) as EventRow[];
                setEvents(list);
                setSelectedEventId((prev) => {
                    if (initialEventId && list.some((e) => e.id === initialEventId)) {
                        return initialEventId;
                    }
                    if (prev && list.some((e) => e.id === prev)) {
                        return prev;
                    }
                    return initialEventId || (list.length > 0 ? list[0].id : "");
                });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [initialEventId, userId]);

    useEffect(() => {
        if (!initialEventId) return;
        queueMicrotask(() => {
            setSelectedEventId(initialEventId);
        });
    }, [initialEventId]);

    // イベントバンド取得
    const refreshEventBands = useCallback(async () => {
        if (!selectedEventId || !userId) return;
        if (activeScope.current !== `${userId}:${selectedEventId}`) return;
        const version = ++requestVersion.current;
        setLoading(true);
        try {

            const { data: bandsData, error } = await supabase
                .from("bands")
                .select("id, name, created_by")
                .eq("event_id", selectedEventId)
                .eq("band_type", "event")
                .order("created_at", { ascending: true });

            if (version !== requestVersion.current) return;
            if (error) {
                console.error(error);
                toast.error("イベントバンドの取得に失敗しました。");
                setLoadedEventId(selectedEventId);
                setEventBands([]);
                setLoading(false);
                return;
            }

            const bandIds = (bandsData ?? []).map((band) => band.id);
            if (bandIds.length === 0) {
                setLoadedEventId(selectedEventId);
                setEventBands([]);
                setLoading(false);
                return;
            }

            const { data: membersData, error: membersError } = await supabase
                .from("band_members")
                .select("band_id, user_id, profiles(display_name, real_name)")
                .in("band_id", bandIds);

            if (version !== requestVersion.current) return;
            if (membersError) {
                console.error(membersError);
                toast.error("メンバー情報の取得に失敗しました。一覧を更新してください。");
                setLoadedEventId(selectedEventId);
                setEventBands([]);
                setLoading(false);
                return;
            }

            const memberCounts = new Map<string, Set<string>>();
            const memberNames = new Map<string, Map<string, string>>();
            (membersData ?? []).forEach((row) => {
                const entry = row as BandMemberRow;
                const set = memberCounts.get(entry.band_id) ?? new Set<string>();
                set.add(entry.user_id);
                memberCounts.set(entry.band_id, set);

                const profile = Array.isArray(entry.profiles)
                    ? entry.profiles[0]
                    : entry.profiles;
                const name =
                    profile?.display_name?.trim() ||
                    profile?.real_name?.trim() ||
                    "未設定";
                const bandMap = memberNames.get(entry.band_id) ?? new Map<string, string>();
                if (!bandMap.has(entry.user_id)) {
                    bandMap.set(entry.user_id, name);
                }
                memberNames.set(entry.band_id, bandMap);
            });

            const list = (bandsData ?? []).map((band) => ({
                id: band.id,
                name: band.name,
                created_by: band.created_by ?? null,
                members: memberCounts.get(band.id)?.size ?? 0,
                memberNames: Array.from(memberNames.get(band.id)?.values() ?? []),
                isMember: memberCounts.get(band.id)?.has(userId) ?? false,
            }));

            setLoadedEventId(selectedEventId);
            setEventBands(list);
            setLoading(false);
        } catch (error) {
            if (version !== requestVersion.current) return;
            console.error(error);
            toast.error("バンド情報を取得できませんでした。一覧を更新してください。");
            setLoadedEventId(selectedEventId);
            setEventBands([]);
        } finally {
            if (version === requestVersion.current) setLoading(false);
        }
    }, [selectedEventId, userId]);

    // 選択イベント変更時にバンド取得
    useEffect(() => {
        if (!selectedEventId) {
            queueMicrotask(() => {
                setLoadedEventId(selectedEventId);
                setEventBands([]);
                setLoading(false);
            });
            return;
        }
        void (async () => {
            await refreshEventBands();
        })();
        return () => { requestVersion.current += 1; };
    }, [selectedEventId, refreshEventBands]);

    return {
        events,
        selectedEventId,
        setSelectedEventId,
        selectedEvent,
        eventBands: loadedEventId === selectedEventId ? eventBands : [],
        loading: loading || Boolean(selectedEventId && loadedEventId !== selectedEventId),
        refreshEventBands,
    };
}
