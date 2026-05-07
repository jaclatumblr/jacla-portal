"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Clock, MapPin } from "@/lib/icons";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatTimeText } from "@/lib/time";
import { getDepartmentConfig, type DepartmentKey } from "@/lib/departments";

type DashboardEventRow = {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  status: string;
  open_time: string | null;
  start_time: string | null;
};

type EquipmentSummaryRow = {
  id: string;
  quantity: number;
  status: "ok" | "needs_repair" | "needs_replace" | "missing" | "loaned";
  updated_at: string;
};

function statusVariant(status: string) {
  if (status === "recruiting" || status === "募集中") return "default";
  if (status === "fixed" || status === "準備中" || status === "確定") return "secondary";
  return "outline";
}

function statusLabel(status: string) {
  if (status === "draft") return "下書き";
  if (status === "recruiting") return "募集中";
  if (status === "fixed") return "確定";
  if (status === "closed") return "終了";
  return status;
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function EventListCard({
  event,
  department,
  eventActionLabel,
  accentHoverTextClass,
  isArchive = false,
}: {
  event: DashboardEventRow;
  department: DepartmentKey;
  eventActionLabel: string;
  accentHoverTextClass: string;
  isArchive?: boolean;
}) {
  const openText = formatTimeText(event.open_time) ?? event.open_time;
  const startText = formatTimeText(event.start_time) ?? event.start_time;
  const timeLabel =
    openText && startText
      ? `開場 ${openText} / 開演 ${startText}`
      : openText
        ? `開場 ${openText}`
        : startText
          ? `開演 ${startText}`
          : "時間未定";

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isArchive ? "border-border/70 bg-card/40" : "border-border bg-card/60"
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(event.status)}>{statusLabel(event.status)}</Badge>
            {isArchive ? <Badge variant="outline">アーカイブ</Badge> : null}
            <h3 className="text-base font-semibold text-foreground">{event.name}</h3>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {formatDateLabel(event.date)}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {timeLabel}
            </span>
            <span className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="h-4 w-4 text-primary" />
              {event.venue ?? "会場未設定"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/${department}/events/${event.id}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors",
              accentHoverTextClass
            )}
          >
            {eventActionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            イベント詳細
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DepartmentDashboardPage({
  department,
}: {
  department: DepartmentKey;
}) {
  const config = getDepartmentConfig(department);
  const isPa = department === "pa";
  const accentTextClass = isPa ? "text-secondary" : "text-accent";
  const accentHoverBorderClass = isPa
    ? "hover:border-secondary/70"
    : "hover:border-accent/70";
  const accentHoverTextClass = isPa
    ? "hover:border-secondary/50 hover:text-secondary"
    : "hover:border-accent/50 hover:text-accent";

  const [events, setEvents] = useState<DashboardEventRow[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllArchivedEvents, setShowAllArchivedEvents] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [eventsRes, equipmentRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, venue, status, open_time, start_time")
          .order("date", { ascending: true }),
        supabase
          .from("equipment_items")
          .select("id, quantity, status, updated_at")
          .eq("category", config.equipmentCategory)
          .order("updated_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (eventsRes.error || equipmentRes.error) {
        console.error(eventsRes.error ?? equipmentRes.error);
        toast.error(`${config.label}ダッシュボードの取得に失敗しました。`);
        setEvents([]);
        setEquipmentItems([]);
        setLoading(false);
        return;
      }

      setEvents((eventsRes.data ?? []) as DashboardEventRow[]);
      setEquipmentItems((equipmentRes.data ?? []) as EquipmentSummaryRow[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [config.equipmentCategory, config.label]);

  const upcomingEvents = useMemo(() => {
    const today = getTodayKey();
    return events.filter((event) => event.date >= today).slice(0, 5);
  }, [events]);

  const archivedEvents = useMemo(
    () =>
      [...events]
        .filter((event) => event.date < getTodayKey())
        .sort((left, right) => right.date.localeCompare(left.date)),
    [events]
  );

  const nextEvent = upcomingEvents[0] ?? null;
  const visibleArchivedEvents = showAllArchivedEvents
    ? archivedEvents
    : archivedEvents.slice(0, 6);

  const equipmentSummary = useMemo(() => {
    const totalQuantity = equipmentItems.reduce((sum, item) => sum + item.quantity, 0);
    const attentionCount = equipmentItems.filter((item) => item.status !== "ok").length;
    const criticalCount = equipmentItems.filter(
      (item) => item.status === "missing" || item.status === "needs_replace"
    ).length;

    return {
      totalItems: equipmentItems.length,
      totalQuantity,
      attentionCount,
      criticalCount,
    };
  }, [equipmentItems]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker={config.label}
            title={config.dashboardTitle}
            description={config.dashboardDescription}
            tone={config.tone}
            size="lg"
            meta={
              <div className="grid max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-border bg-card/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    次のイベント
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {loading ? "-" : nextEvent?.name ?? "予定なし"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {loading
                      ? "読み込み中..."
                      : nextEvent
                        ? `${formatDateLabel(nextEvent.date)} / ${
                            formatTimeText(nextEvent.start_time) ?? "時間未定"
                          }`
                        : "今後のイベントはありません。アーカイブから過去イベントを確認できます。"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    要確認機材
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {loading ? "-" : `${equipmentSummary.attentionCount}件`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {loading
                      ? "読み込み中..."
                      : `欠品・要交換 ${equipmentSummary.criticalCount}件`}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/70 p-4 sm:col-span-2 xl:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    登録機材
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {loading ? "-" : `${equipmentSummary.totalItems}件`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {loading
                      ? "読み込み中..."
                      : `合計数量 ${equipmentSummary.totalQuantity}`}
                  </p>
                </div>
              </div>
            }
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto space-y-8 px-4 sm:px-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">クイックアクセス</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {config.actionCards.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.href}
                        href={action.href}
                        className={cn(
                          "group rounded-xl border border-border bg-card/60 p-4 transition-colors",
                          accentHoverBorderClass
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-5 w-5", accentTextClass)} />
                          <span className="text-sm font-semibold">{action.label}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{action.description}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">直近のイベント</h2>
                  <Badge variant="secondary">{loading ? "-" : upcomingEvents.length}</Badge>
                </div>

                {loading ? (
                  <div className="rounded-xl border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                    イベントを読み込んでいます...
                  </div>
                ) : upcomingEvents.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                    今後のイベントはありません。下のアーカイブから過去のイベントを確認できます。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingEvents.map((event) => (
                      <EventListCard
                        key={event.id}
                        event={event}
                        department={department}
                        eventActionLabel={config.eventActionLabel}
                        accentHoverTextClass={accentHoverTextClass}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">イベントアーカイブ</h2>
                    <Badge variant="secondary">{loading ? "-" : archivedEvents.length}</Badge>
                  </div>

                  {!loading && archivedEvents.length > 6 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllArchivedEvents((prev) => !prev)}
                    >
                      {showAllArchivedEvents ? "折りたたむ" : "もっと見る"}
                    </Button>
                  ) : null}
                </div>

                <p className="text-sm text-muted-foreground">
                  過去に対応したイベントのPA/照明画面を、記録としてそのまま見返せます。
                </p>

                {loading ? (
                  <div className="rounded-xl border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                    アーカイブを読み込んでいます...
                  </div>
                ) : archivedEvents.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                    まだアーカイブできる過去イベントはありません。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleArchivedEvents.map((event) => (
                      <EventListCard
                        key={event.id}
                        event={event}
                        department={department}
                        eventActionLabel={config.eventActionLabel}
                        accentHoverTextClass={accentHoverTextClass}
                        isArchive
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
