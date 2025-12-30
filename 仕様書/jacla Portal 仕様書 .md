# Jacla Portal 仕様書

## 1. 概要
総合音楽サークル「Jacla」の運営業務をDX化するためのポータル。イベント・バンド・レパ表・機材・お知らせ・アカウント運用を一元管理する。
- 目的
  - イベント（ライブ等）の管理
  - バンド編成・レパ表提出の標準化
  - PA/照明の情報共有
  - お知らせ/機材/備品の管理
  - 管理/引き継ぎが容易な運用

## 2. 技術スタック
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS
- Backend/DB: Supabase (PostgreSQL + Auth)
- Hosting: Vercel
- Storage: Supabase Storage

## 3. 認証・ロール
- Auth: Google OAuth を主に使用（メールリンクは廃止）
- ドメイン制限: `edu.teu.ac.jp` を許可、管理者の Gmail は許可リストで例外
- リーダーロール: Administrator / Supervisor / PA Leader / Lighting Leader / Part Leader
- 役職（複数可）: Official, President, Vice President, Treasurer, PA Chief, Lighting Chief, Web Secretary

## 4. 主要機能（実装済み）
### 4.1 プロフィール
- 初回ログイン時にプロフィール入力を必須
- 表示名/本名/学籍番号/入学年度/メイン楽器/サブ楽器/Discord/アイコン
- 学籍番号は `profile_private` に分離
- 役職とロールは管理画面で編集

### 4.2 イベント
- イベント作成/編集/削除
- イベント種別: ライブ/講習会/説明会/合宿/その他
- ライブ/合宿のみバンド作成が可能

### 4.3 バンド・レパ表
- バンド作成（代表者を設定）
- バンドメンバー管理/パート追加
- セットリスト（曲/MC）管理
- URL メタ情報取得（タイトル/アーティスト/時間）
- ステージプロット配置図
- PA/照明メモ
- レパ表提出ステータス: 下書き/提出済み
- レパ表の氏名表示は本名ベース

### 4.4 お知らせ（CMS）
- 管理者/PA長/照明長が作成・編集
- 公開/下書き、ピン留め、画像/添付リンク

### 4.5 備品/楽器管理
- PA/照明/総合/楽器の区分で登録・閲覧
- 変更履歴ログ（誰がいつ更新したか）

### 4.6 フィードバック
- ログイン必須で送信
- 本名/学籍番号が管理画面で確認できる
- 送信内容は管理画面で確認する

## 5. 主要機能（未実装・追加予定）
以下の順で実装を進める。
1. イベントTT（event_slots の手動編集UI）
2. PA/照明シフト割当UI（event_staff_members / slot_staff_assignments）
3. 自動TT生成（デフォルト演奏時間/転換時間）
4. 自動シフト割当（ラウンドロビン + 固定除外）
5. ダブルブッキング検知（PA/照明の重複警告）
6. /me シフト一覧

## 6. DB 主要テーブル（抜粋）
- profiles
  - display_name, real_name, crew, leader, avatar_url, discord_id
- profile_private
  - student_id, enrollment_year, birth_date
- profile_positions
  - profile_id, position
- events
  - name, date, status, event_type, venue, open_time, start_time, note, default_changeover_min
- bands
  - event_id, name, repertoire_status, stage_plot_data, note_pa, note_lighting, created_by
- band_members
  - band_id, user_id, instrument, position_x, position_y, monitor_request, is_mc
- songs
  - band_id, title, artist, entry_type, url, duration_sec, arrangement_note, lighting_*, memo
- announcements
  - title, content, category, is_published, is_pinned, image_url, attachment_url
- equipment_items / equipment_instruments
  - section, name, status, note, updated_by
- feedbacks
  - profile_id, category, message, created_at

## 7. UI・運用ルール
- UI調整は随時改善（操作性/レスポンシブ最優先）
- 仕様書は現状仕様と追加仕様を継続更新
- 重要な変更は README と SQL にも反映
