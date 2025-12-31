import Link from "next/link";
import { NotebookPen, Package, SlidersHorizontal, Sparkles } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";

export default function PAPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-16 md:py-24 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-secondary/5 to-transparent" />
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-6xl pt-12 md:pt-0">
                <span className="text-xs text-secondary tracking-[0.3em] font-mono">PA</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">
                  PAダッシュボード
                </h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-3xl">
                  PA指示・Live Adviser・PA機材・PAコンソールをまとめました。必要なセクションを選んで確認してください。
                </p>

                <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-w-4xl">
                  <Link
                    href="/pa/instructions"
                    className="p-4 rounded-lg border border-border bg-card/60 hover:border-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <NotebookPen className="w-5 h-5 text-secondary" />
                      <span className="text-sm font-semibold">PA指示</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      セトリ進行やキューの共通メモ
                    </p>
                  </Link>
                  <Link
                    href="/pa/live-adviser"
                    className="p-4 rounded-lg border border-border bg-card/60 hover:border-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-secondary" />
                      <span className="text-sm font-semibold">Live Adviser</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">リアルタイムのアドバイス</p>
                  </Link>
                  <Link
                    href="/pa/equipment"
                    className="p-4 rounded-lg border border-border bg-card/60 hover:border-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-secondary" />
                      <span className="text-sm font-semibold">PA機材</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">PA機材の在庫と状態</p>
                  </Link>
                  <Link
                    href="/pa/console"
                    className="p-4 rounded-lg border border-border bg-card/60 hover:border-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-5 h-5 text-secondary" />
                      <span className="text-sm font-semibold">PAコンソール</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">ミキサーのレイアウトを確認</p>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
