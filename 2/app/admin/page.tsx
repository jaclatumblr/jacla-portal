import Link from "next/link"
import { Calendar, Music, Lightbulb, Users, Bell, Plus, Settings, Shield, ArrowRight } from "lucide-react"
import { SideNav } from "@/components/side-nav"

export default function AdminPage() {
  return (
    <div className="flex min-h-screen">
      <SideNav />

      <main className="flex-1 md:ml-20">
        {/* ヘッダーセクション */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

          <div className="relative z-10 container mx-auto px-4 sm:px-6">
            <div className="max-w-4xl pt-12 md:pt-0">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-primary" />
                <span className="text-xs text-primary tracking-[0.3em] font-mono">ADMIN</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">管理ページ</h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                管理者専用の機能です。イベント作成、機材登録、お知らせ投稿などを行えます。
              </p>
            </div>
          </div>
        </section>

        {/* 管理機能カード */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">ACTIONS</span>
                <h2 className="text-xl md:text-2xl font-bold mt-2">管理アクション</h2>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {/* イベント作成 */}
                <Link href="/admin/events/new" className="group">
                  <div className="relative h-48 md:h-56 bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-primary" />
                        </div>
                        <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">新規イベント作成</h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">
                        ライブやコンサートなどのイベントを新規作成
                      </p>
                      <div className="flex items-center gap-2 text-primary text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>作成する</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                {/* PA機材登録 */}
                <Link href="/admin/pa/new" className="group">
                  <div className="relative h-48 md:h-56 bg-card border border-border rounded-lg overflow-hidden hover:border-secondary/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <Music className="w-6 h-6 text-secondary" />
                        </div>
                        <Plus className="w-5 h-5 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">PA機材登録</h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">音響機材の新規登録・編集</p>
                      <div className="flex items-center gap-2 text-secondary text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>登録する</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                {/* 照明機材登録 */}
                <Link href="/admin/lighting/new" className="group">
                  <div className="relative h-48 md:h-56 bg-card border border-border rounded-lg overflow-hidden hover:border-accent/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                          <Lightbulb className="w-6 h-6 text-accent" />
                        </div>
                        <Plus className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">照明機材登録</h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">照明機材の新規登録・編集</p>
                      <div className="flex items-center gap-2 text-accent text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>登録する</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                {/* お知らせ投稿 */}
                <Link href="/admin/announcements/new" className="group">
                  <div className="relative h-48 md:h-56 bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Bell className="w-6 h-6 text-primary" />
                        </div>
                        <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">お知らせ投稿</h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">部員向けのお知らせを新規投稿</p>
                      <div className="flex items-center gap-2 text-primary text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>投稿する</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                {/* 部員管理 */}
                <Link href="/admin/members" className="group">
                  <div className="relative h-48 md:h-56 bg-card border border-border rounded-lg overflow-hidden hover:border-secondary/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <Users className="w-6 h-6 text-secondary" />
                        </div>
                        <Settings className="w-5 h-5 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">部員管理</h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">部員情報の編集・権限管理</p>
                      <div className="flex items-center gap-2 text-secondary text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>管理する</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                {/* 設定 */}
                <Link href="/admin/settings" className="group">
                  <div className="relative h-48 md:h-56 bg-card border border-border rounded-lg overflow-hidden hover:border-muted-foreground/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <Settings className="w-6 h-6 text-muted-foreground" />
                        </div>
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">システム設定</h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">サイト全体の設定を管理</p>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>設定する</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 最近の操作ログ */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
              <div className="mb-6">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">RECENT ACTIVITY</span>
                <h2 className="text-xl md:text-2xl font-bold mt-2">最近の操作</h2>
              </div>

              <div className="space-y-3">
                {[
                  { action: "イベント「春ライブ 2025」を作成", user: "管理者", time: "2時間前", type: "create" },
                  { action: "お知らせ「レパートリー提出締切」を投稿", user: "管理者", time: "5時間前", type: "create" },
                  { action: "PA機材「SM58 マイク」を更新", user: "管理者", time: "1日前", type: "update" },
                  { action: "部員「田中美咲」を追加", user: "管理者", time: "2日前", type: "create" },
                ].map((log, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-card/50 border border-border rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${log.type === "create" ? "bg-green-500" : "bg-blue-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{log.action}</p>
                      <p className="text-xs text-muted-foreground">{log.user}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{log.time}</span>
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
