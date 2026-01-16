"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { GripVertical, Plus, Save, Trash2, RefreshCw } from "lucide-react";
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
    Song,
    slotTypeOptions,
    formatTime,
    parseTime,
} from "../types";

type SlotManagerProps = {
    event: EventRow;
    bands: Band[];
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
    songs,
    slots,
    setSlots,
    onRefresh,
    selectedBandId,
    onBandSelect,
}: SlotManagerProps) {
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
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

    const orderedSlots = useMemo(() => {
        return [...slots].sort((a, b) => {
            const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            const startA = a.start_time ?? "";
            const startB = b.start_time ?? "";
            if (startA !== startB) return startA.localeCompare(startB);
            return (a.note ?? "").localeCompare(b.note ?? "");
        });
    }, [slots]);

    const slotPhaseOptions = [
        { value: "show", label: "本番" },
        { value: "rehearsal_normal", label: "通常リハ" },
        { value: "rehearsal_pre", label: "直前リハ" },
    ];

    type PhaseKey = EventSlot["slot_phase"] | "prep" | "cleanup" | "rest";

    const slotPhaseKey = (slot: EventSlot): PhaseKey => {
        const note = slot.note?.trim();
        if (note === "集合～準備") return "prep";
        if (note === "終了～撤収" || note === "終了～解散") return "cleanup";
        if (note === "休憩") return "rest";
        return slot.slot_phase ?? "show";
    };

    const slotToneClass = (slot: EventSlot) => {
        const note = slot.note?.trim() ?? "";
        if (note === "集合～準備" || note === "終了～撤収" || note === "終了～解散" || note === "休憩") {
            return "before:bg-amber-400/80";
        }
        if (slot.slot_type === "break" || note.includes("転換")) {
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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const activeId = String(active.id);
        const overId = String(over.id);
        const oldIndex = orderedSlots.findIndex((slot) => slot.id === activeId);
        const newIndex = orderedSlots.findIndex((slot) => slot.id === overId);
        if (oldIndex < 0 || newIndex < 0) return;

        const reordered = arrayMove(orderedSlots, oldIndex, newIndex).map((slot, index) => ({
            ...slot,
            order_in_event: index + 1,
        }));
        setSlots(reordered);
    };

    const handleSlotChange = <K extends keyof EventSlot>(
        id: string,
        key: K,
        value: EventSlot[K]
    ) => {
        setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, [key]: value } : slot)));
    };

    const resolveSlotTypeValue = (slot: EventSlot) => {
        if (slot.slot_type === "band") return "band";
        if (slot.slot_type === "break") return "break";
        const note = slot.note?.trim() ?? "";
        if (note.includes("転換")) return "break";
        return "other";
    };

    const handleSlotTypeSelect = (slot: EventSlot, nextType: "band" | "break" | "other") => {
        const note = slot.note?.trim() ?? "";
        if (nextType === "band") {
            handleSlotChange(slot.id, "slot_type", "band");
            return;
        }
        if (nextType === "break") {
            handleSlotChange(slot.id, "slot_type", "break");
            handleSlotChange(slot.id, "band_id", null);
            handleSlotChange(slot.id, "note", "転換");
            return;
        }
        handleSlotChange(slot.id, "slot_type", "other");
        handleSlotChange(slot.id, "band_id", null);
        if (note === "転換") {
            handleSlotChange(slot.id, "note", "");
        }
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
        setSlots((prev) => [...prev, newSlot]);
    };

    const handleAddRehearsalSlots = (phase: EventSlot["slot_phase"]) => {
        if (bands.length === 0) {
            toast.error("バンドがありません。");
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
        setSlots((prev) => [...prev, ...newSlots]);
    };

    const handleAddSpecialSlot = (note: string, phase: EventSlot["slot_phase"]) => {
        const nextOrder =
            slots.reduce((max, slot) => Math.max(max, slot.order_in_event ?? 0), 0) + 1;
        const newSlot: EventSlot = {
            id: crypto.randomUUID(),
            event_id: event.id,
            band_id: null,
            slot_type: "other",
            slot_phase: phase ?? "show",
            order_in_event: nextOrder,
            start_time: null,
            end_time: null,
            changeover_min: null,
            note,
        };
        setSlots((prev) => [...prev, newSlot]);
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
        setSlots(next);
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
            toast.error("通常リハ順序の保存に失敗しました。");
        } else {
            toast.success("通常リハ順序を保存しました。");
            await onRefresh();
        }
        setSavingRehearsalOrder(false);
    };

    const handleRehearsalPhaseChange = (nextPhase: "rehearsal_normal" | "rehearsal_pre") => {
        if (nextPhase === rehearsalPhase) return;
        setRehearsalPhase(nextPhase);
        applyRehearsalSort(nextPhase, rehearsalOrder);
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (!window.confirm("このスロットを削除しますか？")) return;

        // UI反映を先に行う
        setSlots((prev) => prev.filter((s) => s.id !== slotId));

        // もし既に保存済みならDBからも削除
        // ※ 新規作成で未保存の場合はここでのDB削除は不要だが、UUIDを使っているため判別が難しい
        // 今回は単純にDB削除を試みる
        const { error } = await supabase.from("event_slots").delete().eq("id", slotId);
        if (error) {
            console.error(error);
            // エラーでもUI上は消しておくか、リフレッシュするか
            toast.error("削除に失敗しました。");
            await onRefresh();
        } else {
            toast.success("スロットを削除しました。");
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const payloads = slots.map((slot, index) => {
            const note = slot.note?.trim() ?? "";
            let slotType = slot.slot_type;
            let nextNote = slot.note || null;
            if (slotType === "mc") slotType = "other";
            if (slotType === "other" && note.includes("転換")) {
                slotType = "break";
                nextNote = "転換";
            }
            if (slotType === "break") {
                nextNote = "転換";
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
            toast.error("保存に失敗しました。");
        } else {
            // 戻り値で更新
            setSlots((data ?? []) as EventSlot[]);
            toast.success("タイムテーブルを保存しました。");
        }
        setSaving(false);
    };

    const handleGenerate = async () => {
        if (bands.length === 0) {
            toast.error("バンドがありません。");
            return;
        }
        if (slots.length > 0) {
            if (!window.confirm("既存のスロットをすべて削除して再生成しますか？")) return;
        }

        setGenerating(true);

        // 既存削除
        const { error: delError } = await supabase.from("event_slots").delete().eq("event_id", event.id);
        if (delError) {
            console.error(delError);
            toast.error("既存スロットの削除に失敗しました。");
            setGenerating(false);
            return;
        }

        // 生成ロジック
        const durationMap = new Map<string, number>();
        songs.forEach((song) => {
            if (!song.band_id || !song.duration_sec) return;
            const current = durationMap.get(song.band_id) ?? 0;
            durationMap.set(song.band_id, current + song.duration_sec);
        });

        const baseStart = parseTime(event.start_time ?? null);
        let cursor = baseStart;
        const changeover = event.default_changeover_min ?? 15;

        const payloads: any[] = [];
        let orderIndex = 1;

        payloads.push({
            event_id: event.id,
            band_id: null,
            slot_type: "other",
            slot_phase: "rehearsal_normal",
            order_in_event: orderIndex++,
            start_time: event.assembly_time ?? event.open_time ?? null,
            end_time: event.start_time ?? null,
            changeover_min: null,
            note: "集合～準備",
        });

        const rehearsalList = rehearsalOrder === "reverse" ? [...bands].reverse() : [...bands];
        rehearsalList.forEach((band, index) => {
            payloads.push({
                event_id: event.id,
                band_id: band.id,
                slot_type: "band",
                slot_phase: rehearsalPhase,
                order_in_event: orderIndex++,
                start_time: null,
                end_time: null,
                changeover_min: event.default_changeover_min ?? 15,
                note: null,
            });
        });

        if (rehearsalPhase === "rehearsal_normal") {
            const restMinutes = 60;
            let restStart: string | null = null;
            let restEnd: string | null = null;
            if (baseStart != null) {
                const restStartValue = baseStart - restMinutes;
                if (restStartValue >= 0) {
                    restStart = formatTime(restStartValue);
                    restEnd = formatTime(baseStart);
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
                note: "休憩",
            });
        }

        bands.forEach((band, index) => {
            const durationSec = durationMap.get(band.id) ?? 0;
            const durationMin = durationSec > 0 ? Math.ceil(durationSec / 60) : null;
            let startTime: string | null = null;
            let endTime: string | null = null;
            if (cursor != null) {
                startTime = formatTime(cursor);
                if (durationMin != null) {
                    endTime = formatTime(cursor + durationMin);
                }
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

            if (cursor != null && durationMin != null) {
                cursor += durationMin;
            }

            if (index < bands.length - 1 && changeover > 0) {
                let changeoverStart: string | null = null;
                let changeoverEnd: string | null = null;
                if (cursor != null) {
                    changeoverStart = formatTime(cursor);
                    changeoverEnd = formatTime(cursor + changeover);
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
                    note: "転換",
                });

                if (cursor != null) {
                    cursor += changeover;
                }
            }
        });

        payloads.push({
            event_id: event.id,
            band_id: null,
            slot_type: "other",
            slot_phase: "show",
            order_in_event: orderIndex++,
            start_time: null,
            end_time: null,
            changeover_min: null,
            note: "終了～撤収",
        });

        const { data, error } = await supabase
            .from("event_slots")
            .insert(payloads)
            .select();

        if (error || !data) {
            console.error(error);
            toast.error("自動生成に失敗しました。");
        } else {
            setSlots(data as EventSlot[]);
            toast.success("スロットを自動生成しました。");
        }
        setGenerating(false);
    };

    return (
        <Card className="bg-card/60">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">タイムテーブル</CardTitle>
                        <CardDescription>
                            各バンドの演奏順や付帯作業、転換時間を設定します。
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
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
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
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
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddRehearsalSlots(rehearsalPhase)}
                            >
                                リハ追加
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-24"
                                onClick={() => handleAddSpecialSlot("集合～準備", "rehearsal_normal")}
                            >
                                準備追加
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-24"
                                onClick={() => handleAddSpecialSlot("終了～撤収", "show")}
                            >
                                撤収追加
                            </Button>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
                            <RefreshCw className={cn("w-4 h-4 mr-2", generating && "animate-spin")} />
                            自動生成
                        </Button>
                        <Button onClick={handleSave} disabled={saving} size="sm">
                            <Save className="w-4 h-4 mr-2" />
                            保存
                        </Button>
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

                                                    {slot.slot_type !== "band" && (
                                                        <Input
                                                            placeholder="メモ"
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
