"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  MapPin,
  PencilLine,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

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

type Band = {
  id: string;
  event_id: string;
  name: string;
  is_approved: boolean;
  note_pa: string | null;
  note_lighting: string | null;
  stage_plot_data: Record<string, any> | null;
  created_by: string | null;
};

type ProfileOption = {
  id: string;
  display_name: string;
  email?: string | null;
  discord?: string | null;
  crew?: string | null;
};

type BandMember = {
  id: string;
  band_id: string;
  user_id: string;
  instrument: string;
};

type Song = {
  id: string;
  band_id: string;
  title: string;
  artist: string | null;
  duration_sec: number | null;
  memo: string | null;
};

const statusOptions = [
  { value: "draft", label: "下書き" },
  { value: "recruiting", label: "募集中" },
  { value: "fixed", label: "確定" },
  { value: "closed", label: "終了" },
];

function statusBadge(status: string) {
  if (status === "recruiting") return "default";
  if (status === "fixed") return "secondary";
  return "outline";
}

function statusLabel(status: string) {
  return statusOptions.find((s) => s.value === status)?.label ?? status;
}

export default function AdminEventDetailPage() {
  const params = useParams();
  const eventId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [eventForm, setEventForm] = useState<EventRow | null>(null);
  const [bands, setBands] = useState<Band[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [bandForm, setBandForm] = useState({
    name: "",
    is_approved: false,
    note_pa: "",
    note_lighting: "",
    stagePlotNote: "",
  });
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [members, setMembers] = useState<BandMember[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [newBandName, setNewBandName] = useState("");
  const [memberForm, setMemberForm] = useState({ profileId: "", instrument: "" });
  const [songForm, setSongForm] = useState({ title: "", artist: "", duration_sec: "", memo: "" });
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingBand, setSavingBand] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [savingSong, setSavingSong] = useState(false);

  const selectedBand = useMemo(
    () => bands.find((b) => b.id === selectedBandId) ?? null,
    [bands, selectedBandId]
  );

  const profilesMap = useMemo(() => {
    const map = new Map<string, ProfileOption>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const selectedBandMembers = useMemo(
    () => members.filter((m) => m.band_id === selectedBandId),
    [members, selectedBandId]
  );

  const selectedBandSongs = useMemo(
    () => songs.filter((s) => s.band_id === selectedBandId),
    [songs, selectedBandId]
  );
  useEffect(() => {
    if (!eventId || adminLoading || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const [eventRes, bandsRes, profilesRes] = await Promise.all([
        supabase
          .from("events")
          .select(
            "id, name, date, status, venue, open_time, start_time, note, default_song_duration_sec, default_changeover_min"
          )
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("bands")
          .select("id, event_id, name, is_approved, note_pa, note_lighting, stage_plot_data, created_by")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("*").order("display_name", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        setError("イベント情報の取得に失敗しました。");
        setEvent(null);
        setBands([]);
        setProfiles([]);
        setMembers([]);
        setSongs([]);
        setLoading(false);
        return;
      }

      setEvent(eventRes.data as EventRow);
      setEventForm(eventRes.data as EventRow);

      const bandList = (bandsRes.data ?? []) as Band[];
      setBands(bandList);
      setSelectedBandId((prev) => prev ?? bandList[0]?.id ?? null);

      const profileList = (profilesRes.data ?? []).map((p: any) => ({
        id: p.id,
        display_name: p.display_name ?? p.full_name ?? p.name ?? p.email ?? "名前未登録",
        email: p.email ?? null,
        discord: p.discord_username ?? p.discord ?? null,
        crew: p.crew ?? null,
      }));
      setProfiles(profileList);

      const bandIds = bandList.map((b) => b.id);
      if (bandIds.length === 0) {
        setMembers([]);
        setSongs([]);
        setLoading(false);
        return;
      }

      const [membersRes, songsRes] = await Promise.all([
        supabase.from("band_members").select("id, band_id, user_id, instrument").in("band_id", bandIds),
        supabase.from("songs").select("id, band_id, title, artist, duration_sec, memo").in("band_id", bandIds),
      ]);

      if (!cancelled) {
        if (membersRes.error) {
          console.error(membersRes.error);
          setError("バンドメンバーの取得に失敗しました。");
        } else {
          setMembers((membersRes.data ?? []) as BandMember[]);
        }

        if (songsRes.error) {
          console.error(songsRes.error);
          setError((prev) => prev ?? "セットリストの取得に失敗しました。");
        } else {
          setSongs((songsRes.data ?? []) as Song[]);
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [adminLoading, eventId, isAdmin]);

  useEffect(() => {
    if (!selectedBand) {
      setBandForm({
        name: "",
        is_approved: false,
        note_pa: "",
        note_lighting: "",
        stagePlotNote: "",
      });
      return;
    }
    setBandForm({
      name: selectedBand.name,
      is_approved: Boolean(selectedBand.is_approved),
      note_pa: selectedBand.note_pa ?? "",
      note_lighting: selectedBand.note_lighting ?? "",
      stagePlotNote:
        (selectedBand.stage_plot_data?.note as string) ??
        (selectedBand.stage_plot_data?.stage_plot as string) ??
        "",
    });
  }, [selectedBand]);
  const handleEventChange = (key: keyof EventRow, value: string | number) => {
    if (!eventForm) return;
    setEventForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm || savingEvent) return;
    setSavingEvent(true);
    setError(null);

    const payload = {
      name: eventForm.name.trim(),
      date: eventForm.date,
      status: eventForm.status,
      venue: eventForm.venue || null,
      open_time: eventForm.open_time || null,
      start_time: eventForm.start_time || null,
      note: eventForm.note || null,
      default_song_duration_sec: Number(eventForm.default_song_duration_sec) || 240,
      default_changeover_min: Number(eventForm.default_changeover_min) || 15,
    };

    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", eventId)
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("イベントの更新に失敗しました。");
    } else {
      setEvent(data as EventRow);
      setEventForm(data as EventRow);
    }
    setSavingEvent(false);
  };

  const handleCreateBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBandName.trim() || savingBand) return;
    setSavingBand(true);
    setError(null);

    const { data, error } = await supabase
      .from("bands")
      .insert([
        {
          event_id: eventId,
          name: newBandName.trim(),
          created_by: userId ?? null,
          is_approved: false,
        },
      ])
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("バンドの作成に失敗しました。");
      setSavingBand(false);
      return;
    }

    const added = data as Band;
    setBands((prev) => [...prev, added]);
    setSelectedBandId(added.id);
    setNewBandName("");
    setSavingBand(false);
  };

  const handleUpdateBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBandId || savingBand) return;
    setSavingBand(true);
    setError(null);

    const payload = {
      name: bandForm.name.trim() || "未命名バンド",
      is_approved: bandForm.is_approved,
      note_pa: bandForm.note_pa || null,
      note_lighting: bandForm.note_lighting || null,
      stage_plot_data: bandForm.stagePlotNote ? { note: bandForm.stagePlotNote } : {},
    };

    const { data, error } = await supabase
      .from("bands")
      .update(payload)
      .eq("id", selectedBandId)
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("バンド情報の更新に失敗しました。");
      setSavingBand(false);
      return;
    }

    const updated = data as Band;
    setBands((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setSavingBand(false);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBandId || !memberForm.profileId || !memberForm.instrument.trim() || savingMember) {
      return;
    }
    setSavingMember(true);
    setError(null);

    const { data, error } = await supabase
      .from("band_members")
      .insert([
        {
          band_id: selectedBandId,
          user_id: memberForm.profileId,
          instrument: memberForm.instrument.trim(),
        },
      ])
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("メンバーの追加に失敗しました。");
      setSavingMember(false);
      return;
    }

    setMembers((prev) => [...prev, data as BandMember]);
    setMemberForm({ profileId: "", instrument: "" });
    setSavingMember(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!memberId) return;
    const { error } = await supabase.from("band_members").delete().eq("id", memberId);
    if (error) {
      console.error(error);
      setError("メンバーの削除に失敗しました。");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBandId || !songForm.title.trim() || savingSong) return;
    setSavingSong(true);
    setError(null);

    const { data, error } = await supabase
      .from("songs")
      .insert([
        {
          band_id: selectedBandId,
          title: songForm.title.trim(),
          artist: songForm.artist || null,
          duration_sec: songForm.duration_sec ? Number(songForm.duration_sec) : null,
          memo: songForm.memo || null,
        },
      ])
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setError("セットリストの追加に失敗しました。");
      setSavingSong(false);
      return;
    }

    setSongs((prev) => [...prev, data as Song]);
    setSongForm({ title: "", artist: "", duration_sec: "", memo: "" });
    setSavingSong(false);
  };

  const handleRemoveSong = async (songId: string) => {
    if (!songId) return;
    const { error } = await supabase.from("songs").delete().eq("id", songId);
    if (error) {
      console.error(error);
      setError("曲の削除に失敗しました。");
      return;
    }
    setSongs((prev) => prev.filter((s) => s.id !== songId));
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

  if (loading || !eventForm) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            読み込み中です...
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
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
                <Link href="/admin/events" className="hover:text-primary transition-colors">
                  イベント一覧に戻る
                </Link>
              </div>
              <div className="max-w-5xl mt-6">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">ADMIN</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">イベント編集</h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  イベント情報・バンド・メンバー・セットリストを管理します。
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <Badge variant={statusBadge(eventForm.status)}>{statusLabel(eventForm.status)}</Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>{eventForm.date}</span>
                  </div>
                  {eventForm.venue && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{eventForm.venue}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-8 md:space-y-10">
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-xl">イベント情報</CardTitle>
                    <CardDescription>基本情報とデフォルト設定を更新します。</CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-4 h-4" />
                    Admin only
                  </Badge>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateEvent} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">イベント名</span>
                        <Input
                          required
                          value={eventForm.name}
                          onChange={(e) => handleEventChange("name", e.target.value)}
                          placeholder="春ライブ 2025"
                        />
                      </label>
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">ステータス</span>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-card px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                          value={eventForm.status}
                          onChange={(e) => handleEventChange("status", e.target.value)}
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">開催日</span>
                        <Input
                          type="date"
                          required
                          value={eventForm.date}
                          onChange={(e) => handleEventChange("date", e.target.value)}
                        />
                      </label>
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">会場</span>
                        <Input
                          value={eventForm.venue ?? ""}
                          onChange={(e) => handleEventChange("venue", e.target.value)}
                          placeholder="大学ホール"
                        />
                      </label>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">開場時間</span>
                          <Input
                            type="time"
                            value={eventForm.open_time ?? ""}
                            onChange={(e) => handleEventChange("open_time", e.target.value)}
                          />
                        </label>
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">開演時間</span>
                          <Input
                            type="time"
                            value={eventForm.start_time ?? ""}
                            onChange={(e) => handleEventChange("start_time", e.target.value)}
                          />
                        </label>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">デフォルト演奏時間（秒）</span>
                          <Input
                            type="number"
                            min={30}
                            value={eventForm.default_song_duration_sec}
                            onChange={(e) =>
                              handleEventChange("default_song_duration_sec", Number(e.target.value))
                            }
                          />
                        </label>
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">デフォルト転換時間（分）</span>
                          <Input
                            type="number"
                            min={0}
                            value={eventForm.default_changeover_min}
                            onChange={(e) =>
                              handleEventChange("default_changeover_min", Number(e.target.value))
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <label className="space-y-1 block text-sm">
                      <span className="text-foreground">メモ</span>
                      <Textarea
                        rows={3}
                        value={eventForm.note ?? ""}
                        onChange={(e) => handleEventChange("note", e.target.value)}
                        placeholder="備考や出演条件など"
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={savingEvent} className="gap-2">
                        {savingEvent ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PencilLine className="w-4 h-4" />}
                        保存する
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEventForm(event ?? null)}
                        disabled={savingEvent}
                      >
                        変更を戻す
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
              <div className="grid lg:grid-cols-[320px,1fr] gap-6">
                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">バンド</CardTitle>
                    <CardDescription>選択または新規作成</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {bands.length === 0 ? (
                        <p className="text-sm text-muted-foreground">まだバンドがありません。</p>
                      ) : (
                        <div className="space-y-2">
                          {bands.map((band) => (
                            <button
                              key={band.id}
                              type="button"
                              onClick={() => setSelectedBandId(band.id)}
                              className={cn(
                                "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                                selectedBandId === band.id
                                  ? "border-primary/60 bg-primary/10"
                                  : "border-border hover:border-primary/40 hover:bg-muted/50"
                              )}
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm">{band.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {band.note_pa ? "PAメモあり" : "PAメモなし"}
                                </span>
                              </div>
                              {band.is_approved ? (
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                              ) : (
                                <BadgeCheck className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleCreateBand} className="space-y-2">
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">新規バンド名</span>
                        <Input
                          value={newBandName}
                          onChange={(e) => setNewBandName(e.target.value)}
                          placeholder="バンド名を入力"
                        />
                      </label>
                      <Button type="submit" disabled={savingBand || !newBandName.trim()} className="gap-2 w-full">
                        {savingBand ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        追加
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="bg-card/60 border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">バンド詳細</CardTitle>
                      <CardDescription>承認状態・PA/照明メモ・ステージプロット</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!selectedBand ? (
                        <p className="text-sm text-muted-foreground">バンドを選択してください。</p>
                      ) : (
                        <form onSubmit={handleUpdateBand} className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <label className="space-y-1 block text-sm">
                              <span className="text-foreground">バンド名</span>
                              <Input
                                value={bandForm.name}
                                onChange={(e) => setBandForm((prev) => ({ ...prev, name: e.target.value }))}
                              />
                            </label>
                            <label className="space-y-2 block text-sm">
                              <span className="text-foreground">承認状態</span>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setBandForm((prev) => ({ ...prev, is_approved: !prev.is_approved }))}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                                    bandForm.is_approved
                                      ? "border-primary text-primary bg-primary/10"
                                      : "border-border text-muted-foreground hover:border-primary/40"
                                  )}
                                >
                                  {bandForm.is_approved ? <CheckCircle2 className="w-4 h-4" /> : <BadgeCheck className="w-4 h-4" />}
                                  {bandForm.is_approved ? "承認済み" : "未承認"}
                                </button>
                              </div>
                            </label>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <label className="space-y-1 block text-sm">
                              <span className="text-foreground">PAメモ</span>
                              <Textarea
                                rows={3}
                                value={bandForm.note_pa}
                                onChange={(e) => setBandForm((prev) => ({ ...prev, note_pa: e.target.value }))}
                                placeholder="マイアンプ / インプット本数 / 注意点など"
                              />
                            </label>
                            <label className="space-y-1 block text-sm">
                              <span className="text-foreground">照明メモ</span>
                              <Textarea
                                rows={3}
                                value={bandForm.note_lighting}
                                onChange={(e) => setBandForm((prev) => ({ ...prev, note_lighting: e.target.value }))}
                                placeholder="曲の雰囲気、色の希望など"
                              />
                            </label>
                          </div>

                          <label className="space-y-1 block text-sm">
                            <span className="text-foreground">ステージプロット / 機材図</span>
                            <Textarea
                              rows={3}
                              value={bandForm.stagePlotNote}
                              onChange={(e) => setBandForm((prev) => ({ ...prev, stagePlotNote: e.target.value }))}
                              placeholder="共有リンクやテキストで記載（画像URLでもOK）"
                            />
                          </label>

                          <div className="flex flex-wrap items-center gap-3">
                            <Button type="submit" disabled={savingBand} className="gap-2">
                              {savingBand ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PencilLine className="w-4 h-4" />}
                              バンド情報を保存
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setBandForm({
                                  name: selectedBand.name,
                                  is_approved: Boolean(selectedBand.is_approved),
                                  note_pa: selectedBand.note_pa ?? "",
                                  note_lighting: selectedBand.note_lighting ?? "",
                                  stagePlotNote:
                                    (selectedBand.stage_plot_data?.note as string) ??
                                    (selectedBand.stage_plot_data?.stage_plot as string) ??
                                    "",
                                });
                              }}
                            >
                              変更を戻す
                            </Button>
                          </div>
                        </form>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="bg-card/60 border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">メンバー</CardTitle>
                        <CardDescription>Discord連携を優先して表示します。</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {!selectedBand ? (
                          <p className="text-sm text-muted-foreground">バンドを選択してください。</p>
                        ) : (
                          <>
                            <form onSubmit={handleAddMember} className="space-y-3">
                              <div className="space-y-1 text-sm">
                                <span className="text-foreground">プロフィール</span>
                                <select
                                  required
                                  className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                                  value={memberForm.profileId}
                                  onChange={(e) => setMemberForm((prev) => ({ ...prev, profileId: e.target.value }))}
                                >
                                  <option value="">選択してください</option>
                                  {profiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>
                                      {profile.display_name}
                                      {profile.crew ? ` / ${profile.crew}` : ""}
                                    </option>
                                  ))}
                                </select>
                                {memberForm.profileId && (
                                  <p className="text-xs text-muted-foreground">
                                    Discord: {profilesMap.get(memberForm.profileId)?.discord ?? "未連携"}
                                  </p>
                                )}
                              </div>
                              <label className="space-y-1 block text-sm">
                                <span className="text-foreground">パート / 担当</span>
                                <Input
                                  required
                                  value={memberForm.instrument}
                                  onChange={(e) => setMemberForm((prev) => ({ ...prev, instrument: e.target.value }))}
                                  placeholder="Gt. / Vo. / Dr. など"
                                />
                              </label>
                              <Button
                                type="submit"
                                disabled={savingMember || !memberForm.profileId || !memberForm.instrument.trim()}
                                className="gap-2 w-full"
                              >
                                {savingMember ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                メンバーを追加
                              </Button>
                            </form>

                            <div className="space-y-2">
                              {selectedBandMembers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">追加されたメンバーはいません。</p>
                              ) : (
                                selectedBandMembers.map((member) => {
                                  const profile = profilesMap.get(member.user_id);
                                  return (
                                    <div
                                      key={member.id}
                                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                                    >
                                      <div className="space-y-1">
                                        <p className="font-medium text-sm">{profile?.display_name ?? "不明なユーザー"}</p>
                                        <p className="text-xs text-muted-foreground">{member.instrument}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Discord: {profile?.discord ?? "未連携"}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveMember(member.id)}
                                        className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                        aria-label="メンバーを削除"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-card/60 border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">セットリスト</CardTitle>
                        <CardDescription>演奏曲と所要時間を管理します。</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {!selectedBand ? (
                          <p className="text-sm text-muted-foreground">バンドを選択してください。</p>
                        ) : (
                          <>
                            <form onSubmit={handleAddSong} className="space-y-3">
                              <div className="grid md:grid-cols-2 gap-3">
                                <label className="space-y-1 block text-sm">
                                  <span className="text-foreground">曲名</span>
                                  <Input
                                    required
                                    value={songForm.title}
                                    onChange={(e) => setSongForm((prev) => ({ ...prev, title: e.target.value }))}
                                    placeholder="曲名を入力"
                                  />
                                </label>
                                <label className="space-y-1 block text-sm">
                                  <span className="text-foreground">アーティスト</span>
                                  <Input
                                    value={songForm.artist}
                                    onChange={(e) => setSongForm((prev) => ({ ...prev, artist: e.target.value }))}
                                    placeholder="任意"
                                  />
                                </label>
                              </div>
                              <div className="grid md:grid-cols-2 gap-3">
                                <label className="space-y-1 block text-sm">
                                  <span className="text-foreground">演奏時間（秒）</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={songForm.duration_sec}
                                    onChange={(e) => setSongForm((prev) => ({ ...prev, duration_sec: e.target.value }))}
                                    placeholder="未設定の場合はデフォルト時間"
                                  />
                                </label>
                                <label className="space-y-1 block text-sm">
                                  <span className="text-foreground">メモ</span>
                                  <Input
                                    value={songForm.memo}
                                    onChange={(e) => setSongForm((prev) => ({ ...prev, memo: e.target.value }))}
                                    placeholder="Key変更 / 繰り返し回数 など"
                                  />
                                </label>
                              </div>
                              <Button
                                type="submit"
                                disabled={savingSong || !songForm.title.trim()}
                                className="gap-2 w-full"
                              >
                                {savingSong ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                曲を追加
                              </Button>
                            </form>

                            <div className="space-y-2">
                              {selectedBandSongs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">セットリストがありません。</p>
                              ) : (
                                selectedBandSongs.map((song) => (
                                  <div
                                    key={song.id}
                                    className="flex items-start justify-between rounded-lg border border-border px-3 py-2"
                                  >
                                    <div className="space-y-1">
                                      <p className="font-medium text-sm">{song.title}</p>
                                      <p className="text-xs text-muted-foreground">{song.artist ?? "アーティスト未設定"}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {song.duration_sec ? `${song.duration_sec} 秒` : "時間未設定"}
                                      </p>
                                      {song.memo && <p className="text-xs text-muted-foreground">メモ: {song.memo}</p>}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSong(song.id)}
                                      className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                      aria-label="曲を削除"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}


