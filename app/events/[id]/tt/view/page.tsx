"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock, Download, List } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toast";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { cn } from "@/lib/utils";
import { downloadExcelWorkbook } from "@/lib/exportExcel";
import { RepertoireSection } from "@/app/admin/events/[id]/components/RepertoireSection";

type EventRow = {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  open_time: string | null;
  start_time: string | null;
  tt_is_published: boolean;
};

type SlotRow = {
  id: string;
  band_id: string | null;
  slot_type: "band" | "break" | "mc" | "other";
  slot_phase?: "show" | "rehearsal_normal" | "rehearsal_pre";
  order_in_event: number | null;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  bands?: { name: string | null } | { name: string | null }[] | null;
};

const PREP_NOTE = "\u96C6\u5408\uFF5E\u6E96\u5099";
const CLEANUP_NOTE = "\u7D42\u4E86\uFF5E\u64A4\u53CE";
const CLEANUP_NOTE_ALT = "\u7D42\u4E86\uFF5E\u89E3\u6563";
const REST_NOTE = "\u4F11\u61A9";

const normalizeLegacyText = (value: string) => {
  const trimmed = value.replace(/\u3000/g, " ").trim();
  if (trimmed === "髮・粋縲懈ｺ門ｙ") return PREP_NOTE;
  if (trimmed === "邨ゆｺ・懈彫蜿・") return CLEANUP_NOTE;
  if (trimmed === "邨ゆｺ・懆ｧ｣謨｣") return CLEANUP_NOTE_ALT;
  if (trimmed === "莨第・") return REST_NOTE;
  return trimmed
    .replace(/霆｢謠・/g, "\u8EE2\u63DB")
    .replace(/莉伜ｸｯ菴懈･ｭ/g, "\u4ED8\u5E2F\u4F5C\u696D");
};

const normalizeNote = (note?: string | null) => normalizeLegacyText(note ?? "");

const formatTimeText = (value: string | null) => {
  if (!value) return "";
  const [h = "", m = ""] = value.split(":");
  if (!h || !m) return value;
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
};

const parseTime = (value: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const timeLabel = (start: string | null, end: string | null) => {
  const startText = formatTimeText(start);
  const endText = formatTimeText(end);
  if (!startText && !endText) return "\u6642\u9593\u672A\u8A2D\u5B9A";
  if (!startText) return `-${endText}`;
  if (!endText) return `${startText}-`;
  const startMin = parseTime(start);
  const endMin = parseTime(end);
  let duration = "";
  if (startMin != null && endMin != null) {
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    if (diff > 0) duration = `(${diff})`;
  }
  return `${startText}-${endText}${duration}`;
};

const slotLabel = (slot: SlotRow) => {
  if (slot.slot_type === "band") {
    if (Array.isArray(slot.bands)) return slot.bands[0]?.name ?? "\u672A\u8A2D\u5B9A\u30D0\u30F3\u30C9";
    return slot.bands?.name ?? "\u672A\u8A2D\u5B9A\u30D0\u30F3\u30C9";
  }
  const note = normalizeNote(slot.note);
  if (slot.slot_type === "break" || note.includes("\u8EE2\u63DB")) return "\u8EE2\u63DB";
  return note || "\u4ED8\u5E2F\u4F5C\u696D";
};

const slotTypeLabel = (slot: SlotRow) => {
  if (slot.slot_type === "band") return "\u30D0\u30F3\u30C9";
  const note = normalizeNote(slot.note);
  if (slot.slot_type === "break" || note.includes("\u8EE2\u63DB")) return "\u8EE2\u63DB";
  return "\u4ED8\u5E2F\u4F5C\u696D";
};

const slotPhaseLabel = (slot: SlotRow) => {
  const note = normalizeNote(slot.note);
  if (note === PREP_NOTE || note === CLEANUP_NOTE || note === CLEANUP_NOTE_ALT || note === REST_NOTE) {
    return note;
  }
  if (slot.slot_phase === "rehearsal_normal") return "\u901A\u5E38\u30EA\u30CF";
  if (slot.slot_phase === "rehearsal_pre") return "\u524D\u65E5\u30EA\u30CF";
  return "\u672C\u756A";
};

const slotToneClass = (slot: SlotRow) => {
  const note = normalizeNote(slot.note);
  if (note === PREP_NOTE || note === CLEANUP_NOTE || note === CLEANUP_NOTE_ALT || note === REST_NOTE) {
    return "before:bg-amber-400/80";
  }
  if (slot.slot_type === "break" || note.includes("\u8EE2\u63DB")) return "before:bg-amber-400/80";
  if (slot.slot_phase === "rehearsal_normal" || slot.slot_phase === "rehearsal_pre") {
    return "before:bg-sky-400/80";
  }
  return "before:bg-fuchsia-400/80";
};

export default function EventTimeTableViewPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;
  const { isAdmin, loading: rolesLoading } = useRoleFlags();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const [eventRes, slotsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, venue, open_time, start_time, tt_is_published")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("event_slots")
          .select("id, band_id, slot_type, slot_phase, order_in_event, start_time, end_time, note, bands(name)")
          .eq("event_id", eventId)
          .order("order_in_event", { ascending: true })
          .order("start_time", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        toast.error("\u30A4\u30D9\u30F3\u30C8\u60C5\u5831\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
        setEvent(null);
      } else {
        setEvent(eventRes.data as EventRow);
      }

      if (slotsRes.error) {
        console.error(slotsRes.error);
        toast.error("\u30BF\u30A4\u30E0\u30C6\u30FC\u30D6\u30EB\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
        setSlots([]);
      } else {
        setSlots((slotsRes.data ?? []) as SlotRow[]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const orderedSlots = useMemo(() => {
    return [...slots].sort((a, b) => {
      const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });
  }, [slots]);

  const firstBandId = useMemo(() => {
    const bandSlot = orderedSlots.find((slot) => slot.slot_type === "band" && slot.band_id);
    return bandSlot?.band_id ?? null;
  }, [orderedSlots]);

  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const effectiveBandId = selectedBandId ?? firstBandId;

  const selectedBandSlot = useMemo(() => {
    if (!effectiveBandId) return null;
    return orderedSlots.find((slot) => slot.slot_type === "band" && slot.band_id === effectiveBandId) ?? null;
  }, [orderedSlots, effectiveBandId]);

  const summary = useMemo(() => {
    const total = orderedSlots.length;
    const band = orderedSlots.filter((slot) => slot.slot_type === "band");
    const rehearsal = band.filter(
      (slot) => slot.slot_phase === "rehearsal_normal" || slot.slot_phase === "rehearsal_pre"
    ).length;
    const show = band.filter((slot) => slot.slot_phase === "show").length;
    const changeovers = orderedSlots.filter((slot) => {
      const note = normalizeNote(slot.note);
      return slot.slot_type === "break" || note.includes("\u8EE2\u63DB");
    }).length;
    const firstStart = orderedSlots.find((slot) => slot.start_time)?.start_time ?? null;
    const lastEnd = [...orderedSlots].reverse().find((slot) => slot.end_time)?.end_time ?? null;
    const startMin = parseTime(firstStart);
    const endMin = parseTime(lastEnd);
    let totalMin: number | null = null;
    if (startMin != null && endMin != null) {
      totalMin = endMin - startMin;
      if (totalMin < 0) totalMin += 24 * 60;
    }
    return { total, band: band.length, rehearsal, show, changeovers, totalMin };
  }, [orderedSlots]);

  const canViewTimetable = Boolean(event?.tt_is_published) || isAdmin;

  const handleSlotClick = (slot: SlotRow) => {
    if (slot.slot_type === "band" && slot.band_id) {
      setSelectedBandId(slot.band_id);
    }
  };

  const handleExportTimetable = () => {
    if (!event || orderedSlots.length === 0) {
      toast.error("\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8\u3059\u308BTT\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
      return;
    }

    void (async () => {
      try {
        const bandIds = Array.from(new Set(orderedSlots.map((slot) => slot.band_id).filter(Boolean))) as string[];
        const memberMap = new Map<string, number>();
        const songMap = new Map<string, number>();

        if (bandIds.length > 0) {
          const [membersRes, songsRes] = await Promise.all([
            supabase.from("band_members").select("band_id").in("band_id", bandIds),
            supabase.from("songs").select("band_id, entry_type").in("band_id", bandIds),
          ]);

          if (!membersRes.error) {
            ((membersRes.data ?? []) as Array<{ band_id: string | null }>).forEach((row) => {
              if (!row.band_id) return;
              memberMap.set(row.band_id, (memberMap.get(row.band_id) ?? 0) + 1);
            });
          }
          if (!songsRes.error) {
            ((songsRes.data ?? []) as Array<{ band_id: string | null; entry_type: string | null }>).forEach((row) => {
              if (!row.band_id || row.entry_type === "mc") return;
              songMap.set(row.band_id, (songMap.get(row.band_id) ?? 0) + 1);
            });
          }
        }

        const rows = orderedSlots.map((slot, index) => {
          const bandId = slot.band_id ?? "";
          return [
            index + 1,
            slotLabel(slot),
            slot.slot_type === "band" ? memberMap.get(bandId) ?? "" : "",
            slot.slot_type === "band" ? songMap.get(bandId) ?? "" : "",
            formatTimeText(slot.start_time),
            formatTimeText(slot.end_time),
            slotTypeLabel(slot),
            slotPhaseLabel(slot),
          ];
        });

        const eventDate = (event.date ?? "").replaceAll("-", "");
        const filename = `${event.name ?? "event"}_TT_${eventDate || "export"}`.replace(/[\\/:*?"<>|]/g, "_");

        downloadExcelWorkbook(`${filename}.xlsx`, [
          {
            name: "Sheet1",
            headers: ["#", "\u9805\u76EE", "\u30E1\u30F3\u30D0\u30FC\u6570", "\u66F2\u6570", "\u958B\u59CB", "\u7D42\u4E86", "\u7A2E\u5225", "\u533A\u5206"],
            rows,
            colWidths: [6, 34, 12, 8, 10, 10, 10, 14],
          },
        ]);

        toast.success("TT\u3092\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8\u3057\u307E\u3057\u305F\u3002");
      } catch (exportError) {
        console.error(exportError);
        toast.error("\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
      }
    })();
  };

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
                    <Calendar className="h-4 w-4" />
                    {event.date}
                  </span>
                  {event.open_time && (
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {"\u958B\u5834"} {formatTimeText(event.open_time)}
                    </span>
                  )}
                  {event.start_time && (
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {"\u958B\u6F14"} {formatTimeText(event.start_time)}
                    </span>
                  )}
                  {event.venue && (
                    <span className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      {event.venue}
                    </span>
                  )}
                  <Badge variant={event.tt_is_published ? "default" : "outline"}>
                    {event.tt_is_published ? "\u516C\u958B\u4E2D" : "\u975E\u516C\u958B"}
                  </Badge>
                </div>
              )
            }
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTimetable}
                disabled={loading || rolesLoading || !canViewTimetable || orderedSlots.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                {"\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8"}
              </Button>
            }
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto space-y-6 px-4 sm:px-6">
              {loading || rolesLoading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  {"\u8AAD\u307F\u8FBC\u307F\u4E2D..."}
                </div>
              ) : event && !canViewTimetable ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  {
                    "\u30BF\u30A4\u30E0\u30C6\u30FC\u30D6\u30EB\u306F\u307E\u3060\u516C\u958B\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u516C\u958B\u307E\u3067\u304A\u5F85\u3061\u304F\u3060\u3055\u3044\u3002"
                  }
                </div>
              ) : orderedSlots.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  {"\u30BF\u30A4\u30E0\u30C6\u30FC\u30D6\u30EB\u304C\u307E\u3060\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002"}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="border-border bg-card/60">
                      <CardContent className="p-4">
                        <p className="text-[11px] text-muted-foreground">{"\u30B9\u30ED\u30C3\u30C8\u7DCF\u6570"}</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">{summary.total}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border bg-card/60">
                      <CardContent className="p-4">
                        <p className="text-[11px] text-muted-foreground">{"\u30D0\u30F3\u30C9\u67A0"}</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">{summary.band}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border bg-card/60">
                      <CardContent className="p-4">
                        <p className="text-[11px] text-muted-foreground">{"\u30EA\u30CF / \u672C\u756A"}</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">
                          {summary.rehearsal}
                          <span className="mx-1 text-muted-foreground">/</span>
                          {summary.show}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-border bg-card/60">
                      <CardContent className="p-4">
                        <p className="text-[11px] text-muted-foreground">{"\u5168\u4F53\u5C3A / \u8EE2\u63DB\u6570"}</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">
                          {summary.totalMin != null ? `${summary.totalMin}m` : "-"}
                          <span className="ml-2 text-sm text-muted-foreground">{summary.changeovers}</span>
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <Card className="border-border bg-card/60">
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <List className="h-4 w-4 text-primary" />
                              {"\u30BF\u30A4\u30E0\u30C6\u30FC\u30D6\u30EB"}
                            </CardTitle>
                            <Badge variant="outline" className="text-[10px]">
                              {orderedSlots.length} slots
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {selectedBandSlot
                              ? `${slotLabel(selectedBandSlot)} / ${timeLabel(selectedBandSlot.start_time, selectedBandSlot.end_time)}`
                              : "\u30D0\u30F3\u30C9\u67A0\u3092\u9078\u629E\u3059\u308B\u3068\u30EC\u30D1\u8868\u304C\u9023\u52D5\u3057\u307E\u3059"}
                          </p>
                        </CardHeader>
                        <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                          {orderedSlots.map((slot, index) => {
                            const isSelected = slot.slot_type === "band" && slot.band_id === effectiveBandId;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => handleSlotClick(slot)}
                                className={cn(
                                  "relative w-full rounded-lg border bg-card/70 px-3 py-2 pl-5 text-left transition-colors",
                                  "before:absolute before:bottom-2 before:left-2 before:top-2 before:w-1 before:rounded-full before:content-['']",
                                  slotToneClass(slot),
                                  isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                                )}
                              >
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>#{String(index + 1).padStart(2, "0")}</span>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {slotPhaseLabel(slot)}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px]">
                                    {slotTypeLabel(slot)}
                                  </Badge>
                                  <span className="ml-auto text-xs">{timeLabel(slot.start_time, slot.end_time)}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <div className="min-w-0 truncate text-sm font-semibold">{slotLabel(slot)}</div>
                                </div>
                              </button>
                            );
                          })}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="min-w-0">
                      <Card className="border-border bg-card/60">
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <List className="h-4 w-4 text-primary" />
                              {"\u30EC\u30D1\u8868\u30D7\u30EC\u30D3\u30E5\u30FC"}
                            </CardTitle>
                            {selectedBandSlot && (
                              <Badge variant="outline" className="max-w-full truncate text-[10px]">
                                {slotLabel(selectedBandSlot)}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <RepertoireSection
                            eventId={eventId ?? ""}
                            selectedBandId={effectiveBandId}
                            hideBandList={true}
                            onBandSelect={setSelectedBandId}
                            readOnly={true}
                          />
                        </CardContent>
                      </Card>
                    </div>
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
