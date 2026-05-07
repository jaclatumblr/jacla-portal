// app/events/page.tsx
"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Clock, MapPin } from "@/lib/icons";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SkeletonEventCard } from "@/components/ui/skeleton";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { groupItemsByFiscalYear } from "@/lib/fiscalYear";
import { toast } from "@/lib/toast";
import { formatTimeText } from "@/lib/time";

type EventRow = {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  status: string;
  open_time: string | null;
  start_time: string | null;
  note: string | null;
};

function statusVariant(status: string) {
  if (status === "recruiting" || status === "募集中") return "default";
  if (status === "fixed" || status === "準備中" || status === "確定") return "secondary";
  if (status === "closed") return "outline";
  return "outline";
}

function statusLabel(status: string) {
  if (status === "draft") return "下書き";
  if (status === "recruiting") return "募集中";
  if (status === "fixed") return "確定";
  if (status === "closed") return "終了";
  return status;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const fiscalYearSections = useMemo(() => groupItemsByFiscalYear(events), [events]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("events")
        .select("id, name, date, venue, status, open_time, start_time, note, created_at")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error("イベント情報の取得に失敗しました。");
        setEvents([]);
      } else {
        setEvents((data ?? []) as EventRow[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Events"
            title="イベント一覧"
            description="ライブやコンサートのスケジュール確認、レパートリー提出、タイムテーブル閲覧ができます。"
            size="lg"
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                {loading ? (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <SkeletonEventCard key={i} />
                    ))}
                  </>
                ) : events.length === 0 ? (
                  <div className="text-sm text-muted-foreground">イベントがありません。</div>
                ) : (
                  fiscalYearSections.map((section) => (
                    <div key={section.fiscalYear} className="space-y-3 md:space-y-4">
                      <div className="flex items-center gap-3 border-b border-border/70 pb-2">
                        <h2 className="text-lg font-semibold text-foreground">{section.label}</h2>
                        <Badge variant="secondary">{section.items.length}</Badge>
                      </div>

                      <div className="space-y-4">
                        {section.items.map((event, index) => {
                          const openText = formatTimeText(event.open_time) ?? event.open_time;
                          const startText = formatTimeText(event.start_time) ?? event.start_time;
                          const timeRange =
                            openText && startText ? `${openText} - ${startText}` : "時間未定";
                          return (
                            <Link key={event.id} href={`/events/${event.id}`} className="group block">
                              <div className="relative rounded-lg border border-border bg-card/50 p-4 transition-all duration-300 hover:border-primary/50 sm:p-6">
                                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                                <div className="relative">
                                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span className="font-mono text-xs text-muted-foreground">
                                        {String(index + 1).padStart(2, "0")}
                                      </span>
                                      <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary sm:text-xl">
                                        {event.name}
                                      </h3>
                                      <Badge variant={statusVariant(event.status)}>
                                        {statusLabel(event.status)}
                                      </Badge>
                                    </div>
                                    <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary sm:block" />
                                  </div>

                                  <p className="mb-4 line-clamp-2 text-sm text-muted-foreground sm:text-base">
                                    {event.note ?? "詳細を確認できます。"}
                                  </p>

                                  <div className="grid grid-cols-2 items-center gap-3 text-sm sm:flex sm:flex-wrap sm:gap-6">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar className="h-4 w-4 shrink-0 text-primary" />
                                      <span className="truncate">{event.date}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Clock className="h-4 w-4 shrink-0 text-primary" />
                                      <span className="truncate">{timeRange}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                                      <span className="truncate">{event.venue ?? "未設定"}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
