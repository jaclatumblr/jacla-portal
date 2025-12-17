import Link from "next/link";
import { ArrowLeft, Calendar, Pin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";

type Announcement = {
  id: number;
  title: string;
  content: string;
  date: string;
  category: string;
  isPinned: boolean;
  author: string;
};

const announcementsData: Record<string, Announcement> = {
  "1": {
    id: 1,
    title: "春ライブのレパートリー提出締切について",
    content:
      "春ライブ2025のレパートリー提出締切は3月1日です。\n\n提出方法\n- イベントページから「レパートリー提出」を選択\n- バンド情報と演奏曲を入力\n- メンバー全員の確認後、提出ボタンを押下\n\n注意事項\n- 締切後の変更は原則不可です\n- 曲数は最大4曲まで\n- オリジナル曲の場合、譜面データの添付をお願いします\n\n不明点があれば運営までお問い合わせください。",
    date: "2025-01-15",
    category: "締切",
    isPinned: true,
    author: "運営チーム",
  },
  "2": {
    id: 2,
    title: "新入部員歓迎会のお知らせ",
    content:
      "4月5日（土）18:00より新入部員歓迎会を開催します。\n\n概要\n- 日時: 2025年4月5日（土）18:00〜21:00\n- 場所: 大学ホール\n- 参加費: 無料\n\n内容\n- 部活動紹介\n- 先輩バンドによるライブ演奏\n- 新入生との交流企画\n- 軽食・ドリンクあり\n\n参加希望者は部長まで連絡ください。",
    date: "2025-01-12",
    category: "イベント",
    isPinned: true,
    author: "部長",
  },
  "3": {
    id: 3,
    title: "PA機材メンテナンス完了",
    content:
      "SM58マイク5本のメンテナンスが完了しました。\n\n貸出を希望する場合は、PA担当まで申請してください。",
    date: "2025-01-10",
    category: "機材",
    isPinned: false,
    author: "PA担当",
  },
  "4": {
    id: 4,
    title: "練習スタジオ利用時間変更",
    content: "2月1日より練習スタジオの利用時間が9:00〜21:00に変更になります。",
    date: "2025-01-08",
    category: "お知らせ",
    isPinned: false,
    author: "運営チーム",
  },
  "5": {
    id: 5,
    title: "部費納入のお願い",
    content: "今月末までに部費の納入をお願いします。未納の方は会計担当まで連絡ください。",
    date: "2025-01-05",
    category: "事務",
    isPinned: false,
    author: "会計",
  },
};

export default function AnnouncementDetailPage({ params }: { params: { id: string } }) {
  const announcement = announcementsData[params.id];

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-3xl pt-12 md:pt-0">
                <Link
                  href="/announcements"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">お知らせ一覧に戻る</span>
                </Link>

                {!announcement ? (
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                    お知らせが見つかりません
                  </h1>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      {announcement.isPinned && <Pin className="w-4 h-4 text-primary" />}
                      <Badge variant="default">{announcement.category}</Badge>
                    </div>

                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                      {announcement.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{announcement.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{announcement.author}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {announcement && (
            <section className="py-8 md:py-12">
              <div className="container mx-auto px-4 sm:px-6">
                <div className="max-w-3xl mx-auto">
                  <div className="p-6 md:p-8 bg-card/50 border border-border rounded-lg">
                    <div className="text-sm md:text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {announcement.content}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

