"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  Lightbulb,
  Music,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

type EventSummary = {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  status: string;
};

type AnnouncementSummary = {
  id: string;
  title: string;
  date: string;
  isNew: boolean;
};

const myTasks = [
  {
    id: 1,
    title: "春ライブ レパートリー提出",
    deadline: "2025-03-01",
    type: "提出",
    urgent: true,
    link: "/me/tasks",
  },
  {
    id: 2,
    title: "新歓コンサート バンドメンバー確認",
    deadline: "2025-03-15",
    type: "確認",
    urgent: false,
    link: "/events",
  },
  {
    id: 3,
    title: "PA機材点検（担当）",
    deadline: "2025-02-15",
    type: "担当",
    urgent: false,
    link: "/pa",
  },
];

const todayShifts = [{ event: "練習日", role: "PA担当", time: "14:00 - 18:00" }];

function statusVariant(status: string) {
  if (status === "募集中") return "default";
  if (status === "準備中") return "secondary";
  return "outline";
}

export default function DashboardPage() {
  const { session } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<EventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [recentAnnouncements, setRecentAnnouncements] = useState<AnnouncementSummary[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const userLabel = useMemo(() => {
    const meta = session?.user.user_metadata as Record<string, unknown> | undefined;
    const name = typeof meta?.full_name === "string" ? meta.full_name : undefined;
    const displayName = name || session?.user.email || "ユーザー";
    return displayName;
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setEventsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("id, name, date, venue, status")
        .order("date", { ascending: true })
        .limit(2);

      if (cancelled) return;

      if (error) {
        console.error(error);
        setUpcomingEvents([]);
      } else {
        setUpcomingEvents((data ?? []) as EventSummary[]);
      }
      setEventsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setAnnouncementsLoading(true);
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, published_at, created_at, is_pinned")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(2);

      if (cancelled) return;

      if (error) {
        console.error(error);
        setRecentAnnouncements([]);
      } else {
        const now = Date.now();
        const mapped = (data ?? []).map((row) => {
          const entry = row as {
            id: string;
            title: string;
            published_at?: string | null;
            created_at?: string | null;
          };
          const dateValue = entry.published_at ?? entry.created_at;
          const isNew =
            dateValue ? now - new Date(dateValue).getTime() < 1000 * 60 * 60 * 24 * 7 : false;
          return {
            id: entry.id,
            title: entry.title,
            date: dateValue ? new Date(dateValue).toLocaleDateString("ja-JP") : "",
            isNew,
          };
        });
        setRecentAnnouncements(mapped);
      }
      setAnnouncementsLoading(false);
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
            kicker="Dashboard"
            title={`おかえりなさい${session ? `、${userLabel}さん` : ""}`}
            description="今日の予定と、やることを確認しましょう"
          />

          <section className="py-6 md:py-8">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-4 md:gap-6">
                <div className="lg:col-span-2 space-y-4 md:space-y-6">
                  {todayShifts.length > 0 && (
                    <div className="p-4 md:p-6 bg-primary/10 border border-primary/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-primary" />
                        <h2 className="font-bold text-lg">今日の担当</h2>
                      </div>
                      {todayShifts.map((shift, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{shift.event}</p>
                            <p className="text-sm text-muted-foreground">{shift.role}</p>
                          </div>
                          <Badge variant="default">{shift.time}</Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                        <h2 className="font-bold text-lg">やること</h2>
                      </div>
                      <Link href="/me/tasks" className="text-sm text-primary hover:underline">
                        すべて見る
                      </Link>
                    </div>
                    <div className="space-y-3">
                      {myTasks.map((task) => (
                        <Link
                          key={task.id}
                          href={task.link}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            task.urgent
                              ? "border-orange-500/50 bg-orange-500/5"
                              : "border-border bg-background/50"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                task.urgent ? "bg-orange-500" : "bg-muted-foreground"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{task.title}</p>
                              <p className="text-xs text-muted-foreground">??: {task.deadline}</p>
                            </div>
                          </div>
                          <Badge variant={task.urgent ? "destructive" : "outline"} className="shrink-0 text-xs">
                            {task.type}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        <h2 className="font-bold text-lg">直近イベント</h2>
                      </div>
                      <Link href="/events" className="text-sm text-primary hover:underline">
                        すべて見る
                      </Link>
                    </div>

                    {eventsLoading ? (
                      <div className="text-sm text-muted-foreground">読み込み中...</div>
                    ) : upcomingEvents.length === 0 ? (
                      <div className="text-sm text-muted-foreground">直近のイベントがありません。</div>
                    ) : (
                      <div className="space-y-3">
                        {upcomingEvents.map((event) => (
                          <Link
                            key={event.id}
                            href={`/events/${event.id}`}
                            className="group flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-all"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                                {event.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {event.date}
                                {event.venue ? `・${event.venue}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant={statusVariant(event.status)}
                                className="text-xs"
                              >
                                {event.status}
                              </Badge>
                              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 md:space-y-6">
                  <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                    <h2 className="font-bold mb-4">クイックアクセス</h2>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href="/pa"
                        className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-secondary/50 hover:bg-secondary/5 transition-all"
                      >
                        <Music className="w-5 h-5 text-secondary" />
                        <span className="text-xs font-medium">PA</span>
                      </Link>
                      <Link
                        href="/lighting"
                        className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
                      >
                        <Lightbulb className="w-5 h-5 text-accent" />
                        <span className="text-xs font-medium">照明</span>
                      </Link>
                      <Link
                        href="/announcements"
                        className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <Bell className="w-5 h-5 text-primary" />
                        <span className="text-xs font-medium">お知らせ</span>
                      </Link>
                      <Link
                        href="/members"
                        className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <Users className="w-5 h-5 text-primary" />
                        <span className="text-xs font-medium">部員一覧</span>
                      </Link>
                    </div>
                  </div>

                  <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary" />
                        <h2 className="font-bold">お知らせ</h2>
                      </div>
                      <Link href="/announcements" className="text-sm text-primary hover:underline">
                        すべて
                      </Link>
                    </div>
                    <div className="space-y-3">
                      {announcementsLoading ? (
                        <div className="text-sm text-muted-foreground">読み込み中...</div>
                      ) : recentAnnouncements.length === 0 ? (
                        <div className="text-sm text-muted-foreground">お知らせがありません。</div>
                      ) : (
                        recentAnnouncements.map((announcement) => (
                          <Link
                            key={announcement.id}
                            href={`/announcements/${announcement.id}`}
                            className="block group"
                          >
                            <div className="flex items-start gap-2">
                              {announcement.isNew && (
                                <Badge className="bg-red-500 text-white text-xs shrink-0">NEW</Badge>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                                  {announcement.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">{announcement.date}</p>
                              </div>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <h2 className="font-bold">ステータス</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ポータルは正常に動作しています。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}

