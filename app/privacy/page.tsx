export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">プライバシーポリシー</h1>
          <div className="text-xs text-muted-foreground">
            <p>施行日: 2026-01-26</p>
            <p>最終改定日: 2026-01-26</p>
          </div>
          <p className="text-sm text-muted-foreground">
            本ポリシーは、東京工科大学 総合音楽部 Jacla（以下「運営」）
            および矢内康太朗（以下「製作者」）が提供する
            「Jacla Portal」（以下「本サービス」）における個人情報の取扱いを定めるものです。
          </p>
          <p className="text-sm text-muted-foreground">
            本サービスは部活動内の運用を目的としたシステムであり、取得した情報は部内運営のために利用されます。
          </p>
        </div>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">1. 取得する情報</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>アカウント情報（メールアドレス、認証プロバイダ情報）</li>
              <li>プロフィール情報（氏名、楽器、役職、学籍番号等）</li>
              <li>活動・運用情報（イベント、レパ表、備品管理、フィードバック内容等）</li>
              <li>利用ログ（アクセス履歴、操作履歴など）</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">2. 利用目的</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>認証・本人確認、アカウント管理</li>
              <li>イベント運営や部活動に必要な情報の管理・共有</li>
              <li>部内運営に必要な範囲での関係者間の情報共有</li>
              <li>問い合わせ対応、通知、重要なお知らせの配信</li>
              <li>不正利用防止、品質改善、保守・運用</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">3. 外部サービスの利用</h2>
            <p>
              本サービスでは、認証・データ保管・ホスティング等のため、外部サービスを利用します。
              これらのサービスは各社のプライバシーポリシーに従って情報を取り扱います。
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Supabase（認証、データベース、ファイル保管）</li>
              <li>Vercel（ホスティング、サーバーレス実行環境）</li>
              <li>Discord（アカウント連携）</li>
              <li>GitHub（ソースコード管理、更新情報の取得）</li>
              <li>YouTube / Spotify / Apple Music（URL入力時の曲情報取得）</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              GitHubリポジトリ:{" "}
              <a
                href="https://github.com/jaclatumblr/jacla-portal"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                https://github.com/jaclatumblr/jacla-portal
              </a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">4. 第三者提供</h2>
            <p>
              法令に基づく場合、または本サービスの提供に必要な委託先への提供を除き、
              個人情報を第三者に提供することはありません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. 保管期間</h2>
            <p>
              取得した情報は、本サービスの運営に必要な期間に限り保管し、不要となった場合は適切に削除します。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. 安全管理</h2>
            <p>
              個人情報の漏えい、滅失、毀損等を防止するため、必要かつ適切な安全管理措置を講じます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">7. 開示・訂正・削除</h2>
            <p>
              利用者は、自己の情報について開示・訂正・削除を求めることができます。
              手続きは本サービス内のフィードバック機能からご連絡ください。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. ポリシーの変更</h2>
            <p>
              本ポリシーは、必要に応じて改定されることがあります。改定後は本サービス上で通知します。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
