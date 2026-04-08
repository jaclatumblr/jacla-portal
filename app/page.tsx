"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, Calendar, ChevronDown, Clock, Guitar, Lightbulb, MapPin, Music, Pin, Users } from "@/lib/icons";
import { AuthGuard } from "@/lib/AuthGuard";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { SideNav } from "@/components/SideNav";
import { supabase } from "@/lib/supabaseClient";
import { formatTimeText } from "@/lib/time";

type AnnouncementSummary = { id: string; title: string; content: string; date: string; category: string; isPinned: boolean };
type HomeEventSummary = { id: string; name: string; date: string; venue: string | null; status: string; openTime: string | null; startTime: string | null };
type CalendarDay = { key: string; dayNumber: number; inCurrentMonth: boolean; isToday: boolean; eventCount: number };

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const FEATURE_CARDS = [
  { href: "/events", icon: Calendar, title: "イベント", description: "ライブやコンサートの予定、募集状況、詳細ページにすぐアクセスできます。" },
  { href: "/bands", icon: Guitar, title: "バンドを組む", description: "出演イベントごとのバンド編成やメンバー調整をまとめて進められます。" },
  { href: "/members", icon: Users, title: "部員一覧", description: "プロフィールや担当、つながりたい部員をポータル上ですぐ確認できます。" },
  { href: "/announcements", icon: Bell, title: "お知らせ", description: "運営連絡や更新情報を見逃さずに追える通知ハブです。" },
  { href: "/pa", icon: Music, title: "PA", description: "機材情報やオペレーションの導線をひとまとめで確認できます。" },
  { href: "/lighting", icon: Lightbulb, title: "照明", description: "照明まわりのガイドやイベント導線にそのままつながります。" },
] as const;

function parseDateValue(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(year, (month || 1) - 1, day || 1); }
function formatDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function createMonthStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function shiftMonth(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function isSameMonthDate(left: Date, right: Date) { return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth(); }
function formatMonthLabel(date: Date) { return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(date); }
function formatDayLabel(value: string) { return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short" }).format(parseDateValue(value)); }
function formatStatusLabel(status: string) { if (status === "draft") return "Draft"; if (status === "recruiting") return "Open"; if (status === "fixed") return "Fixed"; if (status === "closed") return "Closed"; return status; }
function statusBadgeTone(status: string) { if (status === "recruiting") return "border-primary/30 bg-primary/10 text-primary"; if (status === "fixed") return "border-secondary/30 bg-secondary/10 text-secondary"; if (status === "closed") return "border-border bg-muted/70 text-muted-foreground"; return "border-border bg-card text-foreground"; }
function formatEventTimeLabel(event: HomeEventSummary) { const openText = formatTimeText(event.openTime); const startText = formatTimeText(event.startTime); if (openText && startText) return `${openText} - ${startText}`; return startText ?? openText ?? "Time TBD"; }
function buildCalendarDays(month: Date, eventCountByDate: Record<string, number>) {
  const monthStart = createMonthStart(month);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - startOffset);
  const todayKey = formatDateKey(new Date());
  const days: CalendarDay[] = [];
  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    const key = formatDateKey(cellDate);
    const inCurrentMonth = isSameMonthDate(cellDate, monthStart);
    days.push({ key, dayNumber: cellDate.getDate(), inCurrentMonth, isToday: key === todayKey, eventCount: inCurrentMonth ? eventCountByDate[key] ?? 0 : 0 });
  }
  return days;
}

export default function HomePage() {
  const [announcements, setAnnouncements] = useState<AnnouncementSummary[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState<HomeEventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(() => createMonthStart(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAnnouncementsLoading(true);
      const { data, error } = await supabase.from("announcements").select("id, title, content, category, is_pinned, published_at, created_at").eq("is_published", true).order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).order("created_at", { ascending: false }).limit(3);
      if (cancelled) return;
      if (error) {
        console.error(error);
        setAnnouncements([]);
      } else {
        setAnnouncements((data ?? []).map((row) => {
          const entry = row as { id: string; title: string; content: string; category: string; is_pinned?: boolean | null; published_at?: string | null; created_at?: string | null };
          const dateValue = entry.published_at ?? entry.created_at;
          return { id: entry.id, title: entry.title, content: entry.content, category: entry.category, isPinned: Boolean(entry.is_pinned), date: dateValue ? new Date(dateValue).toLocaleDateString("ja-JP") : "" };
        }));
      }
      setAnnouncementsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEventsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("id, name, date, venue, status, open_time, start_time")
        .not("date", "is", null)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setCalendarEvents([]);
      } else {
        setCalendarEvents((data ?? []).map((row) => {
          const entry = row as { id: string; name: string; date: string; venue?: string | null; status?: string | null; open_time?: string | null; start_time?: string | null };
          return { id: entry.id, name: entry.name, date: entry.date, venue: entry.venue ?? null, status: entry.status ?? "", openTime: entry.open_time ?? null, startTime: entry.start_time ?? null };
        }));
      }
      setEventsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const visibleDateKeys = Array.from(new Set(calendarEvents.filter((event) => isSameMonthDate(parseDateValue(event.date), calendarMonth)).map((event) => event.date))).sort();
    const today = new Date();
    const todayKey = formatDateKey(today);
    const isCurrentMonthView = isSameMonthDate(calendarMonth, today);

    if (isCurrentMonthView) {
      setSelectedDateKey((current) =>
        current && isSameMonthDate(parseDateValue(current), calendarMonth) ? current : todayKey
      );
      return;
    }

    if (visibleDateKeys.length === 0) {
      setSelectedDateKey(null);
      return;
    }

    setSelectedDateKey((current) => {
      if (current && visibleDateKeys.includes(current)) return current;
      return visibleDateKeys[0];
    });
  }, [calendarEvents, calendarMonth]);

  const eventCountByDate = calendarEvents.reduce<Record<string, number>>((acc, event) => { acc[event.date] = (acc[event.date] ?? 0) + 1; return acc; }, {});
  const calendarDays = buildCalendarDays(calendarMonth, eventCountByDate);
  const visibleMonthEvents = calendarEvents.filter((event) => isSameMonthDate(parseDateValue(event.date), calendarMonth));
  const visibleEventsByDate = visibleMonthEvents.reduce<Record<string, HomeEventSummary[]>>((acc, event) => { acc[event.date] ??= []; acc[event.date].push(event); return acc; }, {});
  const visibleDateKeys = Object.keys(visibleEventsByDate).sort();
  const selectedDayEvents = selectedDateKey ? visibleEventsByDate[selectedDateKey] ?? [] : [];

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <SideNav />
        <main className="flex flex-1 flex-col bg-background md:ml-20">
          <section
            id="home"
            className="order-1 relative flex min-h-[calc(100svh-var(--mobile-topbar-height,0px))] items-center justify-center overflow-hidden px-4 sm:px-6 md:min-h-screen"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/14" />
            <div
              aria-hidden="true"
              className="hero-aurora-drift absolute inset-[-20%] opacity-85"
              style={{
                backgroundImage: `radial-gradient(circle at 18% 24%, color-mix(in oklab, var(--primary) 28%, transparent) 0, transparent 38%),
                  radial-gradient(circle at 78% 30%, color-mix(in oklab, var(--secondary) 24%, transparent) 0, transparent 32%),
                  radial-gradient(circle at 56% 76%, color-mix(in oklab, var(--primary) 20%, transparent) 0, transparent 40%)`,
              }}
            />
            <div aria-hidden="true" className="hero-orb-float absolute left-[8%] top-[16%] h-[24rem] w-[24rem] rounded-full bg-primary/12 blur-3xl" />
            <div aria-hidden="true" className="hero-orb-float-delayed absolute bottom-[8%] right-[6%] h-[30rem] w-[30rem] rounded-full bg-secondary/12 blur-3xl" />
            <div aria-hidden="true" className="hero-orb-pulse absolute left-1/2 top-1/2 h-[21rem] w-[21rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div
              aria-hidden="true"
              className="hero-beam-drift absolute inset-[-14%] opacity-80"
              style={{
                backgroundImage: `linear-gradient(122deg, transparent 28%, color-mix(in oklab, var(--primary) 16%, transparent) 46%, transparent 64%),
                  linear-gradient(302deg, transparent 34%, color-mix(in oklab, var(--secondary) 15%, transparent) 50%, transparent 68%)`,
              }}
            />
            <div className="hero-grid-drift absolute inset-0 mix-blend-multiply dark:mix-blend-normal">
              <div
                className="h-full w-full opacity-[0.22] dark:opacity-[0.14]"
                style={{
                  backgroundImage: `linear-gradient(var(--hero-grid-minor) 1.25px, transparent 1.25px),
                              linear-gradient(90deg, var(--hero-grid-minor) 1.25px, transparent 1.25px)`,
                  backgroundSize: "92px 92px",
                }}
              />
              <div
                className="absolute inset-0 opacity-[0.2] dark:opacity-[0.12]"
                style={{
                  backgroundImage: `linear-gradient(var(--hero-grid-major) 1.6px, transparent 1.6px),
                              linear-gradient(90deg, var(--hero-grid-major) 1.6px, transparent 1.6px)`,
                  backgroundSize: "368px 368px",
                }}
              />
            </div>

            <div className="relative z-10 py-16 text-center sm:py-20 md:py-24">
              <div className="mb-6 md:mb-8">
                <Image
                  src="/images/jacla-logo.png"
                  alt="Jacla logo"
                  width={200}
                  height={120}
                  className="mx-auto w-32 object-contain sm:w-40 md:w-[200px]"
                  priority
                />
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl">
                <span className="text-foreground">総合音楽部</span>
                <span className="mt-2 block text-primary">Jacla</span>
              </h1>
              <p className="mx-auto mb-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg md:mb-8 md:text-xl">
                部員専用ポータルサイト。<br />
                イベント、連絡、編成づくりをひとつの場所にまとめています。
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                <Link href="#calendar" className="w-full rounded bg-primary px-8 py-3 text-center font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto">
                  カレンダーを見る
                </Link>
                <Link href="/bands" className="w-full rounded border border-border px-8 py-3 text-center font-medium text-foreground transition-colors hover:border-primary hover:text-primary sm:w-auto">
                  バンドを組む
                </Link>
                <PwaInstallButton />
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 animate-bounce" style={{ bottom: "calc(env(safe-area-inset-bottom) + clamp(1.25rem, 4vh, 2.5rem))" }}>
              <span className="text-xs tracking-widest text-muted-foreground">SCROLL</span>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="absolute left-8 top-8 hidden h-16 w-16 border-l-2 border-t-2 border-primary/30 sm:block" />
            <div className="absolute bottom-8 right-8 hidden h-16 w-16 border-b-2 border-r-2 border-primary/30 sm:block" />
          </section>
          <section id="calendar" className="order-3 relative overflow-hidden py-10 md:py-14">
            <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
                <div>
                  <span className="font-mono text-xs tracking-[0.3em] text-primary">EVENT CALENDAR</span>
                  <h2 className="mt-4 text-3xl font-bold sm:text-4xl md:text-5xl">予定を月で見る</h2>
                  <p className="mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
                    今月から先のイベントをホームで確認できるようにしました。日付を選ぶと、その日の予定が右側に出ます。
                  </p>
                </div>
                <Link href="/events" className="flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80">
                  イベント一覧へ
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
                <div className="rounded-[24px] border border-border/80 bg-card/70 p-4 shadow-[0_20px_72px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">View Month</p>
                      <h3 className="mt-2 text-xl font-semibold sm:text-2xl">{formatMonthLabel(calendarMonth)}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background/80 text-foreground transition hover:border-primary/40 hover:text-primary" aria-label="前の月へ">
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background/80 text-foreground transition hover:border-primary/40 hover:text-primary" aria-label="次の月へ">
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/90">
                    {WEEKDAY_LABELS.map((label) => (
                      <div key={label} className="pb-1">{label}</div>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2">
                    {calendarDays.map((day) => {
                      const isSelected = selectedDateKey === day.key;
                      const isInteractive = day.inCurrentMonth && day.eventCount > 0;
                      const baseClass = day.inCurrentMonth ? "border-border/80 bg-background/70 text-foreground" : "border-transparent bg-transparent text-muted-foreground/35";
                      const activeClass = isSelected ? "border-primary/50 bg-primary/10 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_16%,transparent)]" : isInteractive ? "hover:border-primary/40 hover:bg-primary/[0.05]" : "";
                      const todayClass = day.isToday ? "ring-1 ring-primary/35" : "";
                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => { if (isInteractive) setSelectedDateKey(day.key); }}
                          disabled={!isInteractive}
                          aria-pressed={isSelected}
                          className={`flex min-h-[70px] flex-col rounded-xl border p-2 text-left transition sm:min-h-[82px] sm:p-2.5 ${baseClass} ${activeClass} ${todayClass} ${!isInteractive ? "cursor-default" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`text-sm font-semibold sm:text-base ${day.inCurrentMonth ? "" : "opacity-50"}`}>{day.dayNumber}</span>
                            {day.eventCount > 0 && <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{day.eventCount}</span>}
                          </div>
                          <div className="mt-auto flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-primary/80">
                            <span className={`h-1.5 w-1.5 rounded-full ${day.eventCount > 0 ? "bg-current" : "bg-transparent"}`} />
                            <span>{day.eventCount > 0 ? "Event" : ""}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/80 bg-card/70 p-4 shadow-[0_20px_72px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Day Focus</p>
                      <h3 className="mt-2 text-xl font-semibold sm:text-2xl">
                        {selectedDateKey ? formatDayLabel(selectedDateKey) : `${formatMonthLabel(calendarMonth)} の予定`}
                      </h3>
                    </div>
                    <Calendar className="mt-1 h-5 w-5 text-primary" />
                  </div>

                  {eventsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, index) => (
                        <div key={index} className="h-20 animate-pulse rounded-xl border border-border/70 bg-background/60" />
                      ))}
                    </div>
                  ) : visibleMonthEvents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-5 py-10 text-center">
                      <Calendar className="mx-auto h-6 w-6 text-primary/70" />
                      <p className="mt-4 text-sm font-medium text-foreground">この月のイベントはまだありません</p>
                      <p className="mt-2 text-sm text-muted-foreground">次の月へ進むか、イベント一覧から全体を確認してください。</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {selectedDayEvents.map((event) => (
                          <Link key={event.id} href={`/events/${event.id}`} className="group block rounded-2xl border border-border/80 bg-background/70 p-4 transition hover:border-primary/40 hover:bg-primary/[0.04]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${statusBadgeTone(event.status)}`}>{formatStatusLabel(event.status)}</span>
                                <h4 className="mt-3 truncate text-base font-semibold transition-colors group-hover:text-primary">{event.name}</h4>
                              </div>
                              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                            </div>
                            <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                              <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-primary" />{formatEventTimeLabel(event)}</span>
                              <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" />{event.venue ?? "Venue TBD"}</span>
                            </div>
                          </Link>
                        ))}
                      </div>

                      <div className="mt-5 border-t border-border/70 pt-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Month Agenda</p>
                          <span className="text-xs text-muted-foreground">{visibleMonthEvents.length} items</span>
                        </div>
                        <div className="space-y-2">
                          {visibleDateKeys.map((dateKey) => {
                            const dayEvents = visibleEventsByDate[dateKey] ?? [];
                            const isActive = dateKey === selectedDateKey;
                            return (
                              <button
                                key={dateKey}
                                type="button"
                                onClick={() => setSelectedDateKey(dateKey)}
                                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${isActive ? "border-primary/40 bg-primary/[0.06] text-primary" : "border-border/70 bg-background/60 text-foreground hover:border-primary/30 hover:bg-primary/[0.03]"}`}
                              >
                                <span className="font-medium">{formatDayLabel(dateKey)}</span>
                                <span className="text-xs text-muted-foreground">{dayEvents.length} scheduled</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
          <section id="announcements" className="order-2 relative bg-card/30 py-16 md:py-24">
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-12">
                <div>
                  <span className="font-mono text-xs tracking-[0.3em] text-primary">ANNOUNCEMENTS</span>
                  <h2 className="mt-4 text-3xl font-bold sm:text-4xl md:text-5xl">お知らせ</h2>
                </div>
                <Link href="/announcements" className="flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80">
                  すべて見る
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid max-w-4xl gap-4 md:gap-6">
                {announcementsLoading ? (
                  <div className="text-sm text-muted-foreground">読み込み中...</div>
                ) : announcements.length === 0 ? (
                  <div className="text-sm text-muted-foreground">お知らせはまだありません。</div>
                ) : (
                  announcements.map((announcement) => {
                    const tone = announcement.category === "緊急"
                      ? "bg-destructive/10 text-destructive"
                      : announcement.category === "イベント"
                        ? "bg-secondary/10 text-secondary"
                        : announcement.category === "募集"
                          ? "bg-orange-500/10 text-orange-500"
                          : "bg-muted text-muted-foreground";

                    return (
                      <Link
                        key={announcement.id}
                        href={`/announcements/${announcement.id}`}
                        className={`group relative block rounded-lg border bg-card p-4 transition-all duration-300 hover:border-primary/30 md:p-6 ${announcement.isPinned ? "border-primary/50" : "border-border"}`}
                        aria-label={`お知らせ: ${announcement.title}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                          <div className="flex shrink-0 items-center gap-2">
                            {announcement.isPinned && <Pin className="h-4 w-4 text-primary" />}
                            <span className={`rounded px-2 py-1 text-xs ${tone}`}>{announcement.category}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                              <h3 className="font-bold text-foreground">{announcement.title}</h3>
                              <span className="font-mono text-xs text-muted-foreground">{announcement.date}</span>
                            </div>
                            <p className="line-clamp-2 text-sm text-muted-foreground">{announcement.content}</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <section id="features" className="order-4 relative min-h-screen py-16 md:py-24">
            <div className="absolute inset-0 bg-gradient-to-b from-background via-card/50 to-background" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="mb-12 text-center md:mb-16">
                <span className="font-mono text-xs tracking-[0.3em] text-primary">FEATURES</span>
                <h2 className="mb-4 mt-4 text-3xl font-bold sm:text-4xl md:mb-6 md:text-5xl">ポータルでできること</h2>
                <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
                  活動に必要な導線をまとめて、イベント当日の動きまでスムーズにつなげます。
                </p>
              </div>

              <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
                {FEATURE_CARDS.map((feature, index) => (
                  <Link key={feature.href} href={feature.href} className="group">
                    <div className="relative h-56 overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:border-primary/50 md:h-64">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="relative flex h-full flex-col p-4 md:p-6">
                        <div className="mb-3 flex items-center justify-between md:mb-4">
                          <feature.icon className="h-6 w-6 text-primary md:h-8 md:w-8" />
                          <span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                        </div>
                        <h3 className="mb-2 text-lg font-bold md:text-xl">{feature.title}</h3>
                        <p className="flex-1 text-xs text-muted-foreground md:text-sm">{feature.description}</p>
                        <div className="mt-4 flex items-center gap-2 text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
                          <span>開く</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
