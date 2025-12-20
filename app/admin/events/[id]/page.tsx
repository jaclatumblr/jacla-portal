"use client";
"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/lib/useIsAdmin";

type EventRow = {
  id: string;
  name: string;
  date: string;
  status: string;
  venue: string | null;
  open_time: string | null;
  start_time: string | null;
  note: string | null;
  default_song_duration_sec: number;
  default_changeover_min: number;
};

type BandRow = {
  id: string;
  name: string;
  is_approved: boolean;
  note_pa: string | null;
  note_lighting: string | null;
  created_by: string | null;
};

const statusOptions = [
  { value: "draft", label: "下書き" },
  { value: "recruiting", label: "募集中" },
  { value: "fixed", label: "確定" },
  { value: "closed", label: "終了" },
];

export default function AdminEventEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params?.id;
  const { session } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [form, setForm] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [bands, setBands] = useState<BandRow[]>([]);
  const [bandsLoading, setBandsLoading] = useState(false);
  const [bandsError, setBandsError] = useState<string | null>(null);
  const [bandSaving, setBandSaving] = useState(false);
  const [bandUpdating, setBandUpdating] = useState(false);
  const [bandForm, setBandForm] = useState({
    name: "",
    is_approved: false,
    note_pa: "",
    note_lighting: "",
  });
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [bandEdit, setBandEdit] = useState({
    name: "",
    is_approved: false,
    note_pa: "",
    note_lighting: "",
  });

  useEffect(() => {
    if (adminLoading) return;
    if (!eventId || !isAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, date, status, venue, open_time, start_time, note, default_song_duration_sec, default_changeover_min"
        )
        .eq("id", eventId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error(error);
        setError("イベントの取得に失敗しました。");
        setForm(null);
      } else if (!data) {
        setError("イベントが見つかりませんでした。");
        setForm(null);
      } else {
        setForm(data as EventRow);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [adminLoading, eventId, isAdmin]);

  useEffect(() => {
    if (!eventId || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setBandsLoading(true);
      setBandsError(null);
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, is_approved, note_pa, note_lighting, created_by")
        .eq("event_id", eventId)
        .order("name", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setBandsError("バンド一覧の取得に失敗しました。");
        setBands([]);
      } else {
        setBands((data ?? []) as BandRow[]);
        if (!selectedBandId && data && data.length > 0) {
          setSelectedBandId(data[0].id);
          const first = data[0] as BandRow;
          setBandEdit({
            name: first.name,
            is_approved: first.is_approved,
            note_pa: first.note_pa ?? "",
            note_lighting: first.note_lighting ?? "",
          });
        }
      }
      setBandsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, isAdmin, selectedBandId]);

  const canSubmit = useMemo(() => {
    if (!form) return false;
    return form.name.trim().length > 0 && form.date.trim().length > 0 && !saving;
  }, [form, saving]);

  const handleChange = (key: keyof EventRow, value: string | number | null) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !canSubmit || !isAdmin) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      name: form.name.trim(),
      date: form.date,
      status: form.status,
      venue: form.venue || null,
      open_time: form.open_time || null,
      start_time: form.start_time || null,
      note: form.note || null,
      default_song_duration_sec: Number(form.default_song_duration_sec) || 240,
      default_changeover_min: Number(form.default_changeover_min) || 15,
    };

    const { error } = await supabase.from("events").update(payload).eq("id", form.id);
    if (error) {
      console.error(error);
      setError("保存に失敗しました。");
      setSaving(false);
      return;
    }
    setMessage("保存しました。");
    setSaving(false);
  };

  const canCreateBand = bandForm.name.trim().length > 0 && !bandSaving;
  const selectedBand = selectedBandId ? bands.find((b) => b.id === selectedBandId) ?? null : null;
  const canUpdateBand = selectedBand && bandEdit.name.trim().length > 0 && !bandUpdating;

  const handleBandCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !canCreateBand || !isAdmin) return;
    setBandSaving(true);
    setBandsError(null);
    const payload = {
      event_id: eventId,
      name: bandForm.name.trim(),
      is_approved: bandForm.is_approved,
      note_pa: bandForm.note_pa || null,
      note_lighting: bandForm.note_lighting || null,
      created_by: session?.user.id ?? null,
    };
    const { data, error } = await supabase.from("bands").insert([payload]).select().single();
    if (error) {
      console.error(error);
      setBandsError("バンドの作成に失敗しました。");
      setBandSaving(false);
      return;
    }
    setBands((prev) => [...prev, data as BandRow].sort((a, b) => a.name.localeCompare(b.name)));
    if (!selectedBandId) {
      setSelectedBandId(data.id as string);
    }
    setBandForm({ name: "", is_approved: false, note_pa: "", note_lighting: "" });
    setBandSaving(false);
  };

  const handleBandSelect = (band: BandRow) => {
    setSelectedBandId(band.id);
    setBandEdit({
      name: band.name,
      is_approved: band.is_approved,
      note_pa: band.note_pa ?? "",
      note_lighting: band.note_lighting ?? "",
    });
  };

  const handleBandUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBand || !eventId || !bandEdit.name.trim() || !isAdmin) return;
    setBandUpdating(true);
    setBandsError(null);
    const payload = {
      name: bandEdit.name.trim(),
      is_approved: bandEdit.is_approved,
      note_pa: bandEdit.note_pa || null,
      note_lighting: bandEdit.note_lighting || null,
    };
    const { error } = await supabase.from("bands").update(payload).eq("id", selectedBand.id);
    if (error) {
      console.error(error);
      setBandsError("バンドの更新に失敗しました。");
      setBandUpdating(false);
      return;
    }
    setBands((prev) =>
      prev.map((b) => (b.id === selectedBand.id ? { ...b, ...payload } : b)).sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    setBandUpdating(false);
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

  if (loading || !form) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">読み込み中です...</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="pt-10 md:pt-0">
                <Link
                  href="/admin/events"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">イベント一覧に戻る</span>
                </Link>

                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline">イベント編集</Badge>
                  {form?.status && (
                    <Badge variant="secondary" className="capitalize">
                      {form.status}
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold">
                  {form?.name || "イベント編集"}
                </h1>
                {form?.date && (
                  <p className="text-muted-foreground mt-1 text-sm">{form.date}</p>
                )}
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              {loading ? (
                <p className="text-sm text-muted-foreground">読み込み中...</p>
              ) : error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : !form ? (
                <p className="text-sm text-muted-foreground">データがありません。</p>
              ) : (
                <div className="space-y-10">
                  <form
                    onSubmit={handleSave}
                    className="bg-card/60 border border-border rounded-xl p-4 sm:p-6 space-y-4 shadow-sm max-w-3xl"
                  >
                    <div className="grid sm:grid-cols-2 gap-4">
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">イベント名</span>
                        <Input
                          required
                          value={form.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                        />
                      </label>
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">開催日</span>
                        <Input
                          type="date"
                          required
                          value={form.date}
                          onChange={(e) => handleChange("date", e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
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
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">会場</span>
                        <Input
                          value={form.venue ?? ""}
                          onChange={(e) => handleChange("venue", e.target.value)}
                          placeholder="大学ホール"
                        />
                      </label>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
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
                      <span className="text-foreground">メモ</span>
                      <textarea
                        value={form.note ?? ""}
                        onChange={(e) => handleChange("note", e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground"
                        placeholder="備考や出演条件など"
                      />
                    </label>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">デフォルト演奏時間（秒）</span>
                        <Input
                          type="number"
                          min={30}
                          value={form.default_song_duration_sec}
                          onChange={(e) =>
                            handleChange("default_song_duration_sec", Number(e.target.value))
                          }
                        />
                      </label>
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">デフォルト転換時間（分）</span>
                        <Input
                          type="number"
                          min={0}
                          value={form.default_changeover_min}
                          onChange={(e) =>
                            handleChange("default_changeover_min", Number(e.target.value))
                          }
                        />
                      </label>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {message && <p className="text-sm text-green-500">{message}</p>}

                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={!canSubmit} className="gap-2">
                        {saving ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        保存
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push(`/events/${form.id}`)}
                      >
                        公開ページを見る
                      </Button>
                    </div>
                  </form>

                  <div className="mt-10 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">バンド管理</Badge>
                      <span className="text-sm text-muted-foreground">このイベントに紐づくバンド</span>
                    </div>

                    <form
                      onSubmit={handleBandCreate}
                      className="bg-card/60 border border-border rounded-xl p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">バンドを追加</h3>
                        <Badge variant="secondary">event_id: {form.id}</Badge>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">バンド名</span>
                          <Input
                            required
                            value={bandForm.name}
                            onChange={(e) => setBandForm((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Band Name"
                          />
                        </label>
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">承認ステータス</span>
                          <select
                            className="h-10 w-full rounded-md border border-input bg-card/80 px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                            value={bandForm.is_approved ? "1" : "0"}
                            onChange={(e) =>
                              setBandForm((p) => ({ ...p, is_approved: e.target.value === "1" }))
                            }
                          >
                            <option value="0">未承認</option>
                            <option value="1">承認済み</option>
                          </select>
                        </label>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">PAメモ</span>
                          <Input
                            value={bandForm.note_pa}
                            onChange={(e) => setBandForm((p) => ({ ...p, note_pa: e.target.value }))}
                            placeholder="PAに関する注意点など"
                          />
                        </label>
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">照明メモ</span>
                          <Input
                            value={bandForm.note_lighting}
                            onChange={(e) =>
                              setBandForm((p) => ({ ...p, note_lighting: e.target.value }))
                            }
                            placeholder="照明に関する注意点など"
                          />
                        </label>
                      </div>

                      {bandsError && <p className="text-sm text-destructive">{bandsError}</p>}

                      <div className="flex items-center gap-3">
                        <Button type="submit" disabled={!canCreateBand} className="gap-2">
                          {bandSaving ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )}
                          追加
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          作成者ID: {session?.user.id ?? "unknown"}
                        </span>
                      </div>
                    </form>

                    <div className="bg-card/60 border border-border rounded-xl p-4 sm:p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">バンド一覧</h3>
                        <Badge variant="secondary">{bands.length}</Badge>
                      </div>
                      {bandsLoading ? (
                        <p className="text-sm text-muted-foreground">バンドを読み込み中...</p>
                      ) : bands.length === 0 ? (
                        <p className="text-sm text-muted-foreground">まだバンドがありません。</p>
                      ) : (
                        <div className="space-y-2">
                          {bands.map((band) => (
                            <div
                              key={band.id}
                              className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-border bg-card/40"
                              onClick={() => handleBandSelect(band)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{band.name}</span>
                                  {band.is_approved && (
                                    <Badge className="bg-green-600 text-white gap-1">
                                      <CheckCircle2 className="w-4 h-4" />
                                      承認済み
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  PA: {band.note_pa || "なし"} / 照明: {band.note_lighting || "なし"}
                                </p>
                              </div>
                              <div className="flex gap-2" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedBand && (
                      <div className="bg-card/60 border border-border rounded-xl p-4 sm:p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">バンド詳細</Badge>
                          <span className="text-sm text-muted-foreground">
                            選択中: {selectedBand.name} （編集は保存で反映）
                          </span>
                        </div>

                        <form onSubmit={handleBandUpdate} className="space-y-3">
                          <div className="grid sm:grid-cols-2 gap-3">
                            <label className="space-y-1 block text-sm">
                              <span className="text-foreground">バンド名</span>
                              <Input
                                value={bandEdit.name}
                                onChange={(e) => setBandEdit((p) => ({ ...p, name: e.target.value }))}
                                required
                              />
                            </label>
                            <label className="space-y-1 block text-sm">
                              <span className="text-foreground">承認ステータス</span>
                              <select
                                className="h-10 w-full rounded-md border border-input bg-card/80 px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                                value={bandEdit.is_approved ? "1" : "0"}
                                onChange={(e) => setBandEdit((p) => ({ ...p, is_approved: e.target.value === "1" }))}
                              >
                                <option value="0">未承認</option>
                                <option value="1">承認済み</option>
                              </select>
                            </label>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3">
                            <label className="space-y-1 block text-sm">
                              <span className="text-foreground">PAメモ</span>
                              <Input
                                value={bandEdit.note_pa}
                                onChange={(e) => setBandEdit((p) => ({ ...p, note_pa: e.target.value }))}
                                placeholder="PAに関する注意点など"
                              />
                            </label>
                            <label className="space-y-1 block text-sm">
                              <span className="text-foreground">照明メモ</span>
                              <Input
                                value={bandEdit.note_lighting}
                                onChange={(e) => setBandEdit((p) => ({ ...p, note_lighting: e.target.value }))}
                                placeholder="照明に関する注意点など"
                              />
                            </label>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button type="submit" disabled={!canUpdateBand} className="gap-2">
                              {bandUpdating ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <ArrowRight className="w-4 h-4" />
                              )}
                              バンドを保存
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              songs/band_members/stage_plot は後続対応（DB未用意）
                            </span>
                          </div>
                        </form>

                        <div className="grid lg:grid-cols-2 gap-4">
                          <div className="p-4 rounded-lg border border-border bg-card/50 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge>セットリスト</Badge>
                              <span className="text-xs text-muted-foreground">（準備中）</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              songsテーブルが未作成のためUIのみ。曲名・アーティスト・尺をここに並べる予定です。
                            </p>
                            <Button size="sm" variant="outline" disabled>
                              セットリストを追加（準備中）
                            </Button>
                          </div>
                          <div className="p-4 rounded-lg border border-border bg-card/50 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge>ステージプロット</Badge>
                              <span className="text-xs text-muted-foreground">（準備中）</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              stage_plot_data(tldraw JSON) を保存/読み込みする予定です。図面エディタを後続で実装します。
                            </p>
                            <Button size="sm" variant="outline" disabled>
                              プロットを編集（準備中）
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
