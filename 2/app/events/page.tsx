import Link from "next/link"
import { Calendar, Clock, MapPin, Users, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SideNav } from "@/components/side-nav"

const events = [
  {
    id: "spring-live-2025",
    title: "春ライブ 2025",
    date: "2025-03-20",
    time: "18:00 - 21:00",
    location: "大学ホール",
    status: "募集中",
    description: "春学期最初のライブです。新入部員も参加できます。",
    bands: 8,
  },
  {
    id: "welcome-concert",
    title: "新歓コンサート",
    date: "2025-04-10",
    time: "19:00 - 21:30",
    location: "野外ステージ",
    status: "準備中",
    description: "新入生歓迎のための特別コンサートです。",
    bands: 6,
  },
  {
    id: "summer-festival",
    title: "夏フェス 2025",
    date: "2025-07-15",
    time: "14:00 - 22:00",
    location: "キャンパス広場",
    status: "計画中",
    description: "夏の大型音楽フェスティバルです。",
    bands: 15,
  },
]

export default function EventsPage() {
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
              <span className="text-xs text-primary tracking-[0.3em] font-mono">EVENTS</span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">イベント一覧</h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                ライブやコンサートのスケジュール、レパートリー提出、タイムテーブル確認ができます。
              </p>
            </div>
          </div>
        </section>

        {/* イベントリスト */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
              {events.map((event, index) => (
                <Link key={event.id} href={`/events/${event.id}`} className="group block">
                  <div className="relative p-4 sm:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

                    <div className="relative">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs text-muted-foreground font-mono">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                            {event.title}
                          </h3>
                          <Badge
                            variant={
                              event.status === "募集中"
                                ? "default"
                                : event.status === "準備中"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {event.status}
                          </Badge>
                        </div>
                        <ArrowRight className="hidden sm:block w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                      </div>

                      <p className="text-muted-foreground mb-4 text-sm sm:text-base">{event.description}</p>

                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 sm:gap-6 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate">{event.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate">{event.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate">{event.bands} バンド</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
