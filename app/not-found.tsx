import Link from "next/link";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <FileQuestion className="w-10 h-10 text-primary" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-6xl font-bold text-primary">404</h1>
                    <h2 className="text-xl font-semibold text-foreground">
                        ページが見つかりません
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        お探しのページは存在しないか、移動した可能性があります。
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild variant="default" className="gap-2">
                        <Link href="/">
                            <Home className="w-4 h-4" />
                            ホームに戻る
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="gap-2">
                        <Link href="/events">
                            <ArrowLeft className="w-4 h-4" />
                            イベント一覧へ
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
