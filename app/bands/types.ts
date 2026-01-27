// バンド関連の型定義

export type EventRow = {
    id: string;
    name: string;
    date: string;
    event_type: string;
};

export type BandRow = {
    id: string;
    name: string;
    created_by: string | null;
    band_type?: string | null;
    event_id?: string | null;
    source_band_id?: string | null;
};

export type BandMemberRow = {
    id: string;
    band_id: string;
    user_id: string;
    instrument: string | null;
    profiles?:
    | {
        display_name: string | null;
        real_name: string | null;
        part: string | null;
        leader?: string | null;
    }
    | {
        display_name: string | null;
        real_name: string | null;
        part: string | null;
        leader?: string | null;
    }[]
    | null;
};

export type ProfilePartRow = {
    profile_id: string;
    part: string | null;
    is_primary?: boolean | null;
};

export type ProfileRow = {
    id: string;
    display_name: string | null;
    real_name: string | null;
    part: string | null;
    leader?: string | null;
};

export type FixedBandSummary = {
    id: string;
    name: string;
    created_by: string | null;
    members: number;
};

export type EventBandSummary = {
    id: string;
    name: string;
    created_by: string | null;
    members: number;
    memberNames: string[];
    isMember: boolean;
};

export type FixedMember = {
    id: string;
    userId: string
    instrument: string;
    displayName: string;
    realName: string;
    part: string;
};

// ユーティリティ関数
export const isAdminLeader = (leader?: string | null) =>
    leader === "Administrator";

export const formatDate = (value?: string | null) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
};
