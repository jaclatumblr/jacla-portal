# マルチテナントSaaS セキュリティ設計書

更新日: 2026-05-04

## 1. 目的

この資料は、Jacla Portal を複数団体向けのマルチテナントSaaSへ移行する際のセキュリティ基準を定義するためのものです。

最重要目標は次の3点です。

- 団体Aのデータが団体Bから見えないこと
- 権限のないユーザーが管理操作できないこと
- 事故が起きても追跡、抑止、復旧できること

---

## 2. セキュリティ原則

- すべての団体データは `organization_id` で分離する
- `Admin` は全体最上位権限とし、それ以外は必ず団体スコープ内で判定する
- `Administrator` は団体内最上位であり、プラットフォーム全体権限は持たない
- RLS を最終防衛線にする
- フロントの表示制御は補助であり、認可の本体にしない
- `deny by default` を徹底する
- 秘匿情報は通常プロフィールと分離する
- `delete` より `archive` を優先する
- すべての高権限操作を監査ログへ残す

---

## 3. 守るべき不変条件

- `Admin` は常にすべての権限階層で最上位
- 団体所属データを持つテーブルに `organization_id` が無い状態を作らない
- 団体データに対する `select/update/delete` を `authenticated` のみで許可しない
- API は `認証 -> 対象組織確認 -> 権限確認 -> 入力検証` の順で必ず処理する
- `SUPABASE_SERVICE_ROLE_KEY` はブラウザに出さない
- `NEXT_PUBLIC_` の環境変数に秘密情報を置かない
- Storage パスは `org/{organizationId}/...` で分離する
- 秘匿情報の閲覧権限と通常メンバー閲覧権限を分離する
- 外部APIのプロキシは無認証で公開しない

---

## 4. 脅威モデル

### 4.1 想定する主要脅威

| 脅威 | 例 | 対策 |
| --- | --- | --- |
| テナント越境 | A団体ユーザーがB団体のイベントや名簿を見る | `organization_id` + RLS + org scope check |
| 権限昇格 | 一般ユーザーが `Administrator` 相当の操作を行う | RBAC + API認可 + 監査ログ |
| 秘匿情報漏えい | 学籍番号、電話番号、生年月日が不要ユーザーに見える | 専用権限 `members.private.read` と分離テーブル |
| 無認証API悪用 | 外部から管理APIやVercelログAPIを叩かれる | Bearer token 検証 + server-side permission check |
| 外部連携秘密漏えい | Vercel token や service role key の漏えい | server-only env + route hardening |
| 不正変更の追跡不能 | 誰が権限変更したか分からない | 監査ログ |
| 誤削除 | メンバーや設定を誤って消す | archive + soft delete + 確認フロー |

### 4.2 最優先で防ぐべき事故

- 団体越境の閲覧
- 団体越境の更新
- 秘匿情報の誤公開
- 管理APIの無認証公開

---

## 5. データ分類

### 5.1 Public

- 公開済みお知らせ
- 公開プロフィールの一部
- 公開イベント情報

### 5.2 Organization Internal

- 団体内の通常メンバー一覧
- 未公開イベント情報
- バンド提出内容
- 機材一覧

### 5.3 Restricted

- 学籍番号
- 電話番号
- 生年月日
- 入学年度
- ログイン履歴
- アクセスログ
- 管理監査ログ

### 5.4 Secret

- `SUPABASE_SERVICE_ROLE_KEY`
- `VERCEL_TOKEN`
- 外部連携APIキー
- サーバー専用Webhookシークレット

---

## 6. ID・認証・認可モデル

### 6.1 IDモデル

- `profiles`
  - 人そのもの
  - グローバルな1ユーザー1ID
- `organizations`
  - 団体
- `organization_memberships`
  - 人と団体の所属

1人のユーザーが複数団体に所属していてよい。  
権限は `user` ではなく `membership` に紐づける。

### 6.2 権限モデル

- `Admin`
  - 全体最上位
  - プラットフォーム管理
- `Platform Support`
  - 補助権限
- `Administrator`
  - 団体内最上位
- `Supervisor`
  - 団体内の強権限
- その他ロール
  - `PA Leader`, `Lighting Leader`, `Part Leader`, `Web Secretary`, custom role

### 6.3 認可の責任分担

- フロント
  - 見せない、押せないを担当
- API
  - 実行可否を判定
- DB RLS
  - 最終防衛線

---

## 7. RLS 設計ルール

### 7.1 基本ルール

- 団体データの全テーブルに `organization_id uuid not null`
- すべての団体テーブルで RLS を有効化
- `using (true)` を団体データで使わない
- `auth.uid()` だけで許可しない

### 7.2 標準 helper function

最低限次の helper に統一する。

- `is_admin(uid uuid)`
- `is_platform_support(uid uuid)`
- `is_org_member(uid uuid, org_id uuid)`
- `has_org_role(uid uuid, org_id uuid, role_slug text)`
- `has_org_permission(uid uuid, org_id uuid, permission_key text)`

### 7.3 標準ポリシーパターン

読み取り:

```sql
using (
  is_admin(auth.uid())
  or has_org_permission(auth.uid(), organization_id, 'events.read')
)
```

更新:

```sql
using (
  is_admin(auth.uid())
  or has_org_permission(auth.uid(), organization_id, 'events.manage')
)
with check (
  is_admin(auth.uid())
  or has_org_permission(auth.uid(), organization_id, 'events.manage')
)
```

### 7.4 RLS で禁止すること

- クライアントから渡された `organization_id` を無条件で信用すること
- `leader = 'Administrator'` のような固定文字列依存を続けること
- 団体データを `authenticated` 全体に開くこと

---

## 8. API セキュリティルール

### 8.1 すべての管理APIで必須

- Bearer token 検証
- actor の user id 確定
- 対象 `organization_id` 確定
- `Admin` または該当 `permission_key` の確認
- body / query の入力検証
- 実行ログ記録

### 8.2 server-side でしかやらないこと

- `SUPABASE_SERVICE_ROLE_KEY` の利用
- Vercel / GitHub / GAS など外部管理API連携
- 他ユーザー情報の秘匿更新
- 権限変更
- アカウント削除

### 8.3 禁止事項

- 管理APIを無認証で公開する
- 管理APIの認可を UI の表示制御に依存させる
- service role を前提にしてクライアントから直接操作させる
- 外部APIを単なるプロキシとして無認証公開する

---

## 9. Storage セキュリティルール

### 9.1 パス設計

```text
avatars/{profileId}/...
org/{organizationId}/announcements/...
org/{organizationId}/events/...
org/{organizationId}/forms/...
org/{organizationId}/bands/...
```

### 9.2 方針

- 公開アバターだけは public bucket 可
- 団体資料は原則 private bucket
- private asset は signed URL 前提
- object path と DB の `organization_id` を対応させる

### 9.3 禁止事項

- 団体画像や添付ファイルを organization prefix なしで置く
- private asset を bucket ごと public にする

---

## 10. 秘匿情報の扱い

### 10.1 分離対象

- 学籍番号
- 電話番号
- 生年月日
- 入学年度

これらは `profiles` に置かず、`profile_private` または将来の秘匿情報テーブルに分離する。

### 10.2 権限分離

- `members.read`
  - 一般プロフィール閲覧
- `members.private.read`
  - 秘匿情報閲覧
- `members.edit_private`
  - 秘匿情報更新

### 10.3 UI ルール

- `members.private.read` を持たない限り UI に表示しない
- API でも同じ権限を再検証する
- CSV export などでも同じ権限を必須にする

---

## 11. 外部連携と秘密情報

### 11.1 環境変数ルール

- `NEXT_PUBLIC_` は秘密情報禁止
- token, secret, service role key は server-only
- 本番と検証環境で鍵を分離

### 11.2 外部連携で守ること

- Vercel API
  - `Admin` または専用権限のみ
- GitHub 同期
  - 管理者のみ
- Google Apps Script
  - 署名または secret 付き

### 11.3 注意点

メール許可リストのような運用情報も、必要なら `NEXT_PUBLIC_` ではなく server-side 管理へ寄せる。

---

## 12. 監査ログ

### 12.1 必ず記録する操作

- ロール付与 / 削除
- 権限変更
- 組織設定変更
- モジュール ON/OFF
- 秘匿情報更新
- アカウント削除
- 外部同期
- Vercel ログ閲覧

### 12.2 ログ項目

- `actor_user_id`
- `organization_id`
- `action_key`
- `target_type`
- `target_id`
- `before_json`
- `after_json`
- `ip`
- `user_agent`
- `created_at`

### 12.3 保持方針

- 監査ログは通常ユーザーから不可視
- `Admin` と必要な監査ロールのみ閲覧可
- 物理削除より長期保持を優先

---

## 13. 高リスク操作の保護

### 13.1 強い確認を入れる操作

- 他ユーザー削除
- `Administrator` 付与
- `Admin` 付与
- 団体停止
- モジュール停止
- 一括インポート
- 一括エクスポート

### 13.2 推奨保護

- 再認証
- 二重確認
- 監査ログ強制
- 実行理由の記録
- 可能なら `soft delete`

---

## 14. 現行 repo の優先修正点

### 14.1 すぐ塞ぐべきもの

1. `app/api/admin/vercel/deployments/route.ts`
   - 認証も権限確認も無しで Vercel API を叩いている
2. `app/api/admin/vercel/logs/route.ts`
   - 同様に無認証
3. `lib/useCanViewStudentId.ts`
   - `canAccessAdmin` 依存なので `PA Leader` / `Lighting Leader` にも学籍番号閲覧が開く

### 14.2 現状の良い例

- `app/api/admin/profile-private/route.ts`
  - Bearer token 検証をしている
  - service role の利用が server-side に閉じている
  - 管理者確認を行っている

### 14.3 将来の設計に向けて直すべきもの

- `lib/authEmail.ts`
  - 学校ドメイン前提で固定
  - 団体ごとの許可ドメイン設定へ移す
- 固定 leader 文字列判定
  - `Administrator`, `Supervisor`, `PA Leader` などをコード直書きしている
  - `permission_key` ベースへ移す

---

## 15. 実装ルールのチェックリスト

新しい API / テーブル / 画面を追加するたびに次を確認する。

- 団体データなら `organization_id` があるか
- RLS が有効か
- 読み取りポリシーが広すぎないか
- 更新ポリシーが `with check` まで含まれているか
- API が Bearer token を検証しているか
- API が org scope を検証しているか
- API が `permission_key` を検証しているか
- 秘匿情報を公開テーブルに置いていないか
- Storage path が `org/{organizationId}` 配下か
- 高権限操作を監査ログへ残しているか

---

## 16. 開発フェーズ別の優先順位

### フェーズ 0

- Vercel 管理APIの保護
- 学籍番号閲覧権限の分離
- 秘密情報の env 整理

### フェーズ 1

- `organization_id` モデル導入
- helper function 導入
- 団体データの RLS 統一

### フェーズ 2

- RBAC 導入
- `permission_key` ベース認可
- 監査ログ導入

### フェーズ 3

- signed URL
- 高リスク操作の再認証
- エクスポート制御

---

## 17. まとめ

このSaaSで最重要なのは、機能数ではなく `境界の強さ` です。

特に守るべき境界は次です。

- `Admin` と団体管理者の境界
- 団体Aと団体Bの境界
- 通常プロフィールと秘匿情報の境界
- UI と実際の認可の境界

この設計に沿えば、複数団体が同じ基盤を使っても、権限事故と情報漏えいのリスクをかなり抑えられます。
