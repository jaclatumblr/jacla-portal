import Link from "next/link";
import { NotebookPen, ArrowLeft, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";

export default function PAInstructionsPage() {
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
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">PA指示</h1>
                <p className="text-muted-foreground text-base md:text-lg">
                  セット進行・キュー・ステージ上の注意事項を共有します。リアルタイムのメモや転換確認にお使いください。
                </p>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6 space-y-6 max-w-4xl">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <NotebookPen className="w-4 h-4" />
                  テンプレ
                </Badge>
                <span className="text-sm text-muted-foreground">必要に応じてイベントに合わせて書き換えてください。</span>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border bg-card/60 space-y-2">
                  <h3 className="text-sm font-semibold">転換チェックリスト</h3>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>マイク本数 / 立ち位置確認</li>
                    <li>DI / ライン数確認</li>
                    <li>モニター送り / キュー確認</li>
                    <li>シーケンス・クリック有無</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg border border-border bg-card/60 space-y-2">
                  <h3 className="text-sm font-semibold">MC / SE</h3>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>MCポイント・長さ</li>
                    <li>SE 再生タイミング</li>
                    <li>次のバンドの立ち位置引継ぎ</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 md:p-5 rounded-lg border border-border bg-card/60 space-y-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-secondary" />
                  <h3 className="text-base font-semibold">共有メモ</h3>
                </div>
                <Textarea
                  rows={8}
                  placeholder="例) 曲2でGtソロを+2dB / Dr キックを気持ち下げる / Voリバーブ深め など"
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
