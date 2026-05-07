import { Badge } from "@/components/ui/badge";
import { InstructionCard } from "@/components/instructions/InstructionCard";
import { InstructionMemberTable } from "@/components/instructions/InstructionMemberTable";
import { InstructionMetric } from "@/components/instructions/InstructionMetric";
import { InstructionPanel } from "@/components/instructions/InstructionPanel";
import { InstructionSetlistTable } from "@/components/instructions/InstructionSetlistTable";
import { InstructionStagePlot } from "@/components/instructions/InstructionStagePlot";
import { instructionTheme } from "@/components/instructions/theme";
import {
  compactText,
  countAssignedRoles,
  countMcEntries,
  countSongEntries,
  formatCoverage,
  normalizeText,
  phaseLabel,
  slotTimeLabel,
} from "@/components/instructions/helpers";
import {
  BandMemberDetail,
  BandNoteRow,
  EventSlotRow,
  InstructionProfileRow,
  SlotStaffAssignmentRow,
  SongRow,
  StageMember,
  StagePlot,
} from "@/app/types/instructions";
import { ClipboardList, Info, Lightbulb, Monitor, Music } from "@/lib/icons";
import { cn } from "@/lib/utils";

export const LIGHTING_SHIFT_ROLES = [
  { value: "light_op1", label: "卓操作①" },
  { value: "light_op2", label: "卓操作②" },
  { value: "light_spot", label: "スポット" },
  { value: "light_assist", label: "補助" },
] as const;

const hasCueInput = (song: SongRow) =>
  Boolean(song.lighting_spot || song.lighting_strobe || song.lighting_moving || song.lighting_color);

type LightingBandInstructionCardProps = {
  band: BandNoteRow;
  stagePlots: StagePlot[];
  stageMembers: StageMember[];
  memberDetails: BandMemberDetail[];
  bandSongs: SongRow[];
  bandSlots: EventSlotRow[];
  assignmentsBySlot: Record<string, SlotStaffAssignmentRow[]>;
  profilesById: Record<string, InstructionProfileRow>;
  roleKeys: Set<string>;
  isExpanded: boolean;
  onToggle: () => void;
};

export function LightingBandInstructionCard({
  band,
  stagePlots,
  stageMembers,
  memberDetails,
  bandSongs,
  bandSlots,
  assignmentsBySlot,
  profilesById,
  roleKeys,
  isExpanded,
  onToggle,
}: LightingBandInstructionCardProps) {
  const assignedCount = countAssignedRoles(bandSlots, assignmentsBySlot, roleKeys);
  const totalAssignmentCount = bandSlots.length * LIGHTING_SHIFT_ROLES.length;
  const songCount = countSongEntries(bandSongs);
  const mcCount = countMcEntries(bandSongs);
  const cueSongCount = bandSongs.filter((song) => song.entry_type !== "mc" && hasCueInput(song)).length;
  const colorCount = bandSongs.filter(
    (song) => song.entry_type !== "mc" && Boolean(normalizeText(song.lighting_color))
  ).length;
  const spotCount = bandSongs.filter((song) => song.lighting_spot === "o").length;
  const strobeCount = bandSongs.filter((song) => song.lighting_strobe === "o").length;
  const movingCount = bandSongs.filter((song) => song.lighting_moving === "o").length;
  const preview =
    compactText(band.lighting_note) ||
    compactText(bandSongs.find((song) => normalizeText(song.lighting_color))?.lighting_color) ||
    compactText(band.general_note);
  const secondaryPreview = compactText(band.general_note, 72)
    ? `共通メモ: ${compactText(band.general_note, 72)}`
    : cueSongCount > 0
      ? `照明指定あり ${cueSongCount} 曲 / 色指定 ${colorCount} 曲`
      : "";

  const displayProfileName = (profileId?: string | null) => {
    if (!profileId) return "未割り当て";
    const profile = profilesById[profileId];
    return profile?.real_name ?? profile?.display_name ?? "未登録";
  };

  return (
    <InstructionCard
      band={band}
      isExpanded={isExpanded}
      onToggle={onToggle}
      role="lighting"
      preview={preview}
      secondaryPreview={secondaryPreview}
      summaryItems={[
        { label: "卓割", value: formatCoverage(assignedCount, totalAssignmentCount) },
        {
          label: "照明キュー",
          value: `${cueSongCount}曲`,
          tone: cueSongCount > 0 ? "accent" : "muted",
        },
        {
          label: "色指定",
          value: `${colorCount}曲`,
          tone: colorCount > 0 ? "accent" : "muted",
        },
        {
          label: "セット",
          value: `${songCount}曲 / MC ${mcCount}`,
          tone: songCount > 0 ? "accent" : "muted",
        },
      ]}
    >
      <InstructionPanel
        title="卓割"
        role="lighting"
        icon={ClipboardList}
        description="通常リハ、直前リハ、本番の担当者です。"
        headerRight={
          <Badge variant="outline" className={cn("h-6 text-[10px]", instructionTheme.lighting.chip)}>
            {formatCoverage(assignedCount, totalAssignmentCount)}
          </Badge>
        }
      >
        {bandSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">このバンドの枠はまだありません。</p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {bandSlots.map((slot) => {
              const slotAssignments = (assignmentsBySlot[slot.id] ?? []).filter((assignment) =>
                roleKeys.has(assignment.role)
              );
              const filledRoles = slotAssignments.length;

              return (
                <div
                  key={slot.id}
                  className={cn(
                    "rounded-xl border p-3",
                    filledRoles < LIGHTING_SHIFT_ROLES.length
                      ? "border-amber-300/25 bg-amber-500/5"
                      : "border-border/70 bg-background/60"
                  )}
                >
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">{phaseLabel(slot.slot_phase)}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {slotTimeLabel(slot)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        担当 {filledRoles}/{LIGHTING_SHIFT_ROLES.length}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {LIGHTING_SHIFT_ROLES.map((role) => {
                      const assignment = slotAssignments.find((item) => item.role === role.value);
                      return (
                        <div
                          key={`${slot.id}-${role.value}`}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-xs",
                            assignment
                              ? "border-amber-300/25 bg-amber-500/5"
                              : "border-border/60 bg-card/60"
                          )}
                        >
                          <div className="text-[10px] text-muted-foreground">{role.label}</div>
                          <div className="mt-1 font-medium text-foreground">
                            {displayProfileName(assignment?.profile_id)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </InstructionPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <InstructionPanel
          title="照明メモ"
          role="lighting"
          icon={Lightbulb}
          emphasis="accent"
          description="バンド全体の照明要望です。最初にここを確認してください。"
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {band.lighting_note?.trim() || "未入力"}
          </p>
        </InstructionPanel>

        <InstructionPanel
          title="共通メモ"
          role="lighting"
          icon={Info}
          description="運営連絡や共通注意です。"
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {band.general_note?.trim() || "未入力"}
          </p>
        </InstructionPanel>
      </div>

      <InstructionPanel
        title="キュー要約"
        role="lighting"
        icon={Lightbulb}
        emphasis="accent"
        description="楽曲ごとの照明指定を先に集約しています。"
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <InstructionMetric label="照明指定" value={`${cueSongCount}曲`} role="lighting" />
          <InstructionMetric label="スポット" value={`${spotCount}曲`} role="lighting" />
          <InstructionMetric label="ストロボ" value={`${strobeCount}曲`} role="lighting" />
          <InstructionMetric label="ムービング" value={`${movingCount}曲`} role="lighting" />
        </div>
      </InstructionPanel>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <InstructionPanel title="立ち位置" role="lighting" icon={Monitor} description="スポット位置とMC導線の確認用です。">
          <InstructionStagePlot
            plots={stagePlots}
            members={stageMembers}
            songs={bandSongs}
            role="lighting"
          />
        </InstructionPanel>

        <InstructionPanel title="演者 / MC" role="lighting" icon={Monitor} description="照明目線で演者とMC位置を確認します。">
          <InstructionMemberTable members={memberDetails} role="lighting" />
        </InstructionPanel>
      </div>

      <InstructionPanel
        title="セットリスト / 照明要望"
        role="lighting"
        icon={Music}
        description="曲順、キュー、色イメージを確認します。"
      >
        <InstructionSetlistTable songs={bandSongs} role="lighting" />
      </InstructionPanel>
    </InstructionCard>
  );
}
