"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { StagePlotPreview } from "@/components/StagePlotPreview";
import { PageHeader } from "@/components/PageHeader";

type EventRow = {
  id: string;
  name: string;
  date: string | null;
};

type BandNoteRow = {
  id: string;
  name: string;
  event_id: string;
  sound_note: string | null;
  lighting_note: string | null;
  general_note: string | null;
  repertoire_status: string | null;
  stage_plot_data?: Record<string, unknown> | null;
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
  created_at: string | null;
};

type BandMemberRow = {
  id: string;
  band_id: string;
  instrument: string | null;
  position_x: number | null;
  position_y: number | null;
  is_mc: boolean | null;
  profiles?:
    | { display_name: string | null; real_name: string | null; part: string | null }
    | { display_name: string | null; real_name: string | null; part: string | null }[]
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
  instrument?: string | null;
  x: number;
  y: number;
  isMc?: boolean;
};

type EventGroup = EventRow & { bands: BandNoteRow[] };

const statusLabel = (status: string | null) =>
  status === "submitted" ? "提出済み" : "下書き";

const dateLabel = (value: string | null) => (value ? value.slice(0, 10) : "");

const formatDuration = (durationSec: number | null) => {
  if (durationSec == null) return "-";
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatLightingChoice = (value: string | null) => {
  if (!value) return "-";
  if (value === "o") return "○";
  if (value === "x") return "×";
  if (value === "auto") return "おまかせ";
  return value;
};

const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

const normalizeLabel = (value?: string | null) => (value ?? "").trim();

const isNumberedLabel = (label: string) => /\d+$/.test(label);

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "");

const PA_CONSOLE_CHANNELS = [
  { id: "top-l", label: "Top L", key: "topl" },
  { id: "top-r", label: "Top R", key: "topr" },
  { id: "f-tom", label: "F.Tom", key: "ftom" },
  { id: "l-tom", label: "L.Tom", key: "ltom" },
  { id: "h-tom", label: "H.Tom", key: "htom" },
  { id: "b-dr", label: "B.Dr", key: "bdr" },
  { id: "sdr-top", label: "S.Dr Top", key: "sdrtop" },
  { id: "sdr-bottom", label: "S.Dr Bottom", key: "sdrbottom" },
  { id: "hh", label: "H.H", key: "hh" },
  { id: "spare-1", label: "予備", key: "spare1" },
  { id: "bass-di", label: "Bass (DI)", key: "bassdi" },
  { id: "horn-1", label: "管1", key: "管1" },
  { id: "horn-2", label: "管2", key: "管2" },
  { id: "line-1", label: "LINE1", key: "line1" },
  { id: "line-2", label: "LINE2", key: "line2" },
  { id: "line-3", label: "LINE3", key: "line3" },
  { id: "line-4", label: "LINE4", key: "line4" },
  { id: "gt-1", label: "Gt1", key: "gt1" },
  { id: "gt-2", label: "Gt2", key: "gt2" },
  { id: "perc", label: "Perc.", key: "perc" },
  { id: "mc-1", label: "MC1", key: "mc1" },
  { id: "mc-2", label: "MC2", key: "mc2" },
  { id: "spare-2", label: "予備", key: "spare2" },
  { id: "spare-3", label: "予備", key: "spare3" },
  { id: "tb", label: "TB", key: "tb" },
];

const buildChannelSummary = (members: StageMember[], items: StageItem[]) => {
  const memberLabels = members
    .map((member) => normalizeLabel(member.instrument))
    .filter(Boolean);
  const counts = new Map<string, number>();
  memberLabels.forEach((label) => {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  const runningIndex = new Map<string, number>();
  const numberedMembers = memberLabels.map((label) => {
    if (isNumberedLabel(label)) return label;
    const total = counts.get(label) ?? 0;
    if (total <= 1) return label;
    const next = (runningIndex.get(label) ?? 0) + 1;
    runningIndex.set(label, next);
    return `${label}${next}`;
  });
  const itemLabels = items.map((item) => normalizeLabel(item.label)).filter(Boolean);
  const combined = [...numberedMembers, ...itemLabels];
  const seen = new Set<string>();
  return combined.filter((label) => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
};

const buildChannelKeySet = (labels: string[]) => {
  const keys = new Set<string>();
  labels.forEach((label) => {
    const key = normalizeKey(label);
    if (!key) return;
    keys.add(key);
    if (key === "dr" || key === "drum" || key === "drums") {
      [
        "topl",
        "topr",
        "ftom",
        "ltom",
        "htom",
        "bdr",
        "sdrtop",
        "sdrbottom",
        "hh",
      ].forEach((item) => keys.add(item));
    }
    if (key === "gt") keys.add("gt1");
    if (key === "ba" || key === "bass") keys.add("bassdi");
    if (key === "line") keys.add("line1");
    if (key === "管") keys.add("管1");
    if (key === "mc") keys.add("mc1");
  });
  return keys;
};

const parseStageItems = (
  value: Record<string, unknown> | null | undefined
): StageItem[] => {
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

export default function PAInstructionsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [bands, setBands] = useState<BandNoteRow[]>([]);
  const [bandMembers, setBandMembers] = useState<BandMemberRow[]>([]);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBands, setExpandedBands] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [eventsRes, bandsRes, membersRes, songsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date")
          .order("date", { ascending: true }),
        supabase
          .from("bands")
          .select(
            "id, name, event_id, sound_note, lighting_note, general_note, repertoire_status, stage_plot_data"
          )
          .order("created_at", { ascending: true }),
        supabase
          .from("band_members")
          .select(
            "id, band_id, instrument, position_x, position_y, is_mc, profiles(display_name, real_name, part)"
          )
          .order("created_at", { ascending: true }),
        supabase
          .from("songs")
          .select(
            "id, band_id, title, artist, entry_type, url, order_index, duration_sec, arrangement_note, lighting_spot, lighting_strobe, lighting_moving, lighting_color, memo, created_at"
          )
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventsRes.error || bandsRes.error || membersRes.error || songsRes.error) {
        console.error(
          eventsRes.error ?? bandsRes.error ?? membersRes.error ?? songsRes.error
        );
        setError("指示の取得に失敗しました。時間をおいて再度お試しください。");
        setEvents([]);
        setBands([]);
        setBandMembers([]);
        setSongs([]);
        setLoading(false);
        return;
      }

      setEvents((eventsRes.data ?? []) as EventRow[]);
      setBands((bandsRes.data ?? []) as BandNoteRow[]);
      setBandMembers((membersRes.data ?? []) as BandMemberRow[]);
      setSongs((songsRes.data ?? []) as SongRow[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const groupedEvents = useMemo<EventGroup[]>(() => {
    const map = new Map<string, EventGroup>();
    events.forEach((event) => {
      map.set(event.id, { ...event, bands: [] });
    });
    bands.forEach((band) => {
      const entry = map.get(band.event_id);
      if (entry) entry.bands.push(band);
    });
    return Array.from(map.values()).map((group) => ({
      ...group,
      bands: group.bands.sort((a, b) => a.name.localeCompare(b.name, "ja")),
    }));
  }, [events, bands]);

  const stageItemsByBand = useMemo<Record<string, StageItem[]>>(() => {
    const next: Record<string, StageItem[]> = {};
    bands.forEach((band) => {
      next[band.id] = parseStageItems(band.stage_plot_data);
    });
    return next;
  }, [bands]);

  const bandMembersByBand = useMemo<Record<string, StageMember[]>>(() => {
    const next: Record<string, StageMember[]> = {};
    const counters: Record<string, number> = {};

    bandMembers.forEach((row) => {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0] ?? null
        : row.profiles ?? null;
      const name = profile?.real_name ?? profile?.display_name ?? "名前未登録";
      const instrument = row.instrument ?? profile?.part ?? null;
      const count = counters[row.band_id] ?? 0;
      counters[row.band_id] = count + 1;
      const fallbackX = clampPercent(50 + ((count % 3) - 1) * 8);
      const fallbackY = clampPercent(60 + Math.floor(count / 3) * 8);
      const x = row.position_x ?? fallbackX;
      const y = row.position_y ?? fallbackY;
      if (!next[row.band_id]) next[row.band_id] = [];
      next[row.band_id].push({
        id: row.id,
        name,
        instrument,
        x: clampPercent(Number(x ?? 50)),
        y: clampPercent(Number(y ?? 50)),
        isMc: Boolean(row.is_mc),
      });
    });

    return next;
  }, [bandMembers]);

  const songsByBand = useMemo<Record<string, SongRow[]>>(() => {
    const next: Record<string, SongRow[]> = {};
    songs.forEach((song) => {
      if (!next[song.band_id]) next[song.band_id] = [];
      next[song.band_id].push(song);
    });
    Object.values(next).forEach((list) => {
      list.sort((a, b) => {
        const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      });
    });
    return next;
  }, [songs]);

  const toggleBand = (bandId: string) => {
    setExpandedBands((prev) => ({ ...prev, [bandId]: !prev[bandId] }));
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="PA"
            title="PA指示"
            description="各イベントのレパ表から、共通メモ・立ち位置・PAメモを確認できます。"
            backHref="/pa"
            backLabel="PAダッシュボードへ戻る"
            tone="secondary"
            size="lg"
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6 space-y-6 max-w-5xl">
              {loading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                  指示を読み込んでいます...
                </div>
              ) : error ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-destructive">
                  {error}
                </div>
              ) : groupedEvents.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                  指示が登録されたイベントがありません。
                </div>
              ) : (
                groupedEvents.map((event) => (
                  <Card key={event.id} className="bg-card/60 border-border">
                    <CardHeader className="space-y-1">
                      <CardTitle className="text-xl flex flex-wrap items-center gap-3">
                        {event.name}
                        {event.date && (
                          <span className="text-xs text-muted-foreground">
                            {dateLabel(event.date)}
                          </span>
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {event.bands.length} バンド
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {event.bands.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          バンド情報がありません。
                        </div>
                      ) : (
                        event.bands.map((band) => {
                          const stageItems = stageItemsByBand[band.id] ?? [];
                          const stageMembers = bandMembersByBand[band.id] ?? [];
                          const bandSongs = songsByBand[band.id] ?? [];
                          const hasStagePlot =
                            stageItems.length > 0 || stageMembers.length > 0;

                          const isExpanded = expandedBands[band.id] ?? false;
                          const channelSummary = buildChannelSummary(
                            stageMembers,
                            stageItems
                          );
                          const channelKeys = buildChannelKeySet(channelSummary);
                          const channelCount = PA_CONSOLE_CHANNELS.filter(
                            (channel) =>
                              channelKeys.has(channel.key) ||
                              channelKeys.has(normalizeKey(channel.label))
                          ).length;
                          const panelId = `pa-band-${band.id}`;

                          return (
                            <div
                              key={band.id}
                              className="rounded-lg border border-border bg-background/40 p-4"
                            >
                              <button
                                type="button"
                                onClick={() => toggleBand(band.id)}
                                aria-expanded={isExpanded}
                                aria-controls={panelId}
                                className="w-full text-left"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <h3 className="text-base font-semibold">{band.name}</h3>
                                    <span className="text-xs text-muted-foreground">
                                      CH {channelCount}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={
                                        band.repertoire_status === "submitted"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {statusLabel(band.repertoire_status)}
                                    </Badge>
                                    <ChevronDown
                                      className={`w-4 h-4 text-muted-foreground transition-transform ${
                                        isExpanded ? "rotate-180" : ""
                                      }`}
                                    />
                                  </div>
                                </div>
                              </button>
                              {isExpanded && (
                                <div id={panelId} className="mt-3 space-y-3">
                                  <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                                    <div className="text-xs font-semibold text-muted-foreground">
                                      CH簡易表
                                    </div>
                                    {channelSummary.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">
                                        チャンネル情報は未入力です。
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <div className="grid gap-2 min-w-[900px] md:min-w-0 grid-cols-[repeat(25,minmax(0,1fr))] pb-2">
                                          {PA_CONSOLE_CHANNELS.map((channel, index) => {
                                            const isActive =
                                              channelKeys.has(channel.key) ||
                                              channelKeys.has(normalizeKey(channel.label));
                                            return (
                                            <div
                                              key={`ch-${band.id}-${channel.id}`}
                                              className={`rounded-md border px-1.5 py-2 flex flex-col items-center gap-1 ${
                                                isActive
                                                  ? "border-foreground/30 bg-foreground/5 text-foreground"
                                                  : "border-border/60 bg-background/50 text-muted-foreground"
                                              }`}
                                            >
                                              <div className="text-[9px] text-muted-foreground">
                                                CH {String(index + 1).padStart(2, "0")}
                                              </div>
                                              <div className="h-[28px] text-[9px] font-semibold text-center leading-[1.1] overflow-hidden">
                                                {channel.label}
                                              </div>
                                              <div className="relative h-20 w-2 rounded-full bg-border/70">
                                                <div
                                                    className={`absolute left-1/2 -translate-x-1/2 h-3 w-6 rounded-md ${
                                                      isActive
                                                        ? "bg-foreground/80 shadow-[0_0_8px_rgba(255,255,255,0.25)]"
                                                        : "bg-muted-foreground/40"
                                                    }`}
                                                    style={{ bottom: "42%" }}
                                                  />
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                                    <div className="text-xs font-semibold text-primary">
                                      共通
                                    </div>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {band.general_note?.trim() || "未入力"}
                                  </p>
                                </div>
                                <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                                  <div className="text-xs font-semibold text-primary">
                                    立ち位置
                                  </div>
                                  {hasStagePlot ? (
                                    <StagePlotPreview
                                      items={stageItems}
                                      members={stageMembers}
                                      className="mt-2"
                                    />
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      立ち位置は未入力です。
                                    </p>
                                  )}
                                </div>
                                <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                                  <div className="text-xs font-semibold text-primary">
                                    セトリ
                                  </div>
                                  {bandSongs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                      セトリは未入力です。
                                    </p>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="space-y-2 md:hidden">
                                        {bandSongs.map((song, index) => {
                                          const isSong = song.entry_type !== "mc";
                                          const title = song.title?.trim()
                                            ? song.title
                                            : song.entry_type === "mc"
                                              ? "MC"
                                              : "-";
                                          const artist = isSong ? song.artist?.trim() : null;
                                          return (
                                            <div
                                              key={song.id}
                                              className="rounded-md border border-border bg-background/50 p-3"
                                            >
                                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>
                                                  #{String(index + 1).padStart(2, "0")}
                                                </span>
                                                <span>{formatDuration(song.duration_sec)}</span>
                                              </div>
                                              <div className="mt-1 text-sm font-semibold">
                                                {artist ? `${title} / ${artist}` : title}
                                              </div>
                                              {song.url && (
                                                <a
                                                  href={song.url}
                                                  className="mt-1 block text-xs text-primary underline break-all"
                                                  target="_blank"
                                                  rel="noreferrer"
                                                >
                                                  {song.url}
                                                </a>
                                              )}
                                              <div className="mt-2 space-y-2 text-xs">
                                                <div className="flex gap-2">
                                                  <span className="min-w-[72px] text-muted-foreground">
                                                    アレンジ
                                                  </span>
                                                  <span className="text-foreground whitespace-pre-wrap">
                                                    {isSong
                                                      ? song.arrangement_note || "-"
                                                      : "-"}
                                                  </span>
                                                </div>
                                                <div className="flex gap-2">
                                                  <span className="min-w-[72px] text-muted-foreground">
                                                    ライト要望
                                                  </span>
                                                  <div className="text-foreground space-y-1">
                                                    <div>
                                                      スポット:{" "}
                                                      {isSong
                                                        ? formatLightingChoice(
                                                            song.lighting_spot
                                                          )
                                                        : "-"}
                                                    </div>
                                                    <div>
                                                      ストロボ:{" "}
                                                      {isSong
                                                        ? formatLightingChoice(
                                                            song.lighting_strobe
                                                          )
                                                        : "-"}
                                                    </div>
                                                    <div>
                                                      ムービング:{" "}
                                                      {isSong
                                                        ? formatLightingChoice(
                                                            song.lighting_moving
                                                          )
                                                        : "-"}
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="flex gap-2">
                                                  <span className="min-w-[72px] text-muted-foreground">
                                                    色要望
                                                  </span>
                                                  <span className="text-foreground whitespace-pre-wrap">
                                                    {isSong ? song.lighting_color || "-" : "-"}
                                                  </span>
                                                </div>
                                                <div className="flex gap-2">
                                                  <span className="min-w-[72px] text-muted-foreground">
                                                    備考
                                                  </span>
                                                  <span className="text-foreground whitespace-pre-wrap">
                                                    {song.memo || "-"}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="hidden md:block">
                                        <div className="overflow-x-auto rounded-md border border-border bg-background/40">
                                          <Table className="min-w-[860px]">
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead className="w-[48px]">#</TableHead>
                                                <TableHead>
                                                  曲名 / アーティスト / URL
                                                </TableHead>
                                                <TableHead className="w-[120px]">
                                                  時間
                                                </TableHead>
                                                <TableHead className="w-[180px]">
                                                  アレンジ等
                                                </TableHead>
                                                <TableHead className="w-[200px]">
                                                  ライト要望
                                                </TableHead>
                                                <TableHead className="w-[180px]">
                                                  色要望
                                                </TableHead>
                                                <TableHead className="w-[180px]">
                                                  備考
                                                </TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {bandSongs.map((song, index) => {
                                                const isSong = song.entry_type !== "mc";
                                                const title = song.title?.trim()
                                                  ? song.title
                                                  : song.entry_type === "mc"
                                                    ? "MC"
                                                    : "-";
                                                const artist = isSong
                                                  ? song.artist?.trim()
                                                  : null;
                                                return (
                                                  <TableRow key={song.id}>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                      {String(index + 1).padStart(2, "0")}
                                                    </TableCell>
                                                    <TableCell className="min-w-[220px]">
                                                      <div className="space-y-1">
                                                        <div className="text-sm font-medium">
                                                          {artist
                                                            ? `${title} / ${artist}`
                                                            : title}
                                                        </div>
                                                        {song.url && (
                                                          <a
                                                            href={song.url}
                                                            className="text-xs text-primary underline break-all"
                                                            target="_blank"
                                                            rel="noreferrer"
                                                          >
                                                            {song.url}
                                                          </a>
                                                        )}
                                                      </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                      {formatDuration(song.duration_sec)}
                                                    </TableCell>
                                                    <TableCell className="text-xs whitespace-pre-wrap">
                                                      {isSong
                                                        ? song.arrangement_note || "-"
                                                        : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-xs space-y-1">
                                                      <div>
                                                        スポット:{" "}
                                                        {isSong
                                                          ? formatLightingChoice(
                                                              song.lighting_spot
                                                            )
                                                          : "-"}
                                                      </div>
                                                      <div>
                                                        ストロボ:{" "}
                                                        {isSong
                                                          ? formatLightingChoice(
                                                              song.lighting_strobe
                                                            )
                                                          : "-"}
                                                      </div>
                                                      <div>
                                                        ムービング:{" "}
                                                        {isSong
                                                          ? formatLightingChoice(
                                                              song.lighting_moving
                                                            )
                                                          : "-"}
                                                      </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs whitespace-pre-wrap">
                                                      {isSong
                                                        ? song.lighting_color || "-"
                                                        : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-xs whitespace-pre-wrap">
                                                      {song.memo || "-"}
                                                    </TableCell>
                                                  </TableRow>
                                                );
                                              })}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                                  <div className="text-xs font-semibold text-secondary">
                                    PA
                                  </div>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {band.sound_note?.trim() || "未入力"}
                                  </p>
                                </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
