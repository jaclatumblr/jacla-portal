"use client";

import { Badge } from "@/components/ui/badge";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { useEventInstructions } from "@/app/hooks/useEventInstructions";
import { InstructionCard } from "@/components/instructions/InstructionCard";
import { InstructionSetlistTable } from "@/components/instructions/InstructionSetlistTable";
import { InstructionStagePlot } from "@/components/instructions/InstructionStagePlot";
import { InstructionMemberTable } from "@/components/instructions/InstructionMemberTable";
import { StageItem, StageMember, EventSlotRow } from "@/app/types/instructions";
import { Info, Volume2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const PA_SHIFT_ROLES = [
  { value: "pa_main", label: "PA1" },
  { value: "pa_sub", label: "PA2" },
  { value: "pa_extra", label: "PA3" },
] as const;

const normalizeLabel = (value?: string | null) => (value ?? "").trim();
const isNumberedLabel = (label: string) => /\d+$/.test(label);
const splitLabelParts = (label: string) =>
  label.split(/[\\/／]/).map((part) => normalizeLabel(part)).filter(Boolean);
const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/\s+/g, "").replace(/\./g, "");

const buildChannelSummary = (members: StageMember[], items: StageItem[]) => {
  const memberLabels = members.map((member) => normalizeLabel(member.instrument)).filter(Boolean);
  const counts = new Map<string, number>();
  memberLabels.forEach((label) => {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  const runningIndex = new Map<string, number>();
  const numberedMembers = memberLabels.map((label) => {
    if (isNumberedLabel(label)) return label;
    const total = counts.get(label) ?? 0;
    if (total <= 1) return label;
    const next = (runningIndex.get(label) ?? 0) + 1;
    runningIndex.set(label, next);
    return `${label}${next}`;
  });
  const itemLabels = items.map((item) => normalizeLabel(item.label)).filter(Boolean);
  const mcCount = members.filter((member) => member.isMc).length;
  const mcLabels = [
    ...(mcCount >= 1 ? ["MC1"] : []),
    ...(mcCount >= 2 ? ["MC2"] : []),
  ];
  const combined = [...numberedMembers, ...itemLabels, ...mcLabels];
  const seen = new Set<string>();
  return combined.filter((label) => {
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
        if (Number.isFinite(num)) {
          lineCount = Math.max(lineCount, num);
        } else {
          lineCount += 1;
        }
        return;
      }

      if (key.startsWith("mc")) {
        const num = Number.parseInt(key.replace("mc", ""), 10);
        if (Number.isFinite(num)) {
          mcCount = Math.max(mcCount, num);
        } else {
          mcCount += 1;
        }
        return;
      }

      if (key.startsWith("管")) {
        const num = Number.parseInt(key.replace("管", ""), 10);
        if (Number.isFinite(num)) {
          hornCount = Math.max(hornCount, num);
        } else {
          hornCount += 1;
        }
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
        if (Number.isFinite(explicit)) {
          guitarCount = Math.max(guitarCount, explicit);
        } else {
          guitarCount += 1;
        }
      }

      if (key === "ba" || key.startsWith("bass") || key === "active" || key === "passive") {
        hasBass = true;
      }
    });
  });

  if (lineCount > 0) {
    for (let i = 1; i <= Math.min(4, lineCount); i += 1) {
      keys.add(`line${i}`);
    }
  }
  if (hornCount > 0) {
    keys.add("管1");
    if (hornCount >= 2) keys.add("管2");
  }
  if (guitarCount > 0) {
    keys.add("gt1");
    if (guitarCount >= 2) keys.add("gt2");
  }
  if (mcCount > 0) {
    keys.add("mc1");
    if (mcCount >= 2) keys.add("mc2");
  }
  if (hasBass) keys.add("bassdi");

  return keys;
};

const dateLabel = (value: string | null) => (value ? value.slice(0, 10) : "");

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
  return `(${duration})`;
};

const slotTimeLabel = (slot: EventSlotRow) => {
  if (!slot.start_time && !slot.end_time) return "時間未設定";
  if (slot.start_time && slot.end_time) {
    return `${slot.start_time}-${slot.end_time}${slotDurationLabel(slot)}`;
  }
  return slot.start_time ?? slot.end_time ?? "時間未設定";
};

const phaseLabel = (phase: EventSlotRow["slot_phase"]) => {
  if (phase === "rehearsal_normal") return "通常リハ";
  if (phase === "rehearsal_pre") return "直前リハ";
  return "本番";
};

const slotLabel = (slot: EventSlotRow, bandNameMap: Map<string, string>) => {
  if (slot.slot_type === "band") {
    return bandNameMap.get(slot.band_id ?? "") ?? "バンド未設定";
  }
  if (slot.slot_type === "break") return "休憩";
  if (slot.slot_type === "mc") return "MC";
  return slot.note?.trim() || "その他";
};

export default function PAInstructionsPage() {
  const {
    loading,
    error,
    groupedEvents,
    stageItemsByBand,
    bandMembersByBand,
    bandMemberDetailsByBand,
    songsByBand,
    slotsByEvent,
    assignmentsBySlot,
    profilesById,
    toggleBand,
    expandedBands,
  } = useEventInstructions();

  const roleKeys = new Set(PA_SHIFT_ROLES.map((role) => role.value));
  const displayProfileName = (profileId?: string | null) => {
    if (!profileId) return "未割り当て";
    const profile = profilesById[profileId];
    return profile?.real_name ?? profile?.display_name ?? "未登録";
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="PA"
            title="PA指示"
            description="各イベントのレパ表から、共通メモ・立ち位置・PAメモを確認できます。"
            backHref="/pa"
            backLabel="PAダッシュボードへ戻る"
            tone="secondary"
            size="lg"
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6 space-y-6 max-w-5xl">
              {loading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                  指示を読み込んでいます...
                </div>
              ) : error ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-destructive">
                  {error}
                </div>
              ) : groupedEvents.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                  指示が登録されたイベントがありません。
                </div>
              ) : (
                groupedEvents.map((event) => {
                  const bandNameMap = new Map(event.bands.map((band) => [band.id, band.name]));
                  const slots = slotsByEvent[event.id] ?? [];

                  return (
                    <Card key={event.id} className="bg-card/60 border-border">
                      <CardHeader className="space-y-1">
                        <CardTitle className="text-xl flex flex-wrap items-center gap-3">
                          {event.name}
                          {event.date && (
                            <span className="text-xs text-muted-foreground font-normal">
                              {dateLabel(event.date)}
                            </span>
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{event.bands.length} バンド</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {event.bands.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            バンド情報がありません。
                          </div>
                        ) : (
                          event.bands.map((band) => {
                            const stageItems = stageItemsByBand[band.id] ?? [];
                            const stageMembers = bandMembersByBand[band.id] ?? [];
                            const memberDetails = bandMemberDetailsByBand[band.id] ?? [];
                            const bandSongs = songsByBand[band.id] ?? [];
                            const isExpanded = expandedBands[band.id] ?? false;
                            const bandSlots = slots.filter(
                              (slot) => slot.slot_type === "band" && slot.band_id === band.id
                            );

                            const channelSummary = buildChannelSummary(stageMembers, stageItems);
                            const channelKeys = buildChannelKeySet(channelSummary);
                            const channelCount = PA_CONSOLE_CHANNELS.filter(
                              (channel) =>
                                channelKeys.has(channel.key) ||
                                channelKeys.has(normalizeKey(channel.label))
                            ).length;

                            return (
                              <InstructionCard
                                key={band.id}
                                band={band}
                                isExpanded={isExpanded}
                                onToggle={() => toggleBand(band.id)}
                                role="pa"
                                channelCount={channelCount}
                              >
                                <div className="rounded-md border border-blue-200/20 bg-blue-500/5 p-3 space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-primary">PAシフト</span>
                                    <span className="text-xs text-muted-foreground">
                                      イベント: {event.name}
                                      {event.date ? ` (${dateLabel(event.date)})` : ""}
                                    </span>
                                  </div>
                                  {bandSlots.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                      このバンドの枠がまだありません。
                                    </p>
                                  ) : (
                                    <div className="space-y-3">
                                      {bandSlots.map((slot) => {
                                        const slotAssignments = (
                                          assignmentsBySlot[slot.id] ?? []
                                        ).filter((assignment) => roleKeys.has(assignment.role));

                                        return (
                                          <div
                                            key={slot.id}
                                            className="rounded-md border border-border/60 bg-background/50 p-3 space-y-2"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <div className="text-sm font-medium">
                                                {phaseLabel(slot.slot_phase)}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                {slotTimeLabel(slot)}
                                              </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                              <Badge variant="outline" className="text-[10px]">
                                                {phaseLabel(slot.slot_phase)}
                                              </Badge>
                                              <Badge variant="secondary" className="text-[10px]">
                                                {slot.slot_type.toUpperCase()}
                                              </Badge>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                              {PA_SHIFT_ROLES.map((role) => {
                                                const assignment = slotAssignments.find(
                                                  (item) => item.role === role.value
                                                );
                                                return (
                                                  <div
                                                    key={`${slot.id}-${role.value}`}
                                                    className="rounded-md border border-border/60 bg-card/60 px-2 py-1 text-xs"
                                                  >
                                                    <div className="text-[10px] text-muted-foreground">
                                                      {role.label}
                                                    </div>
                                                    <div className="font-medium">
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
                                </div>

                                <div className="rounded-md border border-blue-200/20 bg-blue-500/5 p-3 space-y-2">
                                  <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                                    <Volume2 className="w-3 h-3" />
                                    簡易チャンネル表 (自動生成)
                                  </div>
                                  {channelSummary.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                      チャンネル情報は未入力です。
                                    </p>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <div className="flex gap-2 min-w-max pb-2">
                                        {PA_CONSOLE_CHANNELS.map((channel, index) => {
                                          const isActive =
                                            channelKeys.has(channel.key) ||
                                            channelKeys.has(normalizeKey(channel.label));
                                          return (
                                            <div
                                              key={`ch-${band.id}-${channel.id}`}
                                              className={`rounded-md border px-1.5 py-2 flex flex-col items-center gap-1 w-10 ${
                                                isActive
                                                  ? "border-blue-500/30 bg-blue-500/10 text-foreground"
                                                  : "border-border/40 bg-background/30 text-muted-foreground opacity-50 grayscale"
                                              }`}
                                            >
                                              <div className="text-[9px] text-muted-foreground">
                                                {String(index + 1)}
                                              </div>
                                              <div className="h-[20px] text-[9px] font-semibold text-center leading-tight overflow-hidden flex items-center justify-center">
                                                {channel.label}
                                              </div>
                                              <div className="relative h-12 w-1.5 rounded-full bg-border/50 overflow-hidden">
                                                <div
                                                  className={`absolute left-0 right-0 h-2 rounded-sm ${
                                                    isActive
                                                      ? "bg-blue-400 shadow-[0_0_5px_rgba(59,130,246,0.5)]"
                                                      : "bg-muted-foreground/40"
                                                  }`}
                                                  style={{ bottom: isActive ? "50%" : "10%" }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                                    <Info className="w-3 h-3" />
                                    共通メモ
                                  </div>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {band.general_note?.trim() || "未入力"}
                                  </p>
                                </div>

                                <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                                  <div className="text-xs font-semibold text-primary">立ち位置</div>
                                  <InstructionStagePlot items={stageItems} members={stageMembers} />
                                </div>

                                <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                                  <div className="text-xs font-semibold text-primary">
                                    メンバー / 返しの希望
                                  </div>
                                  <InstructionMemberTable members={memberDetails} role="pa" />
                                </div>

                                <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                                  <div className="text-xs font-semibold text-primary">セットリスト</div>
                                  <InstructionSetlistTable songs={bandSongs} role="pa" />
                                </div>
                              </InstructionCard>
                            );
                          })
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
