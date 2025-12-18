"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Calendar, Clock, MapPin, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SideNav } from "@/components/side-nav"

export default function NewEventPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsLoading(false)
    router.push("/events")
  }

  return (
    <div className="flex min-h-screen">
      <SideNav />

      <main className="flex-1 md:ml-20">
        {/* ヘッダー */}
        <section className="relative py-12 md:py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

          <div className="relative z-10 container mx-auto px-4 sm:px-6">
            <div className="max-w-2xl pt-12 md:pt-0">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">管理ページ</span>
              </Link>

              <span className="text-xs text-primary tracking-[0.3em] font-mono">NEW EVENT</span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 mb-2">新規イベント作成</h1>
              <p className="text-muted-foreground text-sm md:text-base">ライブやコンサートなどのイベントを作成します</p>
            </div>
          </div>
        </section>

        {/* フォーム */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
              <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    イベント名
                  </Label>
                  <Input id="title" placeholder="例: 春ライブ 2025" className="bg-background" required />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      開催日
                    </Label>
                    <Input id="date" type="date" className="bg-background" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time" className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      時間
                    </Label>
                    <Input id="time" placeholder="例: 18:00 - 21:00" className="bg-background" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    会場
                  </Label>
                  <Input id="location" placeholder="例: 大学ホール" className="bg-background" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline">レパートリー提出締切</Label>
                  <Input id="deadline" type="date" className="bg-background" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">説明</Label>
                  <Textarea
                    id="description"
                    placeholder="イベントの詳細説明..."
                    className="bg-background min-h-[120px]"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      作成中...
                    </>
                  ) : (
                    "イベントを作成"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}
