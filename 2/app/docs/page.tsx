import Link from "next/link"
import { FileText, Book, Settings, Users, Calendar, ArrowRight } from "lucide-react"
import { SideNav } from "@/components/side-nav"

const docCategories = [
  {
    title: "はじめに",
    icon: Book,
    docs: [
      { slug: "getting-started", title: "ポータルの使い方", description: "基本的な機能と操作方法" },
      { slug: "account-setup", title: "アカウント設定", description: "プロフィールの編集方法" },
    ],
  },
  {
    title: "イベント運営",
    icon: Calendar,
    docs: [
      { slug: "event-creation", title: "イベント作成ガイド", description: "新規イベントの作成手順" },
      { slug: "repertoire-guide", title: "レパートリー提出", description: "曲目提出の流れ" },
      { slug: "timetable-guide", title: "タイムテーブル作成", description: "TT作成と編集方法" },
    ],
  },
  {
    title: "PA・照明",
    icon: Settings,
    docs: [
      { slug: "pa-basics", title: "PA機材の基本", description: "音響機材の取り扱い" },
      { slug: "lighting-basics", title: "照明機材の基本", description: "照明機材の取り扱い" },
      { slug: "stage-plot", title: "ステージ配置図", description: "配置図の作成方法" },
    ],
  },
  {
    title: "運営・管理",
    icon: Users,
    docs: [
      { slug: "member-management", title: "部員管理", description: "部員情報の管理方法" },
      { slug: "role-guide", title: "権限ガイド", description: "各ロールの説明" },
      { slug: "handover", title: "引き継ぎマニュアル", description: "運営引き継ぎの手順" },
    ],
  },
]

export default function DocsPage() {
  return (
    <div className="flex min-h-screen">
      <SideNav />

      <main className="flex-1 md:ml-20">
        {/* ヘッダーセクション */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

          <div className="relative z-10 container mx-auto px-4 sm:px-6">
            <div className="max-w-4xl pt-12 md:pt-0">
              <span className="text-xs text-primary tracking-[0.3em] font-mono">DOCUMENTATION</span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">ドキュメント</h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                ポータルの使い方、運営マニュアル、引き継ぎ資料などを確認できます。
              </p>
            </div>
          </div>
        </section>

        {/* ドキュメント一覧 */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
              {docCategories.map((category) => {
                const Icon = category.icon
                return (
                  <div key={category.title}>
                    <div className="flex items-center gap-3 mb-4 md:mb-6">
                      <Icon className="w-5 h-5 text-primary" />
                      <h2 className="text-xl md:text-2xl font-bold">{category.title}</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {category.docs.map((doc) => (
                        <Link
                          key={doc.slug}
                          href={`/docs/${doc.slug}`}
                          className="group p-4 md:p-5 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-primary shrink-0" />
                                <h3 className="font-bold text-sm md:text-base group-hover:text-primary transition-colors truncate">
                                  {doc.title}
                                </h3>
                              </div>
                              <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
