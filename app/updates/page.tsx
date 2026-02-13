"use client";

import { useEffect, useMemo, useState } from "react";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toast";
import { BASE_VERSION, buildVersionMap, formatVersionLabel } from "@/lib/versioning";

type UpdateLogRow = {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  is_version_bump: boolean;
  created_at: string;
};

const normalizeMultilineText = (value: string | null | undefined) => {
  if (!value) return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");
};

export default function UpdatesPage() {
  const [logs, setLogs] = useState<UpdateLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("update_logs")
        .select("id, title, summary, details, is_version_bump, created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error("更新履歴の取得に失敗しました。");
        setLogs([]);
        setLoading(false);
        return;
      }

      setLogs((data ?? []) as UpdateLogRow[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const versionMap = useMemo(() => buildVersionMap(logs, BASE_VERSION), [logs]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Updates"
            title="更新履歴"
            description="Ver.表記の更新内容をわかりやすくまとめています。"
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">読み込み中...</div>
              ) : logs.length === 0 ? (
                <div className="text-sm text-muted-foreground">更新履歴はまだありません。</div>
              ) : (
                logs.map((log) => {
                  const titleText = normalizeMultilineText(log.title);
                  const summaryText = normalizeMultilineText(log.summary);
                  const detailsText = normalizeMultilineText(log.details);
                  const versionLabel = formatVersionLabel(versionMap.get(log.id));
                  return (
                    <Card key={log.id} className="bg-card/60 border-border">
                      <CardHeader className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-lg whitespace-pre-line break-words">{titleText}</CardTitle>
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                            {versionLabel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("ja-JP")}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {summaryText && summaryText !== titleText && (
                          <p className="text-foreground whitespace-pre-line break-words">{summaryText}</p>
                        )}
                        {detailsText && (
                          <div className="text-muted-foreground whitespace-pre-line break-words">
                            {detailsText}
                          </div>
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
