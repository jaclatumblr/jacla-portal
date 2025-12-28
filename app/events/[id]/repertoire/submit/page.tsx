"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  name: string;
  date: string;
};

type BandRow = {
  id: string;
  name: string;
  created_by: string | null;
  repertoire_status: string | null;
};

type EntryType = "song" | "mc";
type RepertoireStatus = "draft" | "submitted";

type SongRow = {
  id: string;
  band_id: string;
  title: string;
  artist: string | null;
  entry_type: EntryType | null;
  url: string | null;
  order_index: number | null;
  duration_sec: number | null;
  memo: string | null;
  created_at?: string | null;
};

type SongEntry = {
  id: string;
  band_id: string;
  entry_type: EntryType;
  title: string;
  artist: string;
  url: string;
  durationMin: string;
  durationSec: string;
  memo: string;
  order_index: number | null;
};

const statusOptions: { value: RepertoireStatus; label: string }[] = [
  { value: "draft", label: "下書き" },
  { value: "submitted", label: "提出済み" },
];

const entryTypeLabels: Record<EntryType, string> = {
  song: "曲",
  mc: "MC",
};

const createTempId = () => `temp-${crypto.randomUUID()}`;

const toDurationInputs = (duration: number | null) => {
  if (duration == null) return { durationMin: "", durationSec: "" };
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return {
    durationMin: String(minutes),
    durationSec: String(seconds),
  };
};

const toDurationSec = (minutes: string, seconds: string) => {
  const minValue = Number.parseInt(minutes, 10);
  const secValue = Number.parseInt(seconds, 10);
  if (Number.isNaN(minValue) && Number.isNaN(secValue)) return null;
  const safeMin = Number.isNaN(minValue) ? 0 : Math.max(0, minValue);
  const safeSec = Number.isNaN(secValue) ? 0 : Math.max(0, Math.min(59, secValue));
  return safeMin * 60 + safeSec;
};

const normalizeSongs = (rows: SongRow[]): SongEntry[] =>
  rows.map((row, index) => {
    const durationInputs = toDurationInputs(row.duration_sec ?? null);
    return {
      id: row.id,
      band_id: row.band_id,
      entry_type: row.entry_type ?? "song",
      title: row.title ?? "",
      artist: row.artist ?? "",
      url: row.url ?? "",
      durationMin: durationInputs.durationMin,
      durationSec: durationInputs.durationSec,
      memo: row.memo ?? "",
      order_index: row.order_index ?? index + 1,
    };
  });

const isTemp = (id: string) => id.startsWith("temp-");

export default function RepertoireSubmitPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;
  const { session } = useAuth();
  const { isAdmin, loading: roleLoading } = useRoleFlags();
  const userId = session?.user.id;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [allBands, setAllBands] = useState<BandRow[]>([]);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [songCounts, setSongCounts] = useState<Record<string, number>>({});
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [repertoireStatus, setRepertoireStatus] =
    useState<RepertoireStatus>("draft");
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [newBandName, setNewBandName] = useState("");
  const [creatingBand, setCreatingBand] = useState(false);
  const [createBandError, setCreateBandError] = useState<string | null>(null);
  const [joinBandId, setJoinBandId] = useState("");
  const [joinInstrument, setJoinInstrument] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [fetchingMeta, setFetchingMeta] = useState<Record<string, boolean>>({});
  const draggingId = useRef<string | null>(null);
  const urlFetchTimers = useRef<Map<string, number>>(new Map());

  const selectedBand = useMemo(
    () => bands.find((band) => band.id === selectedBandId) ?? null,
    [bands, selectedBandId]
  );

  const joinableBands = useMemo(() => {
    if (allBands.length === 0) return [];
    const editableIds = new Set(bands.map((band) => band.id));
    return allBands.filter((band) => !editableIds.has(band.id));
  }, [allBands, bands]);

  const bandCountLabel = (bandId: string) => songCounts[bandId] ?? 0;

  const orderedSongs = useMemo(
    () =>
      [...songs].sort((a, b) => {
        const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      }),
    [songs]
  );

  const loadSongs = useCallback(async (bandId: string) => {
    setSongsLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("songs")
      .select(
        "id, band_id, title, artist, entry_type, url, order_index, duration_sec, memo, created_at"
      )
      .eq("band_id", bandId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setSongs([]);
      setError("レパートリーの取得に失敗しました。");
    } else {
      setSongs(normalizeSongs((data ?? []) as SongRow[]));
    }
    setRemovedIds([]);
    setSongsLoading(false);
  }, []);

  const refreshCounts = useCallback(async (bandIds: string[]) => {
    if (bandIds.length === 0) {
      setSongCounts({});
      return;
    }
    const { data, error } = await supabase
      .from("songs")
      .select("id, band_id, entry_type")
      .in("band_id", bandIds);
    if (error) {
      console.error(error);
      return;
    }
    const counts: Record<string, number> = {};
    (data ?? []).forEach((row) => {
      const entry = row as { band_id: string; entry_type?: string | null };
      if (entry.entry_type === "mc") return;
      counts[entry.band_id] = (counts[entry.band_id] ?? 0) + 1;
    });
    setSongCounts(counts);
  }, []);

  const handleCreateBand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newBandName.trim();
    if (!eventId || !name || creatingBand) return;
    if (!userId) {
      setCreateBandError("ログイン情報を確認できません。");
      return;
    }
    setCreatingBand(true);
    setCreateBandError(null);
    const { data, error } = await supabase
      .from("bands")
      .insert([
        {
          event_id: eventId,
          name,
          created_by: userId,
          is_approved: false,
        },
      ])
      .select("id, name, created_by, repertoire_status")
      .maybeSingle();
    if (error || !data) {
      console.error(error);
      setCreateBandError("バンドの作成に失敗しました。");
      setCreatingBand(false);
      return;
    }
    const created = data as BandRow;
    setAllBands((prev) => [...prev, created]);
    setBands((prev) => [...prev, created]);
    setSelectedBandId(created.id);
    setSongCounts((prev) => ({ ...prev, [created.id]: 0 }));
    setNewBandName("");
    setCreatingBand(false);
  };

  const handleJoinBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || joining) return;
    if (!userId) {
      setJoinError("ログイン情報を確認できません。");
      return;
    }
    const bandId = joinBandId;
    const instrument = joinInstrument.trim();
    if (!bandId || !instrument) {
      setJoinError("参加するバンドと担当楽器を入力してください。");
      return;
    }
    setJoining(true);
    setJoinError(null);
    const { error } = await supabase.from("band_members").insert([
      {
        band_id: bandId,
        user_id: userId,
        instrument,
      },
    ]);
    if (error) {
      console.error(error);
      setJoinError("バンドへの参加に失敗しました。");
      setJoining(false);
      return;
    }
    const joinedBand = allBands.find((band) => band.id === bandId);
    if (joinedBand) {
      setBands((prev) =>
        prev.some((band) => band.id === joinedBand.id) ? prev : [...prev, joinedBand]
      );
      setSelectedBandId(joinedBand.id);
      await refreshCounts(
        Array.from(new Set([...bands.map((band) => band.id), joinedBand.id]))
      );
    }
    setJoinBandId("");
    setJoinInstrument("");
    setJoining(false);
  };

  useEffect(() => {
    if (!eventId || roleLoading) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setSaveMessage(null);

      const [eventRes, bandsRes] = await Promise.all([
        supabase.from("events").select("id, name, date").eq("id", eventId).maybeSingle(),
        supabase
          .from("bands")
          .select("id, name, created_by, repertoire_status")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        setError("イベント情報の取得に失敗しました。");
        setEvent(null);
      } else {
        setEvent(eventRes.data as EventRow);
      }

      if (bandsRes.error) {
        console.error(bandsRes.error);
        setAllBands([]);
        setBands([]);
        setSelectedBandId(null);
      } else {
        const allBandList = (bandsRes.data ?? []) as BandRow[];
        setAllBands(allBandList);

        let editableBands = allBandList;

        if (!isAdmin) {
          if (!userId || allBandList.length === 0) {
            editableBands = [];
          } else {
            const { data: memberData, error: memberError } = await supabase
              .from("band_members")
              .select("band_id")
              .eq("user_id", userId)
              .in(
                "band_id",
                allBandList.map((band) => band.id)
              );
            if (memberError) {
              console.error(memberError);
              editableBands = [];
            } else {
              const memberSet = new Set(
                (memberData ?? []).map((row) => (row as { band_id: string }).band_id)
              );
              editableBands = allBandList.filter(
                (band) => band.created_by === userId || memberSet.has(band.id)
              );
            }
          }
        }

        setBands(editableBands);
        setSelectedBandId((prev) => prev ?? editableBands[0]?.id ?? null);
        await refreshCounts(editableBands.map((band) => band.id));
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, isAdmin, refreshCounts, roleLoading, userId]);

  useEffect(() => {
    if (!selectedBandId) return;
    void loadSongs(selectedBandId);
  }, [loadSongs, selectedBandId]);

  useEffect(() => {
    if (!selectedBand) return;
    const nextStatus =
      (selectedBand.repertoire_status as RepertoireStatus | null) ?? "draft";
    setRepertoireStatus(nextStatus);
  }, [selectedBand]);

  useEffect(() => {
    return () => {
      urlFetchTimers.current.forEach((timer) => window.clearTimeout(timer));
      urlFetchTimers.current.clear();
    };
  }, []);

  const updateSongField = <K extends keyof SongEntry>(
    id: string,
    key: K,
    value: SongEntry[K]
  ) => {
    setSongs((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry))
    );
  };

  const scheduleMetadataFetch = (id: string, url: string, entryType: EntryType) => {
    if (entryType !== "song") return;
    if (!url.trim()) return;

    const existing = urlFetchTimers.current.get(id);
    if (existing) {
      window.clearTimeout(existing);
    }

    const timer = window.setTimeout(async () => {
      setFetchingMeta((prev) => ({ ...prev, [id]: true }));
      try {
        const res = await fetch("/api/repertoire/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          title?: string | null;
          artist?: string | null;
        };
        setSongs((prev) =>
          prev.map((entry) => {
            if (entry.id !== id || entry.url.trim() !== url.trim()) return entry;
            const next = { ...entry };
            if (!next.title.trim() && data.title) {
              next.title = data.title;
            }
            if (!next.artist.trim() && data.artist) {
              next.artist = data.artist;
            }
            return next;
          })
        );
      } catch {
        // noop
      } finally {
        setFetchingMeta((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }, 700);

    urlFetchTimers.current.set(id, timer);
  };

  const addEntry = (entryType: EntryType) => {
    if (!selectedBandId) return;
    setSaveMessage(null);
    const newEntry: SongEntry = {
      id: createTempId(),
      band_id: selectedBandId,
      entry_type: entryType,
      title: entryType === "mc" ? "MC" : "",
      artist: "",
      url: "",
      durationMin: "",
      durationSec: "",
      memo: "",
      order_index: songs.length + 1,
    };
    setSongs((prev) => [...prev, newEntry]);
  };

  const removeEntry = (id: string) => {
    setSaveMessage(null);
    setSongs((prev) => prev.filter((entry) => entry.id !== id));
    if (!isTemp(id)) {
      setRemovedIds((prev) => [...prev, id]);
    }
  };

  const moveEntry = (fromIndex: number, toIndex: number) => {
    setSongs((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next.map((entry, index) => ({ ...entry, order_index: index + 1 }));
    });
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId.current) return;
    const fromIndex = songs.findIndex((entry) => entry.id === draggingId.current);
    const toIndex = songs.findIndex((entry) => entry.id === targetId);
    draggingId.current = null;
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    moveEntry(fromIndex, toIndex);
  };

  const handleSave = async () => {
    if (!selectedBandId || saving) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    const payloads = orderedSongs.map((entry, index) => ({
      id: entry.id,
      band_id: selectedBandId,
      title: entry.title.trim() || (entry.entry_type === "mc" ? "MC" : ""),
      artist: entry.entry_type === "mc" ? null : entry.artist.trim() || null,
      entry_type: entry.entry_type,
      url: entry.entry_type === "mc" ? null : entry.url.trim() || null,
      order_index: index + 1,
      duration_sec: toDurationSec(entry.durationMin, entry.durationSec),
      memo: entry.memo.trim() || null,
    }));

    const updates = payloads.filter((entry) => !isTemp(entry.id));
    const inserts = payloads.filter((entry) => isTemp(entry.id)).map(({ id, ...rest }) => rest);

    if (removedIds.length > 0) {
      const { error } = await supabase.from("songs").delete().in("id", removedIds);
      if (error) {
        console.error(error);
        setError("削除に失敗しました。");
        setSaving(false);
        return;
      }
    }

    if (updates.length > 0) {
      const { error } = await supabase.from("songs").upsert(updates, { onConflict: "id" });
      if (error) {
        console.error(error);
        setError("更新に失敗しました。");
        setSaving(false);
        return;
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("songs").insert(inserts);
      if (error) {
        console.error(error);
        setError("追加に失敗しました。");
        setSaving(false);
        return;
      }
    }

    if (selectedBand && selectedBand.repertoire_status !== repertoireStatus) {
      const { error } = await supabase
        .from("bands")
        .update({ repertoire_status: repertoireStatus })
        .eq("id", selectedBand.id);
      if (error) {
        console.error(error);
        setError("提出状態の更新に失敗しました。");
        setSaving(false);
        return;
      }
      setBands((prev) =>
        prev.map((band) =>
          band.id === selectedBand.id
            ? { ...band, repertoire_status: repertoireStatus }
            : band
        )
      );
    }

    await loadSongs(selectedBandId);
    await refreshCounts(bands.map((band) => band.id));
    setSaveMessage("保存しました。");
    setSaving(false);
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
                <Link href={`/events/${eventId}`} className="hover:text-primary transition-colors">
                  イベント詳細に戻る
                </Link>
              </div>
              <div className="max-w-4xl mt-6">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">
                  REPERTOIRE SUBMIT
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">
                  レパ表提出
                </h1>
                {event && (
                  <p className="text-muted-foreground text-sm md:text-base">
                    {event.name} / {event.date}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {saveMessage && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-sm">
                  {saveMessage}
                </div>
              )}

              <div className="grid lg:grid-cols-[0.9fr,1.6fr] gap-6">
                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">バンド一覧</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        読み込み中...
                      </div>
                    ) : bands.length === 0 ? (
                      <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                        編集できるバンドがありません。
                      </div>
                    ) : (
                      bands.map((band) => {
                        const selected = band.id === selectedBandId;
                        const status = (band.repertoire_status as RepertoireStatus | null) ?? "draft";
                        return (
                          <button
                            key={band.id}
                            type="button"
                            onClick={() => setSelectedBandId(band.id)}
                            className={cn(
                              "w-full text-left rounded-lg border border-border px-4 py-3 transition-colors",
                              selected
                                ? "border-primary/50 bg-primary/10"
                                : "bg-card/60 hover:bg-muted/40"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{band.name}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  曲数: {bandCountLabel(band.id)}
                                </div>
                              </div>
                              <Badge variant={status === "submitted" ? "default" : "secondary"}>
                                {status === "submitted" ? "提出済み" : "下書き"}
                              </Badge>
                            </div>
                          </button>
                        );
                      })
                    )}

                    <div className="pt-3 border-t border-border/60 space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">既存バンドに参加する</p>
                        {joinableBands.length === 0 ? (
                          <p className="text-xs text-muted-foreground">参加できるバンドがありません。</p>
                        ) : (
                          <form onSubmit={handleJoinBand} className="flex flex-col gap-2">
                            <select
                              value={joinBandId}
                              onChange={(event) => {
                                setJoinBandId(event.target.value);
                                if (joinError) setJoinError(null);
                              }}
                              className="h-10 w-full rounded-md border border-input bg-card px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            >
                              <option value="">バンドを選択</option>
                              {joinableBands.map((band) => (
                                <option key={band.id} value={band.id}>
                                  {band.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                value={joinInstrument}
                                onChange={(event) => {
                                  setJoinInstrument(event.target.value);
                                  if (joinError) setJoinError(null);
                                }}
                                placeholder="担当楽器/パート"
                              />
                              <Button
                                type="submit"
                                disabled={!joinBandId || !joinInstrument.trim() || joining}
                                className="gap-2"
                              >
                                {joining ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Plus className="w-4 h-4" />
                                )}
                                参加する
                              </Button>
                            </div>
                            {joinError && <p className="text-xs text-destructive">{joinError}</p>}
                          </form>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">新しくバンドを作成する</p>
                        <form onSubmit={handleCreateBand} className="flex flex-col gap-2">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                              value={newBandName}
                              onChange={(event) => {
                                setNewBandName(event.target.value);
                                if (createBandError) setCreateBandError(null);
                              }}
                              placeholder="バンド名を入力"
                            />
                            <Button
                              type="submit"
                              disabled={!newBandName.trim() || creatingBand}
                              className="gap-2"
                            >
                              {creatingBand ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                              作成
                            </Button>
                          </div>
                          {createBandError && (
                            <p className="text-xs text-destructive">{createBandError}</p>
                          )}
                        </form>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/60 border-border">
                  <CardHeader className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-lg">セットリスト</CardTitle>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={repertoireStatus}
                          onChange={(event) =>
                            setRepertoireStatus(event.target.value as RepertoireStatus)
                          }
                          className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                          disabled={!selectedBandId}
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          onClick={handleSave}
                          disabled={!selectedBandId || saving}
                          className="gap-2"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          保存
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addEntry("song")}
                        disabled={!selectedBandId}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        曲を追加
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addEntry("mc")}
                        disabled={!selectedBandId}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        MCを追加
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {!selectedBandId ? (
                      <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                        バンドを選択してください。
                      </div>
                    ) : songsLoading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        読み込み中...
                      </div>
                    ) : orderedSongs.length === 0 ? (
                      <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                        まだ曲が登録されていません。
                      </div>
                    ) : (
                      orderedSongs.map((entry, index) => {
                        const isSong = entry.entry_type === "song";
                        return (
                          <div
                            key={entry.id}
                            className="rounded-lg border border-border bg-card/70 px-4 py-3 space-y-3"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => handleDrop(entry.id)}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground"
                                draggable
                                onDragStart={() => {
                                  draggingId.current = entry.id;
                                }}
                                onDragEnd={() => {
                                  draggingId.current = null;
                                }}
                                aria-label="並び替え"
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                              <span className="text-xs text-muted-foreground w-8">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <Badge variant="outline">{entryTypeLabels[entry.entry_type]}</Badge>
                              <div className="flex-1">
                                <Input
                                  value={entry.title}
                                  onChange={(event) =>
                                    updateSongField(entry.id, "title", event.target.value)
                                  }
                                  placeholder={entry.entry_type === "mc" ? "MCタイトル" : "曲名"}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => moveEntry(index, Math.max(0, index - 1))}
                                  disabled={index === 0}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    moveEntry(index, Math.min(orderedSongs.length - 1, index + 1))
                                  }
                                  disabled={index === orderedSongs.length - 1}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeEntry(entry.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="space-y-1 text-sm">
                                <span className="text-muted-foreground">アーティスト</span>
                                <Input
                                  value={entry.artist}
                                  onChange={(event) =>
                                    updateSongField(entry.id, "artist", event.target.value)
                                  }
                                  disabled={!isSong}
                                  placeholder={isSong ? "アーティスト" : "-"}
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-muted-foreground">URL</span>
                                <div className="relative">
                                  <Input
                                    value={entry.url}
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      updateSongField(entry.id, "url", nextValue);
                                      scheduleMetadataFetch(entry.id, nextValue, entry.entry_type);
                                    }}
                                    disabled={!isSong}
                                    placeholder={isSong ? "YouTube / Spotify / Apple Music" : "-"}
                                  />
                                  {fetchingMeta[entry.id] && (
                                    <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                                  )}
                                </div>
                              </label>
                            </div>

                            <div className="grid gap-3 md:grid-cols-[160px,1fr]">
                              <label className="space-y-1 text-sm">
                                <span className="text-muted-foreground">時間(分:秒)</span>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={entry.durationMin}
                                    onChange={(event) =>
                                      updateSongField(entry.id, "durationMin", event.target.value)
                                    }
                                    className="w-20"
                                  />
                                  <span className="text-muted-foreground">:</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={entry.durationSec}
                                    onChange={(event) =>
                                      updateSongField(entry.id, "durationSec", event.target.value)
                                    }
                                    className="w-20"
                                  />
                                </div>
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-muted-foreground">メモ</span>
                                <Textarea
                                  rows={2}
                                  value={entry.memo}
                                  onChange={(event) =>
                                    updateSongField(entry.id, "memo", event.target.value)
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
