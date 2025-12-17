"use client"

import Link from "next/link"
import { ArrowLeft, Bell, Moon, Shield } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SideNav } from "@/components/side-nav"

export default function SettingsPage() {
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
                href="/me"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">マイページ</span>
              </Link>

              <span className="text-xs text-primary tracking-[0.3em] font-mono">SETTINGS</span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 mb-2">設定</h1>
              <p className="text-muted-foreground text-sm md:text-base">通知や表示に関する設定</p>
            </div>
          </div>
        </section>

        {/* 設定フォーム */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* 通知設定 */}
              <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-6">
                  <Bell className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">通知設定</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-email" className="flex-1">
                      <span className="font-medium">メール通知</span>
                      <p className="text-xs text-muted-foreground mt-1">重要なお知らせをメールで受け取る</p>
                    </Label>
                    <Switch id="notify-email" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-deadline" className="flex-1">
                      <span className="font-medium">締切リマインダー</span>
                      <p className="text-xs text-muted-foreground mt-1">締切3日前に通知を受け取る</p>
                    </Label>
                    <Switch id="notify-deadline" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-event" className="flex-1">
                      <span className="font-medium">イベント通知</span>
                      <p className="text-xs text-muted-foreground mt-1">新しいイベント作成時に通知</p>
                    </Label>
                    <Switch id="notify-event" />
                  </div>
                </div>
              </div>

              {/* 表示設定 */}
              <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-6">
                  <Moon className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">表示設定</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="theme" className="flex-1">
                      <span className="font-medium">テーマ</span>
                      <p className="text-xs text-muted-foreground mt-1">外観のカラーモード</p>
                    </Label>
                    <Select defaultValue="dark">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">ライト</SelectItem>
                        <SelectItem value="dark">ダーク</SelectItem>
                        <SelectItem value="system">システム</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="language" className="flex-1">
                      <span className="font-medium">言語</span>
                      <p className="text-xs text-muted-foreground mt-1">表示言語の設定</p>
                    </Label>
                    <Select defaultValue="ja">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ja">日本語</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* セキュリティ */}
              <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">セキュリティ</h2>
                </div>

                <div className="space-y-4">
                  <Link
                    href="/me/security"
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-all"
                  >
                    <div>
                      <p className="font-medium text-sm">ログイン端末の管理</p>
                      <p className="text-xs text-muted-foreground mt-1">ログイン中のデバイスを確認・管理</p>
                    </div>
                    <span className="text-primary text-sm">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
