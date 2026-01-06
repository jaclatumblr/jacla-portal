"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "@/lib/toast";

const categoryLabels: Record<string, string> = {
  ui: "UI/UX",
  bug: "バグ報告",
  feature: "機能追加",
  other: "その他",
};

type FeedbackRow = {
  id: string;
  profile_id: string;
  category: string;
  message: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  real_name: string | null;
};

type PrivateRow = {
  profile_id: string;
  student_id: string | null;
};

export default function AdminFeedbackPage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [privates, setPrivates] = useState<PrivateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileRow>();
    profiles.forEach((profile) => map.set(profile.id, profile));
    return map;
  }, [profiles]);

  const studentMap = useMemo(() => {
    const map = new Map<string, string | null>();
    privates.forEach((row) => map.set(row.profile_id, row.student_id ?? null));
    return map;
  }, [privates]);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("feedbacks")
        .select("id, profile_id, category, message, created_at")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error("フィードバックの取得に失敗しました。");
        setFeedbacks([]);
        setProfiles([]);
        setPrivates([]);
        setLoading(false);
        return;
      }

      const feedbackRows = (data ?? []) as FeedbackRow[];
      setFeedbacks(feedbackRows);

      const ids = Array.from(new Set(feedbackRows.map((row) => row.profile_id)));
      if (ids.length === 0) {
        setProfiles([]);
        setPrivates([]);
        setLoading(false);
        return;
      }

      const [profilesRes, privateRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, real_name").in("id", ids),
        supabase.from("profile_private").select("profile_id, student_id").in("profile_id", ids),
      ]);

      if (cancelled) return;

      if (profilesRes.error) {
        console.error(profilesRes.error);
        toast.error("送信者情報の取得に失敗しました。");
        setProfiles([]);
      } else {
        setProfiles((profilesRes.data ?? []) as ProfileRow[]);
      }

      if (privateRes.error) {
        console.error(privateRes.error);
        setPrivates([]);
      } else {
        setPrivates((privateRes.data ?? []) as PrivateRow[]);
      }

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
            title="フィードバック"
            description="送信された意見を一覧で確認できます。"
            backHref="/admin"
            backLabel="管理ダッシュボードに戻る"
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6">
              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">フィードバック一覧</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      読み込み中...
                    </div>
                  ) : feedbacks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">フィードバックはまだありません。</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>日時</TableHead>
                            <TableHead>カテゴリ</TableHead>
                            <TableHead>本名</TableHead>
                            <TableHead>学籍番号</TableHead>
                            <TableHead>内容</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {feedbacks.map((row) => {
                            const profile = profileMap.get(row.profile_id);
                            const displayName =
                              profile?.real_name || profile?.display_name || "未登録";
                            const studentId = studentMap.get(row.profile_id) || "未登録";
                            return (
                              <TableRow key={row.id}>
                                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                  {new Date(row.created_at).toLocaleString("ja-JP")}
                                </TableCell>
                                <TableCell>{categoryLabels[row.category] ?? row.category}</TableCell>
                                <TableCell>{displayName}</TableCell>
                                <TableCell>{studentId}</TableCell>
                                <TableCell className="min-w-[320px]">{row.message}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
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
