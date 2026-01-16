"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StagePlotPreview } from "@/components/StagePlotPreview";
import { toast } from "@/lib/toast";

type EventRow = {
  id: string;
  name: string;
  date: string;
};

type BandRow = {
  id: string;
  name: string;
  repertoire_status: string | null;
  representative_name: string | null;
  sound_note: string | null;
  lighting_note: string | null;
  general_note: string | null;
  lighting_total_min: number | null;
  stage_plot_data: Record<string, unknown> | null;
};

type SongRow = {
  id: string;
  band_id: string;
  title: string;
  artist: string | null;
  entry_type: "song" | "mc" | null;
  url: string | null;
  order_index: number | null;
  duration_sec: number | null;
  arrangement_note: string | null;
  lighting_spot: string | null;
  lighting_strobe: string | null;
  lighting_moving: string | null;
  lighting_color: string | null;
  memo: string | null;
  created_at?: string | null;
};

type BandMemberRow = {
  id: string;
  band_id: string;
  instrument: string | null;
  position_x: number | null;
  position_y: number | null;
  is_mc: boolean | null;
  monitor_request: string | null;
  monitor_note: string | null;
  order_index: number | null;
  profiles?:
    | {
        display_name: string | null;
        real_name: string | null;
        part: string | null;
      }
    | {
        display_name: string | null;
        real_name: string | null;
        part: string | null;
      }[]
    | null;
};

type StageItem = {
  id: string;
  label: string;
  dashed?: boolean;
  x: number;
  y: number;
};

type StageMember = {
  id: string;
  name: string;
  instrument: string | null;
  x: number;
  y: number;
  isMc?: boolean;
};

type MemberDetail = {
  id: string;
  name: string;
  instrument: string | null;
  monitorRequest: string | null;
  monitorNote: string | null;
  isMc: boolean;
  orderIndex: number | null;
};

type StageCategory = "drums" | "bass" | "guitar" | "keyboard" | "wind" | "vocal" | "other";

const stageSlots: Record<StageCategory, { x: number; y: number }[]> = {
  drums: [{ x: 52, y: 12 }],
  bass: [{ x: 30, y: 38 }],
  guitar: [
    { x: 70, y: 38 },
    { x: 76, y: 30 },
  ],
  keyboard: [
    { x: 62, y: 56 },
    { x: 50, y: 70 },
    { x: 42, y: 56 },
  ],
  vocal: [
    { x: 50, y: 84 },
    { x: 40, y: 84 },
    { x: 60, y: 84 },
  ],
  wind: [
    { x: 50, y: 62 },
    { x: 42, y: 62 },
    { x: 58, y: 62 },
    { x: 46, y: 68 },
    { x: 54, y: 68 },
    { x: 38, y: 68 },
    { x: 62, y: 68 },
    { x: 50, y: 74 },
    { x: 42, y: 74 },
    { x: 58, y: 74 },
    { x: 34, y: 74 },
    { x: 66, y: 74 },
    { x: 50, y: 78 },
    { x: 40, y: 78 },
    { x: 60, y: 78 },
  ],
  other: [
    { x: 18, y: 60 },
    { x: 82, y: 60 },
    { x: 18, y: 72 },
    { x: 82, y: 72 },
  ],
};

const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

const normalizePartText = (value: string | null | undefined) =>
  (value ?? "").toLowerCase().replace(/\s+/g, "");

const includesAny = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

const getStageCategory = (value: string | null | undefined): StageCategory => {
  const text = normalizePartText(value);
  if (!text) return "other";
  if (includesAny(text, ["dr", "drum", "ドラム"])) return "drums";
  if (text.startsWith("ba") || includesAny(text, ["bass", "ベース"])) return "bass";
  if (includesAny(text, ["gt", "gtr", "guitar", "ギター"])) return "guitar";
  if (
    includesAny(text, [
      "key",
      "keys",
      "keyboard",
      "piano",
      "キーボード",
      "ピアノ",
      "syn",
      "synth",
      "wsyn",
      "w.syn",
      "w.synth",
    ])
  ) {
    return "keyboard";
  }
  if (includesAny(text, ["vo", "vocal", "voca", "ボーカル", "歌"])) return "vocal";
  if (
    includesAny(text, [
      "sax",
      "tp",
      "tb",
      "trumpet",
      "trombone",
      "horn",
      "hr",
      "eup",
      "tu",
      "fl",
      "cl",
      "ob",
      "fg",
      "brass",
      "管",
    ])
  ) {
    return "wind";
  }
  return "other";
};

const getProfile = (row: BandMemberRow) =>
  Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null;

const formatDuration = (seconds: number | null) => {
  if (seconds == null) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const formatLightingChoice = (value: string | null) => {
  if (value === "o") return "○";
  if (value === "x") return "×";
  if (value === "auto") return "おまかせ";
  return "-";
};

const parseStageItems = (value: Record<string, unknown> | null | undefined): StageItem[] => {
  const rawItems = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item, index) => {
      const entry = item as {
        id?: string;
        label?: string;
        dashed?: boolean;
        x?: number;
        y?: number;
      };
      if (!entry.label) return null;
      return {
        id: entry.id ?? `stage-${index}`,
        label: entry.label,
        dashed: Boolean(entry.dashed),
        x: clampPercent(Number(entry.x ?? 50)),
        y: clampPercent(Number(entry.y ?? 50)),
      } satisfies StageItem;
    })
    .filter(Boolean) as StageItem[];
};

export default function AdminRepertoireViewPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;
  const searchParams = useSearchParams();
  const targetBandId = searchParams?.get("bandId") ?? null;

  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [members, setMembers] = useState<BandMemberRow[]>([]);
  const [activeBandId, setActiveBandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !isAdmin) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const eventRes = await supabase
          .from("events")
          .select("id, name, date")
          .eq("id", eventId)
          .maybeSingle();

        if (eventRes.error || !eventRes.data) {
          throw new Error("イベント情報の取得に失敗しました。");
        }

        const bandsRes = await supabase
          .from("bands")
          .select(
            "id, name, repertoire_status, representative_name, sound_note, lighting_note, general_note, lighting_total_min, stage_plot_data"
          )
          .eq("event_id", eventId)
          .eq("band_type", "event")
          .order("created_at", { ascending: true });

        if (bandsRes.error) {
          throw new Error("バンド情報の取得に失敗しました。");
        }

        const bandList = (bandsRes.data ?? []) as BandRow[];
        const bandIds = bandList.map((band) => band.id);

        let songsData: SongRow[] = [];
        let memberData: BandMemberRow[] = [];

        if (bandIds.length > 0) {
          const [songsRes, membersRes] = await Promise.all([
            supabase
              .from("songs")
              .select(
                "id, band_id, title, artist, entry_type, url, order_index, duration_sec, arrangement_note, lighting_spot, lighting_strobe, lighting_moving, lighting_color, memo, created_at"
              )
              .in("band_id", bandIds)
              .order("order_index", { ascending: true }),
            supabase
              .from("band_members")
              .select(
                "id, band_id, instrument, position_x, position_y, is_mc, monitor_request, monitor_note, order_index, profiles(display_name, real_name, part)"
              )
              .in("band_id", bandIds)
              .order("order_index", { ascending: true }),
          ]);

          if (songsRes.error) {
            throw new Error("曲情報の取得に失敗しました。");
          }
          if (membersRes.error) {
            throw new Error("メンバー情報の取得に失敗しました。");
          }

          songsData = (songsRes.data ?? []) as SongRow[];
          memberData = (membersRes.data ?? []) as BandMemberRow[];
        }

        if (cancelled) return;
        setEvent(eventRes.data as EventRow);
        setBands(bandList);
        setSongs(songsData);
        setMembers(memberData);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          const message =
            err instanceof Error ? err.message : "レパ表の取得に失敗しました。";
          setError(message);
          toast.error(message);
          setEvent(null);
          setBands([]);
          setSongs([]);
          setMembers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, isAdmin]);

  useEffect(() => {
    if (bands.length === 0) {
      setActiveBandId(null);
      return;
    }
    if (targetBandId && bands.some((band) => band.id === targetBandId)) {
      setActiveBandId(targetBandId);
      return;
    }
    setActiveBandId((prev) => (prev && bands.some((band) => band.id === prev) ? prev : bands[0].id));
  }, [bands, targetBandId]);

  const visibleBands = useMemo(
    () => (targetBandId ? bands.filter((band) => band.id === targetBandId) : bands),
    [bands, targetBandId]
  );

  const songsByBand = useMemo(() => {
    const grouped: Record<string, SongRow[]> = {};
    songs.forEach((song) => {
      if (!grouped[song.band_id]) grouped[song.band_id] = [];
      grouped[song.band_id].push(song);
    });
    Object.values(grouped).forEach((rows) => {
      rows.sort((a, b) => {
        const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      });
    });
    return grouped;
  }, [songs]);

  const memberDetailsByBand = useMemo(() => {
    const grouped: Record<string, MemberDetail[]> = {};
    members.forEach((row) => {
      const profile = getProfile(row);
      const name = profile?.real_name ?? profile?.display_name ?? "未登録";
      const instrument = row.instrument ?? profile?.part ?? null;
      if (!grouped[row.band_id]) grouped[row.band_id] = [];
      grouped[row.band_id].push({
        id: row.id,
        name,
        instrument,
        monitorRequest: row.monitor_request ?? null,
        monitorNote: row.monitor_note ?? null,
        isMc: Boolean(row.is_mc),
        orderIndex: row.order_index ?? null,
      });
    });
    Object.values(grouped).forEach((list) => {
      list.sort((a, b) => {
        const orderA = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, "ja");
      });
    });
    return grouped;
  }, [members]);

  const stageItemsByBand = useMemo(() => {
    const grouped: Record<string, StageItem[]> = {};
    bands.forEach((band) => {
      grouped[band.id] = parseStageItems(band.stage_plot_data);
    });
    return grouped;
  }, [bands]);

  const stageMembersByBand = useMemo(() => {
    const grouped: Record<string, StageMember[]> = {};
    const membersByBand: Record<string, BandMemberRow[]> = {};
    members.forEach((member) => {
      if (!membersByBand[member.band_id]) membersByBand[member.band_id] = [];
      membersByBand[member.band_id].push(member);
    });

    Object.entries(membersByBand).forEach(([bandId, bandMembers]) => {
      const counters: Record<StageCategory, number> = {
        drums: 0,
        bass: 0,
        guitar: 0,
        keyboard: 0,
        wind: 0,
        vocal: 0,
        other: 0,
      };

      grouped[bandId] = bandMembers.map((member) => {
        const profile = getProfile(member);
        const instrument = member.instrument ?? profile?.part ?? null;
        const name = profile?.real_name ?? profile?.display_name ?? "未登録";
        const category = getStageCategory(instrument || profile?.part);
        const index = counters[category] ?? 0;
        counters[category] = index + 1;
        const slot = stageSlots[category]?.[index];
        const fallback = {
          x: clampPercent(50 + ((index % 3) - 1) * 8),
          y: clampPercent(60 + Math.floor(index / 3) * 8),
        };
        const x = member.position_x ?? slot?.x ?? fallback.x;
        const y = member.position_y ?? slot?.y ?? fallback.y;
        return {
          id: member.id,
          name,
          instrument,
          x: clampPercent(Number(x ?? fallback.x)),
          y: clampPercent(Number(y ?? fallback.y)),
          isMc: Boolean(member.is_mc),
        };
      });
    });

    return grouped;
  }, [members]);

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
            <p className="text-sm text-muted-foreground">管理者にお問い合わせください。</p>
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
            title="レパ表（管理者ビュー）"
            description={event ? `${event.name} / ${event.date}` : "イベント情報を読み込んでいます"}
            backHref={`/admin/events/${eventId}`}
            backLabel="イベント管理へ戻る"
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {loading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  読み込み中...
                </div>
              ) : error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : visibleBands.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  バンドが登録されていません。
                </div>
              ) : (
                <Tabs value={activeBandId ?? undefined} onValueChange={setActiveBandId}>
                  <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
                    {visibleBands.map((band) => (
                      <TabsTrigger key={band.id} value={band.id} className="px-3">
                        {band.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {visibleBands.map((band) => {
                    const statusLabel =
                      band.repertoire_status === "submitted" ? "提出済み" : "下書き";
                    const bandSongs = songsByBand[band.id] ?? [];
                    const memberDetails = memberDetailsByBand[band.id] ?? [];
                    const stageItems = stageItemsByBand[band.id] ?? [];
                    const stageMembers = stageMembersByBand[band.id] ?? [];

                    return (
                      <TabsContent key={band.id} value={band.id} className="mt-6 space-y-6">
                        <Card className="bg-card/60">
                          <CardHeader className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <CardTitle className="text-xl">{band.name}</CardTitle>
                              <Badge variant={band.repertoire_status === "submitted" ? "default" : "secondary"}>
                                {statusLabel}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              代表者: {band.representative_name || "未設定"}
                            </div>
                          </CardHeader>
                        </Card>

                        <div className="grid gap-4 lg:grid-cols-3">
                          <Card className="bg-card/60">
                            <CardHeader>
                              <CardTitle className="text-base">共通指示</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {band.general_note || "未入力"}
                            </CardContent>
                          </Card>
                          <Card className="bg-card/60">
                            <CardHeader>
                              <CardTitle className="text-base">PA指示</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {band.sound_note || "未入力"}
                            </CardContent>
                          </Card>
                          <Card className="bg-card/60">
                            <CardHeader>
                              <CardTitle className="text-base">照明指示</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap space-y-2">
                              <div>{band.lighting_note || "未入力"}</div>
                              {band.lighting_total_min != null && (
                                <div className="text-xs text-muted-foreground">
                                  照明持ち時間: {band.lighting_total_min}分
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        <Card className="bg-card/60">
                          <CardHeader>
                            <CardTitle className="text-base">ステージ配置図</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <StagePlotPreview items={stageItems} members={stageMembers} />
                          </CardContent>
                        </Card>

                        <Card className="bg-card/60">
                          <CardHeader>
                            <CardTitle className="text-base">メンバー一覧</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="overflow-x-auto">
                              <table className="min-w-[720px] w-full text-sm">
                                <thead className="text-xs text-muted-foreground">
                                  <tr className="border-b border-border">
                                    <th className="py-2 text-left font-medium">パート</th>
                                    <th className="py-2 text-left font-medium">名前</th>
                                    <th className="py-2 text-left font-medium">MC</th>
                                    <th className="py-2 text-left font-medium">返し要望</th>
                                    <th className="py-2 text-left font-medium">備考</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {memberDetails.length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="py-3 text-muted-foreground">
                                        メンバーが登録されていません。
                                      </td>
                                    </tr>
                                  ) : (
                                    memberDetails.map((member) => (
                                      <tr key={member.id} className="border-b border-border/50">
                                        <td className="py-2 pr-4 text-muted-foreground">
                                          {member.instrument || "-"}
                                        </td>
                                        <td className="py-2 pr-4">{member.name}</td>
                                        <td className="py-2 pr-4">
                                          {member.isMc ? "○" : "-"}
                                        </td>
                                        <td className="py-2 pr-4 text-muted-foreground">
                                          {member.monitorRequest || "-"}
                                        </td>
                                        <td className="py-2 text-muted-foreground">
                                          {member.monitorNote || "-"}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-card/60">
                          <CardHeader>
                            <CardTitle className="text-base">セトリ・指示</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="overflow-x-auto">
                              <table className="min-w-[980px] w-full text-sm">
                                <thead className="text-xs text-muted-foreground">
                                  <tr className="border-b border-border">
                                    <th className="py-2 text-left font-medium">#</th>
                                    <th className="py-2 text-left font-medium">種別</th>
                                    <th className="py-2 text-left font-medium">曲名 / MC</th>
                                    <th className="py-2 text-left font-medium">アーティスト</th>
                                    <th className="py-2 text-left font-medium">時間</th>
                                    <th className="py-2 text-left font-medium">URL</th>
                                    <th className="py-2 text-left font-medium">アレンジ</th>
                                    <th className="py-2 text-left font-medium">PA指示</th>
                                    <th className="py-2 text-left font-medium">スポット</th>
                                    <th className="py-2 text-left font-medium">ストロボ</th>
                                    <th className="py-2 text-left font-medium">ムービング</th>
                                    <th className="py-2 text-left font-medium">色</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bandSongs.length === 0 ? (
                                    <tr>
                                      <td colSpan={12} className="py-3 text-muted-foreground">
                                        セトリが登録されていません。
                                      </td>
                                    </tr>
                                  ) : (
                                    bandSongs.map((song, index) => (
                                      <tr key={song.id} className="border-b border-border/50 align-top">
                                        <td className="py-2 pr-2 text-muted-foreground">
                                          {String(index + 1).padStart(2, "0")}
                                        </td>
                                        <td className="py-2 pr-2">
                                          <Badge variant="outline">
                                            {song.entry_type === "mc" ? "MC" : "曲"}
                                          </Badge>
                                        </td>
                                        <td className="py-2 pr-3 font-medium">
                                          {song.title || "未入力"}
                                        </td>
                                        <td className="py-2 pr-3 text-muted-foreground">
                                          {song.entry_type === "mc" ? "-" : song.artist || "-"}
                                        </td>
                                        <td className="py-2 pr-3 text-muted-foreground">
                                          {formatDuration(song.duration_sec)}
                                        </td>
                                        <td className="py-2 pr-3">
                                          {song.url ? (
                                            <Link
                                              href={song.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
                                            >
                                              URL
                                              <ExternalLink className="h-3 w-3" />
                                            </Link>
                                          ) : (
                                            <span className="text-muted-foreground">-</span>
                                          )}
                                        </td>
                                        <td className="py-2 pr-3 text-muted-foreground whitespace-pre-wrap">
                                          {song.arrangement_note || "-"}
                                        </td>
                                        <td className="py-2 pr-3 text-muted-foreground whitespace-pre-wrap">
                                          {song.memo || "-"}
                                        </td>
                                        <td className="py-2 pr-3 text-muted-foreground">
                                          {formatLightingChoice(song.lighting_spot)}
                                        </td>
                                        <td className="py-2 pr-3 text-muted-foreground">
                                          {formatLightingChoice(song.lighting_strobe)}
                                        </td>
                                        <td className="py-2 pr-3 text-muted-foreground">
                                          {formatLightingChoice(song.lighting_moving)}
                                        </td>
                                        <td className="py-2 text-muted-foreground">
                                          {song.lighting_color || "-"}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
