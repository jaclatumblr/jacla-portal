"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export type Event = {
    id: string;
    name: string;
    event_type: string;
    status: string;
    start_time: string | null;
    end_time: string | null;
    venue: string | null;
    notes: string | null;
    created_at: string;
};

async function fetchEvents(): Promise<Event[]> {
    const { data, error } = await supabase
        .from("events")
        .select("id, name, event_type, status, start_time, end_time, venue, notes, created_at")
        .order("start_time", { ascending: true });

    if (error) {
        throw new Error("イベント情報の取得に失敗しました。");
    }

    return (data ?? []) as Event[];
}

export function useEvents() {
    return useQuery({
        queryKey: ["events"],
        queryFn: fetchEvents,
    });
}
