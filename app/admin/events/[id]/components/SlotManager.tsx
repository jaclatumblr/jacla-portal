"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DraggableAttributes,
    DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Save, Trash2, RefreshCw, Download, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import {
    EventRow,
    EventSlot,
    Band,
    BandMember,
    Song,
    slotTypeOptions,
    formatTime,
    parseTime,
} from "../types";

type SlotManagerProps = {
    event: EventRow;
    bands: Band[];
    members: BandMember[];
    songs: Song[];
    slots: EventSlot[];
    setSlots: (slots: EventSlot[] | ((prev: EventSlot[]) => EventSlot[])) => void;
    onRefresh: () => Promise<void>;
    selectedBandId?: string | null;
    onBandSelect?: (bandId: string | null) => void;
};

// Sortable Item Component
type SortableItemRenderProps = {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
    setActivatorNodeRef: (node: HTMLElement | null) => void;
    isDragging: boolean;
};

type SortableItemProps = {
    id: string;
    children: (props: SortableItemRenderProps) => React.ReactNode;
};

function SortableItem({ id, children }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-80 z-50")}>
            {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
        </div>
    );
}

export function SlotManager({
    event,
    bands,
    members,
    songs,
    slots,
    setSlots,
    onRefresh,
    selectedBandId,
    onBandSelect,
}: SlotManagerProps) {
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [historyPast, setHistoryPast] = useState<EventSlot[][]>([]);
    const [historyFuture, setHistoryFuture] = useState<EventSlot[][]>([]);
    const slotsRef = useRef<EventSlot[]>(slots);
    const MAX_HISTORY_STEPS = 50;
    const [rehearsalOrder, setRehearsalOrder] = useState<"same" | "reverse">(
        event.normal_rehearsal_order ?? "same"
    );
    const [savingRehearsalOrder, setSavingRehearsalOrder] = useState(false);
    const [rehearsalPhase, setRehearsalPhase] = useState<"rehearsal_normal" | "rehearsal_pre">(
        "rehearsal_normal"
    );

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        })
    );

    const sortSlotsByOrder = (source: EventSlot[]) => {
        return [...source].sort((a, b) => {
            const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            const startA = a.start_time ?? "";
            const startB = b.start_time ?? "";
            if (startA !== startB) return startA.localeCompare(startB);
            return (a.note ?? "").localeCompare(b.note ?? "");
        });
    };

    const orderedSlots = useMemo(() => sortSlotsByOrder(slots), [slots]);
    const hasSelectedRehearsalBands = useMemo(
        () =>
            orderedSlots.some(
                (slot) =>
                    slot.slot_type === "band" &&
                    (slot.slot_phase ?? "show") === rehearsalPhase
            ),
        [orderedSlots, rehearsalPhase]
    );
    const canUndo = historyPast.length > 0;
    const canRedo = historyFuture.length > 0;

    const cloneSlotsSnapshot = (source: EventSlot[]) => source.map((slot) => ({ ...slot }));

    const areSlotsEqual = (left: EventSlot[], right: EventSlot[]) => {
        if (left.length !== right.length) return false;
        for (let index = 0; index < left.length; index += 1) {
            const a = left[index];
            const b = right[index];
            if (!a || !b) return false;
            if (
                a.id !== b.id ||
                a.event_id !== b.event_id ||
                a.band_id !== b.band_id ||
                a.slot_type !== b.slot_type ||
                a.slot_phase !== b.slot_phase ||
                a.order_in_event !== b.order_in_event ||
                a.start_time !== b.start_time ||
                a.end_time !== b.end_time ||
                a.changeover_min !== b.changeover_min ||
                a.note !== b.note
            ) {
                return false;
            }
        }
        return true;
    };

    const applySlotsUpdate = (
        updater: EventSlot[] | ((prev: EventSlot[]) => EventSlot[]),
        options?: { recordHistory?: boolean; clearHistory?: boolean }
    ) => {
        const previous = cloneSlotsSnapshot(slotsRef.current);
        const computed =
            typeof updater === "function"
                ? updater(cloneSlotsSnapshot(previous))
                : updater;
        const next = cloneSlotsSnapshot(computed);
        if (areSlotsEqual(previous, next)) {
            if (options?.clearHistory) {
                setHistoryPast([]);
                setHistoryFuture([]);
            }
            return;
        }

        if (options?.clearHistory) {
            setHistoryPast([]);
            setHistoryFuture([]);
        } else if (options?.recordHistory !== false) {
            setHistoryPast((past) => {
                const nextPast = [...past, previous];
                return nextPast.length > MAX_HISTORY_STEPS
                    ? nextPast.slice(nextPast.length - MAX_HISTORY_STEPS)
                    : nextPast;
            });
            setHistoryFuture([]);
        }

        slotsRef.current = next;
        setSlots(next);
    };

    const slotPhaseOptions = [
        { value: "show", label: "\u672C\u756A" },
        { value: "rehearsal_normal", label: "\u901A\u5E38\u30EA\u30CF" },
        { value: "rehearsal_pre", label: "\u76F4\u524D\u30EA\u30CF" },
    ];

    const DEFAULT_OTHER_DURATION_MIN = 60;
    const DEFAULT_BAND_DURATION_MIN = 10;
    const ROUND_STEP_MIN = 5;
    const REHEARSAL_EXTRA_MIN = 5;
    const MIN_REHEARSAL_MIN = 10;
    const DAY_MINUTES = 24 * 60;
    const PREP_NOTE = "\u96C6\u5408\uFF5E\u6E96\u5099";
    const CLEANUP_NOTE = "\u7D42\u4E86\uFF5E\u64A4\u53CE";
    const CLEANUP_NOTE_ALT = "\u7D42\u4E86\uFF5E\u89E3\u6563";
    const REST_NOTE = "\u4F11\u61A9";

    const roundUpToStep = (value: number, step: number) =>
        Math.ceil(value / step) * step;

    const normalizeDayMinutes = (minutes: number) => {
        const value = minutes % DAY_MINUTES;
        return value < 0 ? value + DAY_MINUTES : value;
    };

    const compactConsecutiveTimedSlots = (source: EventSlot[]) => {
        let cursor: number | null = null;
        return source.map((slot) => {
            const start = parseTime(slot.start_time ?? null);
            const end = parseTime(slot.end_time ?? null);
            if (start == null || end == null) {
                cursor = null;
                return slot;
            }
            let duration = end - start;
            if (duration < 0) duration += DAY_MINUTES;
            if (duration <= 0) {
                cursor = null;
                return slot;
            }
            const nextStart = cursor ?? start;
            const nextEnd = nextStart + duration;
            cursor = nextEnd;
            return {
                ...slot,
                start_time: formatTime(normalizeDayMinutes(nextStart)),
                end_time: formatTime(normalizeDayMinutes(nextEnd)),
            };
        });
    };

    const durationMaps = useMemo(() => {
        const showTotals = new Map<string, number>();
        const rehearsalTotals = new Map<string, number>();
        const songCounts = new Map<string, number>();
        songs.forEach((song) => {
            if (!song.band_id) return;
            if (song.entry_type !== "mc") {
                const count = songCounts.get(song.band_id) ?? 0;
                songCounts.set(song.band_id, count + 1);
            }
            if (!song.duration_sec) return;
            const current = showTotals.get(song.band_id) ?? 0;
            showTotals.set(song.band_id, current + song.duration_sec);
            if (song.entry_type !== "mc") {
                const rehearsalCurrent = rehearsalTotals.get(song.band_id) ?? 0;
                rehearsalTotals.set(song.band_id, rehearsalCurrent + song.duration_sec);
            }
        });

        const show = new Map<string, number>();
        showTotals.forEach((seconds, bandId) => {
            if (seconds <= 0) return;
            const minutes = Math.ceil(seconds / 60);
            const rounded = roundUpToStep(minutes, ROUND_STEP_MIN);
            show.set(bandId, rounded);
        });

        const rehearsal = new Map<string, number>();
        rehearsalTotals.forEach((seconds, bandId) => {
            if (seconds <= 0) return;
            const minutes = Math.ceil(seconds / 60);
            const rounded = roundUpToStep(minutes, ROUND_STEP_MIN);
            const withExtra = rounded + REHEARSAL_EXTRA_MIN;
            rehearsal.set(bandId, Math.max(MIN_REHEARSAL_MIN, withExtra));
        });

        return { show, rehearsal, songCounts };
    }, [songs]);

    const getSlotDurationMin = (slot: EventSlot) => {
        const start = parseTime(slot.start_time ?? null);
        const end = parseTime(slot.end_time ?? null);
        if (start == null || end == null) return null;
        let duration = end - start;
        if (duration < 0) duration += DAY_MINUTES;
        if (duration <= 0) return null;
        return duration;
    };

    const diffForwardMinutes = (start: number, end: number) => {
        let diff = end - start;
        if (diff < 0) diff += DAY_MINUTES;
        return diff;
    };

    const setSlotStartKeepingDuration = (slot: EventSlot, startMin: number) => {
        const duration = getSlotDurationMin(slot);
        const normalizedStart = normalizeDayMinutes(startMin);
        if (duration == null) {
            return { ...slot, start_time: formatTime(normalizedStart) };
        }
        return {
            ...slot,
            start_time: formatTime(normalizedStart),
            end_time: formatTime(normalizeDayMinutes(normalizedStart + duration)),
        };
    };

    const setSlotEndKeepingDuration = (slot: EventSlot, endMin: number) => {
        const duration = getSlotDurationMin(slot);
        const normalizedEnd = normalizeDayMinutes(endMin);
        if (duration == null) {
            return { ...slot, end_time: formatTime(normalizedEnd) };
        }
        const nextStart = normalizeDayMinutes(normalizedEnd - duration);
        return {
            ...slot,
            start_time: formatTime(nextStart),
            end_time: formatTime(normalizedEnd),
        };
    };

    const signedDiffMinutes = (fromMin: number, toMin: number) => {
        let diff = toMin - fromMin;
        if (diff > DAY_MINUTES / 2) diff -= DAY_MINUTES;
        if (diff < -DAY_MINUTES / 2) diff += DAY_MINUTES;
        return diff;
    };

    const shiftTimeByMinutes = (value: string | null, diffMin: number) => {
        if (!value || diffMin === 0) return value;
        const parsed = parseTime(value);
        if (parsed == null) return value;
        return formatTime(normalizeDayMinutes(parsed + diffMin));
    };

    const shiftSlotsBelow = (source: EventSlot[], slotIndex: number, diffMin: number) => {
        if (diffMin === 0) return source;
        return source.map((slot, index) => {
            if (index <= slotIndex) return slot;
            return {
                ...slot,
                start_time: shiftTimeByMinutes(slot.start_time ?? null, diffMin),
                end_time: shiftTimeByMinutes(slot.end_time ?? null, diffMin),
            };
        });
    };

    const suggestedBandDurationMin = (slot: EventSlot) => {
        const bandId = slot.band_id ?? null;
        if (!bandId) return null;
        const phase = slot.slot_phase ?? "show";
        return phase === "rehearsal_normal" || phase === "rehearsal_pre"
            ? durationMaps.rehearsal.get(bandId) ?? durationMaps.show.get(bandId) ?? null
            : durationMaps.show.get(bandId) ?? null;
    };

    const bandSongCount = (slot: EventSlot) => {
        const bandId = slot.band_id ?? null;
        if (!bandId) return 0;
        return durationMaps.songCounts.get(bandId) ?? 0;
    };

    const slotDurationInputValue = (slot: EventSlot) => {
        const duration = getSlotDurationMin(slot);
        return duration == null ? "" : String(duration);
    };

    const applyDurationToSlot = (slot: EventSlot, durationMin: number) => {
        if (!Number.isFinite(durationMin) || durationMin <= 0) return slot;
        const start = parseTime(slot.start_time ?? null);
        const end = parseTime(slot.end_time ?? null);
        if (start == null && end == null) return slot;
        if (start != null) {
            return {
                ...slot,
                end_time: formatTime(normalizeDayMinutes(start + durationMin)),
            };
        }
        return {
            ...slot,
            start_time: formatTime(normalizeDayMinutes((end ?? 0) - durationMin)),
        };
    };

    const formatTimeText = (value: string | null) => {
        if (!value) return "-";
        const parts = value.split(":");
        if (parts.length >= 2) {
            return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
        }
        return value;
    };

    const slotMainLabelForExport = (slot: EventSlot, bandName: string) => {
        const note = slot.note?.trim() ?? "";
        if (slot.slot_type === "band") return bandName || "\u672A\u8A2D\u5B9A\u30D0\u30F3\u30C9";
        if (slot.slot_type === "break" || note.includes("\u8EE2\u63DB")) return "\u8EE2\u63DB";
        return note || "\u4ED8\u5E2F\u4F5C\u696D";
    };

    const slotSectionLabelForExport = (slot: EventSlot) => {
        return slot.slot_phase === "show" ? "\u672C\u756A" : "\u30EA\u30CF";
    };

type PhaseKey = EventSlot["slot_phase"] | "prep" | "cleanup" | "rest";

    const slotPhaseKey = (slot: EventSlot): PhaseKey => {
        const note = slot.note?.trim();
        if (note === PREP_NOTE) return "prep";
        if (note === CLEANUP_NOTE || note === CLEANUP_NOTE_ALT) return "cleanup";
        if (note === REST_NOTE) return "rest";
        return slot.slot_phase ?? "show";
    };

    const slotToneClass = (slot: EventSlot) => {
        const note = slot.note?.trim() ?? "";
        if (note === PREP_NOTE || note === CLEANUP_NOTE || note === CLEANUP_NOTE_ALT || note === REST_NOTE) {
            return "before:bg-amber-400/80";
        }
        if (slot.slot_type === "break" || note.includes("\u8EE2\u63DB")) {
            return "before:bg-amber-400/80";
        }
        const phase = slotPhaseKey(slot);
        if (phase === "rehearsal_normal" || phase === "rehearsal_pre") {
            return "before:bg-sky-400/80";
        }
        if (phase === "show") {
            return "before:bg-fuchsia-400/80";
        }
        return "before:bg-muted";
    };

    useEffect(() => {
        if (event.normal_rehearsal_order) {
            setRehearsalOrder(event.normal_rehearsal_order);
        }
    }, [event.normal_rehearsal_order]);

    useEffect(() => {
        slotsRef.current = cloneSlotsSnapshot(slots);
    }, [slots]);

    useEffect(() => {
        setHistoryPast([]);
        setHistoryFuture([]);
    }, [event.id]);

    const handleUndo = () => {
        if (historyPast.length === 0) return;
        const previous = cloneSlotsSnapshot(historyPast[historyPast.length - 1] ?? []);
        const current = cloneSlotsSnapshot(slotsRef.current);

        setHistoryPast((past) => past.slice(0, -1));
        setHistoryFuture((future) => {
            const nextFuture = [current, ...future];
            return nextFuture.length > MAX_HISTORY_STEPS
                ? nextFuture.slice(0, MAX_HISTORY_STEPS)
                : nextFuture;
        });

        slotsRef.current = previous;
        setSlots(previous);
    };

    const handleRedo = () => {
        if (historyFuture.length === 0) return;
        const next = cloneSlotsSnapshot(historyFuture[0] ?? []);
        const current = cloneSlotsSnapshot(slotsRef.current);

        setHistoryFuture((future) => future.slice(1));
        setHistoryPast((past) => {
            const nextPast = [...past, current];
            return nextPast.length > MAX_HISTORY_STEPS
                ? nextPast.slice(nextPast.length - MAX_HISTORY_STEPS)
                : nextPast;
        });

        slotsRef.current = next;
        setSlots(next);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const activeId = String(active.id);
        const overId = String(over.id);
        const oldIndex = orderedSlots.findIndex((slot) => slot.id === activeId);
        const newIndex = orderedSlots.findIndex((slot) => slot.id === overId);
        if (oldIndex < 0 || newIndex < 0) return;

        const moved = arrayMove(orderedSlots, oldIndex, newIndex);
        const reordered = moved.map((slot, index) => {
            const positionSource = orderedSlots[index];
            return {
                ...slot,
                order_in_event: index + 1,
                start_time: positionSource?.start_time ?? null,
                end_time: positionSource?.end_time ?? null,
            };
        });
        applySlotsUpdate(reordered);
    };

    const handleSlotChange = <K extends keyof EventSlot>(
        id: string,
        key: K,
        value: EventSlot[K]
    ) => {
        applySlotsUpdate((prev) => {
            const sorted = sortSlotsByOrder(prev);
            const slotIndex = sorted.findIndex((slot) => slot.id === id);
            if (slotIndex < 0) return prev;

            const current = sorted[slotIndex];
            let updated: EventSlot = current;
            let diffMin = 0;

            if (key === "start_time") {
                const nextStart = parseTime((value as string | null) ?? null);
                const prevStart = parseTime(current.start_time ?? null);
                if (nextStart != null) {
                    updated = setSlotStartKeepingDuration(current, nextStart);
                } else {
                    updated = { ...current, start_time: null };
                }
                if (prevStart != null && nextStart != null) {
                    diffMin = signedDiffMinutes(prevStart, nextStart);
                }
            } else if (key === "end_time") {
                const nextEnd = parseTime((value as string | null) ?? null);
                const prevEnd = parseTime(current.end_time ?? null);
                if (nextEnd != null) {
                    updated = {
                        ...current,
                        end_time: formatTime(normalizeDayMinutes(nextEnd)),
                    };
                } else {
                    updated = { ...current, end_time: null };
                }
                if (prevEnd != null && nextEnd != null) {
                    diffMin = signedDiffMinutes(prevEnd, nextEnd);
                }
            } else {
                updated = { ...current, [key]: value };
            }

            const next = [...sorted];
            next[slotIndex] = updated;
            return shiftSlotsBelow(next, slotIndex, diffMin);
        });
    };

    const handleSlotDurationChange = (id: string, raw: string) => {
        const duration = Number.parseInt(raw, 10);
        if (!Number.isFinite(duration) || duration <= 0) return;
        applySlotsUpdate((prev) => {
            const sorted = sortSlotsByOrder(prev);
            const slotIndex = sorted.findIndex((slot) => slot.id === id);
            if (slotIndex < 0) return prev;

            const current = sorted[slotIndex];
            const prevEnd = parseTime(current.end_time ?? null);
            const updated = applyDurationToSlot(current, duration);
            const nextEnd = parseTime(updated.end_time ?? null);

            const next = [...sorted];
            next[slotIndex] = updated;
            if (prevEnd == null || nextEnd == null) {
                return next;
            }
            const diffMin = signedDiffMinutes(prevEnd, nextEnd);
            return shiftSlotsBelow(next, slotIndex, diffMin);
        });
    };

    const resolveSlotTypeValue = (slot: EventSlot) => {
        if (slot.slot_type === "band") return "band";
        if (slot.slot_type === "break") return "break";
        const note = slot.note?.trim() ?? "";
        if (note.includes("\u8EE2\u63DB")) return "break";
        return "other";
    };

    const handleSlotTypeSelect = (slot: EventSlot, nextType: "band" | "break" | "other") => {
        applySlotsUpdate((prev) => {
            const sorted = sortSlotsByOrder(prev);
            const slotIndex = sorted.findIndex((current) => current.id === slot.id);
            if (slotIndex < 0) return prev;

            const current = sorted[slotIndex];
            const note = current.note?.trim() ?? "";

            let updated: EventSlot = current;
            if (nextType === "band") {
                updated = { ...current, slot_type: "band" };
            } else if (nextType === "break") {
                updated = { ...current, slot_type: "break", band_id: null, note: "\u8EE2\u63DB" };
            } else {
                updated = {
                    ...current,
                    slot_type: "other",
                    band_id: null,
                    note: note === "\u8EE2\u63DB" ? "" : current.note,
                    changeover_min: current.changeover_min ?? DEFAULT_OTHER_DURATION_MIN,
                };
            }

            const next = [...sorted];
            next[slotIndex] = updated;
            return next;
        });
    };

    const handleAddSlot = () => {
        const nextOrder =
            slots.reduce((max, slot) => Math.max(max, slot.order_in_event ?? 0), 0) + 1;
        const newSlot: EventSlot = {
            id: crypto.randomUUID(),
            event_id: event.id,
            band_id: null,
            slot_type: "band",
            slot_phase: "show",
            order_in_event: nextOrder,
            start_time: null,
            end_time: null,
            changeover_min: event.default_changeover_min ?? 15,
            note: "",
        };
        applySlotsUpdate((prev) => [...prev, newSlot]);
    };

    const handleAddRehearsalSlots = (phase: EventSlot["slot_phase"]) => {
        if (bands.length === 0) {
            toast.error("\u30D0\u30F3\u30C9\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
            return;
        }
        const nextOrder =
            slots.reduce((max, slot) => Math.max(max, slot.order_in_event ?? 0), 0) + 1;
        const list = rehearsalOrder === "reverse" ? [...bands].reverse() : [...bands];
        const newSlots = list.map((band, index) => ({
            id: crypto.randomUUID(),
            event_id: event.id,
            band_id: band.id,
            slot_type: "band" as const,
            slot_phase: phase ?? "rehearsal_normal",
            order_in_event: nextOrder + index,
            start_time: null,
            end_time: null,
            changeover_min: event.default_changeover_min ?? 15,
            note: "",
        }));
        applySlotsUpdate((prev) => [...prev, ...newSlots]);
    };

    const handleAddSpecialSlot = (note: string, phase: EventSlot["slot_phase"]) => {
        const nextOrder =
            slots.reduce((max, slot) => Math.max(max, slot.order_in_event ?? 0), 0) + 1;
        const isPrep = note === PREP_NOTE;
        const isCleanup = note === CLEANUP_NOTE;
        let duration = isPrep || isCleanup ? DEFAULT_OTHER_DURATION_MIN : null;
        let startTime: string | null = null;
        let endTime: string | null = null;
        if (isPrep) {
            const assemblyStart = parseTime(event.assembly_time ?? null);
            const rehearsalStart = parseTime(event.rehearsal_start_time ?? null);
            if (assemblyStart != null) {
                startTime = formatTime(assemblyStart);
                if (rehearsalStart != null && rehearsalStart >= assemblyStart) {
                    endTime = formatTime(rehearsalStart);
                    duration = rehearsalStart - assemblyStart;
                } else {
                    endTime = formatTime(assemblyStart + DEFAULT_OTHER_DURATION_MIN);
                }
            } else if (rehearsalStart != null) {
                const prepStartValue = rehearsalStart - DEFAULT_OTHER_DURATION_MIN;
                if (prepStartValue >= 0) {
                    startTime = formatTime(prepStartValue);
                }
                endTime = formatTime(rehearsalStart);
            }
        }
        const newSlot: EventSlot = {
            id: crypto.randomUUID(),
            event_id: event.id,
            band_id: null,
            slot_type: "other",
            slot_phase: phase ?? "show",
            order_in_event: nextOrder,
            start_time: startTime,
            end_time: endTime,
            changeover_min: duration,
            note,
        };
        applySlotsUpdate((prev) => [...prev, newSlot]);
    };

    const applyRehearsalSort = (
        phase: "rehearsal_normal" | "rehearsal_pre",
        order: "same" | "reverse"
    ) => {
        if (bands.length === 0) return;
        const targetSlots = orderedSlots.filter(
            (slot) =>
                slot.slot_phase === phase &&
                slot.slot_type === "band" &&
                slot.band_id
        );
        if (targetSlots.length <= 1) return;

        const bandSequence = order === "reverse" ? [...bands].reverse() : [...bands];
        const bandOrder = new Map(bandSequence.map((band, index) => [band.id, index]));
        const sortedTargets = [...targetSlots].sort((a, b) => {
            const orderA = bandOrder.get(a.band_id ?? "") ?? Number.MAX_SAFE_INTEGER;
            const orderB = bandOrder.get(b.band_id ?? "") ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            const currentA = a.order_in_event ?? 0;
            const currentB = b.order_in_event ?? 0;
            return currentA - currentB;
        });

        let cursor = 0;
        const next = orderedSlots
            .map((slot) => {
                if (
                    slot.slot_phase === phase &&
                    slot.slot_type === "band" &&
                    slot.band_id
                ) {
                    const replacement = sortedTargets[cursor++];
                    return replacement ?? slot;
                }
                return slot;
            })
            .map((slot, index) => ({
                ...slot,
                order_in_event: index + 1,
            }));

        const currentOrder = orderedSlots.map((slot) => slot.id).join("|");
        const nextOrder = next.map((slot) => slot.id).join("|");
        if (currentOrder === nextOrder) return;
        applySlotsUpdate(next);
    };

    const handleRehearsalOrderChange = async (nextOrder: "same" | "reverse") => {
        if (savingRehearsalOrder || nextOrder === rehearsalOrder) return;
        setRehearsalOrder(nextOrder);
        applyRehearsalSort(rehearsalPhase, nextOrder);
        setSavingRehearsalOrder(true);
        const { error } = await supabase
            .from("events")
            .update({ normal_rehearsal_order: nextOrder })
            .eq("id", event.id);
        if (error) {
            console.error(error);
            toast.error("\u901A\u5E38\u30EA\u30CF\u9806\u5E8F\u306E\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
        } else {
            toast.success("\u901A\u5E38\u30EA\u30CF\u9806\u5E8F\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002");
            await onRefresh();
        }
        setSavingRehearsalOrder(false);
    };

    const handleRehearsalPhaseChange = (nextPhase: "rehearsal_normal" | "rehearsal_pre") => {
        if (nextPhase === rehearsalPhase) return;
        setRehearsalPhase(nextPhase);
        applyRehearsalSort(nextPhase, rehearsalOrder);
    };

    const phaseLabelByValue = (phase: "show" | "rehearsal_normal" | "rehearsal_pre") =>
        slotPhaseOptions.find((opt) => opt.value === phase)?.label ?? phase;

    const alignBandOrderByPhase = (
        sourcePhase: "show" | "rehearsal_normal" | "rehearsal_pre",
        targetPhase: "show" | "rehearsal_normal" | "rehearsal_pre"
    ) => {
        const resolveBandPhase = (slot: EventSlot) => slot.slot_phase ?? "show";
        const sorted = sortSlotsByOrder(slots);
        const sourceBandIds = sorted
            .filter(
                (slot) =>
                    slot.slot_type === "band" &&
                    resolveBandPhase(slot) === sourcePhase
            )
            .map((slot) => slot.band_id ?? null);
        const targetIndexes = sorted
            .map((slot, index) => ({ slot, index }))
            .filter(
                ({ slot }) => slot.slot_type === "band" && resolveBandPhase(slot) === targetPhase
            )
            .map(({ index }) => index);

        if (sourceBandIds.length === 0) {
            toast.info(`${phaseLabelByValue(sourcePhase)}側にバンド枠がありません。`);
            return;
        }
        if (targetIndexes.length === 0) {
            toast.info(`${phaseLabelByValue(targetPhase)}側にバンド枠がありません。`);
            return;
        }

        // show <-> 通常リハ の同期では、通常リハ順序（同順/逆順）に合わせて対応位置を決める。
        const shouldFlipByRehearsalOrder =
            rehearsalOrder === "reverse" &&
            ((sourcePhase === "show" && targetPhase === "rehearsal_normal") ||
                (sourcePhase === "rehearsal_normal" && targetPhase === "show"));

        const syncCount = Math.min(sourceBandIds.length, targetIndexes.length);
        let changed = 0;
        const next = [...sorted];
        for (let i = 0; i < targetIndexes.length; i += 1) {
            const index = targetIndexes[i];
            const sourceIndex = shouldFlipByRehearsalOrder
                ? sourceBandIds.length - 1 - i
                : i;
            const nextBandId = sourceBandIds[sourceIndex] ?? null;
            const target = next[index];
            if (!target || target.band_id === nextBandId) continue;
            next[index] = { ...target, band_id: nextBandId };
            changed += 1;
        }

        if (changed === 0) {
            toast.info("同期対象の変更はありませんでした。");
            return;
        }

        applySlotsUpdate(next);
        if (sourceBandIds.length !== targetIndexes.length) {
            toast.success(
                `${phaseLabelByValue(targetPhase)}を${phaseLabelByValue(sourcePhase)}に合わせました（${syncCount}件同期・枠数差あり）。`
            );
            return;
        }
        toast.success(
            `${phaseLabelByValue(targetPhase)}を${phaseLabelByValue(sourcePhase)}に合わせました。`
        );
    };

    const alignSlotsToEventTimeSettings = (source: EventSlot[]) => {
        if (source.length === 0) return source;

        const sorted = [...source].sort((a, b) => {
            const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            const startA = a.start_time ?? "";
            const startB = b.start_time ?? "";
            if (startA !== startB) return startA.localeCompare(startB);
            return (a.note ?? "").localeCompare(b.note ?? "");
        });

        const next: EventSlot[] = compactConsecutiveTimedSlots(sorted).map((slot, index) => ({
            ...slot,
            order_in_event: index + 1,
        }));

        const prepIndex = next.findIndex((slot) => slot.note?.trim() === PREP_NOTE);
        const restIndex = next.findIndex((slot) => slot.note?.trim() === REST_NOTE);
        const cleanupIndex = next.findIndex((slot) => {
            const note = slot.note?.trim() ?? "";
            return note === CLEANUP_NOTE || note === CLEANUP_NOTE_ALT;
        });
        const firstRehearsalIndex = next.findIndex(
            (slot) =>
                slot.slot_type === "band" &&
                (slot.slot_phase === "rehearsal_normal" || slot.slot_phase === "rehearsal_pre")
        );
        const firstShowIndex = next.findIndex(
            (slot) => slot.slot_type === "band" && slot.slot_phase === "show"
        );
        const lastShowIndex = (() => {
            for (let index = next.length - 1; index >= 0; index -= 1) {
                const slot = next[index];
                if (slot.slot_type === "band" && slot.slot_phase === "show" && getSlotDurationMin(slot) != null) {
                    return index;
                }
            }
            return -1;
        })();

        const assemblyMin = parseTime(event.assembly_time ?? null);
        const rehearsalMin = parseTime(event.rehearsal_start_time ?? null);
        const openMin = parseTime(event.open_time ?? null);
        const startMin = parseTime(event.start_time ?? null);
        const closeMin = parseTime(event.end_time ?? null);

        if (prepIndex >= 0) {
            if (assemblyMin != null && rehearsalMin != null) {
                const duration = diffForwardMinutes(assemblyMin, rehearsalMin);
                if (duration > 0) {
                    next[prepIndex] = {
                        ...next[prepIndex],
                        start_time: formatTime(normalizeDayMinutes(assemblyMin)),
                        end_time: formatTime(normalizeDayMinutes(rehearsalMin)),
                    };
                } else {
                    next[prepIndex] = setSlotStartKeepingDuration(next[prepIndex], assemblyMin);
                }
            } else if (assemblyMin != null) {
                next[prepIndex] = setSlotStartKeepingDuration(next[prepIndex], assemblyMin);
            } else if (rehearsalMin != null) {
                next[prepIndex] = setSlotEndKeepingDuration(next[prepIndex], rehearsalMin);
            }
        } else if (firstRehearsalIndex >= 0 && rehearsalMin != null) {
            next[firstRehearsalIndex] = setSlotStartKeepingDuration(next[firstRehearsalIndex], rehearsalMin);
        }

        const openAnchorIndex = restIndex >= 0 ? restIndex : firstShowIndex;
        if (openAnchorIndex >= 0 && openMin != null) {
            next[openAnchorIndex] = setSlotStartKeepingDuration(next[openAnchorIndex], openMin);
        }

        if (firstShowIndex >= 0 && startMin != null) {
            next[firstShowIndex] = setSlotStartKeepingDuration(next[firstShowIndex], startMin);
        }

        if (restIndex >= 0) {
            let restStartMin = parseTime(next[restIndex].start_time ?? null);
            const lastRehearsalBeforeRestIndex = (() => {
                for (let index = restIndex - 1; index >= 0; index -= 1) {
                    const slot = next[index];
                    if (
                        slot.slot_type === "band" &&
                        (slot.slot_phase === "rehearsal_normal" || slot.slot_phase === "rehearsal_pre")
                    ) {
                        return index;
                    }
                }
                return -1;
            })();

            if (lastRehearsalBeforeRestIndex >= 0) {
                const rehearsalEndMin = parseTime(next[lastRehearsalBeforeRestIndex].end_time ?? null);
                if (rehearsalEndMin != null) {
                    restStartMin = rehearsalEndMin;
                    next[restIndex] = setSlotStartKeepingDuration(next[restIndex], rehearsalEndMin);
                }
            }

            if (lastShowIndex > restIndex) {
                let cursor = parseTime(next[lastShowIndex].start_time ?? null);
                if (cursor != null) {
                    const backwardAnchorIndex =
                        startMin != null && firstShowIndex > restIndex ? firstShowIndex : restIndex;
                    for (let index = lastShowIndex - 1; index > backwardAnchorIndex; index -= 1) {
                        const duration = getSlotDurationMin(next[index]);
                        if (duration == null || cursor == null) {
                            cursor = null;
                            continue;
                        }
                        const endCursor = cursor;
                        next[index] = setSlotEndKeepingDuration(next[index], endCursor);
                        cursor = parseTime(next[index].start_time ?? null);
                    }
                }

                let firstAfterRestIndex = -1;
                const firstAfterAnchor = firstShowIndex > restIndex ? firstShowIndex : restIndex + 1;
                for (let index = firstAfterAnchor; index < next.length; index += 1) {
                    if (getSlotDurationMin(next[index]) != null) {
                        firstAfterRestIndex = index;
                        break;
                    }
                }

                if (restStartMin != null && firstAfterRestIndex > restIndex) {
                    const firstAfterStart = parseTime(next[firstAfterRestIndex].start_time ?? null);
                    if (firstAfterStart != null) {
                        const restDuration = Math.max(1, diffForwardMinutes(restStartMin, firstAfterStart));
                        next[restIndex] = applyDurationToSlot(
                            setSlotStartKeepingDuration(next[restIndex], restStartMin),
                            restDuration
                        );
                    }
                }
            }
        }

        if (closeMin != null) {
            if (cleanupIndex >= 0) {
                if (lastShowIndex >= 0) {
                    const showEndMin = parseTime(next[lastShowIndex].end_time ?? null);
                    if (showEndMin != null) {
                        next[cleanupIndex] = {
                            ...next[cleanupIndex],
                            start_time: formatTime(normalizeDayMinutes(showEndMin)),
                            end_time: formatTime(normalizeDayMinutes(closeMin)),
                        };
                    } else {
                        next[cleanupIndex] = setSlotEndKeepingDuration(next[cleanupIndex], closeMin);
                    }
                } else {
                    next[cleanupIndex] = setSlotEndKeepingDuration(next[cleanupIndex], closeMin);
                }
            } else if (lastShowIndex >= 0) {
                next[lastShowIndex] = setSlotEndKeepingDuration(next[lastShowIndex], closeMin);
            }
        }

        return next.map((slot, index) => ({
            ...slot,
            order_in_event: index + 1,
        }));
    };

    const handleCompactTimes = () => {
        if (orderedSlots.length === 0) return;
        const adjusted = alignSlotsToEventTimeSettings(orderedSlots);
        const changed = adjusted.reduce((count, slot, index) => {
            const prev = orderedSlots[index];
            if (!prev) return count + 1;
            return slot.start_time !== prev.start_time || slot.end_time !== prev.end_time
                ? count + 1
                : count;
        }, 0);

        if (changed === 0) {
            toast.info("No time adjustments were needed.");
            return;
        }
        applySlotsUpdate(adjusted);
        toast.success("Adjusted " + changed + " slot timing(s).");
    };

    const handleExportTimetable = () => {
        if (orderedSlots.length === 0) {
            toast.error("\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8\u3059\u308BTT\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
            return;
        }

        void (async () => {
            try {
                const { Workbook } = await import("exceljs");
                const workbook = new Workbook();
                const sheet = workbook.addWorksheet("Sheet1");

                sheet.columns = [
                    { width: 8 },
                    { width: 34 },
                    { width: 11 },
                    { width: 8 },
                    { width: 10 },
                    { width: 4 },
                    { width: 10 },
                ];

                const bandNameMap = new Map(bands.map((band) => [band.id, band.name]));
                const memberCountMap = new Map<string, number>();
                members.forEach((member) => {
                    const count = memberCountMap.get(member.band_id) ?? 0;
                    memberCountMap.set(member.band_id, count + 1);
                });

                const showBandOrder = new Map<string, number>();
                let showCounter = 1;
                orderedSlots.forEach((slot) => {
                    if (slot.slot_type !== "band" || slot.slot_phase !== "show" || !slot.band_id) return;
                    if (showBandOrder.has(slot.band_id)) return;
                    showBandOrder.set(slot.band_id, showCounter++);
                });

                const titleText = `${event.name ?? "Event"} TT`;
                const palette = {
                    titleBg: "FF0F2942",
                    titleFg: "FFFFFFFF",
                    headerBg: "FFDCEBFF",
                    headerFg: "FF102A43",
                    sectionShowA: "FFF8D2EC",
                    sectionShow: "FFFFE6F5",
                    sectionRehearsalA: "FFD4E9FF",
                    sectionRehearsal: "FFEAF5FF",
                    bandShow: "FFFFF0F8",
                    bandRehearsal: "FFF2F8FF",
                    breakRow: "FFFFF4CC",
                    restRow: "FFE7F7EE",
                    specialRow: "FFEDF2FF",
                    otherRow: "FFF6F7FB",
                    border: "FFD1D5DB",
                };
                const titleRow = sheet.addRow([titleText, "", "", "", "", "", ""]);
                sheet.mergeCells(`A${titleRow.number}:G${titleRow.number}`);

                const headerRow = sheet.addRow([
                    "",
                    "\u30D0\u30F3\u30C9\u540D",
                    "\u30E1\u30F3\u30D0\u30FC\u6570",
                    "\u66F2\u6570",
                    "\u958B\u59CB\u6642\u9593",
                    "~",
                    "\u7D42\u4E86\u6642\u9593",
                ]);

                titleRow.height = 28;
                titleRow.eachCell((cell) => {
                    cell.font = { bold: true, size: 14, color: { argb: palette.titleFg } };
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.titleBg } };
                    cell.alignment = { horizontal: "center", vertical: "middle" };
                });
                headerRow.eachCell((cell, col) => {
                    cell.font = { bold: true, color: { argb: palette.headerFg } };
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.headerBg } };
                    cell.alignment = {
                        horizontal: col === 2 ? "left" : "center",
                        vertical: "middle",
                    };
                    cell.border = {
                        top: { style: "thin", color: { argb: palette.border } },
                        left: { style: "thin", color: { argb: palette.border } },
                        bottom: { style: "thin", color: { argb: palette.border } },
                        right: { style: "thin", color: { argb: palette.border } },
                    };
                });

                let currentSection: string | null = null;
                orderedSlots.forEach((slot) => {
                    const section = slotSectionLabelForExport(slot);
                    if (section !== currentSection) {
                        currentSection = section;
                        const sectionRow = sheet.addRow(["", section, "", "", "", "", ""]);
                        sheet.mergeCells(`B${sectionRow.number}:G${sectionRow.number}`);
                        sectionRow.height = 22;
                        sectionRow.eachCell((cell, col) => {
                            if (section === "\u672C\u756A") {
                                cell.fill = {
                                    type: "pattern",
                                    pattern: "solid",
                                    fgColor: { argb: col === 1 ? palette.sectionShowA : palette.sectionShow },
                                };
                            } else {
                                cell.fill = {
                                    type: "pattern",
                                    pattern: "solid",
                                    fgColor: { argb: col === 1 ? palette.sectionRehearsalA : palette.sectionRehearsal },
                                };
                            }
                            cell.font = { bold: true, color: { argb: palette.headerFg } };
                            cell.alignment = { horizontal: col === 1 ? "center" : "left", vertical: "middle" };
                            cell.border = {
                                top: { style: "thin", color: { argb: palette.border } },
                                left: { style: "thin", color: { argb: palette.border } },
                                bottom: { style: "thin", color: { argb: palette.border } },
                                right: { style: "thin", color: { argb: palette.border } },
                            };
                        });
                    }

                    const bandName = slot.band_id ? bandNameMap.get(slot.band_id) ?? "" : "";
                    const label = slotMainLabelForExport(slot, bandName);
                    const startText = slot.start_time ? formatTimeText(slot.start_time) : "";
                    const endText = slot.end_time ? formatTimeText(slot.end_time) : "";
                    const separator = startText || endText ? "~" : "";
                    const bandNo =
                        slot.slot_type === "band" && slot.band_id
                            ? showBandOrder.get(slot.band_id) ?? ""
                            : "";

                    const row = sheet.addRow([
                        bandNo,
                        label,
                        slot.slot_type === "band" && slot.band_id
                            ? memberCountMap.get(slot.band_id) ?? ""
                            : "",
                        slot.slot_type === "band" ? bandSongCount(slot) : "",
                        startText,
                        separator,
                        endText,
                    ]);

                    const note = slot.note?.trim() ?? "";
                    let fillArgb = "";
                    if (slot.slot_type === "break" || note.includes("\u8EE2\u63DB")) {
                        fillArgb = palette.breakRow;
                    } else if (note === REST_NOTE) {
                        fillArgb = palette.restRow;
                    } else if (note === PREP_NOTE || note === CLEANUP_NOTE || note === CLEANUP_NOTE_ALT) {
                        fillArgb = palette.specialRow;
                    } else if (slot.slot_type === "band") {
                        fillArgb =
                            slot.slot_phase === "show" ? palette.bandShow : palette.bandRehearsal;
                    } else {
                        fillArgb = palette.otherRow;
                    }

                    row.eachCell((cell, col) => {
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
                        cell.alignment = {
                            horizontal: col === 2 ? "left" : "center",
                            vertical: "middle",
                        };
                        cell.border = {
                            top: { style: "thin", color: { argb: palette.border } },
                            left: { style: "thin", color: { argb: palette.border } },
                            bottom: { style: "thin", color: { argb: palette.border } },
                            right: { style: "thin", color: { argb: palette.border } },
                        };
                    });
                });

                const eventDate = (event.date ?? "").replaceAll("-", "");
                const filenameBase = `${event.name ?? "event"}_TT_${eventDate || "export"}`
                    .replace(/[\\/:*?"<>|]/g, "_")
                    .trim();
                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `${filenameBase || "TT_export"}.xlsx`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);

                toast.success("TT\u3092\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8\u3057\u307E\u3057\u305F\u3002");
            } catch (error) {
                console.error(error);
                toast.error("\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
            }
        })();
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (!window.confirm("\u3053\u306E\u30B9\u30ED\u30C3\u30C8\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uff1f")) return;

        // 先にUIから削除してレスポンスを早くする
        applySlotsUpdate((prev) => prev.filter((s) => s.id !== slotId));

        // DB削除に失敗した場合は再取得してUIを巻き戻す
        const { error } = await supabase.from("event_slots").delete().eq("id", slotId);
        if (error) {
            console.error(error);
            // エラー時は再取得してUI整合を回復
            toast.error("\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
            await onRefresh();
        } else {
            toast.success("\u30B9\u30ED\u30C3\u30C8\u3092\u524A\u9664\u3057\u307E\u3057\u305F\u3002");
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const payloads = orderedSlots.map((slot, index) => {
            const note = slot.note?.trim() ?? "";
            let slotType = slot.slot_type;
            let nextNote = slot.note || null;
            if (slotType === "mc") slotType = "other";
            if (slotType === "other" && note.includes("\u8EE2\u63DB")) {
                slotType = "break";
                nextNote = "\u8EE2\u63DB";
            }
            if (slotType === "break") {
                nextNote = "\u8EE2\u63DB";
            }
            return ({
                id: slot.id,
                event_id: event.id,
                band_id: slotType === "band" ? slot.band_id ?? null : null,
                slot_type: slotType,
                slot_phase: slot.slot_phase ?? "show",
                order_in_event: slot.order_in_event ?? index + 1,
                start_time: slot.start_time || null,
                end_time: slot.end_time || null,
                changeover_min:
                    slot.changeover_min == null || Number.isNaN(Number(slot.changeover_min))
                        ? null
                        : Number(slot.changeover_min),
                note: nextNote,
            });
        });

        const { data, error } = await supabase
            .from("event_slots")
            .upsert(payloads, { onConflict: "id" })
            .select();

        if (error) {
            console.error(error);
            toast.error("\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
        } else {
            // 返却データで最新化
            applySlotsUpdate((data ?? []) as EventSlot[], { recordHistory: false, clearHistory: true });
            toast.success("\u30BF\u30A4\u30E0\u30C6\u30FC\u30D6\u30EB\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002");
        }
        setSaving(false);
    };

    const handleGenerate = async () => {
        if (bands.length === 0) {
            toast.error("No bands found.");
            return;
        }
        if (slots.length > 0) {
            if (!window.confirm("Regenerate and delete existing slots?")) return;
        }

        setGenerating(true);

        // delete existing slots
        const { error: delError } = await supabase.from("event_slots").delete().eq("event_id", event.id);
        if (delError) {
            console.error(delError);
            toast.error("Failed to delete existing slots.");
            setGenerating(false);
            return;
        }

        // delete existing slots??
        const showDurationMap = new Map<string, number>();
        const rehearsalDurationMap = new Map<string, number>();
        songs.forEach((song) => {
            if (!song.band_id || !song.duration_sec) return;
            const current = showDurationMap.get(song.band_id) ?? 0;
            showDurationMap.set(song.band_id, current + song.duration_sec);
            if (song.entry_type === "mc") return;
            const rehearsalCurrent = rehearsalDurationMap.get(song.band_id) ?? 0;
            rehearsalDurationMap.set(song.band_id, rehearsalCurrent + song.duration_sec);
        });

        const toRoundedMinutes = (seconds: number, extra: number) => {
            if (seconds <= 0) return null;
            const minutes = Math.ceil(seconds / 60);
            const rounded = roundUpToStep(minutes, ROUND_STEP_MIN);
            return rounded + extra;
        };

        const showStart = parseTime(event.start_time ?? null);
        let showCursor = showStart;
        const changeover = event.default_changeover_min ?? 15;

        const rehearsalStart = parseTime(event.rehearsal_start_time ?? null);
        let rehearsalCursor = rehearsalStart;

        const payloads: Array<Record<string, unknown>> = [];
        let orderIndex = 1;

        let prepStart: string | null = null;
        let prepEnd: string | null = null;
        let prepDuration = DEFAULT_OTHER_DURATION_MIN;
        const assemblyValue = parseTime(event.assembly_time ?? null);
        if (assemblyValue != null) {
            prepStart = formatTime(assemblyValue);
            if (rehearsalStart != null && rehearsalStart >= assemblyValue) {
                prepEnd = formatTime(rehearsalStart);
                prepDuration = rehearsalStart - assemblyValue;
            } else {
                prepEnd = formatTime(assemblyValue + DEFAULT_OTHER_DURATION_MIN);
            }
        } else if (rehearsalStart != null) {
            const prepStartValue = rehearsalStart - DEFAULT_OTHER_DURATION_MIN;
            if (prepStartValue >= 0) {
                prepStart = formatTime(prepStartValue);
            }
            prepEnd = formatTime(rehearsalStart);
        } else {
            const fallbackStart = parseTime(event.open_time ?? null);
            if (fallbackStart != null) {
                prepStart = formatTime(fallbackStart);
                prepEnd = formatTime(fallbackStart + DEFAULT_OTHER_DURATION_MIN);
            }
        }

        payloads.push({
            event_id: event.id,
            band_id: null,
            slot_type: "other",
            slot_phase: "rehearsal_normal",
            order_in_event: orderIndex++,
            start_time: prepStart,
            end_time: prepEnd,
            changeover_min: prepDuration,
            note: PREP_NOTE,
        });

        const rehearsalList = rehearsalOrder === "reverse" ? [...bands].reverse() : [...bands];
        rehearsalList.forEach((band) => {
            const computedRehearsalMin =
                toRoundedMinutes(rehearsalDurationMap.get(band.id) ?? 0, REHEARSAL_EXTRA_MIN) ??
                DEFAULT_BAND_DURATION_MIN + REHEARSAL_EXTRA_MIN;
            const durationMin = Math.max(MIN_REHEARSAL_MIN, computedRehearsalMin);
            let startTime: string | null = null;
            let endTime: string | null = null;
            if (rehearsalCursor != null) {
                startTime = formatTime(rehearsalCursor);
                endTime = formatTime(rehearsalCursor + durationMin);
                rehearsalCursor += durationMin;
            }
            payloads.push({
                event_id: event.id,
                band_id: band.id,
                slot_type: "band",
                slot_phase: rehearsalPhase,
                order_in_event: orderIndex++,
                start_time: startTime,
                end_time: endTime,
                changeover_min: event.default_changeover_min ?? 15,
                note: null,
            });
        });

        if (rehearsalPhase === "rehearsal_normal") {
            const restMinutes = DEFAULT_OTHER_DURATION_MIN;
            let restStart: string | null = null;
            let restEnd: string | null = null;
            if (showStart != null) {
                const restStartValue = showStart - restMinutes;
                if (restStartValue >= 0) {
                    restStart = formatTime(restStartValue);
                    restEnd = formatTime(showStart);
                }
            }
            payloads.push({
                event_id: event.id,
                band_id: null,
                slot_type: "other",
                slot_phase: "rehearsal_normal",
                order_in_event: orderIndex++,
                start_time: restStart,
                end_time: restEnd,
                changeover_min: restMinutes,
                note: REST_NOTE,
            });
        }

        bands.forEach((band, index) => {
            const durationMin =
                toRoundedMinutes(showDurationMap.get(band.id) ?? 0, 0) ?? DEFAULT_BAND_DURATION_MIN;
            let startTime: string | null = null;
            let endTime: string | null = null;
            if (showCursor != null) {
                startTime = formatTime(showCursor);
                endTime = formatTime(showCursor + durationMin);
            }

            payloads.push({
                event_id: event.id,
                band_id: band.id,
                slot_type: "band",
                slot_phase: "show",
                order_in_event: orderIndex++,
                start_time: startTime,
                end_time: endTime,
                changeover_min: changeover,
                note: null,
            });

            if (showCursor != null) {
                showCursor += durationMin;
            }

            if (index < bands.length - 1 && changeover > 0) {
                let changeoverStart: string | null = null;
                let changeoverEnd: string | null = null;
                if (showCursor != null) {
                    changeoverStart = formatTime(showCursor);
                    changeoverEnd = formatTime(showCursor + changeover);
                }
                payloads.push({
                    event_id: event.id,
                    band_id: null,
                    slot_type: "break",
                    slot_phase: "show",
                    order_in_event: orderIndex++,
                    start_time: changeoverStart,
                    end_time: changeoverEnd,
                    changeover_min: changeover,
                    note: "\u8EE2\u63DB",
                });

                if (showCursor != null) {
                    showCursor += changeover;
                }
            }
        });

        const cleanupStart = showCursor != null ? formatTime(showCursor) : null;
        const cleanupEnd = showCursor != null ? formatTime(showCursor + DEFAULT_OTHER_DURATION_MIN) : null;

        payloads.push({
            event_id: event.id,
            band_id: null,
            slot_type: "other",
            slot_phase: "show",
            order_in_event: orderIndex++,
            start_time: cleanupStart,
            end_time: cleanupEnd,
            changeover_min: DEFAULT_OTHER_DURATION_MIN,
            note: CLEANUP_NOTE,
        });

        const { data, error } = await supabase
            .from("event_slots")
            .insert(payloads)
            .select();

        if (error || !data) {
            console.error(error);
            toast.error("Failed to auto-generate slots.");
        } else {
            applySlotsUpdate(data as EventSlot[], { recordHistory: false, clearHistory: true });
            toast.success("Slots generated.");
        }
        setGenerating(false);
    };

    return (
        <Card className="bg-card/60">
            <CardHeader>
                <div className="flex flex-col gap-3">
                    <div>
                        <CardTitle className="text-lg">タイムテーブル</CardTitle>
                        <CardDescription>
                            各バンドの演奏順や付帯作業、転換時間を設定します。
                        </CardDescription>
                    </div>
                    <div className="w-full">
                        <div className="flex flex-wrap gap-2 pb-1">
                            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-muted-foreground shrink-0">
                                <span className="font-medium text-foreground">通常リハ順序</span>
                                <label className="inline-flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name="rehearsal-order"
                                        value="same"
                                        checked={rehearsalOrder === "same"}
                                        onChange={() => handleRehearsalOrderChange("same")}
                                        disabled={savingRehearsalOrder}
                                    />
                                    同順
                                </label>
                                <label className="inline-flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name="rehearsal-order"
                                        value="reverse"
                                        checked={rehearsalOrder === "reverse"}
                                        onChange={() => handleRehearsalOrderChange("reverse")}
                                        disabled={savingRehearsalOrder}
                                    />
                                    逆順
                                </label>
                                {savingRehearsalOrder && (
                                    <span className="inline-flex items-center gap-1">
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        保存中
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-muted-foreground shrink-0">
                                <span className="font-medium text-foreground">リハ種別</span>
                                <label className="inline-flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name="rehearsal-phase"
                                        value="rehearsal_normal"
                                        checked={rehearsalPhase === "rehearsal_normal"}
                                        onChange={() => handleRehearsalPhaseChange("rehearsal_normal")}
                                    />
                                    通常リハ
                                </label>
                                <label className="inline-flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name="rehearsal-phase"
                                        value="rehearsal_pre"
                                        checked={rehearsalPhase === "rehearsal_pre"}
                                        onChange={() => handleRehearsalPhaseChange("rehearsal_pre")}
                                    />
                                    直前リハ
                                </label>
                                <Button variant="outline" size="sm" onClick={() => handleAddRehearsalSlots(rehearsalPhase)}>
                                    リハ追加
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-24"
                                    onClick={() => handleAddSpecialSlot(PREP_NOTE, "rehearsal_normal")}
                                >
                                    準備追加
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-24"
                                    onClick={() => handleAddSpecialSlot(CLEANUP_NOTE, "show")}
                                >
                                    撤収追加
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => alignBandOrderByPhase("show", rehearsalPhase)}
                                    disabled={orderedSlots.length === 0 || !hasSelectedRehearsalBands}
                                >
                                    リハに本番を合わせる
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => alignBandOrderByPhase(rehearsalPhase, "show")}
                                    disabled={orderedSlots.length === 0 || !hasSelectedRehearsalBands}
                                >
                                    本番にリハを合わせる
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 shrink-0">
                                <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo}>
                                    <Undo2 className="w-4 h-4 mr-2" />
                                    戻す
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo}>
                                    <Redo2 className="w-4 h-4 mr-2" />
                                    やり直し
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 shrink-0">
                                <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
                                    <RefreshCw className={cn("w-4 h-4 mr-2", generating && "animate-spin")} />
                                    自動生成
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExportTimetable}
                                    disabled={orderedSlots.length === 0}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    エクスポート
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCompactTimes}
                                    disabled={orderedSlots.length === 0}
                                >
                                    時間補正
                                </Button>
                                <Button onClick={handleSave} disabled={saving} size="sm">
                                    <Save className="w-4 h-4 mr-2" />
                                    保存
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={orderedSlots.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="max-h-[68vh] overflow-y-auto overflow-x-hidden pr-1">
                            <div className="space-y-2">
                            {orderedSlots.map((slot) => (
                                <SortableItem key={slot.id} id={slot.id}>
                                    {({ attributes, listeners, setActivatorNodeRef, isDragging }) => {
                                        const isSelected = slot.slot_type === "band" && slot.band_id === selectedBandId;
                                        return (
                                            <div
                                                className={cn(
                                                    "relative rounded-lg border bg-card px-2 py-2 pl-4 shadow-sm cursor-pointer transition-colors overflow-hidden",
                                                    "before:absolute before:left-2 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:content-['']",
                                                    slotToneClass(slot),
                                                    isDragging && "shadow-lg bg-accent/50",
                                                    isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                                                )}
                                                onClick={() => {
                                                    if (slot.slot_type === "band" && slot.band_id) {
                                                        onBandSelect?.(slot.band_id);
                                                    }
                                                }}
                                            >
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="touch-none bg-muted/40 p-1 rounded cursor-grab active:cursor-grabbing shrink-0"
                                                        ref={setActivatorNodeRef}
                                                        {...listeners}
                                                        {...attributes}
                                                    >
                                                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                                                    </button>

                                                    <select
                                                        value={resolveSlotTypeValue(slot)}
                                                        onChange={(e) =>
                                                            handleSlotTypeSelect(
                                                                slot,
                                                                e.target.value as "band" | "break" | "other"
                                                            )
                                                        }
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-7 w-16 rounded border border-input bg-background px-1 text-[10px] shrink-0"
                                                    >
                                                        {slotTypeOptions.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    <select
                                                        value={slot.slot_phase ?? "show"}
                                                        onChange={(e) =>
                                                            handleSlotChange(slot.id, "slot_phase", e.target.value as EventSlot["slot_phase"])
                                                        }
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-7 w-[72px] rounded border border-input bg-background px-1 text-[10px] shrink-0"
                                                    >
                                                        {slotPhaseOptions.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    {slot.slot_type === "band" && (
                                                        <select
                                                            value={slot.band_id ?? ""}
                                                            onChange={(e) =>
                                                                handleSlotChange(slot.id, "band_id", e.target.value || null)
                                                            }
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="h-7 flex-[1_1_180px] min-w-[160px] rounded border border-input bg-background px-1 text-[10px] truncate"
                                                        >
                                                            <option value="">バンドを選択</option>
                                                            {bands.map((band) => (
                                                                <option key={band.id} value={band.id}>
                                                                    {band.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    {slot.slot_type === "band" && (
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                                                            <span>
                                                                {"\u66F2\u6570"} {bandSongCount(slot)}
                                                            </span>
                                                            <span className="ml-1">{"\u30FB"}</span>
                                                            <span>{"\u6301\u3061"}</span>
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                value={slotDurationInputValue(slot)}
                                                                placeholder={suggestedBandDurationMin(slot)?.toString() ?? ""}
                                                                onChange={(e) =>
                                                                    handleSlotDurationChange(slot.id, e.target.value)
                                                                }
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="h-7 w-14 px-1 text-center text-[10px]"
                                                                disabled={!slot.start_time && !slot.end_time}
                                                            />
                                                            <span>min</span>
                                                        </div>
                                                    )}

                                                    {slot.slot_type !== "band" && (
                                                        <Input
                                                            placeholder="\u30E1\u30E2"
                                                            value={slot.note ?? ""}
                                                            onChange={(e) =>
                                                                handleSlotChange(slot.id, "note", e.target.value)
                                                            }
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="h-7 flex-[1_1_180px] min-w-[160px] text-[10px]"
                                                        />
                                                    )}

                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                        <Input
                                                            type="time"
                                                            value={slot.start_time ?? ""}
                                                            onChange={(e) =>
                                                                handleSlotChange(slot.id, "start_time", e.target.value)
                                                            }
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="h-7 w-20 px-0.5 text-center text-[10px]"
                                                        />
                                                        <span className="text-muted-foreground text-[10px]">-</span>
                                                        <Input
                                                            type="time"
                                                            value={slot.end_time ?? ""}
                                                            onChange={(e) =>
                                                                handleSlotChange(slot.id, "end_time", e.target.value)
                                                            }
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="h-7 w-20 px-0.5 text-center text-[10px]"
                                                        />
                                                    </div>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteSlot(slot.id); }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </SortableItem>
                            ))}
                            </div>
                        </div>
                    </SortableContext>
                </DndContext>

                <Button
                    variant="outline"
                    className="w-full mt-4 border-dashed"
                    onClick={handleAddSlot}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    スロットを追加
                </Button>
            </CardContent>
        </Card>
    );
}



