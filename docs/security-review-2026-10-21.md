# セキュリティ・不具合レビュー（2026-10-21）

未コミットのテーマ・ホーム変更を中心に、認証、キャッシュ、管理API、曲情報取得API、依存パッケージも確認した。修正は未コミット。実アカウントの削除・外部サービスへの送信・DB設定変更は行っていない。

## 修正内容

| 対象 | 確認した問題 | 対応 |
| --- | --- | --- |
| package.json / package-lock.json | 旧Next.jsなどに既知の脆弱性 | Next.jsとeslint-config-nextを16.4.2に更新。PostCSS 8.5.31、sharp 0.35.5なども更新。本番依存のnpm auditは0件 |
| app/api/repertoire/metadata/route.ts | IPv4を埋め込んだIPv6表記で内部IP判定を回避できる。事前DNS確認と実接続で別のIPが使われ得る | IPv6判定を修正。専用Undici Agentで実接続時のDNS解決結果も検証。既存のリダイレクト禁止・サイズ制限・タイムアウトを維持 |
| contexts/AuthContext.tsx / app/debug-auth/page.tsx | セッション全体（アクセストークン等）のconsole出力。ログイン履歴のsessionStorageキーにもトークンを複製 | 出力を削除。履歴キーをユーザーIDと有効期限に変更し、旧キーも削除 |
| contexts/AuthContext.tsx | 遅い初期getSessionが新しい認証イベントを上書きする。初期取得の例外で読み込みが続く | バージョン判定と例外処理を追加。認証コールバック外で履歴を登録し、ストレージ無効時も重複を抑止 |
| components/QueryProvider.tsx / lib/queryClient.ts | 同一ブラウザのアカウント間でQueryClientとページ状態が共有される | アカウント変更時にページツリーとQueryClientを作り直し、旧キャッシュを破棄 |
| public/sw.js | ページや任意の同一オリジン応答を共通キャッシュに保存し得る | 公開静的パスのみをキャッシュ。ページ・RSC・認証付き要求を保存しない。private/no-storeを尊重し、旧キャッシュを削除。キャッシュ容量不足でもネットワーク応答を維持 |
| app/api/account/delete/route.ts | 不正JSONが空オブジェクトとして扱われ、自分自身の削除に進む。空・不正なtargetUserIdも自己削除にフォールバック | 不正なJSON・型・UUIDを400で拒否。正規の空オブジェクトによる自己削除と、権限確認付きの他ユーザー削除は維持 |
| feedback / profile-private / profile-private/batch API | null・配列・想定外の型で例外や不正値の書き込みが起きる | 入力検証を追加。フィードバック分類は継承プロパティを分類として受け入れない |
| contexts/DesignPresetContext.tsx | A→B→Aの切替後、古いAの保存結果が新しい保存のロックやエラーを変更する | リクエストの同一性で完了処理を制限 |
| components/SideNav.tsx / lib/browserStorage.ts | sessionStorage禁止時にナビゲーションが例外停止する | 読み書きを例外に強いヘルパーへ変更 |
| components/ColorWheel.tsx | 明るさを0にすると彩度が失われ、元の色に戻せない | HEXで失われるHSV情報を選択状態に保持 |
| components/ui/input.tsx | labelなしのsupportingTextがaria-describedbyだけ付いて実際には表示されない | 補足本文を描画し、存在する要素に関連付け |
| app/api/repertoire/metadata/route.ts | 動画・配信サービスの時間抽出正規表現が数字を認識しない | エスケープを修正し、JSON内の空白にも対応 |
| app/page.tsx / lib/homeEvents.ts | 当日にイベントがないと、同じ月に予定があっても日別欄が空白になる | 実際にイベントのある日を初期選択。選択日の導出を描画時に行い、同期用Effectを削除 |

## 確認方法

```powershell
node --test scripts/check-security-regressions.cjs scripts/check-design-colors.cjs scripts/check-design-presets.cjs scripts/check-design-icons.cjs scripts/check-home-events.cjs scripts/check-product-themes.cjs scripts/check-uncommitted-regressions.cjs
npm run lint -- --quiet
npm run build
npm audit --omit=dev
git diff --check
```

セキュリティ回帰テストは認証・DNS・ネットワーク・削除APIをモック化し、本物のアカウントや内部ネットワークにはアクセスしない。

最終結果：テスト48件成功、本番ビルド成功（型チェックと61ページの生成を含む）、Lintエラー0件（下記の既存React警告は維持）、本番依存のnpm audit 0件、git diff --check成功。

## 残る制約

- 開発用eslint-config-next配下のbracesに、未修正のHigh警告が残る（関連パッケージへの伝播を含めnpm auditでは5件）。本番依存ではない。[公開アドバイザリ](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)の修正版は未公開。npm audit fix --forceが提案するNext用ESLint設定の14系への降格は行っていない。
- ESLint設定の更新で追加されたReact描画・メモ化の移行診断（set-state-in-effect / preserve-manual-memoization）は、既存の外部データ取得Effectも対象になるため警告として維持している。無効化はしていない。全体Lintの「エラー0」は、これらの警告もすべて解消したという意味ではない。
- 実際の情報流出や攻撃の発生を確認したものではない。コードと隔離テストで確認した問題・リスクを修正した。
- Supabase上で現在有効なRLS・権限・既存データ、実アカウントでの操作、実ブラウザの見た目やインストール動作は今回の検証対象に含めていない。リポジトリ内のSQL確認だけでは、稼働中DBの設定を保証できない。

参照：[Next.js修正版に関する公開アドバイザリ](https://github.com/advisories/GHSA-cjq9-62q9-8jv4)、[Supabase認証イベント仕様](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)。
