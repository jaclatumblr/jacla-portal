export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">利用規約</h1>
          <div className="text-xs text-muted-foreground">
            <p>施行日: 2025-12-30</p>
            <p>最終改定日: 2025-12-30</p>
          </div>
          <p className="text-sm text-muted-foreground">
            本利用規約（以下「本規約」）は、東京工科大学 総合音楽部Jacla（以下「運営」）
            および矢内康太朗（以下「製作者」）が提供する
            「Jacla Portal」（以下「本サービス」）の利用条件を定めるものです。
          </p>
        </div>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">1. 適用</h2>
            <p>
              本規約は、本サービスの利用に関する一切に適用されます。本サービスを利用することで、
              利用者は本規約に同意したものとみなされます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">2. 利用対象</h2>
            <p>
              本サービスは部活動内の運用を目的としたシステムであり、
              運営が許可した部員・関係者のみが利用できます。アカウント情報は正確に入力し、
              自身の管理のもとで利用してください。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">3. 禁止事項</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>不正アクセス、権限の不正取得、なりすまし</li>
              <li>本サービスの運営を妨げる行為</li>
              <li>他の利用者や第三者の権利・利益を侵害する行為</li>
              <li>法令または公序良俗に反する行為</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">4. サービスの変更・停止</h2>
            <p>
              運営、および製作者は、利用者への事前告知なく本サービスの内容変更、追加、停止を行うことがあります。
              これにより利用者に生じた損害について、運営、および製作者は責任を負いません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. 知的財産</h2>
            <p>
              本サービス内に掲載されるコンテンツの著作権等の権利は、運営または正当な権利者に帰属します。
              また、製作者は本サービスに関する著作権その他の権利を保持し、これらの権利を放棄しません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. 免責</h2>
            <p>
              本サービスはβテスト段階であり、内容の正確性・完全性・有用性について保証しません。
              利用により生じた損害について、運営、および製作者は責任を負いません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">7. 利用停止・削除</h2>
            <p>
              利用者が本規約に違反した場合、運営、および製作者は当該利用者の利用停止またはアカウント削除を行うことがあります。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. 規約の変更</h2>
            <p>
              運営、および製作者は必要に応じて本規約を変更できます。変更後の規約は本サービス上に掲載した時点で効力を生じます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">9. 準拠法</h2>
            <p>
              本規約は日本法に準拠します。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">10. お問い合わせ</h2>
            <p>
              本サービスに関するお問い合わせは、サービス内のフィードバック機能からご連絡ください。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
