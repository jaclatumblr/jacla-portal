"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Terminal, Play, Pause, Trash2, Users, Eye } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { PageHeader } from "@/components/PageHeader";
import { SideNav } from "@/components/SideNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";
import { supabase } from "@/lib/supabaseClient";

type Deployment = {
    id: string;
    name: string;
    url: string;
    state: string;
    target: string;
    createdAt: number;
};

type LogEntry = {
    id: string;
    type: "stdout" | "stderr" | "request";
    text: string;
    date: number;
    requestId?: string;
    statusCode?: number;
    path?: string;
};

type LoginLogEntry = {
    id: string;
    email: string;
    display_name: string | null;
    created_at: string;
    user_agent: string | null;
};

type PageViewEntry = {
    id: string;
    path: string;
    display_name: string | null;
    created_at: string;
    event_name: string | null;
};

const LOG_COLORS: Record<string, string> = {
    stdout: "text-green-400",
    stderr: "text-red-400",
    request: "text-blue-400",
};

export default function AdminLogsPage() {
    const { isAdmin, loading: adminLoading } = useIsAdmin();
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const terminalRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // User activity logs
    const [loginLogs, setLoginLogs] = useState<LoginLogEntry[]>([]);
    const [pageViewLogs, setPageViewLogs] = useState<PageViewEntry[]>([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const activityRef = useRef<HTMLDivElement>(null);
    const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch deployments
    useEffect(() => {
        if (adminLoading || !isAdmin) return;
        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/admin/vercel/deployments");
                if (!res.ok) throw new Error("Failed to fetch deployments");
                const data = await res.json();
                if (cancelled) return;
                setDeployments(data.deployments ?? []);
                if (data.deployments?.length > 0 && !selectedDeploymentId) {
                    setSelectedDeploymentId(data.deployments[0].id);
                }
            } catch (error) {
                console.error(error);
                toast.error("デプロイメントの取得に失敗しました。");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [adminLoading, isAdmin]);

    // Fetch Vercel logs
    const fetchLogs = useCallback(async (append = false) => {
        if (!selectedDeploymentId) return;

        setLogsLoading(true);
        try {
            const since = append && logs.length > 0 ? logs[logs.length - 1].date : undefined;
            const url = `/api/admin/vercel/logs?deploymentId=${selectedDeploymentId}${since ? `&since=${since}` : ""}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch logs");
            const data = await res.json();

            if (append) {
                const newLogs = (data.logs ?? []).filter(
                    (l: LogEntry) => !logs.some((existing) => existing.id === l.id)
                );
                if (newLogs.length > 0) {
                    setLogs((prev) => [...prev, ...newLogs]);
                }
            } else {
                setLogs(data.logs ?? []);
            }
        } catch (error) {
            console.error(error);
            if (!append) {
                toast.error("ログの取得に失敗しました。");
            }
        } finally {
            setLogsLoading(false);
        }
    }, [selectedDeploymentId, logs]);

    // Fetch user activity logs
    const fetchActivityLogs = useCallback(async () => {
        setActivityLoading(true);
        try {
            const [loginRes, pageViewRes] = await Promise.all([
                supabase
                    .from("login_history")
                    .select("id, email, user_agent, created_at, profiles(display_name)")
                    .order("created_at", { ascending: false })
                    .limit(100),
                supabase
                    .from("page_views")
                    .select("id, path, created_at, profiles(display_name), events(name)")
                    .order("created_at", { ascending: false })
                    .limit(100),
            ]);

            if (loginRes.error) console.error(loginRes.error);
            if (pageViewRes.error) console.error(pageViewRes.error);

            const logins = (loginRes.data ?? []).map((row: any) => ({
                id: row.id,
                email: row.email,
                display_name: row.profiles?.display_name ?? null,
                created_at: row.created_at,
                user_agent: row.user_agent,
            }));
            setLoginLogs(logins);

            const pageViews = (pageViewRes.data ?? []).map((row: any) => ({
                id: row.id,
                path: row.path,
                display_name: row.profiles?.display_name ?? null,
                created_at: row.created_at,
                event_name: row.events?.name ?? null,
            }));
            setPageViewLogs(pageViews);
        } catch (error) {
            console.error(error);
        } finally {
            setActivityLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        if (adminLoading || !isAdmin) return;
        fetchActivityLogs();
    }, [adminLoading, isAdmin, fetchActivityLogs]);

    // Initial load and deployment change
    useEffect(() => {
        if (selectedDeploymentId) {
            setLogs([]);
            fetchLogs(false);
        }
    }, [selectedDeploymentId]);

    // Auto-refresh for Vercel logs
    useEffect(() => {
        if (autoRefresh && selectedDeploymentId) {
            intervalRef.current = setInterval(() => {
                fetchLogs(true);
            }, 5000);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [autoRefresh, selectedDeploymentId, fetchLogs]);

    // Auto-refresh for activity logs
    useEffect(() => {
        if (autoRefresh && isAdmin) {
            activityIntervalRef.current = setInterval(() => {
                fetchActivityLogs();
            }, 10000);
        } else if (activityIntervalRef.current) {
            clearInterval(activityIntervalRef.current);
            activityIntervalRef.current = null;
        }

        return () => {
            if (activityIntervalRef.current) {
                clearInterval(activityIntervalRef.current);
            }
        };
    }, [autoRefresh, isAdmin, fetchActivityLogs]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString("ja-JP", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const clearLogs = () => {
        setLogs([]);
    };

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
                        title="ログビューアー"
                        description="サーバーログとユーザーアクティビティをリアルタイムで確認できます。"
                        backHref="/admin"
                        backLabel="管理ダッシュボードに戻る"
                    />

                    <section className="pb-12 md:pb-16">
                        <div className="container mx-auto px-4 sm:px-6 space-y-4">
                            {/* Controls */}
                            <Card className="bg-card/60 border-border">
                                <CardContent className="pt-4">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant={autoRefresh ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setAutoRefresh(!autoRefresh)}
                                            >
                                                {autoRefresh ? (
                                                    <>
                                                        <Pause className="w-4 h-4 mr-2" />
                                                        停止
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="w-4 h-4 mr-2" />
                                                        自動更新
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        {autoRefresh && (
                                            <span className="text-xs text-green-500 flex items-center gap-1">
                                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                                ライブ
                                            </span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Tabs defaultValue="activity" className="space-y-4">
                                <TabsList className="grid w-full max-w-md grid-cols-2">
                                    <TabsTrigger value="activity" className="flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        ユーザーアクティビティ
                                    </TabsTrigger>
                                    <TabsTrigger value="server" className="flex items-center gap-2">
                                        <Terminal className="w-4 h-4" />
                                        サーバーログ
                                    </TabsTrigger>
                                </TabsList>

                                {/* User Activity Tab */}
                                <TabsContent value="activity" className="space-y-4">
                                    <div className="grid lg:grid-cols-2 gap-4">
                                        {/* Login History */}
                                        <Card className="bg-black border-border overflow-hidden">
                                            <CardHeader className="bg-zinc-900 border-b border-zinc-700 py-2 px-4">
                                                <CardTitle className="text-sm font-mono text-zinc-400 flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-purple-400" />
                                                    ログイン履歴
                                                    <span className="text-xs text-zinc-600">
                                                        ({loginLogs.length} entries)
                                                    </span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <div
                                                    ref={activityRef}
                                                    className="h-[400px] overflow-y-auto font-mono text-sm p-4 space-y-1"
                                                >
                                                    {activityLoading && loginLogs.length === 0 ? (
                                                        <div className="flex items-center gap-2 text-zinc-500">
                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                            読み込み中...
                                                        </div>
                                                    ) : loginLogs.length === 0 ? (
                                                        <div className="text-zinc-500">
                                                            ログイン履歴がありません。
                                                        </div>
                                                    ) : (
                                                        loginLogs.map((log) => (
                                                            <div key={log.id} className="flex gap-2 hover:bg-zinc-900/50 px-1 -mx-1 rounded">
                                                                <span className="text-zinc-600 shrink-0">
                                                                    [{formatDateTime(log.created_at)}]
                                                                </span>
                                                                <span className="text-purple-400">
                                                                    {log.display_name ?? log.email}
                                                                </span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Page Views */}
                                        <Card className="bg-black border-border overflow-hidden">
                                            <CardHeader className="bg-zinc-900 border-b border-zinc-700 py-2 px-4">
                                                <CardTitle className="text-sm font-mono text-zinc-400 flex items-center gap-2">
                                                    <Eye className="w-4 h-4 text-cyan-400" />
                                                    ページ遷移
                                                    <span className="text-xs text-zinc-600">
                                                        ({pageViewLogs.length} entries)
                                                    </span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <div className="h-[400px] overflow-y-auto font-mono text-sm p-4 space-y-1">
                                                    {activityLoading && pageViewLogs.length === 0 ? (
                                                        <div className="flex items-center gap-2 text-zinc-500">
                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                            読み込み中...
                                                        </div>
                                                    ) : pageViewLogs.length === 0 ? (
                                                        <div className="text-zinc-500">
                                                            ページ遷移履歴がありません。
                                                        </div>
                                                    ) : (
                                                        pageViewLogs.map((log) => (
                                                            <div key={log.id} className="flex gap-2 hover:bg-zinc-900/50 px-1 -mx-1 rounded">
                                                                <span className="text-zinc-600 shrink-0">
                                                                    [{formatDateTime(log.created_at)}]
                                                                </span>
                                                                <span className="text-cyan-400 shrink-0">
                                                                    {log.display_name ?? "Guest"}
                                                                </span>
                                                                <span className="text-zinc-400 truncate">
                                                                    → {log.path}
                                                                </span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                {/* Server Logs Tab */}
                                <TabsContent value="server" className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex-1 min-w-[200px] max-w-[300px]">
                                            <Select
                                                value={selectedDeploymentId ?? ""}
                                                onValueChange={(value) => setSelectedDeploymentId(value)}
                                                options={deployments.map((d) => ({
                                                    value: d.id,
                                                    label: `${d.target === "production" ? "🚀" : "🔧"} ${d.name} (${new Date(d.createdAt).toLocaleDateString("ja-JP")})`,
                                                }))}
                                                placeholder="デプロイメントを選択"
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fetchLogs(false)}
                                                disabled={!selectedDeploymentId || logsLoading}
                                            >
                                                <RefreshCw className={`w-4 h-4 mr-2 ${logsLoading ? "animate-spin" : ""}`} />
                                                更新
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={clearLogs}
                                                disabled={logs.length === 0}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                クリア
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Terminal */}
                                    <Card className="bg-black border-border overflow-hidden">
                                        <CardHeader className="bg-zinc-900 border-b border-zinc-700 py-2 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1.5">
                                                    <span className="w-3 h-3 rounded-full bg-red-500" />
                                                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                                                    <span className="w-3 h-3 rounded-full bg-green-500" />
                                                </div>
                                                <CardTitle className="text-sm font-mono text-zinc-400 flex items-center gap-2">
                                                    <Terminal className="w-4 h-4" />
                                                    Runtime Logs
                                                    <span className="text-xs text-zinc-600">
                                                        ({logs.length} entries)
                                                    </span>
                                                </CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div
                                                ref={terminalRef}
                                                className="h-[500px] overflow-y-auto font-mono text-sm p-4 space-y-1"
                                            >
                                                {loading ? (
                                                    <div className="flex items-center gap-2 text-zinc-500">
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        読み込み中...
                                                    </div>
                                                ) : logs.length === 0 ? (
                                                    <div className="text-zinc-500">
                                                        ログがありません。デプロイメントを選択してください。
                                                    </div>
                                                ) : (
                                                    logs.map((log) => (
                                                        <div key={log.id} className="flex gap-2 hover:bg-zinc-900/50 px-1 -mx-1 rounded">
                                                            <span className="text-zinc-600 shrink-0">
                                                                [{formatDate(log.date)}]
                                                            </span>
                                                            <span className={`${LOG_COLORS[log.type] ?? "text-zinc-400"}`}>
                                                                {log.text}
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                                {logsLoading && logs.length > 0 && (
                                                    <div className="flex items-center gap-2 text-zinc-500">
                                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                                        新しいログを確認中...
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Legend */}
                                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded bg-green-500/20 border border-green-500" />
                                            <span>stdout</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500" />
                                            <span>stderr</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500" />
                                            <span>request</span>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </section>
                </main>
            </div>
        </AuthGuard>
    );
}

