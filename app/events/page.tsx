// app/events/page.tsx
"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Clock, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("events")
        .select("id, name, date, venue, status, open_time, start_time, note")
        .order("date", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error(error);
        setError("イベント情報の取得に失敗しました。");
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
          <section className="relative py-16 md:py-24 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl pt-12 md:pt-0">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">EVENTS</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">
                  イベント一覧
                </h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                  ライブやコンサートのスケジュール確認、レパートリー提出、タイムテーブル閲覧ができます。
                </p>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                {loading ? (
                  <div className="text-sm text-muted-foreground">読み込み中...</div>
                ) : error ? (
                  <div className="text-sm text-destructive">{error}</div>
                ) : events.length === 0 ? (
                  <div className="text-sm text-muted-foreground">イベントがありません。</div>
                ) : (
                  events.map((event, index) => {
                    const timeRange =
                      event.open_time && event.start_time
                        ? `${event.open_time} - ${event.start_time}`
                        : "時間未定";
                    return (
                      <Link key={event.id} href={`/events/${event.id}`} className="group block">
                        <div className="relative p-4 sm:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all duration-300">
                          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

                          <div className="relative">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-4">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <h3 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                  {event.name}
                                </h3>
                                <Badge variant={statusVariant(event.status)}>
                                  {statusLabel(event.status)}
                                </Badge>
                              </div>
                              <ArrowRight className="hidden sm:block w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                            </div>

                            <p className="text-muted-foreground mb-4 text-sm sm:text-base line-clamp-2">
                              {event.note ?? "詳細を確認できます。"}
                            </p>

                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 sm:gap-6 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="w-4 h-4 text-primary shrink-0" />
                                <span className="truncate">{event.date}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="w-4 h-4 text-primary shrink-0" />
                                <span className="truncate">{timeRange}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="w-4 h-4 text-primary shrink-0" />
                                <span className="truncate">{event.venue ?? "未設定"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
