"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { useEventInstructions } from "@/app/hooks/useEventInstructions";
import { InstructionMetric } from "@/components/instructions/InstructionMetric";
import {
  LIGHTING_SHIFT_ROLES,
  LightingBandInstructionCard,
} from "@/components/instructions/LightingBandInstructionCard";
import {
  countAssignedRoles,
  dateLabel,
  formatCoverage,
} from "@/components/instructions/helpers";
import { instructionTheme } from "@/components/instructions/theme";
import { cn } from "@/lib/utils";

const LIGHTING_WORKFLOW = [
  {
    title: "卓割を先に確認",
    detail: "通常リハ、直前リハ、本番の担当を最初に確定します。",
  },
  {
    title: "照明メモを確認",
    detail: "バンド全体の照明要望と共通メモで演出方針を揃えます。",
  },
  {
    title: "キューと立ち位置",
    detail: "曲ごとの指定、色イメージ、MC導線を確認して本番動線を詰めます。",
  },
] as const;

export default function LightingInstructionsPage() {
  const {
    loading,
    error,
    groupedEvents,
    stagePlotsByBand,
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

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Lighting"
            title="照明指示"
            description="卓割、照明メモ、キュー、立ち位置を照明卓向けの順番で確認できます。"
            backHref="/lighting"
            backLabel="照明ダッシュボードへ戻る"
            tone="accent"
            size="lg"
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
              <section
                className={cn(
                  "rounded-2xl border p-4 shadow-sm",
                  instructionTheme.lighting.accentBorder,
                  instructionTheme.lighting.accentSurfaceStrong
                )}
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-200">
                    Lighting Workflow
                  </p>
                  <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-50">
                    照明卓で先に見る順番
                  </h2>
                  <p className="text-sm leading-relaxed text-amber-700/80 dark:text-amber-100/80">
                    担当、照明メモ、曲ごとのキュー、立ち位置を一連で追えるように整理しています。
                  </p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {LIGHTING_WORKFLOW.map((step, index) => (
                    <div
                      key={step.title}
                      className="rounded-xl border border-amber-300/20 bg-background/70 p-3"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
                        Step {index + 1}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">{step.title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {step.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

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
                  const slots = slotsByEvent[event.id] ?? [];
                  const bandSlotsInEvent = slots.filter((slot) => slot.slot_type === "band");
                  const bandCountInEvent =
                    new Set(
                      bandSlotsInEvent
                        .filter((slot) => Boolean(slot.band_id))
                        .map((slot) => slot.band_id as string)
                    ).size || event.bands.length;
                  const eventAssignedCount = countAssignedRoles(
                    bandSlotsInEvent,
                    assignmentsBySlot,
                    roleKeys
                  );
                  const eventTotalAssignments =
                    bandSlotsInEvent.length * LIGHTING_SHIFT_ROLES.length;

                  return (
                    <Card key={event.id} className="border-border/70 bg-card/60 shadow-sm">
                      <CardHeader className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1">
                            <CardTitle className="flex flex-wrap items-center gap-3 text-xl">
                              {event.name}
                              {event.date ? (
                                <span className="text-xs font-normal text-muted-foreground">
                                  {dateLabel(event.date)}
                                </span>
                              ) : null}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              照明指示対象 {event.bands.length} バンド
                            </p>
                          </div>

                          <Badge
                            variant="outline"
                            className={cn("h-6 text-[10px]", instructionTheme.lighting.chip)}
                          >
                            照明卓
                          </Badge>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <InstructionMetric
                            label="バンド"
                            value={`${event.bands.length}件`}
                            role="lighting"
                          />
                          <InstructionMetric
                            label="対象バンド"
                            value={`${bandCountInEvent}バンド`}
                            role="lighting"
                            tone="muted"
                          />
                          <InstructionMetric
                            label="卓割"
                            value={formatCoverage(eventAssignedCount, eventTotalAssignments)}
                            role="lighting"
                          />
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {event.bands.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            バンド情報がありません。
                          </div>
                        ) : (
                          event.bands.map((band) => (
                            <LightingBandInstructionCard
                              key={band.id}
                              band={band}
                              stagePlots={stagePlotsByBand[band.id] ?? []}
                              stageMembers={bandMembersByBand[band.id] ?? []}
                              memberDetails={bandMemberDetailsByBand[band.id] ?? []}
                              bandSongs={songsByBand[band.id] ?? []}
                              bandSlots={slots.filter(
                                (slot) => slot.slot_type === "band" && slot.band_id === band.id
                              )}
                              assignmentsBySlot={assignmentsBySlot}
                              profilesById={profilesById}
                              roleKeys={roleKeys}
                              isExpanded={expandedBands[band.id] ?? false}
                              onToggle={() => toggleBand(band.id)}
                            />
                          ))
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
