"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
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

const resolveProfileName = (profiles: LoginHistoryRow["profiles"]) => {
  const profile = Array.isArray(profiles) ? profiles[0] ?? null : profiles;
  return profile?.real_name ?? profile?.display_name ?? "未登録";
};

const resolveEventName = (events: PageViewRow["events"]) => {
  const event = Array.isArray(events) ? events[0] ?? null : events;
  return event?.name ?? "イベント未登録";
};

export default function AdminAnalyticsPage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRow[]>([]);
  const [pageViews, setPageViews] = useState<PageViewRow[]>([]);
  const [eventSummary, setEventSummary] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

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
          .limit(120),
        supabase
          .from("page_views")
          .select("id, user_id, path, event_id, created_at, profiles(display_name, real_name), events(name)")
          .order("created_at", { ascending: false })
          .limit(300),
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
      setEventSummary(summaries);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [adminLoading, isAdmin]);

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
              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">ログイン履歴</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      読み込み中...
                    </div>
                  ) : loginHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">ログイン履歴がありません。</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>日時</TableHead>
                            <TableHead>名前</TableHead>
                            <TableHead>メール</TableHead>
                            <TableHead>端末情報</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loginHistory.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {new Date(row.created_at).toLocaleString("ja-JP")}
                              </TableCell>
                              <TableCell>{resolveProfileName(row.profiles)}</TableCell>
                              <TableCell>{row.email ?? "-"}</TableCell>
                              <TableCell className="max-w-[360px] truncate text-xs text-muted-foreground">
                                {row.user_agent ?? "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">ページ閲覧</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        読み込み中...
                      </div>
                    ) : pageViews.length === 0 ? (
                      <p className="text-sm text-muted-foreground">閲覧ログがありません。</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>日時</TableHead>
                              <TableHead>名前</TableHead>
                              <TableHead>ページ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageViews.map((row) => (
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

                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">イベント別アクセス</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        読み込み中...
                      </div>
                    ) : eventSummary.length === 0 ? (
                      <p className="text-sm text-muted-foreground">イベントアクセスがありません。</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>イベント</TableHead>
                              <TableHead className="text-right">アクセス数</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {eventSummary.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="text-sm">{row.name}</TableCell>
                                <TableCell className="text-right">{row.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
