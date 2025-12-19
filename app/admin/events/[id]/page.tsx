"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  const [form, setForm] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
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
        setError("イベントが見つかりません。");
        setForm(null);
      } else {
        setForm(data as EventRow);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const canSubmit = useMemo(() => {
    if (!form) return false;
    return form.name.trim().length > 0 && form.date.trim().length > 0 && !saving;
  }, [form, saving]);

  const handleChange = (key: keyof EventRow, value: string | number | null) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !canSubmit) return;
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
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
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
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
