"use client";

import Link from "next/link";
import type {
  BandMemberDetail,
  InstructionProfileRow,
  SlotStaffAssignmentRow,
  SongRow,
  StageMember,
  StagePlot,
} from "@/app/types/instructions";
import { StagePlotPreviewTabs } from "@/components/StagePlotPreviewTabs";
import { Badge } from "@/components/ui/badge";
import { compactText, phaseLabel, slotTimeLabel } from "@/components/instructions/helpers";
import { instructionTheme, type InstructionRole } from "@/components/instructions/theme";
import {
  Calendar,
  ExternalLink,
  FileText,
  Lightbulb,
  Monitor,
  Music,
  NotebookPen,
  Package,
  Users,
} from "@/lib/icons";
import { cn } from "@/lib/utils";

type BandSlotSummary = {
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

type DepartmentBandSummary = {
  id: string;
  name: string;
  repertoire_status: string | null;
  representative_name: string | null;
  general_note: string | null;
  sound_note: string | null;
  lighting_note: string | null;
  lighting_total_min: number | null;
};

type DepartmentBandSubmissionDetailProps = {
  eventId: string;
  role: InstructionRole;
  label: string;
  noteTitle: string;
  band: DepartmentBandSummary;
  slots: BandSlotSummary[];
  memberDetails: BandMemberDetail[];
  stageMembers: StageMember[];
  stagePlots: StagePlot[];
  songs: SongRow[];
  slotAssignmentsBySlot: Record<string, SlotStaffAssignmentRow[]>;
  profilesById: Record<string, InstructionProfileRow>;
};

const PA_SHIFT_ROLES = [
  { value: "pa_main", label: "PA1" },
  { value: "pa_sub", label: "PA2" },
  { value: "pa_extra", label: "PA3" },
] as const;

const LIGHTING_SHIFT_ROLES = [
  { value: "light_op1", label: "卓操作①" },
  { value: "light_op2", label: "卓操作②" },
  { value: "light_spot", label: "スポット" },
  { value: "light_assist", label: "補助" },
] as const;

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

const noteText = (value: string | null | undefined) => (hasText(value) ? value!.trim() : "未入力");

const statusLabel = (status: string | null) => (status === "submitted" ? "提出済み" : "下書き");

const songTitle = (song: SongRow) =>
  song.title?.trim() || (song.entry_type === "mc" ? "MC" : "未入力");

const formatDuration = (seconds: number | null) => {
  if (seconds == null) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const formatLightingChoice = (value: string | null) => {
  if (!value) return "-";
  if (value === "o") return "あり";
  if (value === "x") return "なし";
  if (value === "auto") return "おまかせ";
  return value;
};

const hasLightingCue = (song: SongRow) =>
  Boolean(song.lighting_spot || song.lighting_strobe || song.lighting_moving || song.lighting_color);

const formatLightingSummary = (song: SongRow) => {
  const parts: string[] = [];
  if (song.lighting_spot) parts.push(`Spot: ${formatLightingChoice(song.lighting_spot)}`);
  if (song.lighting_strobe) parts.push(`Strobe: ${formatLightingChoice(song.lighting_strobe)}`);
  if (song.lighting_moving) parts.push(`Moving: ${formatLightingChoice(song.lighting_moving)}`);
  if (hasText(song.lighting_color)) parts.push(`Color: ${song.lighting_color!.trim()}`);
  return parts.length > 0 ? parts.join(" / ") : "未入力";
};

export function DepartmentBandSubmissionDetail({
  eventId,
  role,
  label,
  noteTitle,
  band,
  slots,
  memberDetails,
  stageMembers,
  stagePlots,
  songs,
  slotAssignmentsBySlot,
  profilesById,
}: DepartmentBandSubmissionDetailProps) {
  const isPa = role === "pa";
  const showStagePlot = stagePlots.length > 0 || stageMembers.length > 0;
  const theme = instructionTheme[role];
  const primaryNote = isPa ? band.sound_note : band.lighting_note;
  const shiftRoles = isPa ? PA_SHIFT_ROLES : LIGHTING_SHIFT_ROLES;
  const summaryShiftRoles = isPa
    ? PA_SHIFT_ROLES.filter((shiftRole) => shiftRole.value !== "pa_extra")
    : LIGHTING_SHIFT_ROLES;
  const requiredShiftRoleCount = summaryShiftRoles.length;
  const slotCount = slots.length;
  const songCount = songs.filter((song) => song.entry_type !== "mc").length;
  const mcCount = songs.length - songCount;
  const monitorRequestCount = memberDetails.filter((member) =>
    hasText(member.monitorRequest)
  ).length;
  const carryInCount = memberDetails.filter((member) => hasText(member.monitorNote)).length;
  const paSongMemoCount = songs.filter((song) => hasText(song.memo)).length;
  const lightingCueCount = songs.filter(
    (song) => song.entry_type !== "mc" && hasLightingCue(song)
  ).length;
  const mcLeadCount = memberDetails.filter((member) => member.isMc).length;
  const slotSummary = compactText(
    slots.map((slot) => `${phaseLabel(slot.slot_phase)} ${slotTimeLabel(slot)}`).join(" / "),
    120
  );
  const previewPlots =
    stagePlots.length > 0
      ? stagePlots
      : stageMembers.length > 0
        ? [
            {
              id: `${band.id}-preview`,
              name: "配置図",
              items: [],
            } as StagePlot,
          ]
        : [];
  const stagePlotNameById = Object.fromEntries(stagePlots.map((plot) => [plot.id, plot.name]));
  const carryInEntries = memberDetails
    .filter((member) => hasText(member.monitorNote))
    .map((member) => ({
      id: member.id,
      instrument: member.instrument?.trim() || null,
      name: member.name,
      note: member.monitorNote!.trim(),
    }));
  const displayProfileName = (profileId?: string | null) => {
    if (!profileId) return "未割当";
    const profile = profilesById[profileId];
    return profile?.real_name ?? profile?.display_name ?? "未割当";
  };
  const shiftAssignments = shiftRoles.map((shiftRole) => {
    const profileIds = Array.from(
      new Set(
        slots.flatMap((slot) =>
          (slotAssignmentsBySlot[slot.id] ?? [])
            .filter((assignment) => assignment.role === shiftRole.value)
            .map((assignment) => assignment.profile_id)
            .filter((profileId): profileId is string => Boolean(profileId))
        )
      )
    );

    return {
      ...shiftRole,
      profileIds,
      assignedSlotCount: slots.filter((slot) =>
        (slotAssignmentsBySlot[slot.id] ?? []).some((assignment) => assignment.role === shiftRole.value)
      ).length,
    };
  });
  const assignedShiftCount = shiftAssignments.filter(
    (assignment) =>
      slots.length > 0 &&
      summaryShiftRoles.some((shiftRole) => shiftRole.value === assignment.value) &&
      assignment.assignedSlotCount === slots.length
  ).length;
  const mismatchedShiftCount = shiftAssignments.filter(
    (assignment) => assignment.profileIds.length > 1
  ).length;

  return (
    <div className="space-y-2.5 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
      <div className="space-y-2.5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
        <section
          className={cn(
            "rounded-lg border p-2.5 shadow-sm ring-1",
            theme.accentBorder,
            theme.accentSurfaceStrong,
            theme.accentRing
          )}
        >
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={cn("h-5 px-2 text-[10px]", theme.chip)}>
                  {label}
                </Badge>
                <Badge
                  variant={band.repertoire_status === "submitted" ? "default" : "secondary"}
                  className="h-5 px-2 text-[10px]"
                >
                  {statusLabel(band.repertoire_status)}
                </Badge>
                <Badge variant="outline" className="h-5 px-2 text-[10px]">
                  {hasText(primaryNote) ? `${noteTitle}あり` : `${noteTitle}未入力`}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h2 className="text-base font-semibold text-foreground sm:text-lg">{band.name}</h2>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground sm:text-xs">
                  <Users className="h-3.5 w-3.5" />
                  代表者 {hasText(band.representative_name) ? band.representative_name!.trim() : "未設定"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                {hasText(slotSummary) ? <span>{slotSummary}</span> : null}
                {band.lighting_total_min != null ? (
                  <span>照明打合せ {band.lighting_total_min} 分</span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 lg:justify-end">
              <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                対象枠 {slotCount}
              </Badge>
              <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                メンバー {memberDetails.length}
              </Badge>
              <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                {role === "pa" ? `返し ${monitorRequestCount}` : `照明キュー ${lightingCueCount}`}
              </Badge>
              <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                {songCount}曲 / MC {mcCount}
              </Badge>
            </div>
          </div>
        </section>

        <section
          className={cn(
            "grid gap-2.5 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]",
            showStagePlot ? "items-start" : ""
          )}
        >
          <div className="space-y-2.5">
            <div className="rounded-lg border border-border/70 bg-card/70 p-2.5 shadow-sm">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  メンバー情報
                </div>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {memberDetails.length} 人
                </Badge>
              </div>

              {memberDetails.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 bg-background/60 px-2.5 py-3 text-sm text-muted-foreground">
                  メンバー情報の提出はありません。
                </div>
              ) : (
                <div className="space-y-1.5">
                  {isPa && carryInEntries.length > 0 ? (
                    <div className="rounded-md border border-border/70 bg-background/70 p-2">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Package className="h-4 w-4 text-primary" />
                          持ち込み機材
                        </div>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          {carryInEntries.length} 人
                        </Badge>
                      </div>

                      <div className="grid items-start gap-1.5 sm:grid-cols-2">
                        {carryInEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-md border border-border/60 bg-card/60 px-2 py-1.5"
                          >
                            <div className="text-xs font-semibold text-foreground">
                              {entry.instrument || entry.name}
                            </div>
                            {entry.instrument ? (
                              <div className="mt-0.5 text-[11px] text-muted-foreground">{entry.name}</div>
                            ) : null}
                            <div className="mt-1 whitespace-pre-wrap text-xs text-foreground">
                              {entry.note}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {memberDetails.map((member, index) => {
                    const highlight =
                      role === "pa"
                        ? hasText(member.monitorRequest) || hasText(member.monitorNote)
                        : member.isMc;
                    const hasMonitorRequest = hasText(member.monitorRequest);
                    const hasCarryIn = hasText(member.monitorNote);

                    return (
                      <div
                        key={member.id}
                        className={cn(
                          "rounded-md border px-2.5 py-1.5",
                          highlight
                            ? `${theme.accentBorder} ${theme.accentSurface}`
                            : "border-border/70 bg-background/60"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-foreground">
                                {member.instrument || `Part ${index + 1}`}
                              </span>
                              {member.isMc ? (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                  MC
                                </Badge>
                              ) : null}
                            </div>
                            <div className="text-sm text-foreground">{member.name}</div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {role === "pa" && hasMonitorRequest ? (
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                返しあり
                              </Badge>
                            ) : null}
                            {!isPa && member.isMc ? (
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                MC導線
                              </Badge>
                            ) : null}
                            {!isPa && hasCarryIn ? (
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                持込あり
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        {hasMonitorRequest || (!isPa && hasCarryIn) ? (
                          <div className="mt-1.5 flex flex-wrap gap-1 text-xs">
                            {hasMonitorRequest ? (
                              <div className="inline-flex max-w-full items-start gap-1 rounded-md border border-blue-300/20 bg-blue-500/5 px-2 py-1 text-blue-700 dark:text-blue-300">
                                <span className="shrink-0 font-medium">返し</span>
                                <span className="whitespace-pre-wrap break-words text-foreground">
                                  {member.monitorRequest!.trim()}
                                </span>
                              </div>
                            ) : null}
                            {!isPa && hasCarryIn ? (
                              <div className="inline-flex max-w-full items-start gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-muted-foreground">
                                <span className="shrink-0 font-medium">持込</span>
                                <span className="whitespace-pre-wrap break-words text-foreground">
                                  {member.monitorNote!.trim()}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {showStagePlot ? (
              <div className="rounded-lg border border-border/70 bg-card/70 p-2.5 shadow-sm">
                <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Music className="h-4 w-4 text-primary" />
                  配置図
                </div>

                {previewPlots.length > 0 ? (
                  <StagePlotPreviewTabs
                    plots={previewPlots}
                    members={stageMembers}
                    songs={songs}
                    previewClassName="aspect-[1.45/1] sm:aspect-[1.6/1]"
                  />
                ) : (
                  <div className="rounded-md border border-dashed border-border/70 bg-background/60 px-2.5 py-3 text-sm text-muted-foreground">
                    配置図の提出はありません。
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-2.5">
            <div className="rounded-lg border border-border/70 bg-card/70 p-2.5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                共通メモ
              </div>
              <p className="whitespace-pre-wrap text-sm leading-snug text-muted-foreground">
                {noteText(band.general_note)}
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-card/70 p-2.5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                進行 / 打合せ
              </div>

              <div className="space-y-1">
                {band.lighting_total_min != null ? (
                  <div className="rounded-md border border-amber-300/20 bg-amber-500/5 px-2 py-1.5 text-sm text-foreground">
                    照明打合せ {band.lighting_total_min} 分
                  </div>
                ) : null}

                {slots.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/70 bg-background/60 px-2.5 py-2.5 text-sm text-muted-foreground">
                    バンド枠はまだありません。
                  </div>
                ) : (
                  slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="rounded-md border border-border/60 bg-background/60 px-2 py-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {phaseLabel(slot.slot_phase)}
                        </span>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          {slotTimeLabel(slot)}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-card/70 p-2.5 shadow-sm">
              <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-foreground">
                {isPa ? (
                  <Monitor className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                ) : (
                  <Lightbulb className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                )}
                {isPa ? "PAシフト" : "照明シフト"}
              </div>

              {slots.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 bg-background/60 px-2.5 py-2.5 text-sm text-muted-foreground">
                  このバンドのシフト対象枠はありません。
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-md border p-2",
                    isPa
                      ? assignedShiftCount < requiredShiftRoleCount
                        ? "border-blue-300/25 bg-blue-500/5"
                        : "border-border/70 bg-background/60"
                      : assignedShiftCount < requiredShiftRoleCount
                        ? "border-amber-300/25 bg-amber-500/5"
                        : "border-border/70 bg-background/60"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      リハ / 本番 共通
                    </Badge>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      配置 {assignedShiftCount}/{requiredShiftRoleCount}
                    </Badge>
                    {mismatchedShiftCount > 0 ? (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        枠差異 {mismatchedShiftCount}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {slots.map((slot) => (
                      <Badge key={`shift-slot-${slot.id}`} variant="outline" className="h-5 px-1.5 text-[10px]">
                        {phaseLabel(slot.slot_phase)} {slotTimeLabel(slot)}
                      </Badge>
                    ))}
                  </div>

                  <div
                    className={cn(
                      "mt-2 grid items-start gap-1.5",
                      isPa ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"
                    )}
                  >
                    {shiftAssignments.map((assignment) => {
                      const hasAssignment = assignment.profileIds.length > 0;
                      const hasMismatch = assignment.profileIds.length > 1;

                      return (
                        <div
                          key={`shift-role-${assignment.value}`}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-xs",
                            hasMismatch
                              ? "border-rose-300/30 bg-rose-500/5"
                              : hasAssignment
                                ? isPa
                                  ? "border-blue-300/25 bg-blue-500/5"
                                  : "border-amber-300/25 bg-amber-500/5"
                                : "border-border/60 bg-card/60"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] text-muted-foreground">{assignment.label}</div>
                            {hasMismatch ? (
                              <Badge variant="outline" className="h-4 px-1 text-[9px]">
                                枠差異
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-0.5 font-medium text-foreground">
                            {hasAssignment
                              ? assignment.profileIds.map((profileId) => displayProfileName(profileId)).join(" / ")
                              : "未割当"}
                          </div>
                          {hasMismatch ? (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              リハと本番で担当が一致していません。
                            </div>
                          ) : assignment.assignedSlotCount > 0 && assignment.assignedSlotCount < slots.length ? (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              一部の枠のみ割当済みです。
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border/70 bg-card/70 p-2.5 shadow-sm">
              <div className="space-y-3">
              <div>
                <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-foreground">
                  {isPa ? (
                    <Monitor className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                  ) : (
                    <Lightbulb className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  )}
                  スタッフへの指示
                </div>

                <div className="grid items-start gap-2.5 lg:grid-cols-2">
                  <div
                    className={cn(
                      "rounded-lg border p-2.5 shadow-sm",
                      isPa
                        ? "border-blue-300/30 bg-blue-500/5 ring-1 ring-blue-400/10"
                        : "border-blue-300/20 bg-blue-500/[0.03]"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        className={cn(
                          "flex items-center gap-2 text-sm font-semibold",
                          isPa
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-blue-700/80 dark:text-blue-200"
                        )}
                      >
                        <Monitor className="h-4 w-4" />
                        PAへの指示
                      </div>
                      {isPa ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          この画面の主対象
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                        返し要望 {monitorRequestCount} 件
                      </Badge>
                      <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                        曲メモ {paSongMemoCount} 件
                      </Badge>
                      <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                        持込 {carryInCount} 件
                      </Badge>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-snug text-foreground">
                      {noteText(band.sound_note)}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "rounded-lg border p-2.5 shadow-sm",
                      isPa
                        ? "border-amber-300/20 bg-amber-500/[0.03]"
                        : "border-amber-300/30 bg-amber-500/5 ring-1 ring-amber-400/10"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        className={cn(
                          "flex items-center gap-2 text-sm font-semibold",
                          isPa
                            ? "text-amber-700/80 dark:text-amber-200"
                            : "text-amber-700 dark:text-amber-300"
                        )}
                      >
                        <Lightbulb className="h-4 w-4" />
                        照明への指示
                      </div>
                      {!isPa ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          この画面の主対象
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                        照明キュー {lightingCueCount} 曲
                      </Badge>
                      <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                        MC {mcLeadCount} 人
                      </Badge>
                      {band.lighting_total_min != null ? (
                        <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                          打合せ {band.lighting_total_min} 分
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-snug text-foreground">
                      {noteText(band.lighting_note)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <NotebookPen className="h-4 w-4 text-primary" />
                    セットリスト詳細
                  </div>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {songCount}曲 / MC {mcCount}
                  </Badge>
                </div>

                {songs.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/70 bg-background/60 px-2.5 py-3 text-sm text-muted-foreground">
                    セットリストの提出はありません。
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {songs.map((song, index) => {
                      const assignedPlotName =
                        song.stagePlotId && stagePlotNameById[song.stagePlotId]
                          ? stagePlotNameById[song.stagePlotId]
                          : stagePlots.length > 1
                            ? "未指定"
                            : stagePlots[0]?.name ?? "未入力";
                      const paHighlight = hasText(song.memo);
                      const lightingHighlight = hasLightingCue(song);

                      return (
                        <div
                          key={song.id}
                          className={cn(
                            "rounded-md border p-2.5",
                            role === "pa" && paHighlight
                              ? "border-blue-300/20 bg-blue-500/5"
                              : role === "lighting" && lightingHighlight
                                ? "border-amber-300/20 bg-amber-500/5"
                                : paHighlight
                                  ? "border-blue-300/10 bg-blue-500/[0.025]"
                                  : lightingHighlight
                                    ? "border-amber-300/10 bg-amber-500/[0.025]"
                                    : "border-border/70 bg-background/60"
                          )}
                        >
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                  {song.entry_type === "mc" ? "MC" : "曲"}
                                </Badge>
                                <span className="font-mono text-xs text-muted-foreground">
                                  #{String(index + 1).padStart(2, "0")}
                                </span>
                                <span className="text-sm font-semibold text-foreground sm:text-base">
                                  {songTitle(song)}
                                </span>
                              </div>

                              {hasText(song.artist) ? (
                                <p className="mt-0.5 text-sm text-muted-foreground">{song.artist}</p>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary">{formatDuration(song.duration_sec)}</Badge>
                              {hasText(song.url) ? (
                                <a
                                  href={song.url!}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                >
                                  URL
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : null}
                            </div>
                          </div>

                          <div
                            className={cn(
                              "mt-2 grid items-start gap-1.5 md:grid-cols-2",
                              showStagePlot ? "xl:grid-cols-4" : "xl:grid-cols-3"
                            )}
                          >
                            {showStagePlot ? (
                              <div className="rounded-md border border-border/60 bg-card/60 px-2 py-1.5">
                                <div className="text-xs text-muted-foreground">配置図</div>
                                <div className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                                  {assignedPlotName}
                                </div>
                              </div>
                            ) : null}

                            <div className="rounded-md border border-border/60 bg-card/60 px-2 py-1.5">
                              <div className="text-xs text-muted-foreground">編曲・補足</div>
                              <div className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                                {noteText(song.arrangement_note)}
                              </div>
                            </div>

                            <div className="rounded-md border border-blue-300/20 bg-blue-500/5 px-2 py-1.5">
                              <div className="text-xs text-blue-700 dark:text-blue-300">PAへの指示</div>
                              <div className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                                {noteText(song.memo)}
                              </div>
                            </div>

                            <div className="rounded-md border border-amber-300/20 bg-amber-500/5 px-2 py-1.5">
                              <div className="text-xs text-amber-700 dark:text-amber-300">照明への指示</div>
                              <div className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                                {formatLightingSummary(song)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </section>

      </div>

      <div className="flex flex-wrap justify-end gap-2 text-[11px] sm:text-xs">
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
        >
          イベント詳細
          <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </Link>
        <Link
          href={`/events/${eventId}/repertoire/view?bandId=${band.id}`}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          レパ表詳細
          <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </Link>
      </div>
    </div>
  );
}
