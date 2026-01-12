"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdministrator } from "@/lib/useIsAdministrator";
import { useCanViewStudentId } from "@/lib/useCanViewStudentId";
import { toast } from "@/lib/toast";
import type {
    Member,
    ProfileRow,
    ProfilePrivateRow,
    EnrollmentYearRow,
    BandMemberRow,
    ProfilePartRow,
    LeaderRow,
    PositionRow,
} from "../types";
import { positionPriority } from "../types";

type UseMembersResult = {
    members: Member[];
    subPartsByProfileId: Record<string, string[]>;
    loading: boolean;
    isAdministrator: boolean;
    canViewStudentId: boolean;
};

export function useMembers(): UseMembersResult {
    const { session, loading: authLoading } = useAuth();
    const { isAdministrator, loading: adminLoading } = useIsAdministrator();
    const { canViewStudentId, loading: studentAccessLoading } = useCanViewStudentId();

    const [members, setMembers] = useState<Member[]>([]);
    const [subPartsByProfileId, setSubPartsByProfileId] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading || adminLoading || studentAccessLoading || !session) return;
        let cancelled = false;

        (async () => {
            setLoading(true);

            const profilesPromise = isAdministrator
                ? supabase
                    .from("profiles")
                    .select(
                        "id, display_name, real_name, email, part, crew, leader, discord, discord_username, discord_id, avatar_url"
                    )
                    .order("display_name", { ascending: true })
                : supabase
                    .from("profiles")
                    .select(
                        "id, display_name, real_name, part, crew, leader, discord, discord_username, discord_id, avatar_url"
                    )
                    .order("display_name", { ascending: true });

            const [profilesRes, bandsRes, leadersRes, positionsRes, enrollmentRes, partsRes] =
                await Promise.all([
                    profilesPromise,
                    supabase.from("band_members").select("user_id, bands(id, name, band_type)"),
                    supabase.from("profile_leaders").select("profile_id, leader"),
                    supabase.from("profile_positions").select("profile_id, position"),
                    supabase.rpc("get_profile_enrollment_years"),
                    supabase.from("profile_parts").select("profile_id, part, is_primary"),
                ]);

            if (cancelled) return;

            if (profilesRes.error) {
                console.error(profilesRes.error);
                toast.error("部員情報の取得に失敗しました。時間をおいて再度お試しください。");
                setMembers([]);
                setLoading(false);
                return;
            }

            // バンドマップ作成
            const bandMap = new Map<string, Set<string>>();
            if (bandsRes.error) {
                console.error(bandsRes.error);
                toast.error("バンド情報の取得に失敗しました。");
            } else {
                (bandsRes.data ?? []).forEach((row) => {
                    const bandRow = row as BandMemberRow;
                    const bandEntries = Array.isArray(bandRow.bands)
                        ? bandRow.bands
                        : bandRow.bands
                            ? [bandRow.bands]
                            : [];
                    const current = bandMap.get(bandRow.user_id) ?? new Set<string>();
                    bandEntries
                        .filter((band) => band.band_type === "fixed")
                        .forEach((band) => current.add(band.name));
                    bandMap.set(bandRow.user_id, current);
                });
            }

            // リーダーマップ作成
            const leaderMap = new Map<string, Set<string>>();
            if (leadersRes.error) {
                console.error(leadersRes.error);
                toast.error("ロール情報の取得に失敗しました。");
            } else {
                (leadersRes.data ?? []).forEach((row) => {
                    const leaderRow = row as LeaderRow;
                    if (!leaderRow.profile_id || !leaderRow.leader || leaderRow.leader === "none") return;
                    const current = leaderMap.get(leaderRow.profile_id) ?? new Set<string>();
                    current.add(leaderRow.leader);
                    leaderMap.set(leaderRow.profile_id, current);
                });
            }

            // サブパート作成
            const nextSubParts: Record<string, string[]> = {};
            if (partsRes.error) {
                console.error(partsRes.error);
            } else {
                (partsRes.data ?? []).forEach((row) => {
                    const partRow = row as ProfilePartRow;
                    if (!partRow.profile_id) return;
                    if (partRow.is_primary) return;
                    const value = partRow.part?.trim();
                    if (!value || value === "none") return;
                    const bucket = nextSubParts[partRow.profile_id] ?? [];
                    if (!bucket.includes(value)) bucket.push(value);
                    nextSubParts[partRow.profile_id] = bucket;
                });
            }
            setSubPartsByProfileId(nextSubParts);

            // ポジションマップ作成
            const positionMap = new Map<string, Set<string>>();
            if (positionsRes.error) {
                console.error(positionsRes.error);
                toast.error("役職情報の取得に失敗しました。");
            } else {
                (positionsRes.data ?? []).forEach((row) => {
                    const positionRow = row as PositionRow;
                    if (!positionRow.profile_id || !positionRow.position) return;
                    const current = positionMap.get(positionRow.profile_id) ?? new Set<string>();
                    current.add(positionRow.position);
                    positionMap.set(positionRow.profile_id, current);
                });
            }

            // 入学年度・誕生日マップ作成
            const enrollmentMap = new Map<string, string>();
            const birthDateMap = new Map<string, string>();
            if (enrollmentRes.error) {
                console.error(enrollmentRes.error);
                toast.error("入学年度の取得に失敗しました。");
            } else {
                const enrollmentRows = (enrollmentRes.data ?? []) as EnrollmentYearRow[];
                enrollmentRows.forEach((entry) => {
                    if (!entry.profile_id) return;
                    const yearValue = entry.enrollment_year != null ? String(entry.enrollment_year) : "";
                    if (yearValue) {
                        enrollmentMap.set(entry.profile_id, yearValue);
                    }
                    const birthValue = entry.birth_date ? String(entry.birth_date) : "";
                    if (birthValue) {
                        birthDateMap.set(entry.profile_id, birthValue);
                    }
                });
            }

            // 学籍番号マップ作成
            const studentMap = new Map<string, string>();
            if (canViewStudentId) {
                const { data: privateData, error: privateError } = await supabase
                    .from("profile_private")
                    .select("profile_id, student_id");
                if (privateError) {
                    console.error(privateError);
                    toast.error("学籍番号の取得に失敗しました。");
                } else {
                    (privateData ?? []).forEach((row) => {
                        const entry = row as ProfilePrivateRow;
                        if (!entry.profile_id) return;
                        studentMap.set(entry.profile_id, entry.student_id);
                    });
                }
            }

            // メンバーリスト作成
            const list = (profilesRes.data ?? []).map((row) => {
                const profile = row as ProfileRow;
                const leaderFallback =
                    profile.leader && profile.leader !== "none" ? [profile.leader] : [];
                const leaderRoles = Array.from(leaderMap.get(profile.id) ?? leaderFallback);
                const positions = Array.from(positionMap.get(profile.id) ?? []);
                return {
                    id: profile.id,
                    name: profile.display_name ?? "名前未登録",
                    realName: profile.real_name ?? null,
                    email: isAdministrator ? profile.email ?? null : null,
                    studentId: canViewStudentId ? studentMap.get(profile.id) ?? null : null,
                    enrollmentYear: enrollmentMap.get(profile.id) ?? null,
                    birthDate: birthDateMap.get(profile.id) ?? null,
                    part: profile.part && profile.part !== "none" ? profile.part : null,
                    crew: profile.crew ?? null,
                    leaderRoles,
                    positions,
                    discordName: profile.discord_username ?? profile.discord ?? null,
                    discordId: profile.discord_id ?? null,
                    bands: Array.from(bandMap.get(profile.id) ?? []),
                    avatarUrl: profile.avatar_url ?? null,
                } satisfies Member;
            });

            // ソート
            const leaderPriority: Record<string, number> = {
                Administrator: 0,
                Supervisor: 1,
                "PA Leader": 2,
                "Lighting Leader": 3,
                "Part Leader": 4,
            };
            const crewPriority: Record<string, number> = {
                PA: 5,
                Lighting: 6,
                User: 7,
            };

            const getPositionRank = (member: Member) => {
                if (member.positions.length === 0) return Number.POSITIVE_INFINITY;
                let rank = Number.POSITIVE_INFINITY;
                member.positions.forEach((position) => {
                    if (position === "Official") return;
                    const value = positionPriority[position];
                    if (value !== undefined && value < rank) {
                        rank = value;
                    }
                });
                return Number.isFinite(rank) ? rank : 99;
            };

            const getTopRank = (member: Member) => {
                if (member.positions.includes("Official")) return 0;
                if (member.leaderRoles.includes("Administrator")) return 1;
                return 2;
            };

            const getRoleRank = (member: Member) => {
                let rank = Number.POSITIVE_INFINITY;
                member.leaderRoles.forEach((role) => {
                    const value = leaderPriority[role];
                    if (value !== undefined && value < rank) {
                        rank = value;
                    }
                });
                if (!Number.isFinite(rank)) {
                    const crewValue = member.crew ? crewPriority[member.crew] : undefined;
                    rank = crewValue ?? 99;
                }
                return rank;
            };

            const sorted = [...list].sort((a, b) => {
                const topA = getTopRank(a);
                const topB = getTopRank(b);
                if (topA !== topB) return topA - topB;
                const positionA = getPositionRank(a);
                const positionB = getPositionRank(b);
                if (positionA !== positionB) return positionA - positionB;
                const roleA = getRoleRank(a);
                const roleB = getRoleRank(b);
                if (roleA !== roleB) return roleA - roleB;
                return a.name.localeCompare(b.name, "ja");
            });

            setMembers(sorted);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [authLoading, adminLoading, studentAccessLoading, isAdministrator, canViewStudentId, session]);

    return {
        members,
        subPartsByProfileId,
        loading: authLoading || adminLoading || studentAccessLoading || loading,
        isAdministrator,
        canViewStudentId,
    };
}
