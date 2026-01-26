"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import type { ProfileRow, ProfilePartRow } from "../types";

type UseProfilesResult = {
    profiles: ProfileRow[];
    subPartsByProfileId: Record<string, string[]>;
    selfPart: string;
    loading: boolean;
    getFilteredProfiles: (existingUserIds: string[], searchQuery: string) => ProfileRow[];
};

export function useProfiles(): UseProfilesResult {
    const { session } = useAuth();
    const userId = session?.user.id ?? null;

    const [profiles, setProfiles] = useState<ProfileRow[]>([]);
    const [subPartsByProfileId, setSubPartsByProfileId] = useState<Record<string, string[]>>({});
    const [leaderRolesByProfileId, setLeaderRolesByProfileId] = useState<Record<string, string[]>>({});
    const [selfPart, setSelfPart] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        (async () => {
            setLoading(true);
            const [profilesRes, partsRes, leadersRes] = await Promise.all([
                supabase.from("profiles").select("id, display_name, real_name, part, leader"),
                supabase.from("profile_parts").select("profile_id, part, is_primary"),
                supabase.from("profile_leaders").select("profile_id, leader"),
            ]);

            if (cancelled) return;

            if (profilesRes.error) {
                console.error(profilesRes.error);
                toast.error("メンバー一覧の取得に失敗しました。");
                setProfiles([]);
            } else {
                const list = (profilesRes.data ?? []) as ProfileRow[];
                setProfiles(list);
                const selfProfile = list.find((p) => p.id === userId);
                setSelfPart(selfProfile?.part ?? "");
            }

            if (partsRes.error) {
                console.error(partsRes.error);
                setSubPartsByProfileId({});
            } else {
                const nextMap: Record<string, string[]> = {};
                (partsRes.data ?? []).forEach((row) => {
                    const entry = row as ProfilePartRow;
                    if (!entry.profile_id || entry.is_primary) return;
                    const partValue = entry.part?.trim();
                    if (!partValue || partValue === "none") return;
                    const bucket = nextMap[entry.profile_id] ?? [];
                    if (!bucket.includes(partValue)) bucket.push(partValue);
                    nextMap[entry.profile_id] = bucket;
                });
                setSubPartsByProfileId(nextMap);
            }

            if (leadersRes.error) {
                console.error(leadersRes.error);
                setLeaderRolesByProfileId({});
            } else {
                const nextMap: Record<string, string[]> = {};
                (leadersRes.data ?? []).forEach((row) => {
                    const entry = row as { profile_id?: string | null; leader?: string | null };
                    if (!entry.profile_id || !entry.leader || entry.leader === "none") return;
                    const bucket = nextMap[entry.profile_id] ?? [];
                    if (!bucket.includes(entry.leader)) bucket.push(entry.leader);
                    nextMap[entry.profile_id] = bucket;
                });
                setLeaderRolesByProfileId(nextMap);
            }
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    const getFilteredProfiles = useCallback(
        (existingUserIds: string[], searchQuery: string): ProfileRow[] => {
            const query = searchQuery.trim().toLowerCase();
            const existingIds = new Set(existingUserIds);

            return profiles
                .filter((profile) => {
                    if (profile.leader === "Administrator") return false;
                    const roles = leaderRolesByProfileId[profile.id] ?? [];
                    return !roles.includes("Administrator");
                })
                .filter((profile) => !existingIds.has(profile.id))
                .filter((profile) => {
                    if (!query) return true;
                    const subParts = subPartsByProfileId[profile.id] ?? [];
                    const combined = `${profile.display_name ?? ""} ${profile.real_name ?? ""} ${profile.part ?? ""
                        } ${subParts.join(" ")}`.toLowerCase();
                    return combined.includes(query);
                });
        },
        [profiles, subPartsByProfileId, leaderRolesByProfileId]
    );

    return {
        profiles,
        subPartsByProfileId,
        selfPart,
        loading,
        getFilteredProfiles,
    };
}
