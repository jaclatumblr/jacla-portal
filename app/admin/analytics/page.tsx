"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, TrendingUp, Users, Eye } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { PageHeader } from "@/components/PageHeader";
import { SideNav } from "@/components/SideNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/lib/toast";

type LoginHistoryRow = {
  id: string;
  user_id: string;
  email: string | null;
  user_agent: string | null;
  created_at: string;
  profiles: { display_name: string | null; real_name: string | null } | null | { display_name: string | null; real_name: string | null }[];
};

type PageViewRow = {
  id: string;
  user_id: string | null;
  path: string;
  event_id: string | null;
  created_at: string;
  profiles: { display_name: string | null; real_name: string | null } | null | { display_name: string | null; real_name: string | null }[];
  events: { name: string | null } | null | { name: string | null }[];
};

type EventSummary = {
  id: string;
  name: string;
  count: number;
};

type DateCount = {
  date: string;
  count: number;
};

const resolveProfileName = (profiles: LoginHistoryRow["profiles"]) => {
  const profile = Array.isArray(profiles) ? profiles[0] ?? null : profiles;
  return profile?.real_name ?? profile?.display_name ?? "未登録";
};

const resolveEventName = (events: PageViewRow["events"]) => {
  const event = Array.isArray(events) ? events[0] ?? null : events;
  return event?.name ?? "イベント未登録";
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const aggregateByDate = (data: { created_at: string }[], days: number): DateCount[] => {
  const counts = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Initialize last N days with 0
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    counts.set(d.toISOString().slice(0, 10), 0);
  }

  // Count entries
  data.forEach((row) => {
    const dateKey = row.created_at.slice(0, 10);
    if (counts.has(dateKey)) {
      counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
    }
  });

  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date: formatDate(date), count }));
};

const CHART_COLORS = {
  login: "#3b82f6",
  pageView: "#10b981",
  event: ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"],
};

export default function AdminAnalyticsPage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRow[]>([]);
  const [pageViews, setPageViews] = useState<PageViewRow[]>([]);
  const [eventSummary, setEventSummary] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoginTable, setShowLoginTable] = useState(false);
  const [showPageViewTable, setShowPageViewTable] = useState(false);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [loginRes, pageRes] = await Promise.all([
        supabase
          .from("login_history")
          .select("id, user_id, email, user_agent, created_at, profiles(display_name, real_name)")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("page_views")
          .select("id, user_id, path, event_id, created_at, profiles(display_name, real_name), events(name)")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

      if (cancelled) return;

      if (loginRes.error || pageRes.error) {
        console.error(loginRes.error ?? pageRes.error);
        toast.error("ログ情報の取得に失敗しました。");
        setLoginHistory([]);
        setPageViews([]);
        setEventSummary([]);
        setLoading(false);
        return;
      }

      const nextLogin = (loginRes.data ?? []) as LoginHistoryRow[];
      const nextViews = (pageRes.data ?? []) as PageViewRow[];
      setLoginHistory(nextLogin);
      setPageViews(nextViews);

      const eventCounts = new Map<string, number>();
      nextViews.forEach((row) => {
        if (!row.event_id) return;
        eventCounts.set(row.event_id, (eventCounts.get(row.event_id) ?? 0) + 1);
      });
      const summaries: EventSummary[] = Array.from(eventCounts.entries()).map(
        ([id, count]) => {
          const matching = nextViews.find((row) => row.event_id === id);
          const name = matching ? resolveEventName(matching.events) : "イベント未登録";
          return { id, name, count };
        }
      );
      summaries.sort((a, b) => b.count - a.count);
      setEventSummary(summaries.slice(0, 10));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [adminLoading, isAdmin]);

  const loginsByDate = useMemo(() => aggregateByDate(loginHistory, 14), [loginHistory]);
  const viewsByDate = useMemo(() => aggregateByDate(pageViews, 14), [pageViews]);

  const totalLogins = useMemo(() => loginsByDate.reduce((sum, d) => sum + d.count, 0), [loginsByDate]);
  const totalViews = useMemo(() => viewsByDate.reduce((sum, d) => sum + d.count, 0), [viewsByDate]);

  if (adminLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">権限を確認しています...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">管理者のみアクセスできます。</p>
            <p className="text-sm text-muted-foreground">管理者にお問い合わせください。</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Admin"
            title="ログ / 分析"
            description="ログイン履歴やページ閲覧を確認できます。"
            backHref="/admin"
            backLabel="管理ダッシュボードに戻る"
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-card/60 border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">過去14日間のログイン</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{loading ? "-" : totalLogins}</div>
                    <p className="text-xs text-muted-foreground">回</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">過去14日間のPV</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{loading ? "-" : totalViews}</div>
                    <p className="text-xs text-muted-foreground">ページビュー</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">イベント数</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{loading ? "-" : eventSummary.length}</div>
                    <p className="text-xs text-muted-foreground">アクティブイベント</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Login Chart */}
                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      ログイン履歴（日別）
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground h-[200px] justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        読み込み中...
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={loginsByDate}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                          />
                          <Bar dataKey="count" fill={CHART_COLORS.login} radius={[4, 4, 0, 0]} name="ログイン数" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    <button
                      onClick={() => setShowLoginTable(!showLoginTable)}
                      className="mt-3 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showLoginTable ? "詳細を閉じる" : "詳細を表示"}
                    </button>
                    {showLoginTable && (
                      <div className="mt-3 overflow-x-auto max-h-[300px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>日時</TableHead>
                              <TableHead>名前</TableHead>
                              <TableHead>メール</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loginHistory.slice(0, 50).map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                  {new Date(row.created_at).toLocaleString("ja-JP")}
                                </TableCell>
                                <TableCell>{resolveProfileName(row.profiles)}</TableCell>
                                <TableCell>{row.email ?? "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Page View Chart */}
                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="w-5 h-5 text-emerald-500" />
                      ページ閲覧（日別）
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground h-[200px] justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        読み込み中...
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={viewsByDate}>
                          <defs>
                            <linearGradient id="colorPageView" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={CHART_COLORS.pageView} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={CHART_COLORS.pageView} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke={CHART_COLORS.pageView}
                            fillOpacity={1}
                            fill="url(#colorPageView)"
                            name="ページビュー"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                    <button
                      onClick={() => setShowPageViewTable(!showPageViewTable)}
                      className="mt-3 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showPageViewTable ? "詳細を閉じる" : "詳細を表示"}
                    </button>
                    {showPageViewTable && (
                      <div className="mt-3 overflow-x-auto max-h-[300px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>日時</TableHead>
                              <TableHead>名前</TableHead>
                              <TableHead>ページ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageViews.slice(0, 50).map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                  {new Date(row.created_at).toLocaleString("ja-JP")}
                                </TableCell>
                                <TableCell>{resolveProfileName(row.profiles)}</TableCell>
                                <TableCell className="text-xs">{row.path}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Event Access Chart */}
              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                    イベント別アクセス（Top 10）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground h-[250px] justify-center">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      読み込み中...
                    </div>
                  ) : eventSummary.length === 0 ? (
                    <p className="text-sm text-muted-foreground">イベントアクセスがありません。</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(250, eventSummary.length * 40)}>
                      <BarChart data={eventSummary} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                          width={100}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} name="アクセス数">
                          {eventSummary.map((entry, index) => (
                            <Cell key={`cell-${entry.id}`} fill={CHART_COLORS.event[index % CHART_COLORS.event.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}

