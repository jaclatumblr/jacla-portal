"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft, FileText, Clock, User } from "lucide-react"
import { SideNav } from "@/components/side-nav"

const docsData: Record<string, { title: string; content: string; lastUpdated: string; author: string }> = {
  "getting-started": {
    title: "ポータルの使い方",
    content: `# ポータルの使い方

jaclaポータルへようこそ！このガイドでは、基本的な機能と操作方法を説明します。

## ログイン方法

1. ログインページにアクセス
2. 大学のメールアドレスを入力
3. 送信されたメールリンクをクリック

## 主な機能

### イベント管理
- イベント一覧の確認
- レパートリー提出
- タイムテーブル確認

### 機材管理
- PA機材の確認・予約
- 照明機材の確認・予約

### お知らせ
- 運営からのお知らせ確認
- 重要な連絡事項のチェック

## サポート

不明点がある場合は、運営チームまでお問い合わせください。`,
    lastUpdated: "2025-01-10",
    author: "運営チーム",
  },
  "repertoire-guide": {
    title: "レパートリー提出",
    content: `# レパートリー提出ガイド

イベントに参加するバンドは、締切までにレパートリーを提出する必要があります。

## 提出手順

1. イベントページにアクセス
2. 「レパートリー提出」をクリック
3. バンド情報を入力
4. 演奏曲を追加（最大4曲）
5. メンバー確認後、提出

## 注意事項

- 締切厳守
- 曲順の変更は可能
- オリジナル曲は楽譜添付必須`,
    lastUpdated: "2025-01-08",
    author: "イベント運営",
  },
}

export default function DocDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const doc = docsData[slug] || {
    title: "ドキュメントが見つかりません",
    content: "指定されたドキュメントは存在しません。",
    lastUpdated: "",
    author: "",
  }

  return (
    <div className="flex min-h-screen">
      <SideNav />

      <main className="flex-1 md:ml-20">
        {/* ヘッダー */}
        <section className="relative py-12 md:py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

          <div className="relative z-10 container mx-auto px-4 sm:px-6">
            <div className="max-w-3xl pt-12 md:pt-0">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">ドキュメント一覧</span>
              </Link>

              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-xs text-primary tracking-[0.3em] font-mono">DOCUMENT</span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">{doc.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {doc.lastUpdated && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>更新: {doc.lastUpdated}</span>
                  </div>
                )}
                {doc.author && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{doc.author}</span>
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
                  {doc.content.split("\n").map((line, index) => {
                    if (line.startsWith("# ")) {
                      return null // タイトルはヘッダーで表示済み
                    }
                    if (line.startsWith("## ")) {
                      return (
                        <h2
                          key={index}
                          className="text-xl font-bold mt-8 mb-4 text-foreground border-b border-border pb-2"
                        >
                          {line.replace("## ", "")}
                        </h2>
                      )
                    }
                    if (line.startsWith("### ")) {
                      return (
                        <h3 key={index} className="text-lg font-bold mt-6 mb-3 text-foreground">
                          {line.replace("### ", "")}
                        </h3>
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
