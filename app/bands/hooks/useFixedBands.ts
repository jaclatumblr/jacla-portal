"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import type { FixedBandSummary, FixedMember, BandMemberRow } from "../types";

type UseFixedBandsResult = {
    fixedBands: FixedBandSummary[];
    selectedBandId: string | null;
    setSelectedBandId: (id: string | null) => void;
    selectedBand: FixedBandSummary | null;
    members: FixedMember[];
    loading: boolean;
    membersLoading: boolean;
    refreshFixedBands: () => Promise<void>;
    refreshMembers: () => Promise<void>;
};

export function useFixedBands(): UseFixedBandsResult {
    const { session } = useAuth();
    const userId = session?.user.id ?? null;

    const [fixedBands, setFixedBands] = useState<FixedBandSummary[]>([]);
    const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
    const [members, setMembers] = useState<FixedMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [membersLoading, setMembersLoading] = useState(false);

    const selectedBand = fixedBands.find((b) => b.id === selectedBandId) ?? null;

    // 固定バンド一覧取得
    const refreshFixedBands = useCallback(async () => {
        if (!userId) return;
        setLoading(true);

        const [memberRes, createdRes] = await Promise.all([
            supabase.from("band_members").select("band_id").eq("user_id", userId),
            supabase.from("bands").select("id").eq("created_by", userId).eq("band_type", "fixed"),
        ]);

        if (memberRes.error || createdRes.error) {
            console.error(memberRes.error ?? createdRes.error);
            toast.error("固定バンドの取得に失敗しました。");
            setFixedBands([]);
            setLoading(false);
            return;
        }

        const memberBandIds = (memberRes.data ?? []).map(
            (row) => (row as { band_id: string }).band_id
        );
        const createdIds = (createdRes.data ?? []).map((row) => (row as { id: string }).id);
        const bandIds = Array.from(new Set([...memberBandIds, ...createdIds]));

        if (bandIds.length === 0) {
            setFixedBands([]);
            setSelectedBandId(null);
            setLoading(false);
            return;
        }

        const { data: bandsData, error: bandsError } = await supabase
            .from("bands")
            .select("id, name, created_by, band_type")
            .in("id", bandIds)
            .eq("band_type", "fixed");

        if (bandsError) {
            console.error(bandsError);
            toast.error("固定バンドの取得に失敗しました。");
            setFixedBands([]);
            setLoading(false);
            return;
        }

        const { data: countsData, error: countsError } = await supabase
            .from("band_members")
            .select("band_id, user_id")
            .in("band_id", bandIds);

        if (countsError) {
            console.error(countsError);
        }

        const memberCounts = new Map<string, Set<string>>();
        (countsData ?? []).forEach((row) => {
            const entry = row as { band_id: string; user_id: string };
            const set = memberCounts.get(entry.band_id) ?? new Set<string>();
            set.add(entry.user_id);
            memberCounts.set(entry.band_id, set);
        });

        const list = (bandsData ?? [])
            .map((band) => ({
                id: band.id,
                name: band.name,
                created_by: band.created_by ?? null,
                members: memberCounts.get(band.id)?.size ?? 0,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "ja"));

        setFixedBands(list);
        setSelectedBandId((prev) => (list.some((b) => b.id === prev) ? prev : list[0]?.id ?? null));
        setLoading(false);
    }, [userId]);

    // メンバー取得
    const refreshMembers = useCallback(async () => {
        if (!selectedBandId) {
            setMembers([]);
            return;
        }
        setMembersLoading(true);

        const { data, error } = await supabase
            .from("band_members")
            .select("id, band_id, user_id, instrument, profiles(display_name, real_name, part, leader)")
            .eq("band_id", selectedBandId)
            .order("order_index", { ascending: true });

        if (error) {
            console.error(error);
            toast.error("メンバーの取得に失敗しました。");
            setMembers([]);
            setMembersLoading(false);
            return;
        }

        const list = (data ?? []).map((row) => {
            const memberRow = row as BandMemberRow;
            const profile = Array.isArray(memberRow.profiles)
                ? memberRow.profiles[0]
                : memberRow.profiles;
            return {
                id: memberRow.id,
                userId: memberRow.user_id,
                instrument: memberRow.instrument ?? "",
                displayName: profile?.display_name ?? "",
                realName: profile?.real_name ?? "",
                part: profile?.part ?? "",
            } satisfies FixedMember;
        });

        setMembers(list);
        setMembersLoading(false);
    }, [selectedBandId]);

    // 初期読み込み
    useEffect(() => {
        refreshFixedBands();
    }, [refreshFixedBands]);

    // バンド選択時にメンバー取得
    useEffect(() => {
        refreshMembers();
    }, [refreshMembers]);

    return {
        fixedBands,
        selectedBandId,
        setSelectedBandId,
        selectedBand,
        members,
        loading,
        membersLoading,
        refreshFixedBands,
        refreshMembers,
    };
}
