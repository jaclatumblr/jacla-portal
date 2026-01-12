export type EventRow = {
    id: string;
    name: string;
    date: string | null;
};

export type BandNoteRow = {
    id: string;
    name: string;
    event_id: string;
    sound_note: string | null;
    lighting_note: string | null;
    general_note: string | null;
    repertoire_status: string | null;
    stage_plot_data?: Record<string, unknown> | null;
};

export type SongRow = {
    id: string;
    band_id: string;
    title: string;
    artist: string | null;
    entry_type: "song" | "mc" | null;
    url: string | null;
    order_index: number | null;
    duration_sec: number | null;
    arrangement_note: string | null;
    lighting_spot: string | null;
    lighting_strobe: string | null;
    lighting_moving: string | null;
    lighting_color: string | null;
    memo: string | null;
    created_at: string | null;
};

export type BandMemberRow = {
    id: string;
    band_id: string;
    instrument: string | null;
    position_x: number | null;
    position_y: number | null;
    is_mc: boolean | null;
    monitor_request: string | null;
    monitor_note: string | null;
    order_index: number | null;
    profiles?:
    | { display_name: string | null; real_name: string | null; part: string | null }
    | { display_name: string | null; real_name: string | null; part: string | null }[]
    | null;
};

export type StageItem = {
    id: string;
    label: string;
    dashed?: boolean;
    x: number;
    y: number;
};

export type StageMember = {
    id: string;
    name: string;
    instrument?: string | null;
    x: number;
    y: number;
    isMc?: boolean;
};

export type EventGroup = EventRow & { bands: BandNoteRow[] };

export type BandMemberDetail = {
    id: string;
    name: string;
    instrument: string | null;
    monitorRequest: string | null;
    monitorNote: string | null;
    isMc: boolean;
    orderIndex: number | null;
};

export type EventSlotRow = {
    id: string;
    event_id: string;
    band_id: string | null;
    slot_type: "band" | "break" | "mc" | "other";
    slot_phase: "show" | "rehearsal_normal" | "rehearsal_pre" | null;
    order_in_event: number | null;
    start_time: string | null;
    end_time: string | null;
    note: string | null;
};

export type SlotStaffAssignmentRow = {
    id: string;
    event_slot_id: string;
    profile_id: string;
    role: string;
};

export type InstructionProfileRow = {
    id: string;
    display_name: string | null;
    real_name: string | null;
};
