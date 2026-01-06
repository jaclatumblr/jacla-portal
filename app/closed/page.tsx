import Link from "next/link";

export default function ClosedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">現在メンテナンス中です</h1>
        <p className="text-sm text-muted-foreground">
          Jacla Portal は一時的にクローズされています。しばらく時間をおいてから再度アクセスしてください。
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
          >
            ログイン画面へ
          </Link>
        </div>
      </div>
    </div>
  );
}
