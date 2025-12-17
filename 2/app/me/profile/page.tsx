import Link from "next/link"
import { Mail, Phone, Music, Calendar, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SideNav } from "@/components/side-nav"

export default function ProfilePage() {
  const user = {
    name: "山田太郎",
    email: "yamada@example.com",
    phone: "090-1234-5678",
    part: "ボーカル",
    secondaryPart: "ギター",
    year: "3年生",
    joinDate: "2023-04-01",
    bands: [
      { name: "The Rockers", role: "リードボーカル" },
      { name: "Acoustic Duo", role: "ボーカル・ギター" },
    ],
  }

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
              <span className="text-xs text-primary tracking-[0.3em] font-mono">PROFILE</span>

              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mt-8">
                <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-primary/30">
                  <AvatarImage src="/placeholder-user.jpg" alt={user.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl md:text-2xl font-bold">
                    {user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">{user.name}</h1>
                    <Badge variant="secondary">{user.year}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 md:gap-4 text-muted-foreground text-sm md:text-base">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-primary" />
                      <span>{user.part}</span>
                    </div>
                    <span className="hidden sm:inline">•</span>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span>入部: {user.joinDate}</span>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="bg-transparent w-full sm:w-auto mt-4 sm:mt-0">
                  <Edit className="w-4 h-4 mr-2" />
                  編集
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* プロフィール詳細 */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-4 md:gap-6 max-w-4xl mx-auto mb-8 md:mb-12">
              {/* 連絡先情報 */}
              <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                <h3 className="text-lg font-bold mb-4 md:mb-6">連絡先情報</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">メールアドレス</p>
                      <p className="font-medium text-sm md:text-base truncate">{user.email}</p>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">電話番号</p>
                      <p className="font-medium text-sm md:text-base">{user.phone}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 担当パート */}
              <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                <h3 className="text-lg font-bold mb-4 md:mb-6">担当パート</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Music className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">メインパート</p>
                      <p className="font-medium text-sm md:text-base">{user.part}</p>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
                      <Music className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">サブパート</p>
                      <p className="font-medium text-sm md:text-base">{user.secondaryPart}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 所属バンド */}
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <span className="text-xs text-primary tracking-[0.3em] font-mono">BANDS</span>
                  <h2 className="text-xl md:text-2xl font-bold mt-2">所属バンド</h2>
                </div>
                <Link href="/me/bands">
                  <Button variant="outline" className="bg-transparent w-full sm:w-auto">
                    バンド管理
                  </Button>
                </Link>
              </div>

              <div className="space-y-3 md:space-y-4">
                {user.bands.map((band, index) => (
                  <div
                    key={index}
                    className="group flex items-center justify-between p-3 md:p-4 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                      <span className="hidden sm:block text-xs text-muted-foreground font-mono">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Music className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm md:text-base truncate">{band.name}</p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">{band.role}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-primary shrink-0">
                      詳細 →
                    </Button>
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
