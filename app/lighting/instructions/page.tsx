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
import { EventSlotRow } from "@/app/types/instructions";
import { Info, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LIGHTING_SHIFT_ROLES = [
  { value: "light_op1", label: "卓操作①" },
  { value: "light_op2", label: "卓操作②" },
  { value: "light_spot", label: "スポット" },
  { value: "light_assist", label: "補助" },
] as const;

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
  const note = slot.note?.trim() ?? "";
  if (slot.slot_type === "break" || note.includes("転換")) return "転換";
  if (slot.slot_type === "mc") return "付帯作業";
  return note || "付帯作業";
};

const slotTypeLabel = (slot: EventSlotRow) => {
  if (slot.slot_type === "band") return "バンド";
  const note = slot.note?.trim() ?? "";
  if (slot.slot_type === "break" || note.includes("転換")) return "転換";
  return "付帯作業";
};

export default function LightingInstructionsPage() {
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

  const roleKeys: Set<string> = new Set(LIGHTING_SHIFT_ROLES.map((role) => role.value));
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
            kicker="Lighting"
            title="照明指示"
            description="各イベントのレパ表から、共通メモ・立ち位置・照明メモを確認できます。"
            backHref="/lighting"
            backLabel="照明ダッシュボードへ戻る"
            tone="accent"
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

                            return (
                              <InstructionCard
                                key={band.id}
                                band={band}
                                isExpanded={isExpanded}
                                onToggle={() => toggleBand(band.id)}
                                role="lighting"
                              >
                                <div className="rounded-md border border-purple-200/20 bg-purple-500/5 p-3 space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-primary">照明シフト</span>
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
                                                {slotTypeLabel(slot)}
                                              </Badge>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                              {LIGHTING_SHIFT_ROLES.map((role) => {
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

                                <div className="rounded-md border border-purple-200/20 bg-purple-500/5 p-3 space-y-2">
                                  <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                                    <Lightbulb className="w-3 h-3" />
                                    照明メモ
                                  </div>
                                  <p className="text-sm text-foreground whitespace-pre-wrap">
                                    {band.lighting_note?.trim() || "未入力"}
                                  </p>
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
                                    メンバー情報
                                  </div>
                                  <InstructionMemberTable members={memberDetails} role="lighting" />
                                </div>

                                <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                                  <div className="text-xs font-semibold text-primary">
                                    セットリスト / 照明要望
                                  </div>
                                  <InstructionSetlistTable songs={bandSongs} role="lighting" />
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
