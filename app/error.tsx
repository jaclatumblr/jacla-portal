"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Page error:", error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-foreground">
                        ページの読み込みに失敗しました
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        このページでエラーが発生しました。再試行するか、ホームに戻ってください。
                    </p>
                </div>

                {process.env.NODE_ENV === "development" && error.message && (
                    <div className="text-left bg-muted/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground font-mono break-all">
                            {error.message}
                        </p>
                    </div>
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
            </div>
        </div>
    );
}
