export type TimetableToneKey = "show" | "rehearsal" | "special" | "other";

type TimetableToneInput = {
  slotType?: string | null;
  slotPhase?: string | null;
  note?: string | null;
};

type TimetableToneStyle = {
  railClass: string;
  cardClass: string;
  badgeClass: string;
  barClass: string;
  textClass: string;
  chipClass: string;
};

const SPECIAL_NOTES = new Set(["集合～準備", "終了～撤収", "終了～解散", "休憩"]);

export const TIMETABLE_TONE_STYLES: Record<TimetableToneKey, TimetableToneStyle> = {
  show: {
    railClass: "before:bg-fuchsia-400/80",
    cardClass: "border-fuchsia-300/35 bg-fuchsia-500/[0.06] hover:border-fuchsia-400/55",
    badgeClass: "border-fuchsia-300/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200",
    barClass: "bg-fuchsia-400/80",
    textClass: "text-fuchsia-700 dark:text-fuchsia-300",
    chipClass: "border-fuchsia-300/35 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200",
  },
  rehearsal: {
    railClass: "before:bg-sky-400/80",
    cardClass: "border-sky-300/35 bg-sky-500/[0.06] hover:border-sky-400/55",
    badgeClass: "border-sky-300/40 bg-sky-500/10 text-sky-700 dark:text-sky-200",
    barClass: "bg-sky-400/80",
    textClass: "text-sky-700 dark:text-sky-300",
    chipClass: "border-sky-300/35 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  },
  special: {
    railClass: "before:bg-amber-400/80",
    cardClass: "border-amber-300/35 bg-amber-500/[0.06] hover:border-amber-400/55",
    badgeClass: "border-amber-300/40 bg-amber-500/10 text-amber-700 dark:text-amber-200",
    barClass: "bg-amber-400/80",
    textClass: "text-amber-700 dark:text-amber-300",
    chipClass: "border-amber-300/35 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  },
  other: {
    railClass: "before:bg-muted",
    cardClass: "border-border/70 bg-card/60 hover:border-primary/40",
    badgeClass: "border-border/60 bg-background/70 text-muted-foreground",
    barClass: "bg-muted",
    textClass: "text-muted-foreground",
    chipClass: "border-border/60 bg-background/70 text-muted-foreground",
  },
};

export const TIMETABLE_LEGEND_ITEMS = [
  { key: "rehearsal" as const, label: "リハ" },
  { key: "show" as const, label: "本番" },
  { key: "special" as const, label: "転換・付帯" },
];

export const isTimetableSpecialNote = (note?: string | null) => {
  const normalized = (note ?? "").trim();
  return SPECIAL_NOTES.has(normalized);
};

export const resolveTimetableToneKey = ({
  slotType,
  slotPhase,
  note,
}: TimetableToneInput): TimetableToneKey => {
  const normalizedNote = (note ?? "").trim();

  if (
    isTimetableSpecialNote(normalizedNote) ||
    slotType === "break" ||
    normalizedNote.includes("転換")
  ) {
    return "special";
  }

  if (slotPhase === "rehearsal_normal" || slotPhase === "rehearsal_pre") {
    return "rehearsal";
  }

  if ((slotPhase ?? "show") === "show") {
    return "show";
  }

  return "other";
};

export const getTimetableTone = (input: TimetableToneInput) => {
  const key = resolveTimetableToneKey(input);
  return {
    key,
    ...TIMETABLE_TONE_STYLES[key],
  };
};
