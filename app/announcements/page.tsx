import Link from "next/link";
import { ArrowRight, Calendar, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";

const announcements = [
  {
    id: 1,
    title: "春ライブのレパートリー提出締切について",
    content:
      "春ライブ2025のレパートリー提出締切は3月1日です。未提出のバンドは早めに提出をお願いします。",
    date: "2025-01-15",
    category: "締切",
    isPinned: true,
    isNew: true,
  },
  {
    id: 2,
    title: "新入部員歓迎会のお知らせ",
    content:
      "4月5日（土）18:00より新入部員歓迎会を開催します。場所は大学ホールです。参加希望者は部長まで連絡ください。",
    date: "2025-01-12",
    category: "イベント",
    isPinned: true,
    isNew: false,
  },
  {
    id: 3,
    title: "PA機材メンテナンス完了",
    content:
      "SM58マイク5本のメンテナンスが完了しました。貸出可能になりましたので、必要な方は申請してください。",
    date: "2025-01-10",
    category: "機材",
    isPinned: false,
    isNew: false,
  },
  {
    id: 4,
    title: "練習スタジオ利用時間変更",
    content: "2月1日より練習スタジオの利用時間が9:00〜21:00に変更になります。",
    date: "2025-01-08",
    category: "お知らせ",
    isPinned: false,
    isNew: false,
  },
  {
    id: 5,
    title: "部費納入のお願い",
    content: "今月末までに部費の納入をお願いします。未納の方は会計担当まで連絡ください。",
    date: "2025-01-05",
    category: "事務",
    isPinned: false,
    isNew: false,
  },
];

export default function AnnouncementsPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-16 md:py-24 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl pt-12 md:pt-0">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">ANNOUNCEMENTS</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">お知らせ</h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                  サークルからの重要なお知らせ、イベント情報、連絡事項を確認できます。
                </p>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                {announcements
                  .filter((a) => a.isPinned)
                  .map((announcement) => (
                    <Link
                      key={announcement.id}
                      href={`/announcements/${announcement.id}`}
                      className="group block"
                    >
                      <div className="relative p-4 sm:p-6 bg-primary/5 border border-primary/20 rounded-lg hover:border-primary/50 transition-all duration-300">
                        <div className="absolute top-4 right-4">
                          <Pin className="w-4 h-4 text-primary" />
                        </div>

                        <div className="relative">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="default" className="bg-primary text-primary-foreground">
                                {announcement.category}
                              </Badge>
                              {announcement.isNew && (
                                <Badge className="bg-red-500 text-white">NEW</Badge>
                              )}
                              <h3 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                {announcement.title}
                              </h3>
                            </div>
                          </div>

                          <p className="text-muted-foreground mb-4 text-sm sm:text-base line-clamp-2">
                            {announcement.content}
                          </p>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4 text-primary shrink-0" />
                              <span>{announcement.date}</span>
                            </div>
                            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}

                {announcements
                  .filter((a) => !a.isPinned)
                  .map((announcement) => (
                    <Link
                      key={announcement.id}
                      href={`/announcements/${announcement.id}`}
                      className="group block"
                    >
                      <div className="relative p-4 sm:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all duration-300">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

                        <div className="relative">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="outline" className="bg-transparent">
                                {announcement.category}
                              </Badge>
                              <h3 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                {announcement.title}
                              </h3>
                            </div>
                            <ArrowRight className="hidden sm:block w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                          </div>

                          <p className="text-muted-foreground mb-4 text-sm sm:text-base line-clamp-2">
                            {announcement.content}
                          </p>

                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 text-primary shrink-0" />
                            <span>{announcement.date}</span>
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
    </AuthGuard>
  );
}

