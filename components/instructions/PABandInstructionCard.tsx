import { Badge } from "@/components/ui/badge";
import { InstructionCard } from "@/components/instructions/InstructionCard";
import { InstructionMemberTable } from "@/components/instructions/InstructionMemberTable";
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
import { ClipboardList, Info, Monitor, Music, Volume2 } from "@/lib/icons";
import { cn } from "@/lib/utils";

export const PA_SHIFT_ROLES = [
  { value: "pa_main", label: "PA1" },
  { value: "pa_sub", label: "PA2" },
  { value: "pa_extra", label: "PA3" },
] as const;

const PA_CONSOLE_CHANNELS = [
  { id: "top-l", label: "Top L", key: "topl" },
  { id: "top-r", label: "Top R", key: "topr" },
  { id: "f-tom", label: "F.Tom", key: "ftom" },
  { id: "l-tom", label: "L.Tom", key: "ltom" },
  { id: "h-tom", label: "H.Tom", key: "htom" },
  { id: "b-dr", label: "B.Dr", key: "bdr" },
  { id: "sdr-top", label: "S.Dr Top", key: "sdrtop" },
  { id: "sdr-bottom", label: "S.Dr Bottom", key: "sdrbottom" },
  { id: "hh", label: "H.H", key: "hh" },
  { id: "spare-1", label: "予備", key: "spare1" },
  { id: "bass-di", label: "Bass (DI)", key: "bassdi" },
  { id: "horn-1", label: "管1", key: "管1" },
  { id: "horn-2", label: "管2", key: "管2" },
  { id: "line-1", label: "LINE1", key: "line1" },
  { id: "line-2", label: "LINE2", key: "line2" },
  { id: "line-3", label: "LINE3", key: "line3" },
  { id: "line-4", label: "LINE4", key: "line4" },
  { id: "gt-1", label: "Gt1", key: "gt1" },
  { id: "gt-2", label: "Gt2", key: "gt2" },
  { id: "perc", label: "Perc.", key: "perc" },
  { id: "mc-1", label: "MC1", key: "mc1" },
  { id: "mc-2", label: "MC2", key: "mc2" },
  { id: "spare-2", label: "予備", key: "spare2" },
  { id: "spare-3", label: "予備", key: "spare3" },
  { id: "tb", label: "TB", key: "tb" },
];

const normalizeLabel = (value?: string | null) => (value ?? "").trim();
const isNumberedLabel = (label: string) => /\d+$/.test(label);
const splitLabelParts = (label: string) =>
  label.split(/[\\/／]/).map((part) => normalizeLabel(part)).filter(Boolean);
const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/\s+/g, "").replace(/\./g, "");

const buildChannelSummary = (members: BandMemberDetail[], plots: StagePlot[]) => {
  const memberLabels = members.map((member) => normalizeLabel(member.instrument)).filter(Boolean);
  const counts = new Map<string, number>();
  memberLabels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  const runningIndex = new Map<string, number>();
  const numberedMembers = memberLabels.map((label) => {
    if (isNumberedLabel(label)) return label;
    const total = counts.get(label) ?? 0;
    if (total <= 1) return label;
    const next = (runningIndex.get(label) ?? 0) + 1;
    runningIndex.set(label, next);
    return `${label}${next}`;
  });
  const itemLabels = plots
    .flatMap((plot) => plot.items)
    .map((item) => normalizeLabel(item.label))
    .filter(Boolean);
  const mcCount = members.filter((member) => member.isMc).length;
  const mcLabels = [...(mcCount >= 1 ? ["MC1"] : []), ...(mcCount >= 2 ? ["MC2"] : [])];
  const seen = new Set<string>();

  return [...numberedMembers, ...itemLabels, ...mcLabels].filter((label) => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
};

const buildChannelKeySet = (labels: string[]) => {
  const keys = new Set<string>();
  let lineCount = 0;
  let hornCount = 0;
  let guitarCount = 0;
  let mcCount = 0;
  let hasBass = false;

  labels.forEach((label) => {
    splitLabelParts(label).forEach((part) => {
      const key = normalizeKey(part);
      if (!key) return;
      keys.add(key);

      if (key === "dr" || key === "drum" || key === "drums") {
        ["topl", "topr", "ftom", "ltom", "htom", "bdr", "sdrtop", "sdrbottom", "hh"].forEach(
          (item) => keys.add(item)
        );
      }

      if (key.startsWith("line")) {
        const num = Number.parseInt(key.replace("line", ""), 10);
        lineCount = Number.isFinite(num) ? Math.max(lineCount, num) : lineCount + 1;
        return;
      }
      if (key.startsWith("mc")) {
        const num = Number.parseInt(key.replace("mc", ""), 10);
        mcCount = Number.isFinite(num) ? Math.max(mcCount, num) : mcCount + 1;
        return;
      }
      if (key.startsWith("管")) {
        const num = Number.parseInt(key.replace("管", ""), 10);
        hornCount = Number.isFinite(num) ? Math.max(hornCount, num) : hornCount + 1;
        return;
      }
      if (
        key === "key" ||
        key.startsWith("key") ||
        key.startsWith("keyboard") ||
        key.startsWith("piano") ||
        key.startsWith("syn") ||
        key.startsWith("synth") ||
        key.startsWith("wsyn")
      ) {
        lineCount += 1;
      }

      if (
        key.startsWith("sax") ||
        key.startsWith("ssax") ||
        key.startsWith("asax") ||
        key.startsWith("tsax") ||
        key.startsWith("bsax") ||
        key === "tp" ||
        key.startsWith("trumpet") ||
        key === "tb" ||
        key.startsWith("trombone") ||
        key.startsWith("horn") ||
        key === "hr" ||
        key.startsWith("eup") ||
        key === "tu" ||
        key.startsWith("fl") ||
        key.startsWith("cl") ||
        key.startsWith("bcl") ||
        key.startsWith("ob") ||
        key.startsWith("fg") ||
        key.startsWith("brass")
      ) {
        hornCount += 1;
      }

      if (
        key.startsWith("gt") ||
        key.startsWith("gtr") ||
        key.startsWith("guitar") ||
        key === "marshall" ||
        key === "jc"
      ) {
        const explicit = Number.parseInt(key.replace("gt", ""), 10);
        guitarCount = Number.isFinite(explicit) ? Math.max(guitarCount, explicit) : guitarCount + 1;
      }

      if (key === "ba" || key.startsWith("bass") || key === "active" || key === "passive") {
        hasBass = true;
      }
    });
  });

  for (let i = 1; i <= Math.min(4, lineCount); i += 1) keys.add(`line${i}`);
  if (hornCount > 0) keys.add("管1");
  if (hornCount >= 2) keys.add("管2");
  if (guitarCount > 0) keys.add("gt1");
  if (guitarCount >= 2) keys.add("gt2");
  if (mcCount > 0) keys.add("mc1");
  if (mcCount >= 2) keys.add("mc2");
  if (hasBass) keys.add("bassdi");
  return keys;
};

const summarizeChannelLabels = (labels: string[]) => {
  if (labels.length === 0) return "";
  const visible = labels.slice(0, 6).join(" / ");
  return `想定入力: ${visible}${labels.length > 6 ? ` 他${labels.length - 6}` : ""}`;
};

type PABandInstructionCardProps = {
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

export function PABandInstructionCard({
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
}: PABandInstructionCardProps) {
  const channelSummary = buildChannelSummary(memberDetails, stagePlots);
  const channelKeys = buildChannelKeySet(channelSummary);
  const channelCount = PA_CONSOLE_CHANNELS.filter(
    (channel) => channelKeys.has(channel.key) || channelKeys.has(normalizeKey(channel.label))
  ).length;
  const assignedCount = countAssignedRoles(bandSlots, assignmentsBySlot, roleKeys);
  const totalAssignmentCount = bandSlots.length * PA_SHIFT_ROLES.length;
  const songCount = countSongEntries(bandSongs);
  const mcCount = countMcEntries(bandSongs);
  const monitorCount = memberDetails.filter(
    (member) => Boolean(normalizeText(member.monitorRequest)) || Boolean(normalizeText(member.monitorNote))
  ).length;
  const firstMonitorRequest =
    memberDetails.find((member) => normalizeText(member.monitorRequest))?.monitorRequest ?? null;
  const preview =
    compactText(band.sound_note) || compactText(firstMonitorRequest) || compactText(band.general_note);
  const secondaryPreview =
    compactText(band.general_note, 72)
      ? `共通メモ: ${compactText(band.general_note, 72)}`
      : summarizeChannelLabels(channelSummary);

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
      role="pa"
      preview={preview}
      secondaryPreview={secondaryPreview}
      summaryItems={[
        { label: "卓割", value: formatCoverage(assignedCount, totalAssignmentCount) },
        {
          label: "返し要望",
          value: `${monitorCount}件`,
          tone: monitorCount > 0 ? "accent" : "muted",
        },
        {
          label: "セット",
          value: `${songCount}曲 / MC ${mcCount}`,
          tone: songCount > 0 ? "accent" : "muted",
        },
        {
          label: "想定CH",
          value: channelCount > 0 ? `${channelCount}ch` : "未推定",
          tone: channelCount > 0 ? "accent" : "muted",
        },
      ]}
    >
      <InstructionPanel
        title="卓割"
        role="pa"
        icon={ClipboardList}
        description="通常リハ、直前リハ、本番の担当者です。"
        headerRight={
          <Badge variant="outline" className={cn("h-6 text-[10px]", instructionTheme.pa.chip)}>
            {formatCoverage(assignedCount, totalAssignmentCount)}
          </Badge>
        }
      >
        {bandSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">このバンドの枠はまだありません。</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
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
                    filledRoles < PA_SHIFT_ROLES.length
                      ? "border-blue-300/25 bg-blue-500/5"
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
                        担当 {filledRoles}/{PA_SHIFT_ROLES.length}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {PA_SHIFT_ROLES.map((role) => {
                      const assignment = slotAssignments.find((item) => item.role === role.value);
                      return (
                        <div
                          key={`${slot.id}-${role.value}`}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-xs",
                            assignment
                              ? "border-blue-300/25 bg-blue-500/5"
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
          title="PAメモ"
          role="pa"
          icon={Volume2}
          emphasis="accent"
          description="バンド全体のPA要望です。最初にここを確認してください。"
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {band.sound_note?.trim() || "未入力"}
          </p>
        </InstructionPanel>

        <InstructionPanel
          title="共通メモ"
          role="pa"
          icon={Info}
          description="運営連絡や共通注意です。"
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {band.general_note?.trim() || "未入力"}
          </p>
        </InstructionPanel>
      </div>

      <InstructionPanel title="返し要望" role="pa" icon={Monitor} description="各演者の返し指示です。">
        <InstructionMemberTable members={memberDetails} role="pa" />
      </InstructionPanel>

      <InstructionPanel
        title="簡易チャンネル表"
        role="pa"
        icon={Volume2}
        emphasis="accent"
        description="立ち位置と編成から自動生成した想定入力です。"
        headerRight={
          <Badge variant="outline" className={cn("h-6 text-[10px]", instructionTheme.pa.chip)}>
            {channelCount > 0 ? `${channelCount} CH` : "未推定"}
          </Badge>
        }
      >
        {channelSummary.length === 0 ? (
          <p className="text-sm text-muted-foreground">チャンネル情報は未入力です。</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {channelSummary.map((label) => (
                <Badge
                  key={`${band.id}-${label}`}
                  variant="outline"
                  className={cn("h-6 text-[10px]", instructionTheme.pa.mutedChip)}
                >
                  {label}
                </Badge>
              ))}
            </div>
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-2 pb-2">
                {PA_CONSOLE_CHANNELS.map((channel, index) => {
                  const isActive =
                    channelKeys.has(channel.key) || channelKeys.has(normalizeKey(channel.label));

                  return (
                    <div
                      key={`ch-${band.id}-${channel.id}`}
                      className={cn(
                        "flex w-11 flex-col items-center gap-1 rounded-lg border px-1.5 py-2",
                        isActive
                          ? "border-blue-300/30 bg-blue-500/10 text-foreground"
                          : "border-border/50 bg-background/40 text-muted-foreground opacity-60"
                      )}
                    >
                      <div className="text-[9px] text-muted-foreground">{String(index + 1)}</div>
                      <div className="flex h-[20px] items-center justify-center overflow-hidden text-center text-[9px] font-semibold leading-tight">
                        {channel.label}
                      </div>
                      <div className="relative h-12 w-1.5 overflow-hidden rounded-full bg-border/50">
                        <div
                          className={cn(
                            "absolute left-0 right-0 h-2 rounded-sm",
                            isActive
                              ? "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.45)]"
                              : "bg-muted-foreground/40"
                          )}
                          style={{ bottom: isActive ? "50%" : "10%" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </InstructionPanel>

      <InstructionPanel title="立ち位置" role="pa" icon={Monitor} description="返し位置と楽器配置の確認用です。">
        <InstructionStagePlot
          plots={stagePlots}
          members={stageMembers}
          songs={bandSongs}
          role="pa"
        />
      </InstructionPanel>

      <InstructionPanel title="セットリスト / PAメモ" role="pa" icon={Music} description="曲順と楽曲ごとのPAメモです。">
        <InstructionSetlistTable songs={bandSongs} role="pa" />
      </InstructionPanel>
    </InstructionCard>
  );
}
