import Link from "next/link"
import { Calendar, Music, Lightbulb, Clock, AlertCircle, CheckCircle, ArrowRight, Bell, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SideNav } from "@/components/side-nav"

const upcomingEvents = [
  { id: "spring-live-2025", title: "春ライブ 2025", date: "2025-03-20", status: "募集中" },
  { id: "welcome-concert", title: "新歓コンサート", date: "2025-04-10", status: "準備中" },
]

const myTasks = [
  { id: 1, title: "春ライブ レパートリー提出", deadline: "2025-03-01", type: "提出", urgent: true },
  { id: 2, title: "PA機材点検（担当）", deadline: "2025-02-15", type: "担当", urgent: false },
  { id: 3, title: "新歓コンサート バンドメンバー確認", deadline: "2025-03-15", type: "確認", urgent: false },
]

const todayShifts = [{ event: "練習日", role: "PA担当", time: "14:00 - 18:00" }]

const recentAnnouncements = [
  { id: 1, title: "春ライブのレパートリー提出締切について", date: "2025-01-15", isNew: true },
  { id: 2, title: "新入部員歓迎会のお知らせ", date: "2025-01-12", isNew: false },
]

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      <SideNav />

      <main className="flex-1 md:ml-20">
        {/* ヘッダーセクション */}
        <section className="relative py-12 md:py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

          <div className="relative z-10 container mx-auto px-4 sm:px-6">
            <div className="max-w-5xl pt-12 md:pt-0">
              <span className="text-xs text-primary tracking-[0.3em] font-mono">DASHBOARD</span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 mb-2">おかえりなさい、山田さん</h1>
              <p className="text-muted-foreground text-sm md:text-base">今日の予定と、やることを確認しましょう</p>
            </div>
          </div>
        </section>

        {/* メインコンテンツ */}
        <section className="py-6 md:py-8">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-4 md:gap-6">
              {/* 左カラム */}
              <div className="lg:col-span-2 space-y-4 md:space-y-6">
                {/* 今日の担当 */}
                {todayShifts.length > 0 && (
                  <div className="p-4 md:p-6 bg-primary/10 border border-primary/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-primary" />
                      <h2 className="font-bold text-lg">今日の担当</h2>
                    </div>
                    {todayShifts.map((shift, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{shift.event}</p>
                          <p className="text-sm text-muted-foreground">{shift.role}</p>
                        </div>
                        <Badge variant="default">{shift.time}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* やること */}
                <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      <h2 className="font-bold text-lg">やること</h2>
                    </div>
                    <Link href="/me/tasks" className="text-sm text-primary hover:underline">
                      すべて見る
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {myTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          task.urgent ? "border-orange-500/50 bg-orange-500/5" : "border-border bg-background/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${task.urgent ? "bg-orange-500" : "bg-muted-foreground"}`}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">締切: {task.deadline}</p>
                          </div>
                        </div>
                        <Badge variant={task.urgent ? "destructive" : "outline"} className="shrink-0 text-xs">
                          {task.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 直近イベント */}
                <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      <h2 className="font-bold text-lg">直近イベント</h2>
                    </div>
                    <Link href="/events" className="text-sm text-primary hover:underline">
                      すべて見る
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {upcomingEvents.map((event) => (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className="group flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-all"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                            {event.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{event.date}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={event.status === "募集中" ? "default" : "secondary"} className="text-xs">
                            {event.status}
                          </Badge>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* 右カラム */}
              <div className="space-y-4 md:space-y-6">
                {/* お知らせ */}
                <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-primary" />
                      <h2 className="font-bold">お知らせ</h2>
                    </div>
                    <Link href="/announcements" className="text-sm text-primary hover:underline">
                      すべて
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {recentAnnouncements.map((announcement) => (
                      <Link key={announcement.id} href={`/announcements/${announcement.id}`} className="block group">
                        <div className="flex items-start gap-2">
                          {announcement.isNew && <Badge className="bg-red-500 text-white text-xs shrink-0">NEW</Badge>}
                          <div className="min-w-0">
                            <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                              {announcement.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{announcement.date}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* クイックアクセス */}
                <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                  <h2 className="font-bold mb-4">クイックアクセス</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/pa"
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-secondary/50 hover:bg-secondary/5 transition-all"
                    >
                      <Music className="w-5 h-5 text-secondary" />
                      <span className="text-xs font-medium">PA機材</span>
                    </Link>
                    <Link
                      href="/lighting"
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
                    >
                      <Lightbulb className="w-5 h-5 text-accent" />
                      <span className="text-xs font-medium">照明</span>
                    </Link>
                    <Link
                      href="/docs"
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="text-xs font-medium">ドキュメント</span>
                    </Link>
                    <Link
                      href="/me/bands"
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <CheckCircle className="w-5 h-5 text-primary" />
                      <span className="text-xs font-medium">参加バンド</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
