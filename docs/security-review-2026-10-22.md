# 再精査 2026-10-22

対象: 未コミット差分を含むアプリの認証、Discord連携、権限状態、API入力、遷移先、ストレージ、既存テーマ・ホーム・Service Workerの回帰確認。

## 今回修正した項目

- Discord連携の署名付きstateをHttpOnly・SameSite=LaxのCookieに結び付け、別ブラウザにコピーされた認可URLから連携が完了する問題を防止。完了時にCookieを削除。
- stateの署名形式・対象ユーザーID・nonce・有効期限・未来日時を検証。不正なUnicode署名で例外になる経路も排除。
- Discord通信にタイムアウトと例外処理を追加。nullや不正型の応答でクラッシュせず、エラー画面へ戻す。
- Discord、プロフィール登録後、内部リンク判定に共通の遷移先検証を導入。外部URL、バックスラッシュ、制御文字、過大な遷移先を拒否。
- 管理者モードと権限フラグを取得対象のアカウントに紐付け、アカウント切替直後・ログアウト・取得失敗時に以前の権限が残る問題を修正。他人のモードを切替先の保存領域へ書き込まない。
- localStorageが使用できない場合も管理者モード・切替ドックが動作するように修正。
- 認証コールバックの二重URLデコードを削除し、パーセント記号を含むエラーで落ちる問題を修正。
- 認証イベント内のDB処理を遅延実行。古いセッションの非同期判定によるログアウト・遷移を抑止し、画面破棄時やタイムアウト時の処理を無効化。AuthGuardにも破棄確認を追加。
- 管理者向けVercelログAPIでdeploymentIdとsinceを検証し、外部APIへのパス・クエリ混入を防止。

## 検証

- 既存の回帰テスト48件に加え、新規9件が成功（計57件）。Discordは通信・DBをモックし、実アカウントの変更は行っていない。
- 新規テスト: scripts/check-oauth-regressions.cjs。Cookie不一致時に通信も更新も発生しないこと、正常連携、通信失敗、遷移先検証、state検証、アカウント切替と取得失敗、ストレージ拒否、認証判定の競合を確認。
- npm audit --omit=dev: 0件。
- TypeScript、Lint、本番ビルドの結果は完了後に追記。

## 確認範囲の限界

自動テストとコード確認による精査。本番SupabaseのRLS適用状態、外部OAuthの実ログイン、実ブラウザでの全画面操作・見た目は今回未確認。既存の開発用依存に関する注意点は前回の監査記録を参照。脆弱性や不具合が一切ないことを保証するものではない。

関連する仕様・公式資料: [OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/info/rfc9700/)、[Supabaseの認証コールバック内の非同期API呼び出しに関する説明](https://supabase.com/kb/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0)。
