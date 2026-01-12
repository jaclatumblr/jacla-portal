"use client";

import React, { useState, useMemo } from "react";
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
import { GripVertical, Plus, Save, Trash2, ChevronDown, RefreshCw } from "lucide-react";
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
}: SlotManagerProps) {
    const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);

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

    const handleAddSlot = () => {
        const nextOrder =
            slots.reduce((max, slot) => Math.max(max, slot.order_in_event ?? 0), 0) + 1;
        const newSlot: EventSlot = {
            id: crypto.randomUUID(),
            event_id: event.id,
            band_id: null,
            slot_type: "band",
            order_in_event: nextOrder,
            start_time: null,
            end_time: null,
            changeover_min: event.default_changeover_min ?? 15,
            note: "",
        };
        setSlots((prev) => [...prev, newSlot]);
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
        const payloads = slots.map((slot, index) => ({
            id: slot.id,
            event_id: event.id,
            band_id: slot.slot_type === "band" ? slot.band_id ?? null : null,
            slot_type: slot.slot_type,
            order_in_event: slot.order_in_event ?? index + 1,
            start_time: slot.start_time || null,
            end_time: slot.end_time || null,
            changeover_min:
                slot.changeover_min == null || Number.isNaN(Number(slot.changeover_min))
                    ? null
                    : Number(slot.changeover_min),
            note: slot.note || null,
        }));

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
                    slot_type: "other",
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
                            各バンドの演奏順や休憩時間、転換時間を設定します。
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
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
                        <div className="space-y-3">
                            {orderedSlots.map((slot) => (
                                <SortableItem key={slot.id} id={slot.id}>
                                    {({ attributes, listeners, setActivatorNodeRef, isDragging }) => {
                                        const expanded = expandedSlots[slot.id] ?? false;
                                        return (
                                            <div
                                                className={cn(
                                                    "rounded-lg border border-border bg-card px-3 py-3 shadow-sm",
                                                    isDragging && "shadow-lg bg-accent/50"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        className="touch-none bg-muted/40 p-1.5 rounded cursor-grab active:cursor-grabbing"
                                                        ref={setActivatorNodeRef}
                                                        {...listeners}
                                                        {...attributes}
                                                    >
                                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                    </button>

                                                    <div className="flex-1 grid grid-cols-[auto,1fr] sm:flex sm:items-center gap-2 sm:gap-4 ml-1">
                                                        <select
                                                            value={slot.slot_type}
                                                            onChange={(e) =>
                                                                handleSlotChange(slot.id, "slot_type", e.target.value)
                                                            }
                                                            className="h-9 w-24 rounded-md border border-input bg-background px-2 text-xs sm:text-sm"
                                                        >
                                                            {slotTypeOptions.map((opt) => (
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
                                                                className="col-span-2 sm:col-auto h-9 w-full sm:w-48 rounded-md border border-input bg-background px-2 text-xs sm:text-sm"
                                                            >
                                                                <option value="">バンドを選択</option>
                                                                {bands.map((band) => (
                                                                    <option key={band.id} value={band.id}>
                                                                        {band.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}

                                                        {(slot.slot_type !== "band" || expanded) && (
                                                            <Input
                                                                placeholder="メモ・内容"
                                                                value={slot.note ?? ""}
                                                                onChange={(e) =>
                                                                    handleSlotChange(slot.id, "note", e.target.value)
                                                                }
                                                                className={cn(
                                                                    "h-9 text-xs sm:text-sm",
                                                                    slot.slot_type === "band" ? "w-full sm:w-40" : "flex-1"
                                                                )}
                                                            />
                                                        )}

                                                        <div className="flex items-center gap-1 sm:ml-auto">
                                                            <Input
                                                                type="time"
                                                                value={slot.start_time ?? ""}
                                                                onChange={(e) =>
                                                                    handleSlotChange(slot.id, "start_time", e.target.value)
                                                                }
                                                                className="h-9 w-20 sm:w-24 px-1 text-center text-xs sm:text-sm"
                                                            />
                                                            <span className="text-muted-foreground">-</span>
                                                            <Input
                                                                type="time"
                                                                value={slot.end_time ?? ""}
                                                                onChange={(e) =>
                                                                    handleSlotChange(slot.id, "end_time", e.target.value)
                                                                }
                                                                className="h-9 w-20 sm:w-24 px-1 text-center text-xs sm:text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => setExpandedSlots(p => ({ ...p, [slot.id]: !expanded }))}
                                                        >
                                                            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDeleteSlot(slot.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {expanded && (
                                                    <div className="mt-3 pt-3 border-t border-border grid sm:grid-cols-2 gap-4">
                                                        <label className="space-y-1 block text-xs">
                                                            <span className="text-muted-foreground">転換時間（分）</span>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={slot.changeover_min ?? 0}
                                                                onChange={(e) => handleSlotChange(slot.id, "changeover_min", Number(e.target.value))}
                                                                className="h-8"
                                                            />
                                                        </label>
                                                    </div>
                                                )}
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
