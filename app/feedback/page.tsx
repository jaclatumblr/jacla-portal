"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "@/lib/toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const categories = [
  { value: "ui", label: "UI/UX" },
  { value: "bug", label: "バグ報告" },
  { value: "feature", label: "機能追加" },
  { value: "other", label: "その他" },
];

type ProfileInfo = {
  displayName: string | null;
  realName: string | null;
  studentId: string | null;
};

export default function FeedbackPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const accessToken = session?.access_token ?? null;
  const [category, setCategory] = useState("feature");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setLoadingProfile(true);
      const [profileRes, privateRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, real_name")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("profile_private")
          .select("student_id")
          .eq("profile_id", userId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (profileRes.error) {
        console.error(profileRes.error);
      }

      if (privateRes.error) {
        console.error(privateRes.error);
      }

      setProfileInfo({
        displayName: profileRes.data?.display_name ?? null,
        realName: profileRes.data?.real_name ?? null,
        studentId: privateRes.data?.student_id ?? null,
      });
      setLoadingProfile(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (!userId || !accessToken) {
      toast.error("ログイン情報が取得できませんでした。");
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        category,
        message: message.trim(),
      }),
    });

    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      mailOk?: boolean;
      mailError?: string | null;
    };

    if (!res.ok) {
      toast.error(payload.error ?? "送信に失敗しました。時間をおいて再度お試しください。");
    } else if (payload.mailOk === false) {
      toast.error("送信は保存されましたが、メール送信に失敗しました。");
      setMessage("");
    } else {
      toast.success("送信しました。ご協力ありがとうございます！");
      setMessage("");
    }
    setSubmitting(false);
  };

  const displayName = profileInfo?.realName || profileInfo?.displayName || "未登録";
  const studentId = profileInfo?.studentId || "未登録";

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Feedback"
            title="フィードバック"
            description="改善したい点や不具合を共有してください。運営が確認します。"
            size="lg"
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6">
              <Card className="bg-card/60 border-border max-w-3xl">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">ご意見フォーム</CardTitle>
                      <CardDescription>送信内容は運営側で確認します。</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground mb-4">
                    {loadingProfile ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        送信者情報を確認中...
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p>
                          送信者: <span className="text-foreground font-medium">{displayName}</span>
                        </p>
                        <p>
                          学籍番号: <span className="text-foreground font-medium">{studentId}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">カテゴリ</span>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      >
                        {categories.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">内容</span>
                      <Textarea
                        required
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="例: スマホでメニューが開きづらい / こういう機能が欲しい など"
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={submitting || !message.trim()} className="gap-2">
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        送信する
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
