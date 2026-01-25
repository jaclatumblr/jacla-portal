// Admin Event Detail Page Types

export type EventRow = {
    id: string;
    name: string;
    date: string;
    status: string;
    event_type: string;
    repertoire_deadline?: string | null;
    repertoire_is_closed?: boolean | null;
    venue: string | null;
    assembly_time: string | null;
    open_time: string | null;
    start_time: string | null;
    note: string | null;
    default_changeover_min: number;
    tt_is_published: boolean;
    tt_is_provisional: boolean;
    normal_rehearsal_order?: "same" | "reverse" | null;
};

export type Band = {
    id: string;
    event_id: string;
    name: string;
    note_pa: string | null;
    note_lighting: string | null;
    stage_plot_data: Record<string, unknown> | null;
    created_by: string | null;
};

export type ProfileOption = {
    id: string;
    display_name: string;
    email?: string | null;
    discord?: string | null;
    crew?: string | null;
};

export type BandMember = {
    id: string;
    band_id: string;
    user_id: string;
    instrument: string;
};

export type Song = {
    id: string;
    band_id: string;
    title: string;
    artist: string | null;
    entry_type: "song" | "mc" | null;
    url: string | null;
    order_index: number | null;
    duration_sec: number | null;
    memo: string | null;
};

export type EventSlot = {
    id: string;
    event_id: string;
    band_id: string | null;
    slot_type: string;
    slot_phase?: "show" | "rehearsal_normal" | "rehearsal_pre" | null;
    order_in_event: number | null;
    start_time: string | null;
    end_time: string | null;
    changeover_min: number | null;
    note: string | null;
};

export type EventStaffMember = {
    id: string;
    event_id: string;
    profile_id: string;
    can_pa: boolean;
    can_light: boolean;
    note: string | null;
};

export type SlotStaffAssignment = {
    id: string;
    event_slot_id: string;
    profile_id: string;
    role: "pa" | "light";
    is_fixed: boolean;
    note: string | null;
};

// Constants
export const statusOptions = [
    { value: "draft", label: "下書き" },
    { value: "recruiting", label: "募集中" },
    { value: "fixed", label: "確定" },
    { value: "closed", label: "終了" },
];

export const eventTypeOptions = [
    { value: "live", label: "ライブ" },
    { value: "workshop", label: "講習会" },
    { value: "briefing", label: "説明会" },
    { value: "camp", label: "合宿" },
    { value: "other", label: "その他" },
];

export const slotTypeOptions = [
    { value: "band", label: "バンド" },
    { value: "break", label: "転換" },
    { value: "other", label: "付帯作業" },
];

// Utilities
export function statusBadge(status: string) {
    if (status === "recruiting") return "default";
    if (status === "fixed") return "secondary";
    return "outline";
}

export function statusLabel(status: string) {
    return statusOptions.find((s) => s.value === status)?.label ?? status;
}

export function eventTypeLabel(eventType: string) {
    return eventTypeOptions.find((t) => t.value === eventType)?.label ?? eventType;
}

export function parseTime(value: string | null): number | null {
    if (!value) return null;
    const [h, m] = value.split(":").map((part) => Number(part));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

export function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
