# 在籍・アカウント管理

## 動作

管理画面「ユーザー管理」の「在籍・アカウント管理」タブで、Administrator / Supervisor が利用状態を変更できます。管理トップからは「権限管理」タブを既定で開きます。直接リンク `/admin/accounts` や休眠警告からは在籍管理タブを開き、ブラウザの戻る・再読み込みでも選択先を保持します。

| 状態 | 通常の部員一覧・新規バンド追加候補 | ログイン・API・DBアクセス | 既存バンドの名前・所属 |
| --- | --- | --- | --- |
| 在籍中 | 表示 | 許可 | 保持 |
| 休眠 | 非表示 | 停止 | 保持 |
| 卒業 | 非表示 | 停止 | 保持 |
| 退部 | 非表示 | 停止 | 保持 |

状態変更は理由必須で記録されます。自分自身の停止・復帰はできません。複数の管理者が同時に互いを停止する操作もDB側で直列化し、停止済みの管理者の操作を拒否します。

既存の `profiles.id` を人物の参照IDとして保持します。アーカイブ時にAuthユーザーやプロフィールを削除せず、ログインだけを停止するため、バンドや出演履歴の参照を壊しません。ログイン元のGoogleアカウントが消えていても、この履歴は残ります。別Googleアカウントへの付け替え・同姓同名やメールアドレス一致による自動統合は行いません。

復帰は管理者が「在籍中」に変更して行います。元のGoogleアカウントで再ログインが必要です。Googleアカウント自体の消失を復旧する機能ではありません。旧セッションと以前の管理権限・役職は復元しません。必要な権限は別途ユーザー管理で設定してください。

## 休眠と事前警告

- 最終利用から暦上の6か月で休眠対象になります。
- 期限の30日前から、管理ダッシュボードと在籍管理の「休眠の事前警告中」に対象者が表示されます。運用方針に従い、本人宛のメールは送りません。
- 警告を記録してから最低30日経過するまでは自動停止しません。定期処理が長期間止まった後の再開時にも、この猶予を適用します。
- 最後の管理者1名は自動休眠の対象外です。警告一覧には残るため、後任への引き継ぎを確認してください。
- 初回SQL適用時は、既存全員に適用時点から6か月の猶予を設定します。過去の未アクセスを推定して即時停止しません。既知の卒業生は個別に卒業へ変更してください。
- 導入・復帰時の猶予開始は、実アクセスとは区別して「アクセス未記録・判定開始」と表示します。
- 可視状態での画面表示、画面復帰、クリック、キー入力を利用として記録します。書込みはDBでも15分間隔に抑えます。
- 放置したタブの監視タイマーやトークンの自動更新だけでは最終アクセスを延長しません。バックグラウンド監視は利用可否の確認だけを行います。

## セキュリティと保持データ

- 停止・復帰・権限解除・Auth側の停止・セッション削除・監査記録を、DB関数の1トランザクションで実行します。
- Authの `banned_until` によるログイン停止に加え、`auth.sessions` の削除と、現在の利用状態＋session_idの照合を行います。停止前に発行されたJWTも拒否し、復帰後も旧JWTは再利用できません。
- PostgRESTのpre-requestチェックで、既存のSECURITY DEFINER RPCも停止対象者から呼べないようにします。RLSの制限ポリシーも公開スキーマの各テーブルと `storage.objects` に追加します。
- 既存の権限・公開範囲は維持します。従来RLSが無かったテーブルでは従来のGRANTに基づくアクセスを維持し、その上に利用状態の制限を追加します。公開画像等の匿名アクセスを非公開へ変更するものではありません。
- service roleを使用するアプリAPIにも共通チェックを入れます。Discordの遅延コールバックにも認可開始時のsession_idを結び付けます。
- 停止時に `profiles.leader`、`profile_leaders`、`profile_positions` を解除します。以前の役職は管理者向け監査記録に保持します。
- アーカイブ済みプロフィールの通常削除と、新しいバンドへの追加をDB側でも拒否します。既存の所属は更新・表示でき、名前は保持します。
- メール、学籍番号、誕生日、Discord等の個人情報を自動で一括削除する機能は含みません。必要に応じた個人情報の整理・本人からの削除要請は別途対応してください。活動履歴のアーカイブと完全消去は別の手続きです。

## 本番への適用

**コードをデプロイするだけでは有効になりません。先にDBを適用してください。** DBの確認に失敗した場合、APIは安全側に停止します。

1. 既存DBのバックアップを取り、Supabase SQL Editorで `SQL/AccountLifecycle.sql` を実行します。既存のprofiles・profile_leaders・band_membersが必要です。既存スクリプト一式を再実行する必要はありません。
2. 既存の `pgrst.db_pre_request` が別に設定されている場合、このSQLはロール設定を上書きせず中断します。既存チェックとの統合が必要です。DBや環境変数で別途フックを設定している場合も確認してください。
3. Supabaseのスキーマキャッシュと設定をリロードするNOTIFYもSQLに含まれます。管理者の現行セッションで部員一覧と在籍管理が取得できることを確認します。
4. VercelのProduction環境変数 `CRON_SECRET` にランダムな秘密値（最低16文字、推奨32バイト以上）を設定します。既存のSupabase URL・anon key・service role keyも必要です。値はクライアント公開変数にしません。
5. コードをデプロイします。`vercel.json` で毎日18:00 UTC（日本時間の翌03:00、Hobbyではその時間帯）の `/api/cron/inactive-accounts` が実行されます。VercelがAuthorizationヘッダーを付けます。
6. VercelのCron設定・ログで正常終了を確認します。戻り値は `warned`、`suspended`、`skipped_last_admin` の件数です。同じ処理を繰り返しても重複停止・重複警告しません。

状態は管理画面から段階的に変更してください。SQL適用そのものでは卒業・休眠への変更は一件も行いません。本番へのSQL適用、環境変数の設定、デプロイはこの実装作業では実行していません。

新しいDBテーブルを追加した際は、SQL中の「Restrictive policies」ブロックを再適用して利用停止の制限を追加してください。pre-requestだけに依存するとStorage/Realtimeの経路を保護できません。

## 検証

- `scripts/check-account-lifecycle.cjs`: APIの利用可否・変更理由・自己停止拒否・権限・Cron認証、実利用とバックグラウンド監視の区別。
- `scripts/check-account-lifecycle-db.cjs`: 隔離PostgreSQL（PGlite）に実際のマイグレーションと既存の役職トリガーを適用。履歴保持、Auth停止、セッション破棄、RLS、RPCの実行権限、復帰、猶予、冪等性を検証します。本番DBには接続しません。
- 既存のテーマ・ホーム・セキュリティ・PDF等の回帰テストも対象にします。

DBテストの準備（プロジェクトの依存関係には追加しません）:

```powershell
$lifecycleTestRoot = Join-Path $env:TEMP 'jacla-lifecycle-db-tests'
npm install --prefix $lifecycleTestRoot --no-save --ignore-scripts --no-audit --no-fund @electric-sql/pglite
node --test scripts/check-account-lifecycle.cjs scripts/check-account-lifecycle-db.cjs
```

別の場所にPGliteを用意する場合は `JACLA_PGLITE_MODULE` にモジュールの絶対パスを指定してください。

実ブラウザでの全画面操作、実Supabase Auth/Storage/Realtimeとの統合、本番設定の反映は別途確認が必要です。

参考: [Supabaseのユーザー管理・JWTの注意点](https://supabase.com/docs/guides/auth/managing-user-data)、[Data APIのpre-request](https://supabase.com/docs/guides/api/securing-your-api)、[pre-requestと他製品の違い](https://supabase.com/docs/guides/database/debugging-performance)、[Vercel Cronの認証と運用](https://vercel.com/docs/cron-jobs/manage-cron-jobs)。

実装時の検証結果（2026-10-22）: 既存57件＋新規10件、計67件の回帰テスト成功。新規には実SQLを隔離PostgreSQLで実行する4件を含みます。TypeScript検査・本番ビルド（65件の静的ページ生成）成功。実ブラウザでの見た目の検証は未実施です。
Lintは `npm run lint -- --quiet` でエラーなし。既存の警告は残っています。コミット・本番SQL適用・デプロイは行っていません。

## 在籍機能の再精査（2026-10-22）

追加で確認し、以下を修正しました。

- `band_members` のUPDATEでuser_idを変えずにband_idだけ移動すると、アーカイブ済みの人を新しいバンドに追加できる問題。元のバンド内の更新は維持し、別バンドへの移動は拒否します。
- 利用状態だけでなく、Supabaseの `auth.users.banned_until` と `auth.sessions.not_after` も照合。外部からの利用停止、期限切れだが削除待ちのセッションを拒否します。
- 最後の管理者の保護で、Supabase側で停止中の管理者を「他に利用可能な管理者がいる」と数えないように変更。
- 管理画面の状態変更に、読込み時の `status_changed_at` を用いた競合チェックを追加。別の管理者が変更した古い画面からの上書きを409で拒否します。再読み込み時は古い編集フォームも閉じます。
- 画面復帰時は15分以内でも利用可否を確認。監視リクエスト中の実操作は取りこぼさず、その後に利用記録を送ります。
- モバイル等で古いJWTのまま復帰した際は、一度トークン更新を試してから再判定。正常な利用者を即時ログアウトさせないようにしました。通信にタイムアウトも設定し、監視が無期限に停止しないように変更。

追加のDBテスト4件とクライアントテスト2件を含め、回帰テストの対象は計73件です。前バージョンのSQLをすでに適用している場合も、更新した `SQL/AccountLifecycle.sql` を再適用してください。旧4引数の状態変更関数はSQL内で削除し、競合チェックに対応した5引数版に置き換えます（内部処理向けの省略可能引数あり）。本番DBへの適用はこの作業では行っていません。

仕様確認: [Supabaseのセッションと削除タイミング](https://supabase.com/docs/guides/auth/sessions)、[Supabase Authのセッションクリーンアップ実装](https://github.com/supabase/auth/blob/master/internal/models/cleanup.go)。

再精査の検証結果: 全73件成功、TypeScript・Lint（quiet、既存warningは残存）・本番ビルド成功、npm audit --omit=dev は0件。実ブラウザでの全画面操作と本番Supabaseでの統合動作は未確認です。
