import Link from "next/link";
import { NotebookPen, Package, SlidersHorizontal } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { PageHeader } from "@/components/PageHeader";

export default function PAPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="PA"
            title="PAダッシュボード"
            description="PA指示・PA機材・PAコンソールをまとめました。必要なセクションを選んで確認してください。"
            size="lg"
            tone="secondary"
            meta={
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-w-4xl">
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
            }
          />
        </main>
      </div>
    </AuthGuard>
  );
}
