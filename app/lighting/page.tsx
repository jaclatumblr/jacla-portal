import Link from "next/link";
import { Lightbulb, NotebookPen } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { PageHeader } from "@/components/PageHeader";

export default function LightingPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Lighting"
            title="照明ダッシュボード"
            description="照明指示・照明機材をまとめました。必要なセクションを選んで確認してください。"
            tone="accent"
            size="lg"
            meta={
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-w-4xl">
                <Link
                  href="/lighting/instructions"
                  className="p-4 rounded-lg border border-border bg-card/60 hover:border-accent/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <NotebookPen className="w-5 h-5 text-accent" />
                    <span className="text-sm font-semibold">照明指示</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">シーン/カラー/キューを共有</p>
                </Link>
                <Link
                  href="/lighting/equipment"
                  className="p-4 rounded-lg border border-border bg-card/60 hover:border-accent/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-accent" />
                    <span className="text-sm font-semibold">照明機材</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">照明機材の在庫と状態</p>
                </Link>
              </div>
            }
          />
        </main>
      </div>
    </AuthGuard>
  );
}
