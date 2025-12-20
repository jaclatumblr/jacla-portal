import Link from "next/link";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";

export default function LightingInstructionsPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <section className="relative py-16 md:py-20 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
            <div className="absolute top-0 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl pt-10 md:pt-0">
                <Link
                  href="/lighting"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">照明ダッシュボードへ戻る</span>
                </Link>
                <span className="text-xs text-accent tracking-[0.3em] font-mono">LIGHTING</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">照明指示</h1>
                <p className="text-muted-foreground text-base md:text-lg">
                  シーン構成・カラー指定・キュータイミングの共有メモです。公演ごとに書き換えてください。
                </p>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6 space-y-6 max-w-4xl">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border bg-card/60 space-y-2">
                  <h3 className="text-sm font-semibold">シーンとカラー</h3>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>オープニング: Warm / アンバー系</li>
                    <li>アップテンポ: Cool / ブルー + ストロボ軽め</li>
                    <li>バラード: ピンク + スポット中央</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg border border-border bg-card/60 space-y-2">
                  <h3 className="text-sm font-semibold">キュー例</h3>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>曲頭: フルカラー → 曲Aイントロ</li>
                    <li>サビ: ムービングでパン + ストロボ軽く</li>
                    <li>MC: ウォーム白に固定</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 md:p-5 rounded-lg border border-border bg-card/60 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Lightbulb className="w-4 h-4" />
                    テンプレ
                  </Badge>
                  <span className="text-xs text-muted-foreground">イベント用の指示メモをここに残してください。</span>
                </div>
                <Textarea
                  rows={8}
                  placeholder="例) 曲2サビでストロボ10% / 曲3アウトロでスモーク + バックライト強め"
                  className="bg-card border-border"
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
