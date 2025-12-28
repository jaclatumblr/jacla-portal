// app/feedback/page.tsx
"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toast";

const categories = [
  { value: "ui", label: "UI/UX" },
  { value: "bug", label: "バグ報告" },
  { value: "feature", label: "機能追加" },
  { value: "other", label: "その他" },
];

export default function FeedbackPage() {
  const [category, setCategory] = useState("feature");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);

    const { error } = await supabase.from("feedbacks").insert([
      {
        category,
        message: message.trim(),
        contact: contact.trim() || null,
      },
    ]);

    if (error) {
      console.error(error);
      toast.error("送信に失敗しました。時間をおいて再度お試しください。");
    } else {
      toast.success("送信しました。ご協力ありがとうございます！");
      setMessage("");
      setContact("");
    }
    setSubmitting(false);
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">FEEDBACK</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">フィードバック</h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  改善アイデアや不具合を共有してください。矢内が確認します。
                </p>
              </div>
            </div>
          </section>

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
                      <CardDescription>必須: カテゴリ / 内容。連絡先は任意です。</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
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

                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">連絡先 (任意: Discord, メールなど)</span>
                      <Input
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="Discord ID や メールアドレス"
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={submitting || !message.trim()} className="gap-2">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        送信する
                      </Button>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Sparkles className="w-4 h-4 text-primary" />
                        入力内容は運営にのみ共有されます。
                      </div>
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
