"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Lightbulb,
  Monitor,
  Music,
  Users,
} from "@/lib/icons";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { StagePlotPreviewTabs } from "@/components/StagePlotPreviewTabs";
import { applyStagePlotAssignments, readStagePlotData } from "@/lib/stagePlot";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type {
  BandMemberDetail,
  SongRow as InstructionSongRow,
  StageItem,
  StageMember,
  StagePlot,
} from "@/app/types/instructions";

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
  general_note: string | null;
  sound_note: string | null;
  lighting_note: string | null;
  lighting_total_min: number | null;
  stage_plot_data?: Record<string, unknown> | null;
};

type SongQueryRow = {
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
  created_at: string | null;
};

type MemberProfileRow = {
  display_name: string | null;
  real_name: string | null;
  part: string | null;
};

type MemberQueryRow = {
  id: string;
  band_id: string;
  instrument: string | null;
  position_x: number | null;
  position_y: number | null;
  is_mc: boolean | null;
  monitor_request: string | null;
  monitor_note: string | null;
  order_index: number | null;
  profiles?: MemberProfileRow | MemberProfileRow[] | null;
};

const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

const noteText = (value: string | null | undefined) => (hasText(value) ? value!.trim() : "未入力");

const formatDuration = (seconds: number | null) => {
  if (seconds == null) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const formatLightingChoice = (value: string | null) => {
  if (!value) return "-";
  if (value === "o") return "あり";
  if (value === "x") return "なし";
  if (value === "auto") return "おまかせ";
  return value;
};

const statusLabel = (status: string | null) => (status === "submitted" ? "提出済み" : "下書き");

const songTitle = (song: InstructionSongRow) =>
  song.title?.trim() || (song.entry_type === "mc" ? "MC" : "Untitled");

const resolveMemberProfile = (profiles: MemberQueryRow["profiles"]) => {
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
};

const stagePlotDataExists = (value: Record<string, unknown> | null | undefined) => {
  if (!value || typeof value !== "object") return false;

  const raw = value as {
    plots?: unknown;
    items?: unknown;
    memberPositions?: unknown;
    songPlotAssignments?: unknown;
    allowEmpty?: unknown;
  };

  if (Array.isArray(raw.plots) || Array.isArray(raw.items) || raw.allowEmpty === true) {
    return true;
  }

  if (
    raw.memberPositions &&
    typeof raw.memberPositions === "object" &&
    Object.keys(raw.memberPositions).length > 0
  ) {
    return true;
  }

  if (
    raw.songPlotAssignments &&
    typeof raw.songPlotAssignments === "object" &&
    Object.keys(raw.songPlotAssignments).length > 0
  ) {
    return true;
  }

  return false;
};

const formatLightingSummary = (song: InstructionSongRow) => {
  const parts: string[] = [];
  if (song.lighting_spot) parts.push(`Spot: ${formatLightingChoice(song.lighting_spot)}`);
  if (song.lighting_strobe) parts.push(`Strobe: ${formatLightingChoice(song.lighting_strobe)}`);
  if (song.lighting_moving) parts.push(`Moving: ${formatLightingChoice(song.lighting_moving)}`);
  if (hasText(song.lighting_color)) parts.push(`Color: ${song.lighting_color!.trim()}`);
  return parts.length > 0 ? parts.join(" / ") : "未入力";
};

export default function RepertoireViewPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;
  const searchParams = useSearchParams();
  const targetBandId = searchParams?.get("bandId") ?? null;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [songsByBand, setSongsByBand] = useState<Record<string, InstructionSongRow[]>>({});
  const [memberDetailsByBand, setMemberDetailsByBand] = useState<Record<string, BandMemberDetail[]>>(
    {}
  );
  const [stageMembersByBand, setStageMembersByBand] = useState<Record<string, StageMember[]>>({});
  const [stagePlotsByBand, setStagePlotsByBand] = useState<Record<string, StagePlot[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedBands, setExpandedBands] = useState<Record<string, boolean>>({});

  const visibleBands = useMemo(
    () => (targetBandId ? bands.filter((band) => band.id === targetBandId) : bands),
    [bands, targetBandId]
  );

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const [eventRes, bandsRes] = await Promise.all([
        supabase.from("events").select("id, name, date").eq("id", eventId).maybeSingle(),
        supabase
          .from("bands")
          .select(
            "id, name, repertoire_status, representative_name, general_note, sound_note, lighting_note, lighting_total_min, stage_plot_data"
          )
          .eq("event_id", eventId)
          .eq("band_type", "event")
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        toast.error("イベント情報の取得に失敗しました。");
        setEvent(null);
      } else {
        setEvent(eventRes.data as EventRow);
      }

      if (bandsRes.error) {
        console.error(bandsRes.error);
        toast.error("参加バンド情報の取得に失敗しました。");
        setBands([]);
        setSongsByBand({});
        setMemberDetailsByBand({});
        setStageMembersByBand({});
        setStagePlotsByBand({});
        setLoading(false);
        return;
      }

      const bandList = (bandsRes.data ?? []) as BandRow[];
      setBands(bandList);

      const bandIds = bandList.map((band) => band.id);
      if (bandIds.length === 0) {
        setSongsByBand({});
        setMemberDetailsByBand({});
        setStageMembersByBand({});
        setStagePlotsByBand({});
        setLoading(false);
        return;
      }

      const [songsRes, membersRes] = await Promise.all([
        supabase
          .from("songs")
          .select(
            "id, band_id, title, artist, entry_type, url, order_index, duration_sec, arrangement_note, lighting_spot, lighting_strobe, lighting_moving, lighting_color, memo, created_at"
          )
          .in("band_id", bandIds),
        supabase
          .from("band_members")
          .select(
            "id, band_id, instrument, position_x, position_y, is_mc, monitor_request, monitor_note, order_index, profiles(display_name, real_name, part)"
          )
          .in("band_id", bandIds),
      ]);

      if (cancelled) return;

      if (songsRes.error) {
        console.error(songsRes.error);
        toast.error("セットリストの取得に失敗しました。");
      }

      if (membersRes.error) {
        console.error(membersRes.error);
        toast.error("メンバー情報の取得に失敗しました。");
      }

      const groupedSongs: Record<string, SongQueryRow[]> = {};
      ((songsRes.data ?? []) as SongQueryRow[]).forEach((row) => {
        if (!groupedSongs[row.band_id]) groupedSongs[row.band_id] = [];
        groupedSongs[row.band_id].push(row);
      });

      Object.values(groupedSongs).forEach((rows) => {
        rows.sort((a, b) => {
          const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        });
      });

      const groupedMembers: Record<string, MemberQueryRow[]> = {};
      ((membersRes.data ?? []) as MemberQueryRow[]).forEach((row) => {
        if (!groupedMembers[row.band_id]) groupedMembers[row.band_id] = [];
        groupedMembers[row.band_id].push(row);
      });

      Object.values(groupedMembers).forEach((rows) => {
        rows.sort((a, b) => {
          const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a.id.localeCompare(b.id);
        });
      });

      const nextSongsByBand: Record<string, InstructionSongRow[]> = {};
      const nextMemberDetailsByBand: Record<string, BandMemberDetail[]> = {};
      const nextStageMembersByBand: Record<string, StageMember[]> = {};
      const nextStagePlotsByBand: Record<string, StagePlot[]> = {};

      bandList.forEach((band) => {
        const baseSongs = (groupedSongs[band.id] ?? []) as InstructionSongRow[];
        const memberRows = groupedMembers[band.id] ?? [];
        const hasStagePlotData = stagePlotDataExists(band.stage_plot_data);
        const plotData = hasStagePlotData
          ? readStagePlotData<StageItem>(band.stage_plot_data)
          : { plots: [] as StagePlot[], songPlotAssignments: {} as Record<string, string> };

        nextStagePlotsByBand[band.id] = plotData.plots as StagePlot[];
        nextSongsByBand[band.id] =
          plotData.plots.length > 0
            ? (applyStagePlotAssignments(
                baseSongs,
                plotData.plots,
                plotData.songPlotAssignments
              ) as InstructionSongRow[])
            : baseSongs.map((song) => ({ ...song, stagePlotId: null }));

        nextMemberDetailsByBand[band.id] = memberRows.map((row, index) => {
          const profile = resolveMemberProfile(row.profiles);
          return {
            id: row.id,
            name: profile?.real_name ?? profile?.display_name ?? `Member ${index + 1}`,
            instrument: row.instrument?.trim() || profile?.part?.trim() || `Part ${index + 1}`,
            monitorRequest: hasText(row.monitor_request) ? row.monitor_request!.trim() : null,
            monitorNote: hasText(row.monitor_note) ? row.monitor_note!.trim() : null,
            isMc: Boolean(row.is_mc),
            orderIndex: row.order_index ?? index + 1,
          };
        });

        nextStageMembersByBand[band.id] = memberRows.map((row, index) => {
          const profile = resolveMemberProfile(row.profiles);
          const fallbackX = clampPercent(50 + ((index % 3) - 1) * 8);
          const fallbackY = clampPercent(60 + Math.floor(index / 3) * 8);

          return {
            id: row.id,
            name: profile?.real_name ?? profile?.display_name ?? `Member ${index + 1}`,
            instrument: row.instrument?.trim() || profile?.part?.trim() || `Part ${index + 1}`,
            x: clampPercent(Number(row.position_x ?? fallbackX)),
            y: clampPercent(Number(row.position_y ?? fallbackY)),
            isMc: Boolean(row.is_mc),
          };
        });
      });

      setSongsByBand(nextSongsByBand);
      setMemberDetailsByBand(nextMemberDetailsByBand);
      setStageMembersByBand(nextStageMembersByBand);
      setStagePlotsByBand(nextStagePlotsByBand);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (visibleBands.length !== 1) return;
    const onlyBandId = visibleBands[0]?.id;
    if (!onlyBandId) return;
    queueMicrotask(() => {
      setExpandedBands((prev) => (prev[onlyBandId] ? prev : { ...prev, [onlyBandId]: true }));
    });
  }, [visibleBands]);

  const pageTitle =
    visibleBands.length === 1 ? `${visibleBands[0].name} のレパ表` : "レパ表一覧";

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Repertoire"
            title={pageTitle}
            description={event ? `${event.name} / ${event.date}` : "参加バンドの提出内容を表示します。"}
            backHref={`/events/${eventId}`}
            backLabel="イベント詳細に戻る"
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto space-y-6 px-4 sm:px-6">
              <div className="rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                代表者名・メンバー名を含む提出内容を表示しています。連絡先などの個人情報は含みません。
              </div>

              {loading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  読み込み中...
                </div>
              ) : visibleBands.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  対象のバンドが見つかりません。
                </div>
              ) : (
                <div className="grid gap-6">
                  {visibleBands.map((band) => {
                    const songs = songsByBand[band.id] ?? [];
                    const memberDetails = memberDetailsByBand[band.id] ?? [];
                    const stageMembers = stageMembersByBand[band.id] ?? [];
                    const explicitPlots = stagePlotsByBand[band.id] ?? [];
                    const previewPlots =
                      explicitPlots.length > 0
                        ? explicitPlots
                        : stageMembers.length > 0
                          ? [
                              {
                                id: `${band.id}-preview`,
                                name: "配置図",
                                items: [],
                              } as StagePlot,
                            ]
                          : [];
                    const stagePlotNameById = Object.fromEntries(
                      explicitPlots.map((plot) => [plot.id, plot.name])
                    );
                    const songCount = songs.filter((song) => song.entry_type !== "mc").length;
                    const mcCount = songs.length - songCount;
                    const isExpanded = expandedBands[band.id] ?? visibleBands.length === 1;

                    return (
                      <Card key={band.id} className="overflow-hidden border-border/80 bg-card/60">
                        <CardHeader className="gap-4">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBands((prev) => ({
                                ...prev,
                                [band.id]: !isExpanded,
                              }))
                            }
                            className="w-full text-left"
                            aria-expanded={isExpanded}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant={
                                      band.repertoire_status === "submitted" ? "default" : "secondary"
                                    }
                                  >
                                    {statusLabel(band.repertoire_status)}
                                  </Badge>
                                  <Badge variant="outline">{songCount} 曲</Badge>
                                  <Badge variant="outline">MC {mcCount}</Badge>
                                  <Badge variant="outline">{memberDetails.length} 人</Badge>
                                  {band.lighting_total_min != null ? (
                                    <Badge variant="outline">
                                      照明尺 {band.lighting_total_min} 分
                                    </Badge>
                                  ) : null}
                                </div>
                                <div>
                                  <CardTitle className="text-xl">{band.name}</CardTitle>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    代表者: {hasText(band.representative_name) ? band.representative_name!.trim() : "未設定"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{isExpanded ? "閉じる" : "開く"}</span>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </div>
                          </button>
                        </CardHeader>

                        {isExpanded ? (
                          <CardContent className="space-y-5">
                            <div className="grid gap-4 lg:grid-cols-4">
                              <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                                  <Users className="h-4 w-4 text-primary" />
                                  代表者
                                </div>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                                  {hasText(band.representative_name) ? band.representative_name!.trim() : "未設定"}
                                </p>
                              </div>

                              <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                                  <FileText className="h-4 w-4 text-primary" />
                                  共通メモ
                                </div>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                                  {noteText(band.general_note)}
                                </p>
                              </div>

                              <div className="rounded-xl border border-blue-300/30 bg-blue-500/5 p-4">
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                                  <Monitor className="h-4 w-4" />
                                  PAメモ
                                </div>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                  {noteText(band.sound_note)}
                                </p>
                              </div>

                              <div className="rounded-xl border border-amber-300/30 bg-amber-500/5 p-4">
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                                  <Lightbulb className="h-4 w-4" />
                                  照明メモ
                                </div>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                  {noteText(band.lighting_note)}
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                              <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                                  <Music className="h-4 w-4 text-primary" />
                                  配置図
                                </div>

                                {previewPlots.length > 0 ? (
                                  <StagePlotPreviewTabs
                                    plots={previewPlots}
                                    members={stageMembers}
                                    songs={songs}
                                    previewClassName="aspect-[1.45/1] sm:aspect-[1.6/1]"
                                  />
                                ) : (
                                  <div className="rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                                    配置図の提出はありません。
                                  </div>
                                )}
                              </div>

                              <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                                  <Users className="h-4 w-4 text-primary" />
                                  メンバー情報
                                </div>

                                {memberDetails.length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                                    メンバー情報の提出はありません。
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {memberDetails.map((member, index) => (
                                      <div
                                        key={member.id}
                                        className="rounded-xl border border-border/70 bg-background/60 p-3"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground">
                                              {member.instrument || `Part ${index + 1}`}
                                            </span>
                                            {member.isMc ? (
                                              <Badge variant="outline">MC</Badge>
                                            ) : null}
                                          </div>
                                          <span className="text-sm text-foreground">{member.name}</span>
                                        </div>

                                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                                          <div className="rounded-lg border border-blue-300/20 bg-blue-500/5 px-3 py-2">
                                            <div className="text-muted-foreground">モニター指定</div>
                                            <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                              {noteText(member.monitorRequest)}
                                            </div>
                                          </div>
                                          <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
                                            <div className="text-muted-foreground">補足</div>
                                            <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                              {noteText(member.monitorNote)}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
                              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                                <Music className="h-4 w-4 text-primary" />
                                セットリスト詳細
                              </div>

                              {songs.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                                  セットリストの提出はありません。
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {songs.map((song, index) => {
                                    const assignedPlotName =
                                      song.stagePlotId && stagePlotNameById[song.stagePlotId]
                                        ? stagePlotNameById[song.stagePlotId]
                                        : explicitPlots.length > 1
                                          ? "未指定"
                                          : explicitPlots[0]?.name ?? "未入力";

                                    return (
                                      <div
                                        key={song.id}
                                        className={cn(
                                          "rounded-xl border p-4",
                                          hasText(song.memo)
                                            ? "border-blue-300/20 bg-blue-500/5"
                                            : hasText(song.lighting_color) ||
                                                hasText(song.lighting_spot) ||
                                                hasText(song.lighting_strobe) ||
                                                hasText(song.lighting_moving)
                                              ? "border-amber-300/20 bg-amber-500/5"
                                              : "border-border/70 bg-background/60"
                                        )}
                                      >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <Badge variant="outline">
                                                {song.entry_type === "mc" ? "MC" : "曲"}
                                              </Badge>
                                              <span className="font-mono text-xs text-muted-foreground">
                                                #{String(index + 1).padStart(2, "0")}
                                              </span>
                                              <span className="text-lg font-semibold text-foreground">
                                                {songTitle(song)}
                                              </span>
                                            </div>

                                            {hasText(song.artist) ? (
                                              <p className="mt-1 text-sm text-muted-foreground">
                                                {song.artist}
                                              </p>
                                            ) : null}
                                          </div>

                                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <Badge variant="secondary">{formatDuration(song.duration_sec)}</Badge>
                                            {hasText(song.url) ? (
                                              <a
                                                href={song.url!}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                              >
                                                URL
                                                <ExternalLink className="h-3 w-3" />
                                              </a>
                                            ) : null}
                                          </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                          <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
                                            <div className="text-xs text-muted-foreground">配置図</div>
                                            <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                              {assignedPlotName}
                                            </div>
                                          </div>

                                          <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
                                            <div className="text-xs text-muted-foreground">編曲・補足</div>
                                            <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                              {noteText(song.arrangement_note)}
                                            </div>
                                          </div>

                                          <div className="rounded-lg border border-blue-300/20 bg-blue-500/5 px-3 py-2">
                                            <div className="text-xs text-blue-700 dark:text-blue-300">
                                              PAメモ
                                            </div>
                                            <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                              {noteText(song.memo)}
                                            </div>
                                          </div>

                                          <div className="rounded-lg border border-amber-300/20 bg-amber-500/5 px-3 py-2">
                                            <div className="text-xs text-amber-700 dark:text-amber-300">
                                              照明指定
                                            </div>
                                            <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                              {formatLightingSummary(song)}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        ) : null}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
