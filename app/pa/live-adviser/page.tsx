import Link from "next/link";
import { ArrowLeft, Sparkles, Waves, Headphones } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";

export default function PALiveAdviserPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <section className="relative py-16 md:py-20 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-secondary/5 to-transparent" />
            <div className="absolute top-0 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl pt-10 md:pt-0">
                <Link href="/pa" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-4">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">PAダッシュボードへ戻る</span>
                </Link>
                <span className="text-xs text-secondary tracking-[0.3em] font-mono">PA</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">Live Adviser</h1>
                <p className="text-muted-foreground text-base md:text-lg">
                  本番中の気付きや改善ポイントを記録し、次の曲・次のバンドへフィードバックします。
                </p>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6 space-y-6 max-w-5xl">
              <div className="grid sm:grid-cols-3 gap-4">
                <Card className="border-border bg-card/60">
                  <CardHeader className="flex flex-row items-center gap-2 pb-3">
                    <Sparkles className="w-5 h-5 text-secondary" />
                    <CardTitle className="text-sm">曲ごとのメモ</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    「曲2でVoハウり」「Gtソロを+2dB」など即メモ。
                  </CardContent>
                </Card>
                <Card className="border-border bg-card/60">
                  <CardHeader className="flex flex-row items-center gap-2 pb-3">
                    <Waves className="w-5 h-5 text-secondary" />
                    <CardTitle className="text-sm">客席チェック</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    客席中央/後方のバランス、低域の出方を記録。
                  </CardContent>
                </Card>
                <Card className="border-border bg-card/60">
                  <CardHeader className="flex flex-row items-center gap-2 pb-3">
                    <Headphones className="w-5 h-5 text-secondary" />
                    <CardTitle className="text-sm">モニター状況</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    メンバー要望と応答を履歴化して次回に活かす。
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg border border-border bg-card/60 p-4 sm:p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">リアルタイムメモ</Badge>
                  <span className="text-xs text-muted-foreground">本番中の走り書きをそのまま残せます。</span>
                </div>
                <textarea
                  rows={8}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground"
                  placeholder="例) 曲1: Vo 2kHz少しカット / 曲2: Dr スネア固い → コンプリリース伸ばす"
                />
                <div className="flex justify-end">
                  <Button>メモを保存</Button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
