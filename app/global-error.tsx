"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // エラーをログサービスに送信（必要に応じて）
        console.error("Global error:", error);
    }, [error]);

    return (
        <html lang="ja">
            <body className="font-sans antialiased bg-background text-foreground">
                <div className="min-h-screen flex items-center justify-center p-6">
                    <div className="max-w-md w-full text-center space-y-6">
                        <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-destructive" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold">エラーが発生しました</h1>
                            <p className="text-muted-foreground text-sm">
                                申し訳ございません。予期しないエラーが発生しました。
                            </p>
                        </div>

                        {error.digest && (
                            <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-3 py-2 rounded">
                                エラーID: {error.digest}
                            </p>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button onClick={reset} variant="default" className="gap-2">
                                <RefreshCw className="w-4 h-4" />
                                再試行
                            </Button>
                            <Button asChild variant="outline" className="gap-2">
                                <Link href="/">
                                    <Home className="w-4 h-4" />
                                    ホームに戻る
                                </Link>
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            問題が解決しない場合は、
                            <Link href="/feedback" className="text-primary hover:underline">
                                フィードバック
                            </Link>
                            からお知らせください。
                        </p>
                    </div>
                </div>
            </body>
        </html>
    );
}
