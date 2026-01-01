"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Clock, MapPin, Plus, RefreshCw, Trash2 } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { toast } from "@/lib/toast";

type EventRow = {
  id: string;
  name: string;
  date: string;
  status: string;
  event_type: string;
  venue: string | null;
  open_time: string | null;
  start_time: string | null;
  note: string | null;
  default_changeover_min: number;
};

const statusOptions = [
  { value: "draft", label: "下書き" },
  { value: "recruiting", label: "募集中" },
  { value: "fixed", label: "確定" },
  { value: "closed", label: "終了" },
];

const eventTypeOptions = [
  { value: "live", label: "ライブ" },
  { value: "workshop", label: "講習会" },
  { value: "briefing", label: "説明会" },
  { value: "camp", label: "合宿" },
  { value: "other", label: "その他" },
];

function statusVariant(status: string) {
  if (status === "draft") return "outline";
  if (status === "recruiting") return "default";
  if (status === "fixed") return "secondary";
  return "outline";
}

const emptyForm: EventRow = {
  id: "",
  name: "",
  date: "",
  status: "draft",
  event_type: "live",
  venue: "",
  open_time: "",
  start_time: "",
  note: "",
  default_changeover_min: 15,
};

export default function AdminEventsPage() {
  const { session } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EventRow>(emptyForm);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const userId = session?.user.id;

  const canSubmit = useMemo(() => {
    return form.name.trim().length > 0 && form.date.trim().length > 0 && !saving;
  }, [form.date, form.name, saving]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    setError(null);
  }, [error]);

  useEffect(() => {
    if (!deleteError) return;
    toast.error(deleteError);
    setDeleteError(null);
  }, [deleteError]);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, date, status, event_type, venue, open_time, start_time, note, default_changeover_min"
        )
        .order("date", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setError("イベントの取得に失敗しました。");
        setEvents([]);
      } else {
        setEvents((data ?? []) as EventRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [adminLoading, isAdmin]);

  const handleChange = (key: keyof EventRow, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !isAdmin) return;
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      date: form.date,
      status: form.status,
      event_type: form.event_type,
      venue: form.venue || null,
      open_time: form.open_time || null,
      start_time: form.start_time || null,
      note: form.note || null,
      default_changeover_min: Number(form.default_changeover_min) || 15,
      created_by: userId ?? null,
    };

    const { data, error } = await supabase.from("events").insert([payload]).select().single();
    if (error) {
      console.error(error);
      setError("イベントの作成に失敗しました。");
      setSaving(false);
      return;
    }

    setEvents((prev) => [...prev, data as EventRow].sort((a, b) => a.date.localeCompare(b.date)));
    setForm(emptyForm);
    toast.success("イベントを作成しました。");
    setSaving(false);
  };

  const handleDeleteRequest = (eventId: string) => {
    setDeleteTargetId(eventId);
    setDeleteConfirmText("");
    setDeleteError(null);
  };

  const handleDeleteCancel = () => {
    setDeleteTargetId(null);
    setDeleteConfirmText("");
    setDeleteError(null);
  };

  const handleDeleteEvent = async (eventRow: EventRow) => {
    if (deleting) return;
    if (deleteConfirmText.trim() !== eventRow.name.trim()) {
      setDeleteError("イベント名が一致しません。");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from("events").delete().eq("id", eventRow.id);
    if (error) {
      console.error(error);
      setDeleteError("イベントの削除に失敗しました。");
      setDeleting(false);
      return;
    }
    setEvents((prev) => prev.filter((item) => item.id !== eventRow.id));
    handleDeleteCancel();
    toast.success("イベントを削除しました。");
    setDeleting(false);
  };

  if (adminLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">権限を確認しています...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">管理者のみアクセスできます</p>
            <p className="text-sm text-muted-foreground">管理者に問い合わせてください。</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Admin"
            title="イベント管理"
            description="イベントの作成・編集を行います。"
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-6 lg:gap-10 items-start">
              <form
                onSubmit={handleSubmit}
                className="bg-card/60 border border-border rounded-xl p-4 sm:p-6 space-y-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">イベントを作成</h2>
                    <p className="text-xs text-muted-foreground">
                      必須: イベント名 / 開催日。ほかは後から編集できます。
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="space-y-1 block text-sm">
                    <span className="text-foreground">イベント名</span>
                    <Input
                      required
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="春ライブ 2025"
                    />
                  </label>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">開催日</span>
                      <Input
                        type="date"
                        required
                        value={form.date}
                        onChange={(e) => handleChange("date", e.target.value)}
                      />
                    </label>
                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">ステータス</span>
                      <select
                        aria-label="ステータス"
                        className="h-10 w-full rounded-md border border-input bg-card/80 px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                        value={form.status}
                        onChange={(e) => handleChange("status", e.target.value)}
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="space-y-1 block text-sm">
                    <span className="text-foreground">イベント種別</span>
                    <select
                      aria-label="イベント種別"
                      className="h-10 w-full rounded-md border border-input bg-card/80 px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      value={form.event_type}
                      onChange={(e) => handleChange("event_type", e.target.value)}
                    >
                      {eventTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">開場時間</span>
                      <Input
                        type="time"
                        value={form.open_time ?? ""}
                        onChange={(e) => handleChange("open_time", e.target.value)}
                      />
                    </label>
                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">開演時間</span>
                      <Input
                        type="time"
                        value={form.start_time ?? ""}
                        onChange={(e) => handleChange("start_time", e.target.value)}
                      />
                    </label>
                  </div>

                  <label className="space-y-1 block text-sm">
                    <span className="text-foreground">会場</span>
                    <Input
                      value={form.venue ?? ""}
                      onChange={(e) => handleChange("venue", e.target.value)}
                      placeholder="大学ホール"
                    />
                  </label>

                  <label className="space-y-1 block text-sm">
                    <span className="text-foreground">メモ</span>
                    <textarea
                      value={form.note ?? ""}
                      onChange={(e) => handleChange("note", e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground"
                      placeholder="備考や出演条件など"
                    />
                  </label>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">デフォルト転換時間（分）</span>
                      <Input
                        type="number"
                        min={0}
                        value={form.default_changeover_min}
                        onChange={(e) => handleChange("default_changeover_min", Number(e.target.value))}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Button type="submit" disabled={!canSubmit} className="gap-2">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    イベントを作成
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm(emptyForm)}
                    disabled={saving}
                  >
                    リセット
                  </Button>
                </div>
              </form>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">イベント一覧</h2>
                  <Badge variant="secondary">{events.length}</Badge>
                </div>

                <div className="space-y-3">
                  {loading ? (
                    <div className="text-sm text-muted-foreground">読み込み中...</div>
                  ) : events.length === 0 ? (
                    <div className="text-sm text-muted-foreground">イベントがありません。</div>
                  ) : (
                    events.map((event) => {
                      const timeRange =
                        event.open_time && event.start_time
                          ? `${event.open_time} - ${event.start_time}`
                          : "時間未定";
                      const isDeleteTarget = deleteTargetId === event.id;
                      const confirmMatches =
                        isDeleteTarget && deleteConfirmText.trim() === event.name.trim();
                      const isDeletingTarget = deleting && isDeleteTarget;
                      return (
                        <div
                          key={event.id}
                          className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 p-4 bg-card/50 border border-border rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={statusVariant(event.status)} className="capitalize">
                                {event.status}
                              </Badge>
                              <p className="font-semibold truncate">{event.name}</p>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-primary" />
                                {event.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4 text-primary" />
                                {timeRange}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4 text-primary" />
                                {event.venue ?? "未設定"}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Link
                              href={`/admin/events/${event.id}`}
                              className={cn(
                                "inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-primary/50 hover:text-primary transition-colors"
                              )}
                            >
                              編集
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/events/${event.id}`}
                              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                            >
                              詳細
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDeleteRequest(event.id)}
                              disabled={isDeletingTarget}
                              className={cn(
                                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                                isDeleteTarget
                                  ? "border-destructive/60 text-destructive"
                                  : "border-border text-destructive/80 hover:border-destructive/60 hover:text-destructive",
                                isDeletingTarget && "opacity-70 pointer-events-none"
                              )}
                            >
                              {isDeletingTarget ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                              削除
                            </button>
                          </div>
                          {isDeleteTarget && (
                            <div className="w-full sm:basis-full rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                              <p className="text-xs text-muted-foreground">
                                削除するにはイベント名「{event.name}」を入力してください。
                              </p>
                              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                <Input
                                  value={deleteConfirmText}
                                  onChange={(e) => {
                                    setDeleteConfirmText(e.target.value);
                                    if (deleteError) setDeleteError(null);
                                  }}
                                  placeholder={event.name}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={!confirmMatches || isDeletingTarget}
                                    onClick={() => handleDeleteEvent(event)}
                                  >
                                    {isDeletingTarget ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                    削除する
                                  </Button>
                                  <Button type="button" variant="outline" onClick={handleDeleteCancel}>
                                    キャンセル
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}

