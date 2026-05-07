export type InstructionRole = "pa" | "lighting";

export const instructionTheme = {
  pa: {
    label: "PA",
    accentText: "text-blue-700 dark:text-blue-300",
    accentSoftText: "text-blue-700 dark:text-blue-200",
    accentStrongText: "text-blue-800 dark:text-blue-100",
    accentBorder: "border-blue-300/30",
    accentSurface: "bg-blue-500/5",
    accentSurfaceStrong: "bg-blue-500/10",
    accentRing: "ring-blue-400/20",
    chip: "border-blue-300/30 bg-blue-500/10 text-blue-700 dark:text-blue-100",
    mutedChip: "border-blue-300/20 bg-blue-500/5 text-blue-700/80 dark:text-blue-200/80",
  },
  lighting: {
    label: "Lighting",
    accentText: "text-amber-700 dark:text-amber-300",
    accentSoftText: "text-amber-700 dark:text-amber-200",
    accentStrongText: "text-amber-800 dark:text-amber-100",
    accentBorder: "border-amber-300/30",
    accentSurface: "bg-amber-500/5",
    accentSurfaceStrong: "bg-amber-500/10",
    accentRing: "ring-amber-400/20",
    chip: "border-amber-300/30 bg-amber-500/10 text-amber-700 dark:text-amber-100",
    mutedChip: "border-amber-300/20 bg-amber-500/5 text-amber-700/80 dark:text-amber-200/80",
  },
} as const;
