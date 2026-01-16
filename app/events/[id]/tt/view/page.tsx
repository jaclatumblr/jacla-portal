"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock, List } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toast";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { cn } from "@/lib/utils";
import { RepertoireSection } from "@/app/admin/events/[id]/components/RepertoireSection";

type EventRow = {
  id: string;
  name: string;
  date: string;
  status: string;
  event_type: string;
  venue: string | null;
  open_time: string | null;
  start_time: string | null;
  tt_is_published: boolean;
};

type SlotRow = {
  id: string;
  event_id: string;
  band_id: string | null;
  slot_type: "band" | "break" | "mc" | "other";
  slot_phase?: "show" | "rehearsal_normal" | "rehearsal_pre";
  order_in_event: number | null;
  start_time: string | null;
  end_time: string | null;
  changeover_min: number | null;
  note: string | null;
  bands?: { name: string | null } | { name: string | null }[] | null;
};

const normalizeNote = (note?: string | null) => (note ?? "").replace(/～/g, "〜").trim();

const slotPhaseOptions = [
  { value: "show", label: "本番" },
  { value: "rehearsal_normal", label: "通常リハ" },
  { value: "rehearsal_pre", label: "直前リハ" },
];

const phaseLabel = (phase?: SlotRow["slot_phase"]) => {
  const normalized = phase ?? "show";
  return slotPhaseOptions.find((opt) => opt.value === normalized)?.label ?? normalized;
};

type PhaseKey = SlotRow["slot_phase"] | "prep" | "cleanup" | "rest";

const slotPhaseKey = (slot: SlotRow): PhaseKey => {
  const note = normalizeNote(slot.note);
  if (note === "集合〜準備") return "prep";
  if (note === "終了〜撤収" || note === "終了〜解散") return "cleanup";
  if (note === "休憩") return "rest";
  return slot.slot_phase ?? "show";
};

const slotPhaseLabel = (slot: SlotRow) => {
  const note = normalizeNote(slot.note);
  if (note === "集合〜準備") return "集合〜準備";
  if (note === "終了〜撤収" || note === "終了〜解散") return note;
  if (note === "休憩") return "休憩";
  return phaseLabel(slot.slot_phase);
};

const slotTypeLabel = (slot: SlotRow) => {
  if (slot.slot_type === "band") return "バンド";
  const note = normalizeNote(slot.note);
  if (slot.slot_type === "break" || note.includes("転換")) return "転換";
  return "付帯作業";
};

const slotLabel = (slot: SlotRow) => {
  if (slot.slot_type === "band") {
    if (Array.isArray(slot.bands)) {
      return slot.bands[0]?.name ?? "バンド未設定";
    }
    return slot.bands?.name ?? "バンド未設定";
  }
  const note = normalizeNote(slot.note);
  if (slot.slot_type === "break" || note.includes("転換")) return "転換";
  return note || "付帯作業";
};

const slotPhaseBadgeVariant = (slot: SlotRow) => {
  const key = slotPhaseKey(slot);
  if (key === "prep" || key === "cleanup" || key === "rest") return "outline" as const;
  if (key === "rehearsal_pre") return "secondary" as const;
  return "default" as const;
};

const slotTypeBadgeVariant = (slot: SlotRow) => {
  if (slot.slot_type === "band") return "default" as const;
  const note = normalizeNote(slot.note);
  if (slot.slot_type === "break" || note.includes("転換")) return "secondary" as const;
  return "outline" as const;
};

const slotToneClass = (slot: SlotRow) => {
  const note = normalizeNote(slot.note);
  if (note === "集合〜準備" || note === "終了〜撤収" || note === "終了〜解散" || note === "休憩") {
    return "before:bg-amber-400/80";
  }
  if (slot.slot_type === "break" || note.includes("転換")) {
    return "before:bg-amber-400/80";
  }
  const phase = slot.slot_phase ?? "show";
  if (phase === "rehearsal_normal" || phase === "rehearsal_pre") {
    return "before:bg-sky-400/80";
  }
  if (phase === "show") {
    return "before:bg-fuchsia-400/80";
  }
  return "before:bg-muted";
};

const parseTimeValue = (value: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const durationLabel = (start: string | null, end: string | null) => {
  const startMin = parseTimeValue(start);
  const endMin = parseTimeValue(end);
  if (startMin == null || endMin == null) return "";
  let duration = endMin - startMin;
  if (duration < 0) duration += 24 * 60;
  if (duration <= 0) return "";
  return `(${duration})`;
};

const timeLabel = (start: string | null, end: string | null) => {
  if (!start && !end) return "時間未設定";
  if (start && end) return `${start}-${end}${durationLabel(start, end)}`;
  return start ? `${start}-` : `- ${end}`;
};

export default function EventTimeTableViewPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;
  const { isAdmin, loading: rolesLoading } = useRoleFlags();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const [eventRes, slotsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, status, event_type, venue, open_time, start_time, tt_is_published")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("event_slots")
          .select(
            "id, event_id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, changeover_min, note, bands(name)"
          )
          .eq("event_id", eventId)
          .order("order_in_event", { ascending: true })
          .order("start_time", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        setEvent(null);
        setError("イベント情報の取得に失敗しました。");
      } else {
        setEvent(eventRes.data as EventRow);
      }

      if (slotsRes.error) {
        console.error(slotsRes.error);
        setSlots([]);
        setError((prev) => prev ?? "タイムテーブルの取得に失敗しました。");
      } else {
        setSlots((slotsRes.data ?? []) as SlotRow[]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    setError(null);
  }, [error]);

  const orderedSlots = useMemo(() => {
    return [...slots].sort((a, b) => {
      const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const startA = a.start_time ?? "";
      const startB = b.start_time ?? "";
      return startA.localeCompare(startB);
    });
  }, [slots]);

  const firstBandId = useMemo(() => {
    const bandSlot = orderedSlots.find((slot) => slot.slot_type === "band" && slot.band_id);
    return bandSlot?.band_id ?? null;
  }, [orderedSlots]);

  const [selectedBandId, setSelectedBandId] = useState<string | null>(firstBandId);

  useEffect(() => {
    if (!selectedBandId && firstBandId) {
      setSelectedBandId(firstBandId);
    }
  }, [firstBandId, selectedBandId]);

  const handleSlotClick = (slot: SlotRow) => {
    if (slot.slot_type === "band" && slot.band_id) {
      setSelectedBandId(slot.band_id);
    }
  };

  const canViewTimetable = Boolean(event?.tt_is_published) || isAdmin;

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="TT & Repertoire"
            title="TT・レパ表"
            backHref={`/events/${eventId}`}
            backLabel="イベント詳細へ戻る"
            meta={
              event && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {event.date}
                  </span>
                  {event.open_time && (
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      開場 {event.open_time}
                    </span>
                  )}
                  {event.start_time && (
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      開演 {event.start_time}
                    </span>
                  )}
                  {event.venue && (
                    <span className="flex items-center gap-2">
                      <List className="w-4 h-4" />
                      {event.venue}
                    </span>
                  )}
                  <Badge variant={event.tt_is_published ? "default" : "outline"}>
                    {event.tt_is_published ? "公開中" : "非公開"}
                  </Badge>
                </div>
              )
            }
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {loading || rolesLoading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  読み込み中...
                </div>
              ) : event && !canViewTimetable ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  タイムテーブルは未公開です。公開されるまでお待ちください。
                </div>
              ) : orderedSlots.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  タイムテーブルがまだ作成されていません。
                </div>
              ) : (
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="md:w-1/2">
                    <Card className="bg-card/60 border-border">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <List className="w-4 h-4 text-primary" />
                          タイムテーブル
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {orderedSlots.map((slot, index) => {
                          const isSelected = slot.slot_type === "band" && slot.band_id === selectedBandId;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => handleSlotClick(slot)}
                              className={cn(
                                "relative w-full rounded-lg border bg-card/70 px-3 py-2 pl-5 text-left transition-colors",
                                "before:absolute before:left-2 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:content-['']",
                                slotToneClass(slot),
                                isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                              )}
                            >
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>#{String(index + 1).padStart(2, "0")}</span>
                                <Badge variant={slotPhaseBadgeVariant(slot)} className="text-[10px]">
                                  {slotPhaseLabel(slot)}
                                </Badge>
                                <Badge variant={slotTypeBadgeVariant(slot)} className="text-[10px]">
                                  {slotTypeLabel(slot)}
                                </Badge>
                                <span className="ml-auto text-xs">{timeLabel(slot.start_time, slot.end_time)}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <div className="min-w-0 text-sm font-semibold truncate">{slotLabel(slot)}</div>
                              </div>
                            </button>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="md:w-1/2">
                    <RepertoireSection
                      eventId={eventId ?? ""}
                      selectedBandId={selectedBandId}
                      hideBandList={true}
                      onBandSelect={setSelectedBandId}
                      readOnly={true}
                    />
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
