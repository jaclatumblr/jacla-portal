import Link from "next/link";
import { AlertCircle, CheckCircle, NotebookPen, Package, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";

type EquipmentStatus = "available" | "low" | "out";
type EquipmentRow = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  available: number;
  status: EquipmentStatus;
};

const equipment: EquipmentRow[] = [
  { id: 1, name: "SM58 マイク", category: "マイク", quantity: 5, available: 4, status: "available" },
  { id: 2, name: "SHURE BETA 58A", category: "マイク", quantity: 3, available: 3, status: "available" },
  { id: 3, name: "XLRケーブル 5m", category: "ケーブル", quantity: 10, available: 7, status: "available" },
  { id: 4, name: "XLRケーブル 10m", category: "ケーブル", quantity: 8, available: 5, status: "available" },
  { id: 5, name: "DIボックス", category: "DI", quantity: 4, available: 2, status: "low" },
  { id: 6, name: "パワードスピーカー", category: "スピーカー", quantity: 2, available: 0, status: "out" },
  { id: 7, name: "モニタースピーカー", category: "スピーカー", quantity: 4, available: 4, status: "available" },
  { id: 8, name: "ミキサー YAMAHA MG16", category: "ミキサー", quantity: 1, available: 1, status: "available" },
];

function statusBadge(status: EquipmentStatus) {
  if (status === "available") return <Badge className="bg-emerald-600 text-white">在庫あり</Badge>;
  if (status === "low") return <Badge variant="secondary">残りわずか</Badge>;
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertCircle className="w-3 h-3" />
      なし
    </Badge>
  );
}

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
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">PAダッシュボード</h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-3xl">
                  PA指示・Live Adviser・機材一覧をまとめました。必要なセクションを選んで確認してください。
                </p>

                <div className="mt-8 grid sm:grid-cols-3 gap-3 md:gap-4 max-w-4xl">
                  <Link
                    href="/pa/instructions"
                    className="p-4 rounded-lg border border-border bg-card/60 hover:border-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <NotebookPen className="w-5 h-5 text-secondary" />
                      <span className="text-sm font-semibold">PA指示</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">セット進行・キューの共有</p>
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
                    href="/pa"
                    className="p-4 rounded-lg border border-border bg-card/60 hover:border-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-secondary" />
                      <span className="text-sm font-semibold">PA機材</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">在庫と貸出管理</p>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="grid sm:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto mb-8 md:mb-12">
                <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                  <div className="flex items-center gap-3 mb-3 md:mb-4">
                    <Package className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    <span className="text-xs md:text-sm text-muted-foreground">総機材数</span>
                  </div>
                  <p className="text-3xl md:text-4xl font-bold">37</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">8カテゴリ</p>
                </div>

                <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                  <div className="flex items-center gap-3 mb-3 md:mb-4">
                    <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                    <span className="text-xs md:text-sm text-muted-foreground">利用可能</span>
                  </div>
                  <p className="text-3xl md:text-4xl font-bold">29</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">貸出中を除く在庫</p>
                </div>

                <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                  <div className="flex items-center gap-3 mb-3 md:mb-4">
                    <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
                    <span className="text-xs md:text-sm text-muted-foreground">要補充</span>
                  </div>
                  <p className="text-3xl md:text-4xl font-bold">3</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">在庫少/欠品</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">機材一覧</h2>
                  <p className="text-sm text-muted-foreground">在庫の目安をチェックしてください。</p>
                </div>
                <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  新規機材追加
                </Button>
              </div>

              <div className="overflow-x-auto border border-border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>名前</TableHead>
                      <TableHead>カテゴリ</TableHead>
                      <TableHead>在庫 / 総数</TableHead>
                      <TableHead className="text-right">状態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>
                          {item.available} / {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">{statusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
