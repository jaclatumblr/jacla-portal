// 部員データの型定義

export type Member = {
    id: string;
    name: string;
    realName: string | null;
    email: string | null;
    studentId: string | null;
    discordName: string | null;
    discordId: string | null;
    part: string | null;
    crew: string | null;
    leaderRoles: string[];
    positions: string[];
    bands: string[];
    avatarUrl: string | null;
    enrollmentYear: string | null;
    birthDate: string | null;
};

export type ProfileRow = {
    id: string;
    display_name: string | null;
    real_name: string | null;
    email?: string | null;
    part: string | null;
    crew: string | null;
    leader: string | null;
    discord: string | null;
    discord_username: string | null;
    discord_id?: string | null;
    avatar_url?: string | null;
};

export type ProfilePrivateRow = {
    profile_id: string;
    student_id: string;
};

export type EnrollmentYearRow = {
    profile_id: string;
    enrollment_year: number | null;
    birth_date: string | null;
};

export type BandMemberRow = {
    user_id: string;
    bands:
    | { id: string; name: string; band_type?: string | null }
    | { id: string; name: string; band_type?: string | null }[]
    | null;
};

export type ProfilePartRow = {
    profile_id: string;
    part: string | null;
    is_primary?: boolean | null;
};

export type LeaderRow = {
    profile_id: string;
    leader: string;
};

export type PositionRow = {
    profile_id: string;
    position: string;
};

// 定数

export const positionLabels: Record<string, string> = {
    Official: "Official",
    President: "部長",
    "Vice President": "副部長",
    Treasurer: "会計",
    "PA Chief": "PA長",
    "Lighting Chief": "照明長",
    "Public Relations": "広報",
    "Web Secretary": "Web幹事",
};

export const positionPriority: Record<string, number> = {
    Official: 0,
    President: 1,
    "Vice President": 2,
    Treasurer: 3,
    "PA Chief": 4,
    "Lighting Chief": 4,
    "Public Relations": 5,
    "Web Secretary": 6,
};

export const sortOptions = [
    { value: "role", label: "権限順" },
    { value: "name", label: "名前順" },
    { value: "part", label: "パート順" },
    { value: "enrollment", label: "入学年度順" },
] as const;

export type SortKey = (typeof sortOptions)[number]["value"];
