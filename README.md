# Jacla Portal

管理者の日常運用と担当交代については、[管理者向け引き継ぎ書](docs/admin-handover.md)を参照してください。

総合音楽サークル「Jacla」の運営業務をDX化するための部員専用ポータルサイト。イベント・バンド・レパ表・機材・お知らせ・アカウント運用を一元管理するシステムです。

## 目次

- [概要](#概要)
- [技術スタック](#技術スタック)
- [主要機能](#主要機能)
- [認証・認可システム](#認証認可システム)
- [データベース構造](#データベース構造)
- [環境変数](#環境変数)
- [セットアップ](#セットアップ)
- [開発ガイド](#開発ガイド)
- [デプロイメント](#デプロイメント)
- [ディレクトリ構造](#ディレクトリ構造)
- [その他のツール](#その他のツール)
- [参考資料](#参考資料)

## 概要

Jacla Portalは、部活動の運営を効率化するためのWebアプリケーションです。以下の目的で開発されています：

- **イベント管理**: ライブ等のイベント情報を一元管理
- **バンド編成・レパ表提出の標準化**: バンド構成とレパートリー表の提出プロセスを統一
- **PA/照明の情報共有**: ステージプロットや指示書の共有
- **お知らせ/機材/備品の管理**: 部活動運営に必要な情報を集約
- **管理/引き継ぎが容易な運用**: データベース化による情報の永続化

## 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| **Next.js** | ^16.3.8 | フレームワーク（App Router） |
| **React** | 19.2.0 | UIライブラリ |
| **TypeScript** | 5.x | 型安全性 |
| **Tailwind CSS** | 4.x | スタイリング |
| **TanStack Query** | 5.90.16 | サーバー状態管理・キャッシュ |
| **Radix UI** | 最新 | アクセシブルなUIコンポーネント |
| **next-themes** | 0.4.6 | テーマ管理（ライト/ダーク切替） |
| **react-icons** | 5.6.0 | アイコンライブラリ |
| **@dnd-kit** | 最新 | ドラッグ&ドロップ（ステージプロット等） |
| **recharts** | 3.6.0 | グラフ・チャート表示 |
| **ExcelJS** | ^4.4.0 | Excelエクスポート機能 |

### バックエンド・インフラ

| 技術 | 用途 |
|------|------|
| **Supabase** | BaaS（PostgreSQL + Auth + Storage） |
| **PostgreSQL** | リレーショナルデータベース |
| **Supabase Auth** | 認証システム（Google OAuth） |
| **Supabase Storage** | ファイルストレージ |
| **Vercel** | ホスティング・デプロイメント |

### 開発ツール

- **ESLint**: コード品質チェック
- **TypeScript**: 型チェック
- **Git**: バージョン管理

## 主要機能

### 実装済み機能

#### 1. 認証・プロフィール管理

- **Google OAuth認証**: 大学メールアドレス（`edu.teu.ac.jp`）または運営が許可した管理者用 Gmail でログイン
- **初回登録（オンボーディング）**: 初回ログイン時に必須情報を入力
  - 表示名・本名・学籍番号・入学年度
  - メイン楽器・サブ楽器
  - Discord ID・アイコン
- **プロフィール編集**: 自分のプロフィール情報を編集可能
- **アカウント削除**: アカウント削除機能（管理画面から確認可能）

#### 2. イベント管理

- **イベント作成・編集・削除**: 管理者がイベント情報を管理
- **イベント種別**: ライブ/講習会/説明会/合宿/その他
- **イベント詳細**: 開催日時・会場・開場時間・開始時間・備考
- **イベント一覧**: カレンダー表示・リスト表示
- **イベント閲覧**: 一般ユーザーはイベント情報を閲覧可能

#### 3. バンド・レパ表管理

- **バンド作成**: イベントバンド・固定バンドの作成
- **バンドメンバー管理**: メンバーの追加・削除・パート割り当て
- **セットリスト管理**: 曲・MCの順序管理
  - URLメタ情報取得（タイトル・アーティスト・時間）
  - アレンジメモ・照明指示・PA指示
- **ステージプロット**: ドラッグ&ドロップで配置図を作成
- **レパ表提出ステータス**: 下書き/提出済み
- **レパ表閲覧**: 提出済みレパ表の閲覧（本名表示）

#### 4. PA/照明ダッシュボード

- **PAダッシュボード** (`/pa`): PA担当者向け機能
  - レパ表からのPA指示確認
  - シフト確認
  - 機材管理照会
- **照明ダッシュボード** (`/lighting`): 照明担当者向け機能
  - レパ表からの照明指示確認
  - シフト確認
  - 機材管理照会

#### 5. お知らせ（CMS）

- **お知らせ作成・編集**: 管理者/PA長/照明長が作成・編集可能
- **公開/下書き**: 公開状態の管理
- **ピン留め**: 重要なお知らせをピン留め
- **カテゴリ**: 重要/イベント/締切/その他
- **画像・添付リンク**: 画像や外部リンクの添付
- **お知らせ一覧**: ホーム画面に最新3件を表示

#### 6. 備品・楽器管理

- **備品登録・閲覧**: PA/照明/総合/楽器の区分で管理
- **変更履歴ログ**: 誰がいつ更新したかを記録
- **ステータス管理**: 在庫・貸出中・修理中など

#### 7. 部員管理

- **部員一覧**: 全部員のプロフィールを閲覧
- **検索・フィルタ**: パート・楽器・入学年度で検索
- **プロフィール詳細**: 各メンバーの詳細情報を表示

#### 8. マイページ

- **マイプロフィール**: 自分のプロフィール情報を確認・編集
- **マイバンド**: 自分が所属するバンド一覧
- **シフト一覧** (`/me/tasks`): 自分のシフトを確認

#### 9. フィードバック

- **フィードバック送信**: ログイン必須でフィードバックを送信
- **管理画面で確認**: 送信内容は管理画面で確認可能（本名・学籍番号も表示）

#### 10. 外部リンク・アーカイブ

- **外部リンク集** (`/links`): 公式リンクや大学導線をカテゴリ別に整理
- **動画アーカイブ** (`/links/archive`): 年度・ライブごとに限定公開動画リンクを管理
- **編集モード**: `Admin` / `SV` / `PAL` / `LL` がページ内容を編集可能

#### 11. PWA / インストール対応

- **ホーム画面インストール**: 対応ブラウザでインストール可能
- **Service Worker**: アプリシェルと一部静的資産をキャッシュ
- **オフラインフォールバック**: 通信断時は専用オフラインページを表示
- **テーマ連動のウィンドウ色**: ライト/ダークテーマに合わせて `theme-color` を切替

#### 12. 管理機能

- **ロール管理**: リーダーロール・役職の割り当て
- **イベント管理**: イベントの作成・編集・削除
- **お知らせ管理**: お知らせの作成・編集・削除
- **フィードバック確認**: 送信されたフィードバックを確認
- **アナリティクス**: アクセス解析（実装中）
- **サイト設定**: サイトの公開/非公開設定
- **更新履歴管理**: バージョン情報の管理

#### 13. タイムテーブル・スタッフ割当

- **タイムテーブル編集**: 自動生成・追加・ドラッグによる順序調整
- **公開状態の管理**: 保存・仮確定・公開を切り替え、仮確定後にシフト作成を解放
- **スタッフ割当**: 管理画面での割当と自動割当
- **担当確認**: PA・照明ページおよびマイページからシフトを確認

#### 14. ホーム画面・外観設定

- **ホーム画面**: 次回イベント、イベントカレンダー、最新のお知らせを表示
- **キャラクター表示**: スマホ・タブレットでは上部に余白を確保し、顔が見える位置に配置。PCでも位置を引き上げ、ライト・ダークの両方で不透明度を100%にして色と輪郭を明瞭に表示
- **アニメーション**: 画像の登場とタップ時のジャンプに対応。動きを減らすOS設定ではアニメーションを抑制
- **外観設定** (`/me/appearance`): デザインプリセット、ライト・ダーク、アカウントごとのカスタムカラーに対応

キャラクターは [HomeCharacter.tsx](components/HomeCharacter.tsx)、[home-background.css](app/home-background.css)、[home-character.png](public/images/home-character.png) で管理します。外観設定の実装と確認手順は [デザインテーマ](docs/design-themes.md) を参照してください。

## 認証・認可システム

### 認証方式

- **主認証**: Google OAuth（Supabase Auth）
- **メールリンク認証**: 廃止

### ドメイン制限

| 条件 | 対象ドメイン | 備考 |
|------|-------------|------|
| **許可** | `edu.teu.ac.jp` | 大学メールアドレス |
| **許可** | Gmail（管理者用許可リスト） | `NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST` 登録済みアドレス、または既存管理者として判定できる場合 |
| **拒否** | その他 | ログイン不可 |

> 現在は大学提供の Google アカウントを基本認証としています。個人メール等へのアカウント移行や、卒業後の継続ログインを引き継ぐ仕組みは未実装です。

### ロール・権限モデル

#### リーダーロール

| ロール | 権限 |
|--------|------|
| **Administrator** | 全機能へのアクセス・管理権限 |
| **Supervisor** | 全機能へのアクセス・管理権限 |
| **PA Leader** | PA機能へのアクセス・お知らせ作成 |
| **Lighting Leader** | 照明機能へのアクセス・お知らせ作成 |
| **Part Leader** | パート管理権限 |

#### 役職（複数可）

- Official
- Administrator
- 部長
- 副部長
- 会計
- PA長
- 照明長
- 広報
- Web幹事

### 認証フロー

1. ユーザーがログインページにアクセス
2. Google OAuthで認証
3. `AuthGuard` がセッションを確認
4. メールアドレスのドメインをチェック
5. プロフィールの完全性をチェック（未登録・不完全な場合は `/onboarding` へリダイレクト）
6. サイトの公開状態をチェック（非公開時は管理者以外 `/closed` へリダイレクト）
7. ページを表示

## データベース構造

### 主要テーブル

#### プロフィール関連

- **`profiles`**: 基本プロフィール情報
  - `display_name`, `real_name`, `crew`, `leader`, `avatar_url`, `discord_id`, `part`
- **`profile_private`**: 機密情報（学籍番号等）
  - `student_id`, `enrollment_year`, `birth_date`
- **`profile_leaders`**: リーダーロール（複数可）
  - `profile_id`, `leader`
- **`profile_positions`**: 役職（複数可）
  - `profile_id`, `position`
- **`profile_parts`**: 楽器情報
  - `profile_id`, `part`, `is_main`

#### イベント関連

- **`events`**: イベント情報
  - `name`, `date`, `status`, `event_type`, `venue`, `open_time`, `start_time`, `note`, `default_changeover_min`
- **`event_slots`**: イベントスロット（タイムテーブル）
  - `event_id`, `start_time`, `end_time`, `band_id`, `note`
- **`event_staff_members`**: イベントスタッフ
  - `event_id`, `user_id`, `role` (PA/Lighting)

#### バンド・レパ表関連

- **`bands`**: バンド情報
  - `event_id`, `name`, `repertoire_status`, `stage_plot_data`, `note_pa`, `note_lighting`, `created_by`
- **`band_members`**: バンドメンバー
  - `band_id`, `user_id`, `instrument`, `position_x`, `position_y`, `monitor_request`, `is_mc`
- **`songs`**: 曲情報
  - `band_id`, `title`, `artist`, `entry_type`, `url`, `duration_sec`, `arrangement_note`, `lighting_*`, `memo`

#### その他

- **`announcements`**: お知らせ
  - `title`, `content`, `category`, `is_published`, `is_pinned`, `image_url`, `attachment_url`
- **`equipment_items`** / **`equipment_instruments`**: 備品・楽器
  - `section`, `name`, `status`, `note`, `updated_by`
- **`feedbacks`**: フィードバック
  - `profile_id`, `category`, `message`, `created_at`
- **`site_settings`**: サイト設定
  - `is_open` (公開/非公開)

スキーマ定義・追加機能の適用SQLは `SQL/*.sql` を参照してください。既存DBには対象機能のSQLと関連ドキュメントを確認して適用します。

## 環境変数

以下の環境変数を設定する必要があります：

```bash
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# サイトURL（オプション）
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 管理者メール許可リスト（オプション、カンマ区切り）
NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST=admin1@gmail.com,admin2@gmail.com

# ベースバージョン（オプション、Gitタグから自動取得も可能）
NEXT_PUBLIC_BASE_VERSION=1.000
```

`.env.local` ファイルを作成して設定してください。

## セットアップ

### 前提条件

- Node.js 20.9以上（Next.js 16の要件。依存パッケージの要件も満たすバージョンを使用）
- npm または yarn
- Supabaseアカウント（プロジェクト作成済み）

### インストール手順

1. **リポジトリのクローン**

```bash
git clone <repository-url>
cd jacla-portal
```

2. **依存関係のインストール**

```bash
npm install
```

3. **環境変数の設定**

プロジェクト直下に `.env.local` を新規作成し、「環境変数」の設定例を記入してください。`.env.example` は同梱していません。

```bash
# .env.local に Supabase の URL・公開キー等を設定
```

4. **Supabaseのセットアップ**

- Supabaseプロジェクトを作成
- データベーススキーマを適用（`SQL/*.sql` と対象機能のドキュメントを参照）
- Google OAuth認証を設定
- Row Level Security (RLS) ポリシーを設定

5. **開発サーバーの起動**

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

### ビルド

```bash
npm run build
npm start
```

PWA の install prompt や Service Worker の挙動確認は `npm run dev` ではなく、本番ビルド後の `npm run start` で行ってください。

## 開発ガイド

### プロジェクト構造

```
jacla-portal/
├── app/                    # Next.js App Router ページ
│   ├── admin/              # 管理者向けページ
│   ├── api/                # API Routes
│   ├── auth/               # 認証関連
│   ├── bands/              # バンド管理
│   ├── events/             # イベント管理
│   ├── lighting/           # 照明指示書
│   ├── pa/                 # PA指示書
│   ├── me/                 # マイページ
│   ├── members/            # 部員一覧
│   ├── onboarding/         # 初回登録
│   ├── maintenance/        # 備品管理
│   └── ...
├── components/             # 共通UIコンポーネント
│   ├── ui/                 # 基本UIパーツ
│   ├── instructions/      # PA/照明指示書コンポーネント
│   └── ...
├── lib/                    # ユーティリティ・フック
│   ├── supabaseClient.tsx  # Supabase クライアント
│   ├── AuthGuard.tsx       # 認証ガード
│   ├── useIsAdmin.ts       # 管理者判定フック
│   └── ...
├── contexts/               # React Context
│   └── AuthContext.tsx     # 認証コンテキスト
├── public/                 # 静的ファイル
├── tools/                  # 外部ツール (AI等)
└── 仕様書/                  # ドキュメント
```

### コーディング規約

- **TypeScript**: 厳密な型チェックを有効化
- **ESLint**: Next.jsの推奨設定を使用
- **コンポーネント**: Server Componentsを優先、必要に応じてClient Componentsを使用
- **スタイリング**: Tailwind CSSを使用
- **状態管理**: TanStack Query（サーバー状態）、React Context（認証状態）

### 主要なカスタムフック

- `useAuth()`: 認証状態を取得
- `useRoleFlags()`: ロール・権限フラグを取得
- `useIsAdmin()`: 管理者判定
- `useIsAdministrator()`: Administrator判定
- `useCanManageUpdates()`: 更新履歴管理権限
- `useCanViewStudentId()`: 学籍番号閲覧権限

### 認証ガード

`AuthGuard` コンポーネントで以下のチェックを実行：

1. セッション確認
2. メールアドレスのドメインチェック
3. プロフィールの完全性チェック
4. サイトの公開状態チェック

### API Routes

- `/api/account/activity`: アカウントの活動記録
- `/api/account/delete`: アカウント削除
- `/api/admin/accounts`: 在籍・卒業・休眠状態の管理
- `/api/cron/inactive-accounts`: 休眠アカウントの定期処理（`CRON_SECRET` が必要）
- `/api/admin/vercel/*`: Vercel管理API（デプロイ情報等）
- `/api/discord/connect`: Discord連携
- `/api/discord/disconnect`: Discord連携解除
- `/api/feedback`: フィードバック送信
- `/api/repertoire/metadata`: レパ表URLメタ情報取得
- `/api/updates/sync`: 更新履歴同期

## デプロイメント

### Vercelへのデプロイ

1. **Vercelプロジェクトの作成**

Vercelダッシュボードでプロジェクトを作成し、GitHubリポジトリを連携

2. **環境変数の設定**

Vercelダッシュボードで環境変数を設定：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- その他の環境変数

3. **デプロイ**

`main` ブランチへのプッシュで自動デプロイされます。

### Supabaseの設定

- **本番環境**: 本番用Supabaseプロジェクトを作成
- **開発環境**: 開発用Supabaseプロジェクトを使用
- **RLSポリシー**: 本番環境でも適切に設定

### ビルドコマンド

```bash
npm run build
```

## ディレクトリ構造

詳細なディレクトリ構造は [アーキテクチャ概要.md](仕様書/アーキテクチャ概要.md) を参照してください。

## その他のツール

コード品質は `npm run lint`、本番ビルドは `npm run build` で確認します。テーマ関連の回帰チェックは [デザインテーマ](docs/design-themes.md#validation) を参照してください。

## 参考資料

### ドキュメント

- [Jacla Portal 仕様書](仕様書/jacla%20Portal%20仕様書%20.md)
- [アーキテクチャ概要](仕様書/アーキテクチャ概要.md)
- [デザインテーマ・カスタムカラー](docs/design-themes.md)
- [在籍・アカウント管理](docs/account-lifecycle.md)

### 外部リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Radix UI Documentation](https://www.radix-ui.com/docs)

## ライセンス

このプロジェクトは部活動「Jacla」の内部使用を目的としています。

## 更新履歴

バージョン情報は `/updates` ページで確認できます。

---

**© 2026 Tokyo University of Technology - 総合音楽部 Jacla All rights reserved.**

### 在籍・卒業・休眠の管理

管理画面 `/admin/accounts` で、卒業・退部・休眠への変更と復帰ができます。バンドの所属と名前は保持します。導入時は先に `SQL/AccountLifecycle.sql` の適用とVercelの `CRON_SECRET` 設定が必要です。

動作、移行手順、保持する情報、テスト方法は [在籍・アカウント管理](docs/account-lifecycle.md) を参照してください。

### 合宿幹事の追加

ユーザー管理の「権限管理」タブで、役職「合宿幹事」を複数人に設定・解除できます。管理権限は付与しません。部員一覧・マイプロフィールで日本語表示し、部員一覧では「合宿幹事」で検索できます。

既存DBには、デプロイ前に [SQL/CampOrganizer.sql](SQL/CampOrganizer.sql) をSupabase SQL Editorで適用してください。役職ENUMに値を追加するだけのSQLで、プロフィール設定一式や在籍管理のSQLを再実行する必要はありません。新規DB用の `SQL/Profile.sql` にも追加済みです。
