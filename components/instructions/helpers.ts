import { EventSlotRow, SlotStaffAssignmentRow, SongRow } from "@/app/types/instructions";
import { formatTimeText } from "@/lib/time";

export const normalizeText = (value?: string | null) =>
  (value ?? "").replace(/\s+/g, " ").trim();

export const compactText = (value?: string | null, maxLength = 88) => {
  const text = normalizeText(value);
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

export const dateLabel = (value: string | null) => (value ? value.slice(0, 10) : "");

const parseTimeValue = (value: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const slotDurationLabel = (slot: EventSlotRow) => {
  const start = parseTimeValue(slot.start_time ?? null);
  const end = parseTimeValue(slot.end_time ?? null);
  if (start == null || end == null) return "";
  let duration = end - start;
  if (duration < 0) duration += 24 * 60;
  if (duration <= 0) return "";
  return ` (${duration}分)`;
};

export const slotTimeLabel = (slot: EventSlotRow) => {
  const startText = formatTimeText(slot.start_time);
  const endText = formatTimeText(slot.end_time);
  if (!startText && !endText) return "時刻未設定";
  if (startText && endText) return `${startText}-${endText}${slotDurationLabel(slot)}`;
  return startText ?? endText ?? "時刻未設定";
};

export const phaseLabel = (phase: EventSlotRow["slot_phase"]) => {
  if (phase === "rehearsal_normal") return "通常リハ";
  if (phase === "rehearsal_pre") return "直前リハ";
  return "本番";
};

export const formatCoverage = (filled: number, total: number) =>
  total === 0 ? "未設定" : `${filled}/${total}`;

export const countAssignedRoles = (
  slots: EventSlotRow[],
  assignmentsBySlot: Record<string, SlotStaffAssignmentRow[]>,
  roleKeys: Set<string>
) =>
  slots.reduce(
    (total, slot) =>
      total +
      (assignmentsBySlot[slot.id] ?? []).filter((assignment) => roleKeys.has(assignment.role))
        .length,
    0
  );

export const countSongEntries = (songs: SongRow[]) =>
  songs.filter((song) => song.entry_type !== "mc").length;

export const countMcEntries = (songs: SongRow[]) =>
  songs.filter((song) => song.entry_type === "mc").length;
