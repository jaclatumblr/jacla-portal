"use client";

import { useState } from "react";

type MetadataUpdates = {
    title?: string;
    artist?: string;
    duration_sec?: number;
};

export function useMetadata() {
    const [fetchingMeta, setFetchingMeta] = useState<Record<string, boolean>>({});

    const fetchMetadata = async (
        id: string,
        url: string,
        onSuccess: (id: string, updates: MetadataUpdates) => void
    ) => {
        if (!url || !url.startsWith("http")) return;

        setFetchingMeta((prev) => ({ ...prev, [id]: true }));
        try {
            const res = await fetch("/api/repertoire/metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });

            if (res.ok) {
                const data = await res.json();
                const updates: MetadataUpdates = {};
                if (data.title) updates.title = data.title;
                if (data.artist) updates.artist = data.artist;
                if (typeof data.duration_sec === 'number') updates.duration_sec = data.duration_sec;

                if (Object.keys(updates).length > 0) {
                    onSuccess(id, updates);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFetchingMeta((prev) => ({ ...prev, [id]: false }));
        }
    };

    return {
        fetchingMeta,
        fetchMetadata
    };
}
