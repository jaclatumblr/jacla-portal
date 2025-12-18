"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("認証を確認中...")

  useEffect(() => {
    // 認証コールバック処理をシミュレート
    const handleCallback = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        setStatus("success")
        setMessage("認証が完了しました")
        setTimeout(() => {
          router.push("/home")
        }, 1500)
      } catch {
        setStatus("error")
        setMessage("認証に失敗しました")
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <Image
            src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
            alt="jacla logo"
            width={80}
            height={48}
            className="mx-auto object-contain"
          />
        </div>

        <div className="p-8 bg-card/50 border border-border rounded-lg">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
              <h1 className="text-xl font-bold mb-2">認証中</h1>
              <p className="text-muted-foreground">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h1 className="text-xl font-bold mb-2">認証完了</h1>
              <p className="text-muted-foreground">{message}</p>
              <p className="text-sm text-muted-foreground mt-4">ダッシュボードに移動します...</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <h1 className="text-xl font-bold mb-2">認証エラー</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <Button onClick={() => router.push("/login")} className="w-full">
                ログインページに戻る
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
