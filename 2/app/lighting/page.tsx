import { Lightbulb, CheckCircle, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SideNav } from "@/components/side-nav"

const equipment = [
  { id: 1, name: "LEDパーライト 64", category: "パーライト", quantity: 8, available: 6, status: "available" },
  { id: 2, name: "ムービングヘッド SPOT", category: "ムービング", quantity: 4, available: 2, status: "low" },
  { id: 3, name: "ムービングヘッド WASH", category: "ムービング", quantity: 4, available: 4, status: "available" },
  { id: 4, name: "ストロボライト", category: "エフェクト", quantity: 2, available: 0, status: "out" },
  { id: 5, name: "DMXケーブル 5m", category: "ケーブル", quantity: 12, available: 10, status: "available" },
  { id: 6, name: "DMXケーブル 10m", category: "ケーブル", quantity: 8, available: 6, status: "available" },
  { id: 7, name: "照明コントローラー", category: "コントローラー", quantity: 2, available: 1, status: "low" },
  { id: 8, name: "スモークマシン", category: "エフェクト", quantity: 1, available: 1, status: "available" },
]

export default function LightingPage() {
  return (
    <div className="flex min-h-screen">
      <SideNav />

      <main className="flex-1 md:ml-20">
        {/* ヘッダーセクション */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

          <div className="relative z-10 container mx-auto px-4 sm:px-6">
            <div className="max-w-6xl pt-12 md:pt-0">
              <span className="text-xs text-accent tracking-[0.3em] font-mono">LIGHTING EQUIPMENT</span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">照明機材一覧</h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                照明機材の在庫状況、貸出管理を行います。
              </p>
            </div>
          </div>
        </section>

        {/* ステータスカード */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="grid sm:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto mb-8 md:mb-12">
              <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-3 md:mb-4">
                  <Lightbulb className="w-5 h-5 md:w-6 md:h-6 text-accent" />
                  <span className="text-xs md:text-sm text-muted-foreground">総機材数</span>
                </div>
                <p className="text-3xl md:text-4xl font-bold">41</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">8カテゴリー</p>
              </div>

              <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-3 md:mb-4">
                  <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                  <span className="text-xs md:text-sm text-muted-foreground">利用可能</span>
                </div>
                <p className="text-3xl md:text-4xl font-bold text-green-500">30</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">貸出可能数</p>
              </div>

              <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-3 md:mb-4">
                  <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
                  <span className="text-xs md:text-sm text-muted-foreground">貸出中</span>
                </div>
                <p className="text-3xl md:text-4xl font-bold text-orange-500">11</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">返却待ち</p>
              </div>
            </div>

            {/* 機材テーブル */}
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <span className="text-xs text-accent tracking-[0.3em] font-mono">LIST</span>
                <h2 className="text-xl md:text-2xl font-bold mt-2">機材リスト</h2>
              </div>

              {/* デスクトップテーブル */}
              <div className="hidden md:block bg-card/50 border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">機材名</TableHead>
                      <TableHead className="text-muted-foreground">カテゴリー</TableHead>
                      <TableHead className="text-center text-muted-foreground">総数</TableHead>
                      <TableHead className="text-center text-muted-foreground">利用可能</TableHead>
                      <TableHead className="text-center text-muted-foreground">ステータス</TableHead>
                      <TableHead className="text-right text-muted-foreground">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.map((item) => (
                      <TableRow key={item.id} className="border-border hover:bg-accent/5">
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-transparent">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center font-medium">{item.available}</TableCell>
                        <TableCell className="text-center">
                          {item.status === "available" && (
                            <Badge className="bg-green-600/20 text-green-500 border-green-600/30">在庫あり</Badge>
                          )}
                          {item.status === "low" && <Badge variant="secondary">残りわずか</Badge>}
                          {item.status === "out" && (
                            <Badge className="bg-orange-600/20 text-orange-500 border-orange-600/30">貸出中</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-accent">
                            詳細
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* モバイルカード */}
              <div className="md:hidden space-y-3">
                {equipment.map((item) => (
                  <div key={item.id} className="p-4 bg-card/50 border border-border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-sm">{item.name}</h3>
                        <Badge variant="outline" className="bg-transparent text-xs mt-1">
                          {item.category}
                        </Badge>
                      </div>
                      {item.status === "available" && (
                        <Badge className="bg-green-600/20 text-green-500 border-green-600/30 text-xs">在庫あり</Badge>
                      )}
                      {item.status === "low" && (
                        <Badge variant="secondary" className="text-xs">
                          残りわずか
                        </Badge>
                      )}
                      {item.status === "out" && (
                        <Badge className="bg-orange-600/20 text-orange-500 border-orange-600/30 text-xs">貸出中</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex gap-4 text-muted-foreground">
                        <span>
                          総数: <span className="text-foreground font-medium">{item.quantity}</span>
                        </span>
                        <span>
                          利用可能: <span className="text-foreground font-medium">{item.available}</span>
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-accent h-8 px-2">
                        詳細
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
