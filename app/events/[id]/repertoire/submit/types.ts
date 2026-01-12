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
  repertoire_status: string | null;
  stage_plot_data?: Record<string, unknown> | null;
  representative_name?: string | null;
  sound_note?: string | null;
  lighting_note?: string | null;
  general_note?: string | null;
  lighting_total_min?: number | null;
};

export type EntryType = "song" | "mc";
export type RepertoireStatus = "draft" | "submitted";

export type SongRow = {
  id: string;
  band_id: string;
  title: string;
  artist: string | null;
  entry_type: EntryType | null;
  url: string | null;
  order_index: number | null;
  duration_sec: number | null;
  arrangement_note?: string | null;
  lighting_spot?: string | null;
  lighting_strobe?: string | null;
  lighting_moving?: string | null;
  lighting_color?: string | null;
  memo: string | null;
  created_at?: string | null;
};

export type LightingChoice = "o" | "x" | "auto" | "";

export type SongEntry = {
  id: string;
  band_id: string;
  entry_type: EntryType;
  title: string;
  artist: string;
  url: string;
  durationMin: string;
  durationSec: string;
  arrangementNote: string;
  lightingSpot: LightingChoice;
  lightingStrobe: LightingChoice;
  lightingMoving: LightingChoice;
  lightingColor: string;
  memo: string;
  order_index: number | null;
};

export type ProfileOption = {
  id: string;
  user_id: string | null;
  display_name: string | null;
  real_name: string | null;
  part: string | null;
  leader: string | null;
};

export type ProfilePartRow = {
  profile_id: string;
  part: string | null;
  is_primary?: boolean | null;
};

export type BandMemberRow = {
  id: string;
  band_id: string;
  user_id: string;
  instrument: string;
  position_x: number | null;
  position_y: number | null;
  order_index?: number | null;
  created_at?: string | null;
  monitor_request?: string | null;
  monitor_note?: string | null;
  is_mc?: boolean | null;
  profiles?:
    | {
        display_name: string | null;
        real_name: string | null;
        part: string | null;
      }
    | {
        display_name: string | null;
        real_name: string | null;
        part: string | null;
      }[]
    | null;
};

export type StageMember = {
  id: string;
  userId: string;
  name: string;
  realName: string | null;
  part: string | null;
  instrument: string;
  x: number;
  y: number;
  orderIndex?: number | null;
  monitorRequest: string;
  monitorNote: string;
  isMc: boolean;
};

export type StageItem = {
  id: string;
  label: string;
  dashed: boolean;
  x: number;
  y: number;
  fixed?: boolean;
};

export type RepertoireDraft = {
  eventId: string;
  bandId: string;
  updatedAt: number;
  bandName: string;
  representativeName: string;
  generalNote: string;
  soundNote: string;
  lightingNote: string;
  lightingTotal: string;
  repertoireStatus: RepertoireStatus;
  songs: SongEntry[];
  removedSongIds: string[];
  stageItems: StageItem[];
  bandMembers: StageMember[];
};

export type StageCategory = "drums" | "bass" | "guitar" | "keyboard" | "wind" | "vocal" | "other";

export const adminLeaderSet = new Set(["Administrator"]);

export const statusOptions: { value: RepertoireStatus; label: string }[] = [
  { value: "draft", label: "下書き" },
  { value: "submitted", label: "提出済み" },
];

export const entryTypeLabels: Record<EntryType, string> = {
  song: "曲",
  mc: "MC",
};

export const lightingChoiceOptions: { value: LightingChoice; label: string }[] = [
  { value: "", label: "-" },
  { value: "o", label: "○" },
  { value: "x", label: "×" },
  { value: "auto", label: "おまかせ" },
];

export const lightingChoiceLabels: Record<Exclude<LightingChoice, "">, string> = {
  o: "○",
  x: "×",
  auto: "おまかせ",
};

export const createTempId = () => `temp-${crypto.randomUUID()}`;
export const isTemp = (id: string) => String(id).startsWith("temp-");

export const toDurationInputs = (duration: number | null) => {
  if (duration == null) return { durationMin: "", durationSec: "" };
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return {
    durationMin: String(minutes),
    durationSec: String(seconds),
  };
};

export const toDurationSec = (minutes: string, seconds: string) => {
  const minValue = Number.parseInt(minutes, 10);
  const secValue = Number.parseInt(seconds, 10);
  if (Number.isNaN(minValue) && Number.isNaN(secValue)) return null;
  const safeMin = Number.isNaN(minValue) ? 0 : Math.max(0, minValue);
  const safeSec = Number.isNaN(secValue) ? 0 : Math.max(0, Math.min(59, secValue));
  return safeMin * 60 + safeSec;
};

export const formatDuration = (durationSec: number | null) => {
  if (durationSec == null) return "-";
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const formatLightingChoice = (value: LightingChoice) =>
  value ? lightingChoiceLabels[value as Exclude<LightingChoice, "">] : "-";

export const normalizeSongs = (rows: SongRow[]): SongEntry[] =>
  rows.map((row, index) => {
    const durationInputs = toDurationInputs(row.duration_sec ?? null);
    return {
      id: String(row.id),
      band_id: row.band_id,
      entry_type: row.entry_type ?? "song",
      title: row.title ?? "",
      artist: row.artist ?? "",
      url: row.url ?? "",
      durationMin: durationInputs.durationMin,
      durationSec: durationInputs.durationSec,
      arrangementNote: row.arrangement_note ?? "",
      lightingSpot: (row.lighting_spot as LightingChoice) ?? "",
      lightingStrobe: (row.lighting_strobe as LightingChoice) ?? "",
      lightingMoving: (row.lighting_moving as LightingChoice) ?? "",
      lightingColor: row.lighting_color ?? "",
      memo: row.memo ?? "",
      order_index: row.order_index ?? index + 1,
    };
  });

export const orderEntries = (entries: SongEntry[]) =>
  [...entries].sort((a, b) => {
    const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

export const normalizePartText = (value: string | null | undefined) =>
  (value ?? "").toLowerCase().replace(/\s+/g, "");

export const includesAny = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

export const getStageCategory = (value: string | null | undefined): StageCategory => {
  const text = normalizePartText(value);
  if (!text) return "other";
  if (includesAny(text, ["dr", "drum", "ドラム"])) return "drums";
  if (text.startsWith("ba") || includesAny(text, ["bass", "ベース"])) return "bass";
  if (includesAny(text, ["gt", "gtr", "guitar", "ギター"])) return "guitar";
  if (
    includesAny(text, [
      "key",
      "keys",
      "keyboard",
      "piano",
      "キーボード",
      "ピアノ",
      "syn",
      "synth",
      "wsyn",
      "w.syn",
      "w.synth",
    ])
  ) {
    return "keyboard";
  }
  if (includesAny(text, ["vo", "vocal", "voca", "ボーカル", "歌"])) return "vocal";
  if (
    includesAny(text, [
      "sax",
      "tp",
      "tb",
      "trumpet",
      "trombone",
      "horn",
      "hr",
      "eup",
      "tu",
      "fl",
      "cl",
      "ob",
      "fg",
      "brass",
      "管",
    ])
  ) {
    return "wind";
  }
  return "other";
};

export const stageSlots: Record<StageCategory, { x: number; y: number }[]> = {
  drums: [{ x: 52, y: 12 }],
  bass: [{ x: 30, y: 38 }],
  guitar: [
    { x: 70, y: 38 },
    { x: 76, y: 30 },
  ],
  keyboard: [
    { x: 62, y: 56 },
    { x: 50, y: 70 },
    { x: 42, y: 56 },
  ],
  vocal: [
    { x: 50, y: 84 },
    { x: 40, y: 84 },
    { x: 60, y: 84 },
  ],
  wind: [
    { x: 50, y: 62 },
    { x: 42, y: 62 },
    { x: 58, y: 62 },
    { x: 46, y: 68 },
    { x: 54, y: 68 },
    { x: 38, y: 68 },
    { x: 62, y: 68 },
    { x: 50, y: 74 },
    { x: 42, y: 74 },
    { x: 58, y: 74 },
    { x: 34, y: 74 },
    { x: 66, y: 74 },
    { x: 50, y: 78 },
    { x: 40, y: 78 },
    { x: 60, y: 78 },
  ],
  other: [
    { x: 18, y: 60 },
    { x: 82, y: 60 },
    { x: 18, y: 72 },
    { x: 82, y: 72 },
  ],
};

export const stagePresets: { label: string; dashed: boolean }[] = [
  { label: "Marshall", dashed: true },
  { label: "JC", dashed: true },
  { label: "Active", dashed: true },
  { label: "Passive", dashed: true },
];

export const stagePresetPositions: Record<string, { x: number; y: number }> = {
  Marshall: { x: 72, y: 40 },
  JC: { x: 64, y: 40 },
  Active: { x: 36, y: 40 },
  Passive: { x: 28, y: 40 },
};
