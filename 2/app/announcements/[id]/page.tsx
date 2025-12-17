"use client"

import { use } from "react"
import Link from "next/link"
import { Calendar, ArrowLeft, Pin, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SideNav } from "@/components/side-nav"

const announcementsData: Record<
  string,
  {
    id: number
    title: string
    content: string
    date: string
    category: string
    isPinned: boolean
    author: string
  }
> = {
  "1": {
    id: 1,
    title: "春ライブのレパートリー提出締切について",
    content: `春ライブ2025のレパートリー提出締切は3月1日です。

## 提出方法
1. イベントページから「レパートリー提出」を選択
2. バンド情報と演奏曲を入力
3. メンバー全員の確認後、提出ボタンを押す

## 注意事項
- 締切後の変更は原則不可となります
- 曲数は最大4曲までです
- オリジナル曲の場合は楽譜データも添付してください

ご不明な点がありましたら、運営までお問い合わせください。`,
    date: "2025-01-15",
    category: "締切",
    isPinned: true,
    author: "運営チーム",
  },
  "2": {
    id: 2,
    title: "新入部員歓迎会のお知らせ",
    content: `4月5日（土）18:00より新入部員歓迎会を開催します。

## 概要
- 日時: 2025年4月5日（土）18:00〜21:00
- 場所: 大学ホール
- 参加費: 無料

## 内容
- 部活動紹介
- 先輩バンドによるライブ演奏
- 新入生との交流会
- 軽食・ドリンクあり

参加希望者は部長まで連絡ください。`,
    date: "2025-01-12",
    category: "イベント",
    isPinned: true,
    author: "部長",
  },
}

export default function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const announcement = announcementsData[id] || {
    id: 0,
    title: "お知らせが見つかりません",
    content: "指定されたお知らせは存在しません。",
    date: "",
    category: "",
    isPinned: false,
    author: "",
  }

  return (
    <div className="flex min-h-screen">
      <SideNav />

      <main className="flex-1 md:ml-20">
        {/* ヘッダーセクション */}
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

              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {announcement.isPinned && <Pin className="w-4 h-4 text-primary" />}
                {announcement.category && <Badge variant="default">{announcement.category}</Badge>}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">{announcement.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {announcement.date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{announcement.date}</span>
                  </div>
                )}
                {announcement.author && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{announcement.author}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 本文 */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-3xl mx-auto">
              <div className="p-6 md:p-8 bg-card/50 border border-border rounded-lg">
                <div className="prose prose-invert prose-sm md:prose-base max-w-none">
                  {announcement.content.split("\n").map((line, index) => {
                    if (line.startsWith("## ")) {
                      return (
                        <h2 key={index} className="text-lg font-bold mt-6 mb-3 text-foreground">
                          {line.replace("## ", "")}
                        </h2>
                      )
                    }
                    if (line.startsWith("- ")) {
                      return (
                        <li key={index} className="text-muted-foreground ml-4">
                          {line.replace("- ", "")}
                        </li>
                      )
                    }
                    if (line.match(/^\d+\. /)) {
                      return (
                        <li key={index} className="text-muted-foreground ml-4 list-decimal">
                          {line.replace(/^\d+\. /, "")}
                        </li>
                      )
                    }
                    if (line === "") {
                      return <br key={index} />
                    }
                    return (
                      <p key={index} className="text-muted-foreground mb-2">
                        {line}
                      </p>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
