import { BackToPreviousButton } from "@/components/BackToPreviousButton";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <BackToPreviousButton />

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">利用規約</h1>
          <div className="text-xs text-muted-foreground">
            <p>施行日: 2026-01-26</p>
            <p>最終改定日: 2026-04-09</p>
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
              本規約は、本サービスの利用に関する一切に適用されます。本サービスを利用した時点で、
              利用者は本規約に同意したものとみなされます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">2. 利用対象・認証</h2>
            <p>
              本サービスは部活動内の運用を目的としたシステムであり、運営が許可した部員・卒業生・関係者のみが利用できます。
              通常のログインには東京工科大学の `edu.teu.ac.jp` ドメインの Google
              アカウントを利用し、例外的に運営が個別に許可した管理者用 Gmail
              アドレスを認める場合があります。
            </p>
            <p>
              卒業、退部、権限変更、大学アカウントの失効その他の事情により、運営は利用資格を見直すことがあります。
              現時点では、大学アカウントから個人メール等への自動移行や、同一人物としての継続ログインを保証する機能は提供していません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">3. 禁止事項</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>不正アクセス、権限の不正取得、なりすまし</li>
              <li>本サービスの運営を妨げる行為</li>
              <li>他の利用者や第三者の権利・利益を侵害する行為</li>
              <li>法令または公序良俗に反する行為</li>
              <li>部内限定または権限限定の情報を、運営の許可なく外部共有する行為</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">4. PWA・端末保存</h2>
            <p>
              本サービスは、対応ブラウザでホーム画面への追加やアプリ風表示ができる PWA
              機能を提供する場合があります。利用者の端末には、表示高速化やオフライン表示のため、
              一部のページ、画像、設定情報がブラウザのキャッシュやストレージに一時保存されることがあります。
            </p>
            <p>
              共有端末で利用する場合は、利用後にログアウトし、必要に応じてブラウザのキャッシュや保存データを削除してください。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. サービスの変更・停止</h2>
            <p>
              運営、および製作者は、利用者への事前告知なく本サービスの内容変更、追加、停止を行うことがあります。
              これにより利用者に生じた損害について、運営、および製作者は責任を負いません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. 知的財産</h2>
            <p>
              本サービス内に掲載されるコンテンツの著作権等の権利は、運営または正当な権利者に帰属します。
              また、製作者は本サービスに関する著作権その他の権利を保持し、これらの権利を放棄しません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">7. 免責</h2>
            <p>
              本サービスは現状有姿で提供されます。内容の正確性・完全性・有用性、ならびに常時利用可能であることについて保証しません。
              利用により生じた損害について、運営、および製作者は責任を負いません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. 利用停止・アカウントの取扱い</h2>
            <p>
              利用者が本規約に違反した場合、または運営が利用資格を失ったと判断した場合、運営、および製作者は当該利用者の利用停止、
              権限変更、またはアカウント削除を行うことがあります。
            </p>
            <p>
              認証に用いていた大学アカウントが利用不能となった場合でも、イベント記録、提出物、更新履歴その他の運営上必要なデータは、
              引き継ぎ・監査・履歴保持のため継続保管されることがあります。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">9. 規約の変更</h2>
            <p>
              運営、および製作者は必要に応じて本規約を変更できます。変更後の規約は本サービス上に掲載した時点で効力を生じます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">10. 外部サービス</h2>
            <p>
              本サービスは運用のために外部サービスを利用しています。詳細はプライバシーポリシーをご確認ください。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">11. GitHubリポジトリ</h2>
            <p>
              本サービスのソースコードは、運営が管理するGitHubリポジトリで管理されています。
              <br />
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
            <h2 className="text-lg font-semibold">12. 準拠法</h2>
            <p>本規約は日本法に準拠します。</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">13. お問い合わせ</h2>
            <p>
              本サービスに関するお問い合わせは、サービス内のフィードバック機能からご連絡ください。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
