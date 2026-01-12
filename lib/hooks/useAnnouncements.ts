"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export type Announcement = {
    id: string;
    title: string;
    content: string;
    category: string;
    is_pinned: boolean;
    is_published: boolean;
    published_at: string | null;
    created_at: string;
};

async function fetchAnnouncements(): Promise<Announcement[]> {
    const { data, error } = await supabase
        .from("announcements")
        .select("id, title, content, category, is_pinned, is_published, published_at, created_at")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error("お知らせの取得に失敗しました。");
    }

    return (data ?? []) as Announcement[];
}

export function useAnnouncements() {
    return useQuery({
        queryKey: ["announcements"],
        queryFn: fetchAnnouncements,
    });
}
