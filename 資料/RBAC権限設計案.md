# RBAC権限設計案

更新日: 2026-05-04

## 1. 目的

この資料は次の3点を決めるためのものです。

- 現行 `Jacla Portal` の権限制御を棚卸しする
- マルチテナントSaaS移行時の `原子権限` を定義する
- 現行運用に近い `初期seedロール` を決める

前提として、最上位の全体権限は `Administer` とし、団体内の権限は RBAC で管理します。

---

## 2. 先に結論

- プラットフォーム最上位権限は `administer`
- 団体内では `システムロール` と `役職` を分離する
- システム権限は固定の `permission_key` で持つ
- 団体ごとに `ロールを作成 -> 権限をチェック付与 -> メンバーへロール付与` を行う
- 初期seedロールは現行互換を重視し、`Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader`, `Part Leader`, `Web Secretary`, `Member` を用意する
- `バンド作成者`, `バンドメンバー`, `本人` のような関係ベース権限は RBAC とは別で残す

---

## 3. 現行の権限ソース

現行システムは、1つの権限モデルに統一されていません。判定元が複数あります。

- `profiles.leader`
- `profile_leaders`
- `profile_positions`
- `profiles.crew`
- `profiles.part`
- `profile_parts`
- フロント側の hook 判定
- SQL の helper function と RLS

主な実装箇所:

- `lib/useRoleFlags.ts`
- `lib/useCanManageUpdates.ts`
- `lib/useCanViewStudentId.ts`
- `app/admin/page.tsx`
- `app/admin/roles/page.tsx`
- `SQL/Announcements.sql`
- `SQL/Equipment.sql`
- `SQL/Events.sql`
- `SQL/Feedback.sql`
- `SQL/Forms.sql`
- `SQL/SiteManagement.sql`

---

## 4. 現行のロール判定

### 4.1 現行で実際に使われている主要ロール

- `Administrator`
- `Supervisor`
- `PA Leader`
- `Lighting Leader`
- `Part Leader`
- `Web Secretary`

### 4.2 フロントの基本判定

現行フロントの基礎判定は次です。

- `isAdmin = Administrator or Supervisor`
- `canAccessAdmin = isAdmin or PA Leader or Lighting Leader`

つまり、`Part Leader` と `Web Secretary` は管理者画面トップへのアクセス権を持ちません。

### 4.3 現行 roles 画面での操作範囲

`/admin/roles` の現行挙動は次です。

- `Administrator`, `Supervisor`
  - フル編集可能
  - leader ロール編集
  - 役職編集
  - crew 編集
  - 楽器編集
  - 基本プロフィール編集
  - 学籍番号などの秘匿情報編集
  - muted 設定
  - 他人アカウント削除
- `PA Leader`, `Lighting Leader`
  - 管理者画面トップには入れる
  - roles 画面には入れる
  - ただし実際に保存できるのは `crew` の変更だけ
- `Part Leader`
  - roles 画面に入れない
- `Web Secretary`
  - roles 画面に入れない

---

## 5. 現行の権限棚卸し

### 5.1 画面・機能ごとの現行アクセス

| 画面 / 機能 | 現行アクセス | 備考 |
| --- | --- | --- |
| 管理者トップ `/admin` | `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader` | `Part Leader`, `Web Secretary` は入れない |
| イベント管理 `/admin/events` | `Administrator`, `Supervisor` | UI 上は `isAdmin` 限定 |
| ユーザー管理 `/admin/roles` | 画面アクセスは `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader` | ただし PA/Lighting は実質 `crew` 編集のみ |
| お知らせ管理 `/admin/announcements` | `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader` | SQL も同様 |
| フォーム管理 `/admin/forms` | `Administrator`, `Supervisor` | SQL も同様 |
| フィードバック `/admin/feedback` | `Administrator`, `Supervisor` | 学籍番号も表示している |
| サイト設定 `/admin/site` | `Administrator`, `Supervisor` | SQL も同様 |
| ログ / 分析 `/admin/analytics` | `Administrator`, `Supervisor` | SQL も同様 |
| 更新履歴 `/admin/updates` | `Administrator` または `Web Secretary` | 画面自体は `useCanManageUpdates` で判定 |
| Vercel ログ `/admin/logs` | UI 上は `Administrator`, `Supervisor` | API 側は現状要修正 |
| 外部リンク編集 | `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader` | `ExternalLinksPageClient` のフロント判定 |

### 5.2 SQL / RLS で許可されている権限

| モジュール | 現行権限 |
| --- | --- |
| `announcements` | `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader` が未公開閲覧・作成・更新・削除 |
| `events` | `Administrator`, `Supervisor` が CRUD |
| イベントTT公開 | `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader` |
| `event_slots` | `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader` |
| `event_staff_members` | `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader` |
| `slot_staff_assignments` | `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader` |
| `bands` 更新 | 作成者 / バンドメンバー / `Administrator` / `Supervisor` / `Part Leader` / `PA Leader` / `Lighting Leader` |
| `bands` 削除 | 作成者 / `Administrator` / `Supervisor` / `PA Leader` / `Lighting Leader` |
| `band_members` | 作成者 / バンドメンバー / `Administrator` / `Supervisor` / `Part Leader` / `PA Leader` / `Lighting Leader` |
| `songs` | 作成者 / バンドメンバー / `Administrator` / `Supervisor` / `Part Leader` / `PA Leader` / `Lighting Leader` |
| `equipment_items` | `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader`, `Part Leader`, または `open_to_all` |
| `equipment_instruments` | `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader`, `Part Leader`, または `open_to_all` |
| `equipment_settings` | `Administrator`, `Supervisor` |
| `forms` / `form_fields` | `Administrator`, `Supervisor` |
| `feedbacks` 閲覧 | `Administrator`, `Supervisor` |
| `site_settings` | `Administrator`, `Supervisor` |
| `login_history` / `page_views` 閲覧 | `Administrator`, `Supervisor` |
| `update_logs` 管理 | `Administrator` または `Web Secretary` |

### 5.3 現行でズレている点

- `Web Secretary` は更新履歴の管理権限を持つが、管理者トップのカードには出てこない
- `useCanViewStudentId` は `canAccessAdmin` 依存なので、`PA Leader` と `Lighting Leader` にも学籍番号閲覧が開いている
- `役職` の `Web Secretary` が、実質 `権限ロール` として使われている
- フロント判定と SQL 判定が完全には一致していない
- 権限が文字列直書きで散っているため、団体ごとの差分運用に弱い

---

## 6. 新しい権限モデルの方針

### 6.1 権限の層

- `Platform`
  - SaaS 全体の運用
  - 団体作成、停止、監査、テンプレート管理
- `Organization`
  - 各団体の管理
  - 団体内ロール、団体設定、団体データ管理
- `Record Relation`
  - 自分が作成者か
  - 自分が当事者か
  - 自分がバンドメンバーか

`RBAC` で扱うのは `Platform` と `Organization` です。  
`本人`, `作成者`, `バンドメンバー` のような関係ベース権限は別で扱います。

### 6.2 分離すべきもの

- `システムロール`
  - 何を操作できるか
  - 例: `Administrator`, `PA Leader`, `Web Secretary`
- `役職`
  - 部内の肩書き
  - 例: `部長`, `副部長`, `会計`, `PA長`
- `部署`
  - 所属セクション
  - 例: `PA`, `Lighting`, `Web`
- `楽器`
  - 演奏担当
  - 例: `Gt.`, `Ba.`, `Dr.`

`PA長` と `PA Leader` は同じ名前でも、DB 上は別概念として扱う方が安全です。

### 6.3 管理画面で実現したい操作

- ロール作成
- ロール名編集
- ロール複製
- ロール有効 / 無効
- ロールへの権限チェック付与
- メンバーへのロール付与
- マスタの追加 / 編集 / アーカイブ

削除は基本的に `物理削除` ではなく `archive` を推奨します。

---

## 7. プラットフォーム権限

最上位の全体権限は `administer` とします。

| 権限キー | 内容 |
| --- | --- |
| `platform.administer` | 全団体の管理、停止、再開、監査、テンプレート管理、緊急保守 |
| `platform.support` | 閲覧中心の補助権限。必要に応じて限定付与 |

`platform.administer` は組織ロールとは別で持ちます。  
団体内 `Administrator` より上位です。

---

## 8. 原子権限一覧

以下は団体内ロールに付与する `permission_key` の初期案です。  
現行機能から大きく離れず、あとでロール作成 UI にそのまま出せる粒度にしています。

### 8.1 コア

| 権限キー | 内容 |
| --- | --- |
| `org.dashboard.access` | 団体管理画面に入れる |
| `org.settings.manage` | 団体の基本設定を変更できる |
| `org.analytics.read` | アクセスログ、利用状況、分析を閲覧できる |
| `org.modules.manage` | モジュールの ON/OFF や表示順を変えられる |

### 8.2 メンバー管理

| 権限キー | 内容 |
| --- | --- |
| `members.read` | 団体メンバー一覧を見られる |
| `members.private.read` | 学籍番号などの秘匿情報を閲覧できる |
| `members.edit_profile_basic` | 表示名、氏名、メールなどの基本情報を変更できる |
| `members.edit_private` | 学籍番号、入学年、電話番号、生年月日などを変更できる |
| `members.edit_crew` | 現行 `crew` 相当を変更できる |
| `members.mute` | メンバーを muted にできる |
| `members.delete` | 他メンバーのアカウント削除を実行できる |

### 8.3 ロール・役職・部署・楽器の付与

| 権限キー | 内容 |
| --- | --- |
| `member_roles.assign` | メンバーへシステムロールを付与できる |
| `member_positions.assign` | メンバーへ役職を付与できる |
| `member_departments.assign` | メンバーへ部署を付与できる |
| `member_instruments.assign` | メンバーへ楽器を付与できる |

### 8.4 ロール・マスタ管理

| 権限キー | 内容 |
| --- | --- |
| `roles.manage` | 団体内ロールを作成、編集、複製、無効化できる |
| `positions.manage` | 役職マスタを管理できる |
| `departments.manage` | 部署マスタを管理できる |
| `instruments.manage` | 楽器マスタを管理できる |
| `custom_fields.manage` | 追加項目マスタを管理できる |

### 8.5 お知らせ・リンク

| 権限キー | 内容 |
| --- | --- |
| `announcements.read_unpublished` | 未公開お知らせを見られる |
| `announcements.manage` | お知らせの作成、編集、公開、削除ができる |
| `links.manage` | 外部リンクページを編集できる |

### 8.6 イベント・進行

| 権限キー | 内容 |
| --- | --- |
| `events.manage` | イベント本体の CRUD |
| `events.tt.publish` | TT 公開 / 仮公開切替 |
| `events.slots.manage` | `event_slots` を管理できる |
| `events.staff.manage` | `event_staff_members` と `slot_staff_assignments` を管理できる |

### 8.7 バンド

| 権限キー | 内容 |
| --- | --- |
| `bands.manage_any` | 他人作成のバンドも含めて広く編集できる |
| `bands.delete_any` | 他人作成のバンドも削除できる |
| `bands.support_edit` | ステージプロット、ノート、提出系フィールドを編集できる |
| `bands.members.manage` | バンドメンバー構成を編集できる |
| `bands.songs.manage` | 曲情報、セットリストを編集できる |

### 8.8 フォーム・フィードバック

| 権限キー | 内容 |
| --- | --- |
| `forms.manage` | フォーム、フィールド、公開状態を管理できる |
| `forms.responses.read` | フォーム回答を閲覧できる |
| `feedback.read` | フィードバック一覧を閲覧できる |

### 8.9 機材

| 権限キー | 内容 |
| --- | --- |
| `equipment.items.manage` | 機材アイテムを管理できる |
| `equipment.instruments.manage` | 楽器台帳を管理できる |
| `equipment.settings.manage` | `open_to_all` 等の設定を変更できる |

### 8.10 運用

| 権限キー | 内容 |
| --- | --- |
| `updates.manage` | 更新履歴を同期、作成、編集できる |
| `vercel.logs.read` | Vercel ログを閲覧できる |

---

## 9. 初期seedロール案

### 9.1 プラットフォームロール

| ロール | 付与権限 |
| --- | --- |
| `Administer` | `platform.administer` |
| `Platform Support` | `platform.support` |

### 9.2 団体ロール

現行運用に寄せた seed は次です。

| ロール | 初期付与権限 |
| --- | --- |
| `Administrator` | すべての団体権限 |
| `Supervisor` | `Administrator` に近いが、必要なら `updates.manage` と `vercel.logs.read` は外して開始 |
| `PA Leader` | `org.dashboard.access`, `members.read`, `announcements.read_unpublished`, `announcements.manage`, `links.manage`, `events.tt.publish`, `events.slots.manage`, `events.staff.manage`, `bands.support_edit`, `bands.members.manage`, `bands.songs.manage`, `bands.delete_any`, `equipment.items.manage`, `equipment.instruments.manage` |
| `Lighting Leader` | `PA Leader` と同等。PA 固有の文言だけ別表示にするなら UI 層で制御 |
| `Part Leader` | `members.read`, `bands.support_edit`, `bands.members.manage`, `bands.songs.manage`, `equipment.items.manage`, `equipment.instruments.manage` |
| `Web Secretary` | `org.dashboard.access`, `updates.manage`, `links.manage`, 必要なら `announcements.manage` |
| `Member` | 追加権限なし。本人操作と作成者操作のみ |

### 9.3 Supervisor の扱い

`Supervisor` は現行コード上かなり強い権限を持っています。  
ただし、移行時は次のどちらかで始めるのが安全です。

- `現行互換`
  - `Administrator` とほぼ同等
- `少し引き締める`
  - `members.delete`
  - `updates.manage`
  - `vercel.logs.read`
  - `roles.manage`

この4つだけ外して開始する

おすすめは後者です。

### 9.4 Web Secretary の扱い

現行では `Web Secretary` は役職として保存されつつ、実質 `更新履歴管理権限` として使われています。  
移行後は次のように整理します。

- `Web Secretary`
  - 役職としては `organization_positions`
  - システム権限としては `organization_roles`

同じ表示名を使ってもよいですが、DB 上は分離します。

---

## 10. 関係ベース権限として残すもの

RBAC だけで表現しないものです。

- 本人は自分のプロフィールを編集できる
- バンド作成者は自分のバンドを編集できる
- バンドメンバーは自分の関わるバンドの一部項目を編集できる
- 一般メンバーは公開済みフォームへ回答できる
- 一般メンバーは自分のフィードバックを送信できる

この層は `permission_key` ではなく、サービスロジックまたは RLS で処理します。

---

## 11. 管理画面の実装方針

### 11.1 ロール作成UI

最低限必要なのは次です。

- ロール名
- ロール説明
- 有効 / 無効
- 並び順
- 権限チェックリスト
- テンプレートから複製

### 11.2 権限チェックリストの出し方

権限一覧は `module_key` ごとに grouped 表示します。

- メンバー
- ロール
- 役職
- 部署
- 楽器
- お知らせ
- イベント
- バンド
- フォーム
- 機材
- 運用

### 11.3 守るべきルール

- `permission_key` はコード側で固定
- 管理画面で増減できるのは `role` 側
- システム予約ロールは削除ではなく `archive`
- 付与中のロールを消す場合は参照整合性チェック

---

## 12. DB への落とし込み

この資料は次の DB 設計とセットで使います。

- `platform_permissions`
- `organization_roles`
- `organization_role_permissions`
- `organization_member_roles`

既に別資料で定義している `organization_positions`, `organization_departments`, `organization_instruments` と組み合わせる前提です。

---

## 13. 移行時のマッピング

| 現行データ | 移行先 |
| --- | --- |
| `profiles.leader` | `organization_member_roles` |
| `profile_leaders` | `organization_member_roles` |
| `profile_positions` | `organization_member_positions` |
| `profiles.crew` | `organization_member_departments` または membership 属性 |
| `profiles.part` | `organization_member_instruments` |
| `profile_parts` | `organization_member_instruments` |

### 13.1 現行互換で最初にやること

- `Administrator`, `Supervisor`, `PA Leader`, `Lighting Leader`, `Part Leader`, `Web Secretary`, `Member` を seed
- 現行ユーザーの `leader / position / part / crew` を移行
- まずは現行挙動を再現
- その後に団体ごとの自由ロール作成を開放

---

## 14. まとめ

今回の権限設計で重要なのは次の4点です。

- 最上位権限は `Administer`
- 団体内は `原子権限 -> ロール -> メンバー付与` の RBAC にする
- `役職` と `システムロール` を分離する
- `本人 / 作成者 / バンドメンバー` の関係ベース権限は別レイヤーで残す

この形にすると、今の運用を大きく壊さずに、

- 団体ごとにロールを増やす
- 権限セットを変える
- 役職や楽器を増減する
- 管理画面だけで運用差分を吸収する

という目的を達成できます。
