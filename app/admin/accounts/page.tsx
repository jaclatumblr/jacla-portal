"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { UserManagementTabs } from "@/components/UserManagementTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { accountStatuses, accountStatusLabels, type AccountStatus, type ManagedAccount } from "@/lib/accountLifecycle";

const dateLabel = (value: string) => new Date(value).toLocaleDateString("ja-JP");
export default function AccountManagementPage() {
  const { session } = useAuth();
  const { isAdmin, loading: roleLoading } = useRoleFlags();
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [status, setStatus] = useState("all");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("status") === "warning") setStatus("warning"); }, []);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<ManagedAccount | null>(null);
  const [nextStatus, setNextStatus] = useState<AccountStatus>("graduated");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (roleLoading || !isAdmin || !session) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ status, q: search, page: String(page) });
    void fetch(`/api/admin/accounts?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "一覧を取得できませんでした。");
        if (!controller.signal.aborted) { setAccounts(result.accounts); setHasMore(result.hasMore); }
      }).catch((cause) => {
        if (!controller.signal.aborted) { setAccounts([]); setError(cause instanceof Error ? cause.message : "通信に失敗しました。"); }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, isAdmin, roleLoading, status, search, page, reload]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !session || saving || nextStatus === selected.status) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/accounts", { method: "PATCH", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ profileId: selected.profile_id, status: nextStatus, reason, expectedChangedAt: selected.status_changed_at }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "変更に失敗しました。");
      setNotice(`${selected.display_name}さんを「${accountStatusLabels[nextStatus]}」に変更しました。`);
      setSelected(null); setReason(""); setReload((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "通信に失敗しました。"); }
    finally { setSaving(false); }
  };

  return <AuthGuard><div className="flex min-h-screen bg-background"><SideNav /><main className="min-w-0 flex-1 md:ml-20">
    <PageHeader title="ユーザー管理" kicker="Admin" description="部員の利用状態を管理します。卒業・休眠に変更しても、過去のバンドに名前は残ります。" backHref="/admin" backLabel="管理トップに戻る" />
    <UserManagementTabs activeTab="accounts" canManageAccounts={isAdmin} />
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-8 sm:px-6">
      {roleLoading ? <p role="status">権限を確認しています...</p> : !isAdmin ? <p>管理者のみ利用できます。</p> : <>
        <div className="rounded-xl border border-border bg-card p-5 text-sm leading-relaxed">
          <p>卒業・退部・休眠の部員は通常の部員一覧から外れ、ログインできなくなります。名前とバンドの所属履歴は保持します。</p>
          <p className="mt-2 text-muted-foreground">6か月未アクセスで自動休眠。30日前からこの画面に警告を表示します。初回導入時から判定を開始し、ブラウザでの実際の利用を最終アクセスとして記録します。</p>
          <p className="mt-2 text-muted-foreground">復帰には元のGoogleアカウントでの再ログインが必要です。以前の管理者権限は自動では戻りません。最後の管理者1名は自動休眠の対象外です。権限は「権限管理」タブで設定できます。</p>
        </div>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setSearch(query.trim()); setPage(0); setSelected(null); }}>
          <div className="min-w-48 flex-1"><Input label="名前で検索" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} disabled={saving} /></div>
          <label className="space-y-2 text-sm"><span className="block">利用状態</span><select value={status} disabled={saving} onChange={(event) => { setStatus(event.target.value); setPage(0); setSelected(null); }} className="h-10 rounded-md border border-input bg-card px-3"><option value="all">すべて</option>{accountStatuses.map((value) => <option key={value} value={value}>{accountStatusLabels[value]}</option>)}</select></label>
          <Button type="submit" disabled={saving}>検索</Button><Button type="button" variant="outline" disabled={saving || loading} onClick={() => { setSelected(null); setReload((value) => value + 1); }}>再読み込み</Button>
        </form>
        {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        {selected && <form onSubmit={save} className="space-y-4 rounded-xl border border-primary/40 bg-card p-5" aria-label="利用状態の変更">
          <h2 className="font-semibold">{selected.display_name}さんの状態を変更</h2>
          <label className="block space-y-2 text-sm"><span className="block">変更後の状態</span><select autoFocus value={nextStatus} disabled={saving} onChange={(event) => setNextStatus(event.target.value as AccountStatus)} className="h-10 rounded-md border border-input bg-card px-3">{accountStatuses.map((value) => <option key={value} value={value}>{accountStatusLabels[value]}</option>)}</select></label>
          <Input label="変更理由" placeholder="例：2026年度卒業／本人確認のうえ復帰" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required disabled={saving} />
          <p className="text-sm text-muted-foreground">{nextStatus === "active" ? "利用を再開できます。本人は再ログインが必要です。権限は必要に応じて別途設定してください。" : "利用を停止し、すべてのログインセッションと管理権限を解除します。部員一覧から外れますがバンドの名前は残ります。"}</p>
          <div className="flex gap-3"><Button type="submit" disabled={saving || !reason.trim() || nextStatus === selected.status}>{saving ? "変更中..." : "この内容で変更する"}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => setSelected(null)}>キャンセル</Button></div>
        </form>}
        {loading ? <p role="status" className="py-8 text-center text-muted-foreground">読み込み中...</p> : !accounts.length ? error ? null : <p className="py-8 text-center text-muted-foreground">該当する部員はいません。</p> : <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {accounts.map((account) => <li key={account.profile_id} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="break-words font-medium">{account.display_name}</span><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{accountStatusLabels[account.status]}</span></div>
              <p className="mt-2 text-xs text-muted-foreground">{account.activity_recorded ? "最終アクセス" : "アクセス未記録・判定開始"}：{dateLabel(account.last_active_at)} ／ 状態変更：{dateLabel(account.status_changed_at)}</p>
              {account.warning_at && account.status === "active" && <p className="mt-2 text-sm text-warning">休眠の事前警告：{dateLabel(account.warning_at)}。警告から30日以上経過し、6か月未アクセスの場合に自動休眠します。</p>}
              {account.reason && <p className="mt-2 break-words text-sm text-muted-foreground">理由：{account.reason}</p>}
            </div>
            <Button variant="outline" disabled={saving || account.profile_id === session?.user.id} onClick={() => { setSelected(account); setNextStatus(account.status === "active" ? "graduated" : "active"); setReason(""); setError(""); setNotice(""); }}>{account.profile_id === session?.user.id ? "自分の状態は変更できません" : "状態を変更"}</Button>
          </li>)}
        </ul>}
        <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={page === 0 || loading || saving || !!error} onClick={() => { setPage((value) => value - 1); setSelected(null); }}>前へ</Button><span className="text-sm text-muted-foreground">{page + 1}ページ</span><Button variant="outline" disabled={!hasMore || loading || saving || !!error} onClick={() => { setPage((value) => value + 1); setSelected(null); }}>次へ</Button></div>
      </>}
    </div>
  </main></div></AuthGuard>;
}
