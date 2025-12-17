import Link from "next/link"
import { User, Music, Calendar, Settings, Shield, ArrowRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SideNav } from "@/components/side-nav"

const menuItems = [
  { href: "/me/profile", icon: User, label: "プロフィール編集", description: "連絡先、パート情報の編集" },
  { href: "/me/bands", icon: Music, label: "参加バンド", description: "参加中のバンド一覧" },
  { href: "/me/tasks", icon: Calendar, label: "やること", description: "未提出・担当・確認待ち" },
  { href: "/me/settings", icon: Settings, label: "設定", description: "通知・表示設定" },
]

export default function MyPage() {
  const user = {
    name: "山田太郎",
    part: "ボーカル",
    year: "3年生",
    role: "一般部員",
  }

  return (
    <div className="flex min-h-screen">
      <SideNav />

      <main className="flex-1 md:ml-20">
        {/* ヘッダー */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

          <div className="relative z-10 container mx-auto px-4 sm:px-6">
            <div className="max-w-4xl pt-12 md:pt-0">
              <span className="text-xs text-primary tracking-[0.3em] font-mono">MY PAGE</span>

              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mt-6">
                <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-primary/30">
                  <AvatarImage src="/placeholder-user.jpg" alt={user.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl md:text-2xl font-bold">
                    {user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">{user.name}</h1>
                    <Badge variant="secondary">{user.year}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-primary" />
                      <span>{user.part}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <span>{user.role}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* メニュー */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-4 p-4 md:p-5 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all"
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold group-hover:text-primary transition-colors">{item.label}</h3>
                      <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
