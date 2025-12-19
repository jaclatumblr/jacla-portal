import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Calendar,
  ChevronDown,
  Lightbulb,
  Music,
  Pin,
  User,
  Users,
} from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";

const announcements = [
  {
    id: 1,
    title: "春ライブのレパートリー提出締切について",
    content:
      "春ライブのレパートリー提出締切は1月20日です。まだ提出していないバンドは早めに提出してください。",
    date: "2025/01/15",
    isPinned: true,
    category: "重要",
  },
  {
    id: 2,
    title: "機材庫の利用ルール変更",
    content:
      "機材庫の利用時間が変更になりました。詳細は機材管理ページをご確認ください。",
    date: "2025/01/12",
    isPinned: false,
    category: "お知らせ",
  },
  {
    id: 3,
    title: "新入部員歓迎会のお知らせ",
    content: "4月に新入部員歓迎会を開催予定です。詳細は追って連絡します。",
    date: "2025/01/10",
    isPinned: false,
    category: "イベント",
  },
];

export default function HomePage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section
            id="home"
            className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 sm:px-6 pb-28 sm:pb-32 pt-16 sm:pt-20"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/10" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />

            <div className="absolute inset-0 opacity-5">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
                  backgroundSize: "100px 100px",
                }}
              />
            </div>

            <div className="relative z-10 text-center px-4 sm:px-6">
              <div className="mb-6 md:mb-8">
                <Image
                  src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
                  alt="jacla logo"
                  width={200}
                  height={120}
                  className="mx-auto object-contain w-32 sm:w-40 md:w-[200px]"
                  priority
                />
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-4">
                <span className="text-foreground">総合音楽部</span>
                <span className="block text-primary mt-2">jacla</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed mb-6 md:mb-8">
                部員専用ポータルサイト
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link
                  href="#features"
                  className="w-full sm:w-auto px-8 py-3 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 transition-colors text-center"
                >
                  はじめる
                </Link>
                <Link
                  href="/events"
                  className="w-full sm:w-auto px-8 py-3 border border-border text-foreground font-medium rounded hover:border-primary hover:text-primary transition-colors text-center"
                >
                  イベントを見る
                </Link>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
              <span className="text-xs text-muted-foreground tracking-widest">
                SCROLL
              </span>
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="hidden sm:block absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-primary/30" />
            <div className="hidden sm:block absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-primary/30" />
          </section>

          <section id="features" className="min-h-screen py-16 md:py-24 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-background via-card/50 to-background" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="text-center mb-12 md:mb-16">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">
                  FEATURES
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4 md:mb-6">
                  機能一覧
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
                  サークル活動に必要なすべての機能をここで
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
                <Link href="/events" className="group">
                  <div className="relative h-56 md:h-64 bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <Calendar className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        <span className="text-xs text-muted-foreground font-mono">
                          01
                        </span>
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">
                        イベント管理
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">
                        ライブやイベントの一覧、詳細確認、レパートリー提出
                      </p>
                      <div className="flex items-center gap-2 text-primary text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>詳しく見る</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                <Link href="/pa" className="group">
                  <div className="relative h-56 md:h-64 bg-card border border-border rounded-lg overflow-hidden hover:border-secondary/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <Music className="w-6 h-6 md:w-8 md:h-8 text-secondary" />
                        <span className="text-xs text-muted-foreground font-mono">
                          02
                        </span>
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">
                        PA機材管理
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">
                        音響機材の一覧、貸出状況、イベント別セットリスト
                      </p>
                      <div className="flex items-center gap-2 text-secondary text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>詳しく見る</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                <Link href="/lighting" className="group">
                  <div className="relative h-56 md:h-64 bg-card border border-border rounded-lg overflow-hidden hover:border-accent/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <Lightbulb className="w-6 h-6 md:w-8 md:h-8 text-accent" />
                        <span className="text-xs text-muted-foreground font-mono">
                          03
                        </span>
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">
                        照明機材管理
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">
                        照明機材の一覧、貸出状況、イベント別セットリスト
                      </p>
                      <div className="flex items-center gap-2 text-accent text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>詳しく見る</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                <Link href="/announcements" className="group">
                  <div className="relative h-56 md:h-64 bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <Bell className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        <span className="text-xs text-muted-foreground font-mono">
                          04
                        </span>
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">
                        お知らせ
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">
                        サークルからの重要なお知らせ、連絡事項
                      </p>
                      <div className="flex items-center gap-2 text-primary text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>詳しく見る</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                <Link href="/members" className="group">
                  <div className="relative h-56 md:h-64 bg-card border border-border rounded-lg overflow-hidden hover:border-secondary/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <Users className="w-6 h-6 md:w-8 md:h-8 text-secondary" />
                        <span className="text-xs text-muted-foreground font-mono">
                          05
                        </span>
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">
                        メンバー一覧
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">
                        部員の一覧、連絡先、担当パート情報
                      </p>
                      <div className="flex items-center gap-2 text-secondary text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>詳しく見る</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                <Link href="/me/profile" className="group">
                  <div className="relative h-56 md:h-64 bg-card border border-border rounded-lg overflow-hidden hover:border-accent/50 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full p-4 md:p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <User className="w-6 h-6 md:w-8 md:h-8 text-accent" />
                        <span className="text-xs text-muted-foreground font-mono">
                          06
                        </span>
                      </div>
                      <h3 className="text-lg md:text-xl font-bold mb-2">
                        アカウント
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">
                        自分のプロフィール編集、バンド情報管理
                      </p>
                      <div className="flex items-center gap-2 text-accent text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>詳しく見る</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          <section
            id="announcements"
            className="py-16 md:py-24 relative bg-card/30"
          >
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 md:mb-12 gap-4">
                <div>
                  <span className="text-xs text-primary tracking-[0.3em] font-mono">
                    ANNOUNCEMENTS
                  </span>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4">
                    お知らせ
                  </h2>
                </div>
                <Link
                  href="/announcements"
                  className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm font-medium"
                >
                  すべて見る
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid gap-4 md:gap-6 max-w-4xl">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className={`group relative p-4 md:p-6 bg-card border rounded-lg transition-all duration-300 hover:border-primary/30 ${
                      announcement.isPinned ? "border-primary/50" : "border-border"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                      <div className="flex items-center gap-2 shrink-0">
                        {announcement.isPinned && (
                          <Pin className="w-4 h-4 text-primary" />
                        )}
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            announcement.category === "重要"
                              ? "bg-destructive/10 text-destructive"
                              : announcement.category === "イベント"
                                ? "bg-secondary/10 text-secondary"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {announcement.category}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-2">
                          <h3 className="font-bold text-foreground">
                            {announcement.title}
                          </h3>
                          <span className="text-xs text-muted-foreground font-mono">
                            {announcement.date}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {announcement.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <footer className="py-8 md:py-12 border-t border-border">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
                <div className="flex items-center gap-4">
                  <Image
                    src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
                    alt="jacla logo"
                    width={60}
                    height={36}
                    className="object-contain w-12 md:w-[60px]"
                  />
                  <div>
                    <p className="text-sm font-medium">総合音楽部 jacla</p>
                    <p className="text-xs text-muted-foreground">部員ポータル</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center md:text-right">
                  ©Tokyo University of Technology - 総合音楽部 jacla. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </AuthGuard>
  );
}
