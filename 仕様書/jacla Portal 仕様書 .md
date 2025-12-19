# jacla Portal 仕様書 

## 1. プロジェクト概要

### 1.1 目的

総合音楽サークル「jacla」の運営業務をDX化し、以下を実現する：

* イベント（ライブ）の管理
* バンドエントリー／構成管理
* セットリスト管理
* ステージ見取り図（ステージプロット）
* タイムテーブル（TT）の自動生成
* PA / 照明シフトの管理・自動割り当て
* ダブルブッキング（演者かつPA/照明など）の自動検出

### 1.2 ターゲット

* サークル部員（約100名規模）
* 現運営・次期運営（システムをメンテ・引き継ぐ人）

### 1.3 コアコンセプト

* **運用コスト 0円**（Supabase / Vercel / GitHub 全て Free Tier）
* **技術的負債を減らす**（TypeScript / RDB / OSS）
* **「コード＋README＋DBスキーマ」で誰でも引き継げる**

***

## 2. 技術スタック

| カテゴリ         | 技術選定                  | 理由                    |
| ------------ | --------------------- | --------------------- |
| Frontend     | Next.js (App Router)  | Reactベース、Vercelとの相性◎  |
| 言語           | TypeScript            | 型でバグ低減、引き継ぎしやすい       |
| UI           | Tailwind CSS          | ユーティリティベースで高速実装       |
| Backend / DB | Supabase (PostgreSQL) | Auth＋DB＋REST/JS SDK一体 |
| Auth         | Supabase Auth         | メール / Google でログイン    |
| ステージ図        | tldraw                | OSSのドローツール。Reactで埋め込み |
| Hosting      | Vercel                | Next.js用ホスティング        |
| Repository   | GitHub Organization   | サークルアカウントで管理          |
| 外部ビュー        | Google Sheets + GAS   | DB内容をDriveから閲覧ミラー     |

***

## 3. 機能要件（User Stories）

### A. 認証・ユーザー管理

* ログイン：
  * メールリンク or Googleログイン
* 初回ログイン時：
  * 表示名 / 学年 / メイン楽器 を登録
* 自分のプロフィールを編集できる
* 管理者（admin）は：
  * 全部員の基本情報（学年・メイン楽器・PA/照明可否）を編集可能

***

### B. イベント（ライブ）管理

* 管理者はイベントを作成できる：
  * イベント名、開催日、会場、開場・開演時間、ステータス（募集中 / 確定 / 終了）、メモ
* イベント一覧画面で：
  * 直近イベント／過去イベントを一覧表示
* イベント詳細画面では：
  * イベントの基本情報
  * バンド一覧
  * TT（スロット一覧）
  * イベント全体のセットリスト一覧

***

### C. バンドエントリー & メンバー管理

* ユーザーは、対象イベントを選んでバンドエントリーを作成できる
* バンド作成時：
  * バンド名
  * 所属イベント
  * メンバー（既存部員検索で追加）
  * バンド内での担当楽器（Sax, Key, Gtなど）
* バンド単位でセットリストを登録できる：
  * 曲名 / アーティスト名 / 演奏時間（分） / 曲順

（将来の自動TTで演奏時間を使う）

***

### D. ステージ見取り図（ステージプロット）

* バンド詳細画面に tldraw キャンバスを埋め込む
* クイック追加ツール：
  * 「Vo / Gt / Ba / Key / Dr / Tp / Sax / 譜面台 / 電源」などのボタン
  * ボタン押下で対応アイコン＋ラベルをステージ上に自動配置
* オブジェクトはドラッグ＆ドロップで配置変更可能
* 「保存」ボタンでキャンバスのJSONを `bands.stage_plot_data` に保存
* 再表示時は JSON をロードして前回状態を復元

***

### E. タイムテーブル（TT）閲覧

* イベント詳細画面で：
  * `event_slots` に基づき、順番・開始/終了時間・バンド名（または「休憩」等）を表示
* 休憩やMCなども「スロット」として表示（band\_id無しのスロット）
* バンド名クリックでバンド詳細へ遷移

***

### F. PA / 照明シフト管理（拡張機能だが仕様はここに定義）

* イベントごとに、PA/照明クルーとして参加するメンバーを登録できる
  * 「このイベントに来る」「PAできる」「照明できる」などの情報
* TT（event\_slots）をベースに、各スロットに対して：
  * PA担当
  * 照明担当
    &#x20;を割り当てることができる
* シフト表画面：
  * 行：スロット
  * 列：時間／バンド／PA／照明
* 個人画面 `/me` で「自分のPA/照明シフト」一覧が見られる

***

### G. ダブルブッキング（重複）チェック

対象となる重複の例：

* 同じ時間帯のスロットで：
  * 同じ人が **複数バンドに出演している**
  * 同じ人が **出演しつつPA/照明にも入っている**
  * 同じ人が **PAと照明を同時に兼任** している（NGなら）

要件：

* AdminがTTやシフトを編集するときに：
  * バンドメンバー／PA／照明の重なりをチェック
  * 問題がある場合、画面上に警告（例：赤デバッジ・ダイアログ）を出す
* 重複がある場合でも、**一旦は保存を許可**（「警告のみ」運用）
  * 将来必要なら「保存禁止」オプションも検討

***

### H. 自動TT生成（Auto TT）

要件：

* イベントごとの設定として：
  * デフォルト演奏時間（分）
  * デフォルト転換時間（分）
  * 開演時間
    &#x20;を持てるようにする
* 自動TTボタンを押すと：
  1. イベントに紐づく承認済みバンドを出番順で並べる
     * 並び順は初期値として `bands.order_in_event` または作成順
  2. 開演時間からスタートして：
     * 各バンドの `songs.duration_min` の合計 or デフォルト演奏時間
     * 転換時間
       &#x20;を使って、`event_slots` の `start_time / end_time` を順に計算しながら埋める
  3. 休憩スロットやMCスロットを挿入したい場合は、Adminが手動でスロット追加
* 自動TT実行後：
  * `event_slots` は自由に手動編集可能
  * 再度「自動TT」を押すと、再生成するかどうか確認ダイアログを出す（手動修正が消えないよう注意）

***

## 4. 画面仕様（追加込み）

### 4.1 追加・拡張される画面要素

#### 4.1.1 イベント編集画面 `/admin/events/[id]`

機能：

* イベント情報編集（従来通り）
* バンド一覧＋`order_in_event` の編集
  * 「↑」「↓」ボタン or 数値入力で順番変更
* **TT編集（event\_slots）**
  * スロット一覧をテーブル表示
  * 行ごとに：
    * 種別（band/break/mc）
    * バンド選択（bandの場合）
    * 開始時刻 / 終了時刻
    * 備考
  * 行追加・削除
* **自動TT生成ボタン**
  * ダイアログ表示：
    * 「デフォルト演奏時間」「デフォルト転換時間」「既存スロットを上書きするか」などを確認
  * 実行後、`event_slots` を再計算
* **重複チェック表示**
  * TT・シフトの状態に基づいて、重複エラーの一覧を画面下部に表示：
    * 例：「19:00–19:20: 山田（Key）がバンドAとバンドBで重複」
  * 各エラー行から、そのスロット・バンド編集画面に飛べるリンク

***

#### 4.1.2 シフト編集画面（イベント別）

場所例：`/admin/events/[id]/shifts` または `イベント詳細内のタブ`

機能：

* 左側に TT（`event_slots`）一覧
* 各スロット行に対して：
  * PA担当者を選ぶセレクトボックス（候補＝`profiles.can_pa = true` & そのイベントに参加予定）
  * 照明担当者を選ぶセレクトボックス（候補＝`can_light = true`）
* 「自動シフト割り当て」ボタン：
  * ラウンドロビン方式でPA・照明を均等に割り振る
  * 手動で `slot_staff_assignments.is_fixed` を立てておけば、そのスロットは自動割当対象から除外
* シフト重複がある場合：
  * 行に赤マーク／ツールチップで「山田が2連続PA＋出演中」などの警告を表示

***

#### 4.1.3 マイページ `/me` のシフト表示

* 「担当シフト」セクションを追加：
  * 自分の `slot_staff_assignments` を日付順に一覧表示
  * 日付 / イベント名 / 時間 / 役割(PA/照明) / バンド名 or 「休憩」
  * 行クリックでイベント詳細 or シフト画面に遷移

***

## 5. データベース設計（拡張込み）

### 5.1 既存テーブル（再掲＋追記）

#### `profiles`

```
id              uuid PK   // = auth.users.id
email           text
display_name    text
grade           text      // "B1" 等
main_instrument text
role            text      // "admin" / "member"
can_pa          boolean   // PA可能
can_light       boolean   // 照明可能
created_at      timestamptz
```

***

#### `events`

```
id           uuid PK
name         text
date         date
status       text      // "recruiting" / "fixed" / "closed"
venue        text
open_time    time
start_time   time
note         text
default_song_duration_min  int   // (任意) 自動TT用: デフォルト演奏時間
default_changeover_min     int   // (任意) 自動TT用: デフォルト転換時間
created_by   uuid
created_at   timestamptz
```

※ `default_*` は自動TT時に使う（設定されてなければ固定値を使う）。

***

#### `bands`

```
id              uuid PK
event_id        uuid FK -> events.id
name            text
order_in_event  int     // 手動管理の出番順（自動TTの初期並びに使用）
stage_plot_data jsonb
is_approved     boolean
created_at      timestamptz
```

***

#### `band_members`

```
id         uuid PK
band_id    uuid FK -> bands.id
user_id    uuid FK -> profiles.id
instrument text
note       text
```

***

#### `songs`

```
id             uuid PK
band_id        uuid FK -> bands.id
title          text
artist         text
duration_min   int
order_in_band  int
```

***

### 5.2 TT用テーブル

#### `event_slots`

```
id              uuid PK
event_id        uuid FK -> events.id
band_id         uuid|null  // typeが "band" のときのみ設定
type            text       // "band" / "break" / "mc" / etc.
order_in_event  int
start_time      time
end_time        time
changeover_min  int        // band枠の後ろに付く転換時間
note            text
```

* 自動TTロジックは：
  * `events.start_time` から開始
  * `songs.duration_min` 合計 or `events.default_song_duration_min`
  * `changeover_min` or `events.default_changeover_min`
    &#x20;を使って `start_time` / `end_time` と `order_in_event` を埋める。

***

### 5.3 PA / 照明シフト

#### `event_staff_members`（イベントに来るクルー）

```
id          uuid PK
event_id    uuid FK -> events.id
profile_id  uuid FK -> profiles.id
can_pa      boolean   // このイベントでPAとして入る意思あり
can_light   boolean   // このイベントで照明として入る意思あり
note        text
```

* 「このイベントに行く＋どっち側で手伝うか」を管理する軽い出欠テーブル。

***

#### `slot_staff_assignments`（スロットごとの担当）

```
id             uuid PK
event_slot_id  uuid FK -> event_slots.id
profile_id     uuid FK -> profiles.id
role           text     // "pa" / "light"
is_fixed       boolean  // TRUE = 手動確定済み (自動割当ロジックから除外)
note           text
```

* 自動割り当て：
  * イベントごとに `event_staff_members` から候補者を抽出
    * role="pa" → `can_pa = true`
    * role="light" → `can_light = true`
  * `event_slots` を `order_in_event` 昇順に並べて
    * ラウンドロビンで候補者を巡回しながら `slot_staff_assignments` を生成
  * `is_fixed = true` の既存レコードは上書きしない

***

### 5.4 重複チェック用ロジック（仕様）

**DBテーブルは既存のものを使い、ロジックはアプリ側で実装。**

対象：

1. **出演者重複（バンド同士）**

* 同一イベント内で
  * `event_slots` 同士の時間範囲が重なる
  * 両方の `band_id` に属する `band_members.user_id` の集合が交差している
    &#x20;→ 「XXさんがスロット1とスロット3で重複出演しています」と警告

1. **出演＋PA/照明重複**

* `event_slots` と `slot_staff_assignments` を JOIN して：
  * ある `event_slot_id` に出演メンバーとして参加している `user_id`
  * 同じ時間帯に PA/照明として割り当てられている `profile_id`
    &#x20;→ 重複していたら警告

1. **PA/照明の多重割当**

* 同じ時間帯に、同じ `profile_id` に複数の `slot_staff_assignments` が存在している場合
  &#x20;→ 「YYさんがPAを2スロット連続で担当」などの警告（許容するかどうかは運用）

**エラーフォーマット（例）**

* type: `"double_book_performer" | "double_book_staff" | "double_book_mix"`
* message: 表示用テキスト
* user\_id
* event\_slot\_ids: 問題のあるスロットID配列

Admin画面の下部に「重複エラー一覧」として表示し、
&#x20;各エラーから該当スロットへジャンプできるようにする。

***

## 6. Google Sheets ミラー（変わらず）

* ミラー対象候補：
  * `profiles`
  * `events`
  * `bands`
  * `event_slots`
  * `slot_staff_assignments`
* 初期は `profiles` / `events` / `event_slots` くらいからスタートして、必要に応じて拡張。

***

## 7. 運用・引き継ぎルール（変わらず＋α）

* 共有アカウントで Supabase / Vercel / GitHub を管理
* READMEに：
  * 環境構築
  * デプロイフロー
  * Supabase Restore方法
  * 「自動TT」「自動シフト」「重複チェック」の使い方
* 次期運営向けに：
  * 「仕様書 v3（この文書）」を `docs/spec-v3.md` としてリポジトリに含める

***

## 8. フェーズ分け（実装の優先順位）

### フェーズ1（MVP）

* 認証 / プロフィール
* イベント作成・閲覧
* バンド作成・閲覧・セットリスト
* TT（`event_slots`）の**手動管理と閲覧**
* tldrawによるステージ図保存・表示
* Google Sheetsミラー（最低限）

### フェーズ2（拡張）

* 自動TT生成ロジック
* PA/照明クルー登録（`event_staff_members`）
* シフトテーブル（`slot_staff_assignments`）＋自動割当ロジック
* `/me` のシフト一覧
* 重複チェック機能（警告表示）
