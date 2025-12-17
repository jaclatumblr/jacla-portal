"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Mail, ArrowRight, Loader2, Chrome } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsLoading(false)
    setIsSent(true)
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    // Google login would be implemented here
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* 左側：装飾パネル（デスクトップのみ） */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-card overflow-hidden">
        {/* 背景エフェクト */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />

        {/* グリッドライン */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
              backgroundSize: "80px 80px",
            }}
          />
        </div>

        {/* コンテンツ */}
        <div className="relative z-10 flex flex-col justify-center p-12 lg:p-16">
          <div className="mb-8">
            <Image
              src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
              alt="jacla logo"
              width={120}
              height={72}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold mb-4">
            <span className="text-foreground">総合音楽部</span>
            <span className="block text-primary mt-2">jacla</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
            部員専用ポータルサイトへようこそ。イベント管理、レパートリー提出、PA/照明機材の管理など、サークル活動をサポートします。
          </p>

          {/* 装飾コーナー */}
          <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-primary/30" />
          <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-primary/30" />
        </div>
      </div>

      {/* 右側：ログインフォーム */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* モバイル用ロゴ */}
          <div className="lg:hidden text-center mb-8">
            <Image
              src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
              alt="jacla logo"
              width={80}
              height={48}
              className="mx-auto object-contain mb-4"
              priority
            />
            <h1 className="text-2xl font-bold">
              <span className="text-foreground">総合音楽部 </span>
              <span className="text-primary">jacla</span>
            </h1>
          </div>

          <div className="space-y-6">
            <div className="text-center lg:text-left">
              <span className="text-xs text-primary tracking-[0.3em] font-mono">LOGIN</span>
              <h2 className="text-2xl sm:text-3xl font-bold mt-2">ログイン</h2>
              <p className="text-muted-foreground mt-2">部員アカウントでログインしてください</p>
            </div>

            {isSent ? (
              /* メール送信完了画面 */
              <div className="p-6 bg-card/50 border border-border rounded-lg text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">メールを送信しました</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  <span className="text-foreground font-medium">{email}</span>
                  <br />
                  に認証リンクを送信しました。
                  <br />
                  メールを確認してログインしてください。
                </p>
                <Button variant="outline" className="w-full bg-transparent" onClick={() => setIsSent(false)}>
                  別のメールアドレスを使用
                </Button>
              </div>
            ) : (
              <>
                {/* Googleログイン */}
                <Button
                  variant="outline"
                  className="w-full h-12 bg-card/50 border-border hover:bg-card hover:border-primary/50 transition-all"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Chrome className="w-5 h-5 mr-3" />
                      Googleでログイン
                    </>
                  )}
                </Button>

                <div className="relative">
                  <Separator className="bg-border" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-4 text-xs text-muted-foreground">
                    または
                  </span>
                </div>

                {/* メールリンクログイン */}
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      メールアドレス
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="example@university.ac.jp"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 bg-card/50 border-border focus:border-primary"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading || !email}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        メールリンクでログイン
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground text-center">
                  ログインすることで、
                  <Link href="/terms" className="text-primary hover:underline">
                    利用規約
                  </Link>
                  と
                  <Link href="/privacy" className="text-primary hover:underline">
                    プライバシーポリシー
                  </Link>
                  に同意したことになります。
                </p>
              </>
            )}
          </div>

          {/* フッター */}
          <div className="mt-12 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              アカウントをお持ちでない場合は
              <br className="sm:hidden" />
              <span className="text-foreground">運営にお問い合わせください</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
