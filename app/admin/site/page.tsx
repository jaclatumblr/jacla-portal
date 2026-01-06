"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Unlock } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { SideNav } from "@/components/SideNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";

export default function AdminSitePage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("id, is_open")
        .eq("id", 1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error("サイト設定の取得に失敗しました。");
        setIsOpen(null);
        return;
      }

      if (!data) {
        const { error: insertError } = await supabase
          .from("site_settings")
          .insert([{ id: 1, is_open: true }]);
        if (insertError) {
          console.error(insertError);
          toast.error("サイト設定の初期化に失敗しました。");
          setIsOpen(null);
          return;
        }
        setIsOpen(true);
        return;
      }

      setIsOpen(Boolean((data as { is_open?: boolean }).is_open));
    })();

    return () => {
      cancelled = true;
    };
  }, [adminLoading, isAdmin]);

  const handleToggle = async (nextOpen: boolean) => {
    if (isOpen === null || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({ is_open: nextOpen, updated_by: userId })
      .eq("id", 1);
    if (error) {
      console.error(error);
      toast.error("サイト設定の更新に失敗しました。");
      setSaving(false);
      return;
    }
    setIsOpen(nextOpen);
    toast.success(nextOpen ? "サイトを公開しました。" : "サイトをクローズしました。");
    setSaving(false);
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
            title="サイト公開設定"
            description="サイトの公開 / クローズを切り替えます。"
            backHref="/admin"
            backLabel="管理ダッシュボードに戻る"
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6">
              <Card className="bg-card/60 border-border max-w-xl">
                <CardHeader>
                  <CardTitle className="text-lg">公開ステータス</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">現在の状態</p>
                      <div className="flex items-center gap-2">
                        {isOpen === null ? (
                          <span className="text-sm text-muted-foreground">読み込み中...</span>
                        ) : isOpen ? (
                          <>
                            <Badge>公開中</Badge>
                            <span className="text-xs text-muted-foreground">
                              通常通りアクセスできます
                            </span>
                          </>
                        ) : (
                          <>
                            <Badge variant="secondary">クローズ中</Badge>
                            <span className="text-xs text-muted-foreground">
                              管理者のみアクセス可能
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={isOpen ? "default" : "outline"}
                      onClick={() => handleToggle(true)}
                      disabled={saving || isOpen === true}
                      className="gap-2"
                    >
                      <Unlock className="h-4 w-4" />
                      公開する
                    </Button>
                    <Button
                      type="button"
                      variant={!isOpen ? "destructive" : "outline"}
                      onClick={() => handleToggle(false)}
                      disabled={saving || isOpen === false}
                      className="gap-2"
                    >
                      <Lock className="h-4 w-4" />
                      クローズする
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
