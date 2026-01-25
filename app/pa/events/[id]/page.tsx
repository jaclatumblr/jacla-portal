"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Calendar, Clock, ExternalLink } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { StagePlotPreview } from "@/components/StagePlotPreview";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// Types
type EventRow = {
  id: string;
  name: string;
  date: string;
  status: string;
  venue: string | null;
  assembly_time: string | null;
  open_time: string | null;
  start_time: string | null;
};

type SlotRow = {
  id: string;
  band_id: string | null;
  slot_type: string;
  order_in_event: number | null;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  bands?: { id: string; name: string } | null;
};

type BandRow = {
  id: string;
  name: string;
  repertoire_status: string | null;
  general_note: string | null;
  sound_note: string | null;
  stage_plot_data?: Record<string, unknown> | null;
};

type BandMemberRow = {
  id: string;
  band_id: string;
  instrument: string | null;
  position_x: number | null;
  position_y: number | null;
  is_mc: boolean | null;
  monitor_request: string | null;
  profiles?: { display_name: string | null; real_name: string | null; part: string | null } | null;
};

type SongRow = {
  id: string;
  band_id: string;
  title: string | null;
  duration_sec: number | null;
  order_index: number | null;
  entry_type: string | null;
};

type StageItem = { id: string; label: string; dashed?: boolean; x: number; y: number };
type StageMember = { id: string; name: string; instrument?: string | null; x: number; y: number; isMc?: boolean };

// Utils
const dateLabel = (value: string | null) => value ? value.slice(0, 10) : "";
const clampPercent = (value: number) => Math.min(95, Math.max(5, value));
const formatDuration = (sec: number | null) => {
  if (sec == null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const parseStageItems = (value: Record<string, unknown> | null | undefined): StageItem[] => {
  const rawItems = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item, index) => {
      const entry = item as { id?: string; label?: string; dashed?: boolean; x?: number; y?: number };
      if (!entry.label) return null;
      return {
        id: entry.id ?? `stage-${index}`,
        label: entry.label,
        dashed: Boolean(entry.dashed),
        x: clampPercent(Number(entry.x ?? 50)),
        y: clampPercent(Number(entry.y ?? 50)),
      };
    })
    .filter(Boolean) as StageItem[];
};

export default function PAEventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [bandMembers, setBandMembers] = useState<BandMemberRow[]>([]);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [eventRes, slotsRes, bandsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, status, venue, assembly_time, open_time, start_time")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("event_slots")
          .select("id, band_id, slot_type, order_in_event, start_time, end_time, note, bands(id, name)")
          .eq("event_id", eventId)
          .order("order_in_event", { ascending: true }),
        supabase
          .from("bands")
          .select("id, name, repertoire_status, general_note, sound_note, stage_plot_data")
          .eq("event_id", eventId)
          .eq("band_type", "event"),
      ]);

      if (cancelled) return;
      if (eventRes.error || !eventRes.data) {
        toast.error("イベント情報の取得に失敗しました。");
        setLoading(false);
        return;
      }
      setEvent(eventRes.data as EventRow);
      type SlotResponse = Omit<SlotRow, "bands"> & { bands: { id: string; name: string } | { id: string; name: string }[] | null };
      const slotList = (slotsRes.data ?? []).map((s: SlotResponse) => ({
        ...s,
        bands: Array.isArray(s.bands) ? s.bands[0] : s.bands
      })) as SlotRow[];
      setSlots(slotList);
      const bandList = (bandsRes.data ?? []) as BandRow[];
      setBands(bandList);

      // 最初のバンドスロットを選択
      const firstBandSlot = slotList.find(s => s.slot_type === "band" && s.band_id);
      if (firstBandSlot?.band_id) setSelectedBandId(firstBandSlot.band_id);

      // メンバーと曲を取得
      const bandIds = bandList.map(b => b.id);
      if (bandIds.length > 0) {
        const [membersRes, songsRes] = await Promise.all([
          supabase
            .from("band_members")
            .select("id, band_id, instrument, position_x, position_y, is_mc, monitor_request, profiles(display_name, real_name, part)")
            .in("band_id", bandIds),
          supabase
            .from("songs")
            .select("id, band_id, title, duration_sec, order_index, entry_type")
            .in("band_id", bandIds)
            .order("order_index", { ascending: true }),
        ]);
        if (!cancelled) {
          type MemberResponse = Omit<BandMemberRow, "profiles"> & { profiles: BandMemberRow["profiles"] | BandMemberRow["profiles"][] | null };
          setBandMembers((membersRes.data ?? []).map((m: MemberResponse) => ({
            ...m,
            profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
          })) as BandMemberRow[]);
          setSongs((songsRes.data ?? []) as SongRow[]);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  const bandsById = useMemo(() => Object.fromEntries(bands.map(b => [b.id, b])), [bands]);
  const stageItemsByBand = useMemo(() => {
    const next: Record<string, StageItem[]> = {};
    bands.forEach(b => { next[b.id] = parseStageItems(b.stage_plot_data); });
    return next;
  }, [bands]);
  const stageMembersByBand = useMemo(() => {
    const next: Record<string, StageMember[]> = {};
    bandMembers.forEach(row => {
      const profile = row.profiles;
      const name = profile?.real_name ?? profile?.display_name ?? "名前未登録";
      if (!next[row.band_id]) next[row.band_id] = [];
      next[row.band_id].push({
        id: row.id, name,
        instrument: row.instrument ?? profile?.part ?? null,
        x: clampPercent(Number(row.position_x ?? 50)),
        y: clampPercent(Number(row.position_y ?? 50)),
        isMc: Boolean(row.is_mc),
      });
    });
    return next;
  }, [bandMembers]);
  const membersByBand = useMemo(() => {
    const next: Record<string, typeof bandMembers> = {};
    bandMembers.forEach(m => { if (!next[m.band_id]) next[m.band_id] = []; next[m.band_id].push(m); });
    return next;
  }, [bandMembers]);
  const songsByBand = useMemo(() => {
    const next: Record<string, SongRow[]> = {};
    songs.forEach(s => { if (!next[s.band_id]) next[s.band_id] = []; next[s.band_id].push(s); });
    return next;
  }, [songs]);

  const activeBand = selectedBandId ? bandsById[selectedBandId] : null;

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="PA"
            title={event?.name ?? "PA指示"}
            backHref="/pa"
            backLabel="PAダッシュボードへ戻る"
            tone="secondary"
            meta={event ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{dateLabel(event.date)}</span>
                {event.venue && <span>{event.venue}</span>}
                {event.assembly_time && <span>集合 {event.assembly_time}</span>}
                {event.open_time && <span>開場 {event.open_time}</span>}
                {event.start_time && <span>開演 {event.start_time}</span>}
              </div>
            ) : null}
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
              {loading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">読み込み中...</div>
              ) : slots.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">タイムテーブルが設定されていません。</div>
              ) : (
                <div className="flex flex-col md:flex-row gap-4">
                  {/* 左: タイムテーブル（編集不可） */}
                  <div className="md:w-1/2 space-y-1">
                    <h2 className="text-sm font-semibold mb-2">タイムテーブル</h2>
                    {slots.map(slot => {
                      const isBand = slot.slot_type === "band" && slot.band_id;
                      const isSelected = isBand && slot.band_id === selectedBandId;
                      const bandName = isBand ? (slot.bands as { name: string } | null)?.name ?? "バンド" : null;
                      const note = slot.note?.trim() ?? "";
                      const slotLabel = isBand
                        ? bandName
                        : slot.slot_type === "break" || note.includes("転換")
                          ? "転換"
                          : slot.slot_type === "mc"
                            ? "付帯作業"
                            : note || "付帯作業";
                      return (
                        <div
                          key={slot.id}
                          onClick={() => isBand && slot.band_id && setSelectedBandId(slot.band_id)}
                          className={cn(
                            "rounded-lg border bg-card/60 px-2 py-1.5 flex items-center gap-2 text-[11px] transition-colors",
                            isBand ? "cursor-pointer hover:border-primary/40" : "cursor-default",
                            isSelected ? "border-primary bg-primary/5" : "border-border"
                          )}
                        >
                          <span className="shrink-0 w-20 text-muted-foreground">{slot.start_time ?? "--:--"} - {slot.end_time ?? "--:--"}</span>
                          <span className={cn("truncate", isBand ? "font-medium" : "text-muted-foreground")}>{slotLabel}</span>
                          {isBand && <Badge variant="secondary" className="text-[9px] shrink-0 ml-auto">バンド</Badge>}
                        </div>
                      );
                    })}
                  </div>

                  {/* 右: PA指示詳細 */}
                  <div className="md:w-1/2">
                    {activeBand ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold truncate">{activeBand.name}</h3>
                          <Badge variant={activeBand.repertoire_status === "submitted" ? "default" : "secondary"} className="text-[10px] shrink-0">{activeBand.repertoire_status === "submitted" ? "提出済" : "下書"}</Badge>
                        </div>

                        {/* ステージプロット */}
                        <div className="border border-border rounded-lg p-2 bg-card/60 aspect-[2/1]">
                          <StagePlotPreview items={stageItemsByBand[activeBand.id] ?? []} members={stageMembersByBand[activeBand.id] ?? []} />
                        </div>

                        {/* 共通・PA指示 */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="border border-border rounded p-2 bg-card/60 min-w-0">
                            <div className="text-[10px] font-medium mb-0.5">共通</div>
                            <div className="text-[10px] text-muted-foreground whitespace-pre-wrap line-clamp-3 break-words">{activeBand.general_note || "-"}</div>
                          </div>
                          <div className="border border-border rounded p-2 bg-card/60 min-w-0">
                            <div className="text-[10px] font-medium mb-0.5 text-secondary">PA指示</div>
                            <div className="text-[10px] text-muted-foreground whitespace-pre-wrap line-clamp-3 break-words">{activeBand.sound_note || "-"}</div>
                          </div>
                        </div>

                        {/* メンバーとセトリ */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="border border-border rounded-lg p-2 bg-card/60 min-w-0">
                            <div className="text-[10px] font-medium mb-1">メンバー ({membersByBand[activeBand.id]?.length ?? 0})</div>
                            <div className="max-h-28 overflow-y-auto overflow-x-hidden">
                              <table className="w-full text-[10px]">
                                <thead className="text-[9px] text-muted-foreground sticky top-0 bg-card/60">
                                  <tr className="border-b border-border"><th className="py-0.5 text-left">パート</th><th className="py-0.5 text-left">名前</th><th className="py-0.5 text-left">返し要望</th></tr>
                                </thead>
                                <tbody>
                                  {(membersByBand[activeBand.id] ?? []).length === 0 ? <tr><td colSpan={3} className="py-1 text-muted-foreground">なし</td></tr> : (membersByBand[activeBand.id] ?? []).map(m => {
                                    const profile = m.profiles;
                                    const name = profile?.real_name ?? profile?.display_name ?? "?";
                                    return (
                                      <tr key={m.id} className="border-b border-border/50">
                                        <td className="py-0.5 text-muted-foreground truncate max-w-12">{m.instrument || profile?.part || "-"}</td>
                                        <td className="py-0.5 truncate max-w-16">{name}</td>
                                        <td className="py-0.5 text-muted-foreground truncate max-w-16">{m.monitor_request || "-"}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div className="border border-border rounded-lg p-2 bg-card/60 min-w-0">
                            <div className="text-[10px] font-medium mb-1">セトリ ({songsByBand[activeBand.id]?.length ?? 0})</div>
                            <div className="max-h-28 overflow-y-auto overflow-x-hidden">
                              <table className="w-full text-[10px]">
                                <thead className="text-[9px] text-muted-foreground sticky top-0 bg-card/60">
                                  <tr className="border-b border-border"><th className="py-0.5 text-left w-4">#</th><th className="py-0.5 text-left">曲名</th><th className="py-0.5 text-left w-8">時間</th></tr>
                                </thead>
                                <tbody>
                                  {(songsByBand[activeBand.id] ?? []).length === 0 ? <tr><td colSpan={3} className="py-1 text-muted-foreground">なし</td></tr> : (songsByBand[activeBand.id] ?? []).map((s, i) => (
                                    <tr key={s.id} className="border-b border-border/50">
                                      <td className="py-0.5 text-muted-foreground">{i + 1}</td>
                                      <td className="py-0.5 truncate max-w-20">{s.entry_type === "mc" ? <span className="text-muted-foreground">MC</span> : s.title || "未入力"}</td>
                                      <td className="py-0.5 text-muted-foreground">{formatDuration(s.duration_sec)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Link href={`/events/${eventId}/repertoire/view`} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                            レパ表詳細 <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border bg-card/60 px-4 py-8 text-sm text-center text-muted-foreground">
                        左のタイムテーブルからバンドを選択してください
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
