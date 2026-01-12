"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useCanManageUpdates } from "@/lib/useCanManageUpdates";
import { BASE_VERSION, buildVersionMap, formatVersionLabel } from "@/lib/versioning";
import { PageHeader } from "@/components/PageHeader";
import { SideNav } from "@/components/SideNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type UpdateLogRow = {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  is_published: boolean;
  is_version_bump: boolean;
  commit_sha: string | null;
  commit_url: string | null;
  created_at: string;
};

export default function AdminUpdatesPage() {
  const { canManageUpdates, loading: accessLoading } = useCanManageUpdates();
  const { session } = useAuth();
  const [logs, setLogs] = useState<UpdateLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [bumping, setBumping] = useState(false);

  const versionMap = useMemo(() => buildVersionMap(logs, BASE_VERSION), [logs]);
  const latestVersion = logs.length
    ? versionMap.get(logs[0].id) ?? BASE_VERSION
    : BASE_VERSION;

  const loadLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("update_logs")
      .select(
        "id, title, summary, details, is_published, is_version_bump, commit_sha, commit_url, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("更新履歴の取得に失敗しました。");
      setLogs([]);
      setLoading(false);
      return;
    }

    setLogs((data ?? []) as UpdateLogRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (accessLoading || !canManageUpdates) return;
    let cancelled = false;

    (async () => {
      await loadLogs();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [accessLoading, canManageUpdates]);

  const handleSync = async () => {
    if (syncing) return;
    const accessToken = session?.access_token;
    if (!accessToken) {
      toast.error("セッションを取得できませんでした。");
      return;
    }
    setSyncing(true);
    const res = await fetch("/api/updates/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const raw = await res.text();
    let payload: { inserted?: number; error?: string; detail?: string } = {};
    if (raw) {
      try {
        payload = JSON.parse(raw) as {
          inserted?: number;
          error?: string;
          detail?: string;
        };
      } catch {
        payload = { error: raw };
      }
    }
    if (!res.ok) {
      const message = payload.error ?? "コミット同期に失敗しました。";
      const detail = payload.detail ? ` (${payload.detail})` : "";
      toast.error(`${message}${detail}`);
      setSyncing(false);
      return;
    }
    toast.success(`更新履歴を同期しました。（${payload.inserted ?? 0}件）`);
    setSyncing(false);
    await loadLogs();
  };

  const handleManualMajorBump = async () => {
    if (bumping) return;
    const accessToken = session?.access_token;
    if (!accessToken) {
      toast.error("セッションを取得できませんでした。再ログインしてください。");
      return;
    }
    setBumping(true);
    // メジャーバージョンを手動で+1するためのダミー行を追加（is_version_bump=true）
    const { error } = await supabase
      .from("update_logs")
      .insert({
        title: "メジャーバージョン更新",
        summary: "手動でメジャーバージョンを更新しました。",
        details: null,
        is_published: true,
        is_version_bump: true,
        commit_sha: null,
        commit_url: null,
      });

    if (error) {
      console.error(error);
      toast.error("メジャーバージョン更新に失敗しました。");
      setBumping(false);
      return;
    }

    toast.success("メジャーバージョンを+1しました。");
    setBumping(false);
    await loadLogs();
  };

  if (accessLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!canManageUpdates) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">
              このページにはアクセスできません。
            </p>
            <p className="text-sm text-muted-foreground">
              Administrator または Web幹事の権限が必要です。
            </p>
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
            title="更新履歴"
            description={`基準バージョン: ${formatVersionLabel(BASE_VERSION)} / 最新: ${formatVersionLabel(
              latestVersion
            )}`}
            backHref="/admin"
            backLabel="管理ダッシュボードに戻る"
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
              <Card className="bg-card/60 border-border h-fit">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">一覧</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleSync} className="gap-1" disabled={syncing}>
                      <RefreshCw className="h-4 w-4" />
                      同期
                    </Button>
                    <Button size="sm" variant="default" onClick={handleManualMajorBump} disabled={bumping}>
                      メジャー+1
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {loading ? (
                    <p className="text-xs text-muted-foreground">読み込み中...</p>
                  ) : logs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">更新履歴がありません。</p>
                  ) : (
                    logs.map((log) => {
                      const versionLabel = formatVersionLabel(versionMap.get(log.id));
                      return (
                        <button
                          key={log.id}
                          type="button"
                          onClick={() => setSelectedId(log.id)}
                          className={cn(
                            "w-full text-left rounded-md border border-border px-3 py-2 text-sm transition-colors",
                            log.id === selectedId
                              ? "bg-primary/10 border-primary/40"
                              : "hover:bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{log.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                              {versionLabel}
                            </span>
                            {log.is_version_bump && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary/40 text-primary">
                                バージョン更新
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleDateString("ja-JP")}
                          </div>
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">コミット連動の更新履歴</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    コミット文に [bump] / release: / ver: を含めるとバージョンが1つ進みます。
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>このページはコミット履歴を読み込んで更新履歴を生成します。</p>
                  <div className="space-y-1 text-xs">
                    <div>例: [bump] 仕様書の更新</div>
                    <div>例: release: 更新履歴を整備</div>
                    <div>例: ver: 1.001 UI調整</div>
                  </div>
                  <p>コミットの1行目が要約として表示されます。</p>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
