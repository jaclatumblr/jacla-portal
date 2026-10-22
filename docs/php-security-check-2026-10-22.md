# PHP緊急脆弱性の該当確認（2026-10-22）

## 結論

Jacla Portalの確認可能なアプリケーション構成・依存関係・Vercel本番設定に、今回のPHP脆弱性の対象となるPHP実行系は見つからなかった。PHP対策として変更すべきソースや設定は確認されていない。

これは、外部サービス事業者の内部環境や、別途管理する全サーバーを検査したという意味ではない。

## 対象の脆弱性

- CVE-2026-109618：メモリ不足時の内部状態破損によるリモートコード実行。
- CVE-2026-109619：解放済みのリクエスト内部状態が残ることによるリモートコード実行。

PHP公式は2026-10-21に修正版 PHP 8.5.12 / 8.4.27 / 8.3.36 / 8.2.35 を公開。PHPでWebリクエストを処理する構成が対象で、PHP-FPM、mod_php、php-cgi、FrankenPHP、LiteSpeed等が含まれる。

出典：[PHP公式セキュリティ告知](https://www.php.net/archive/2026.php#2026-10-21-5)。PHP 8.1以前はPHPプロジェクトによる通常サポート対象外であり、利用している場合はベンダーのバックポートまたはサポート対象版への移行を別途確認する必要がある。

## 確認した証拠

| 範囲 | 確認結果 |
| --- | --- |
| アプリの実装 | Next.js / React / TypeScript。PHPソース、PHP開始タグ、PHP実行呼び出しは見つからず |
| パッケージ | package-lock.jsonの630エントリを対象にPHP/Composer/CGI/FPM/FrankenPHP等のランタイム依存を確認し、該当なし |
| ビルド・配備設定 | package.jsonはnext dev/build/start。next.config.tsにPHP用ランタイムの指定なし。Composer、PHP設定、Apache/Nginx設定、PHP用Docker構成は見つからず |
| PHPの埋め込み | vercel-php / php-wasm / php.cgi等の埋め込み・カスタムランタイムを示す実装は見つからず |
| 本番Vercelプロジェクト | Vercel APIで取得成功。framework=nextjs、nodeVersion=24.x。設定されたビルド等のコマンドにPHP/Composer指定なし |
| 最新の本番デプロイ | Vercel APIで取得成功。READY、projectSettings.framework=nextjs、projectSettings.nodeVersion=24.x。API応答に個別関数のランタイム一覧は含まれず、その一覧まで検証したとは扱っていない |
| 開発PCの限定確認 | PATH上にphp / php-cgi / php-fpm / composerコマンドは見つからず。確認時にphp / php-cgi / php-fpm / httpd / nginxの実行中プロセスは見つからず。PC全ディスクのインストール検査は行っていない |

ソース探索ではnode_modules、.next、.git、.venv、生成済み一時ファイル等を除外し、依存関係は別途ロックファイルで調査した。README内の「WordPressのような投稿管理」という説明は、WordPress/PHPの導入を示すものではない。

## 確認対象外

- Vercel・Supabase・Discord・Google等の事業者内部の実装とパッチ状況。
- このリポジトリに含まれないWebサイト、共用サーバー、管理画面、機器内蔵Webサーバー。
- 本番サーバー内部へのログイン、侵入テスト、攻撃リクエストの送信。

認証情報を出力せず、Vercel APIは読み取りのみ実施。デプロイ・環境変数・アプリの実装は変更していない。
