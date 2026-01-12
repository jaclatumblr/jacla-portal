"use client";

import { CSSProperties, useRef, useState, useMemo } from "react";
import {
    DndContext,
    useSensor,
    useSensors,
    PointerSensor,
    DragEndEvent,
    useDraggable,
    useDroppable,
    DragOverlay,
} from "@dnd-kit/core";
import {
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Grid3x3,
    Trash2,
    Plus,
    Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { StagePlotDrumKit } from "@/components/StagePlotDrumKit";
import { cn } from "@/lib/utils";
import {
    StageMember,
    StageItem,
    getStageCategory,
    stageSlots,
    stagePresets,
    stagePresetPositions,
    createTempId,
} from "../types";

// Constants
const GRID_STEP = 2.5;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.4;
const clampPercent = (value: number) => Math.min(95, Math.max(5, value));
const snapToGrid = (value: number) => Math.round(value / GRID_STEP) * GRID_STEP;

type StagePlotEditorProps = {
    members: StageMember[];
    items: StageItem[];
    setMembers: (members: StageMember[]) => void;
    setItems: (items: StageItem[]) => void;
};

// --- Draggable Components ---

type DraggableItemProps = {
    id: string;
    x: number;
    y: number;
    label: string;
    subLabel?: string;
    type: "member" | "item" | "fixed";
    dashed?: boolean;
    onRemove?: () => void;
    isOverlay?: boolean;
    onDoubleClick?: () => void;
};

function DraggableStageItem({
    id,
    x,
    y,
    label,
    subLabel,
    type,
    dashed,
    onRemove,
    isOverlay,
    onDoubleClick,
}: DraggableItemProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id,
        data: { x, y, type },
        disabled: type === "fixed", // 固定設備は動かせないなら
    });

    // 固定設備が動かせる仕様なら disabled=false にする
    // 今回の要件では Marshall/JC などはプリセットアイテムとして追加されるので動かせるはず
    // ステージにあらかじめある固定設備（ドラム台とか？）は動かせないかも

    const style: CSSProperties = {
        left: `${x}%`,
        top: `${y}%`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        position: 'absolute',
        touchAction: 'none'
    };

    const isFixed = type === "fixed";

    if (isOverlay) {
        // Overlay uses px based transform? or just follow mouse?
        // Usually overlay requires no transform property as dnd-kit handles it.
        // But we need to position it initially? No, dnd-kit handles overlay position.
        return (
            <div
                className={cn(
                    "flex h-12 w-12 flex-col items-center justify-center rounded-full border bg-background shadow-xl text-[10px] whitespace-nowrap z-50",
                    dashed ? "border-dashed" : "border-solid",
                    type === "member" && "border-primary text-primary font-bold bg-primary/10",
                    type === "item" && "border-muted-foreground bg-muted/50",
                    isFixed && "border-destructive/50 bg-destructive/10"
                )}
            >
                <span>{label}</span>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={cn(
                "absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border text-[10px] whitespace-nowrap shadow-sm transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing",
                dashed ? "border-dashed" : "border-solid",
                type === "member" && "border-primary bg-background text-foreground font-bold",
                type === "item" && "border-muted-foreground bg-background text-muted-foreground",
                isFixed && "border-destructive/50 bg-destructive/10 cursor-not-allowed",
                isDragging && "opacity-0"
            )}
            title={subLabel ?? label}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick?.();
            }}
        >
            <span className="max-w-[44px] overflow-hidden text-ellipsis px-1">{label}</span>
            {subLabel && <span className="text-[8px] text-muted-foreground max-w-[44px] overflow-hidden text-ellipsis">{subLabel}</span>}

            {onRemove && !isDragging && (
                <button
                    className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground p-0.5 shadow-sm opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <Trash2 className="w-2.5 h-2.5" />
                </button>
            )}
        </div>
    );
}

// --- Main Component ---

export function StagePlotEditor({
    members,
    items,
    setMembers,
    setItems,
}: StagePlotEditorProps) {
    const [zoom, setZoom] = useState(1);
    const [showGrid, setShowGrid] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<{ id: string; type: 'member' | 'item' } | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    );

    const { setNodeRef: setDroppableRef } = useDroppable({
        id: "stage-area",
    });

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, delta } = event;
        setActiveId(null);

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        // Calculate percentage delta
        // delta.x / (rect.width / 100) ? 
        // No, delta is in pixels. Stage width is rect.width.
        // % delta = (delta.x / rect.width) * 100.
        // However, we need to account for Zoom?
        // If container is scaled via transform, delta might need adjustment?
        // Usually dnd-kit handles transform. But our coordinate system is %.

        // Let's rely on data passed to draggable to retrieve original %.
        const currentData = active.data.current as { x: number; y: number; type: string };
        if (!currentData) return;

        // Adjust delta by zoom level if necessary (depends on how zoom is applied)
        // Here zoom is applied to the container size or transform?
        // In the render below, zoom changes the width/height of the container area.
        // So rect.width ALREADY includes zoom effect.
        // percentDelta = (delta / rect.width) * 100.

        const deltaXPercent = (delta.x / rect.width) * 100;
        const deltaYPercent = (delta.y / rect.height) * 100;

        const newX = clampPercent(snapToGrid(currentData.x + deltaXPercent));
        const newY = clampPercent(snapToGrid(currentData.y + deltaYPercent));

        if (currentData.type === "member") {
            setMembers(members.map((m) => (m.id === active.id ? { ...m, x: newX, y: newY } : m)));
        } else if (currentData.type === "item") {
            setItems(items.map((i) => (i.id === active.id ? { ...i, x: newX, y: newY } : i)));
        }
    };

    const addItem = (label: string, dashed: boolean, defaultPos?: { x: number, y: number }) => {
        const newItem: StageItem = {
            id: createTempId(),
            label,
            dashed,
            x: defaultPos?.x ?? 50,
            y: defaultPos?.y ?? 50,
            fixed: false,
        };
        setItems([...items, newItem]);
    };

    const removeItem = (id: string) => {
        setItems(items.filter((i) => i.id !== id));
    };

    const autoLayout = () => {
        if (!window.confirm("現在の配置をリセットして自動配置しますか？")) return;

        // メンバー配置リセット
        const newMembers = members.map((m, i) => {
            // ここで getAutoPosition 等のロジックが必要だが、importした関数を使う
            // itemsは全て削除？
            // 今回はメンバーだけ自動配置し、アイテムは残すか消すか。
            // 元のコードロジック：アイテムは消さないかも。

            const cat = getStageCategory(m.part || m.instrument);
            const slots = stageSlots[cat] || [];
            // Simple allocation: find first slot not taken? Or just assign sequentially based on part index
            // We need complex logic for smart allocation. 
            // For now, let's just map to fallback or simple category slot.
            return {
                ...m,
                x: 50, // Placeholder
                y: 50
            };
        });
        // To properly implement autoLayout, we need to track index of members within same category.
        // Let's implement a simple version.

        const categoryCounts: Record<string, number> = {};

        const computedMembers = members.map(m => {
            const cat = getStageCategory(m.part || m.instrument);
            const idx = categoryCounts[cat] || 0;
            categoryCounts[cat] = idx + 1;

            const slots = stageSlots[cat];
            let pos = { x: 50, y: 50 };
            if (slots && idx < slots.length) {
                pos = slots[idx];
            } else {
                // Fallback
                pos = { x: clampPercent(20 + idx * 10), y: 80 };
            }
            return { ...m, x: pos.x, y: pos.y };
        });

        setMembers(computedMembers);
    };

    const activeObj = useMemo(() => {
        if (!activeId) return null;
        const m = members.find(x => x.id === activeId);
        if (m) return { id: m.id, label: m.realName ?? m.name, dashed: false, type: "member" as const };
        const i = items.find(x => x.id === activeId);
        if (i) return { id: i.id, label: i.label, dashed: i.dashed, type: "item" as const };
        return null;
    }, [activeId, members, items]);

    return (
        <Card className="bg-card/60">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>ステージプロット</CardTitle>
                        <CardDescription>
                            メンバーと機材の立ち位置を配置してください。
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={autoLayout}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            自動配置
                        </Button>
                        <div className="flex items-center border rounded-md">
                            <Button variant="ghost" size="icon" onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - 0.2))}>
                                <ZoomOut className="w-4 h-4" />
                            </Button>
                            <span className="w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
                            <Button variant="ghost" size="icon" onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + 0.2))}>
                                <ZoomIn className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Toolbar */}
                    <div className="flex-none lg:w-48 space-y-6">
                        <div>
                            <h4 className="text-sm font-medium mb-2">機材を追加</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {stagePresets.map(preset => (
                                    <Button
                                        key={preset.label}
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-8"
                                        onClick={() => addItem(preset.label, preset.dashed, stagePresetPositions[preset.label])}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-8"
                                    onClick={() => addItem("DI", false)}
                                >
                                    DI
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-8"
                                    onClick={() => addItem("Mic", false)}
                                >
                                    Mic
                                </Button>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium mb-2">表示設定</h4>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showGrid}
                                    onChange={(e) => setShowGrid(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                グリッドを表示
                            </label>
                        </div>
                    </div>

                    {/* Stage Area */}
                    <div className="flex-1 overflow-hidden border rounded-lg bg-muted/20 relative min-h-[400px]">
                        <DndContext
                            sensors={sensors}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="w-full h-full overflow-auto p-4 flex justify-center items-center">
                                <div
                                    ref={containerRef}
                                    className="relative bg-background border shadow-sm transition-all duration-200"
                                    style={{
                                        width: `${800 * zoom}px`,
                                        height: `${400 * zoom}px`
                                    }}
                                >
                                    <div ref={setDroppableRef} className="absolute inset-0">
                                        {/* Stage Layout Background / Grid */}
                                        {showGrid && (
                                            <div
                                                className="absolute inset-0 opacity-20 pointer-events-none"
                                                style={{
                                                    backgroundImage: `linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)`,
                                                    backgroundSize: `${GRID_STEP}% ${GRID_STEP}%` // Percent based grid
                                                }}
                                            />
                                        )}

                                        {/* Labels */}
                                        <div className="absolute top-4 left-4 text-xs font-bold text-muted-foreground pointer-events-none select-none">
                                            舞台奥 (Stage Back)
                                        </div>
                                        <div className="absolute bottom-4 left-4 text-xs font-bold text-muted-foreground pointer-events-none select-none">
                                            下手 (Shimote)
                                        </div>
                                        <div className="absolute bottom-4 right-4 text-xs font-bold text-muted-foreground pointer-events-none select-none">
                                            上手 (Kamite)
                                        </div>
                                        <div className="absolute inset-x-0 bottom-1 text-center text-xs font-bold text-muted-foreground pointer-events-none select-none">
                                            客席 (Audience)
                                        </div>

                                        {/* Drum Kit Graphic (Guide) */}
                                        <div className="absolute left-[50%] top-[8%] -translate-x-1/2 w-[18%] h-[25%] pointer-events-none opacity-20 select-none z-0">
                                            <StagePlotDrumKit className="w-full h-full text-foreground" />
                                        </div>

                                        {/* Static Stage Items */}
                                        {/* MAIN L (Shimote side) */}
                                        <div className="absolute left-[15%] bottom-[15%] w-[12%] h-[8%] bg-zinc-800 border border-zinc-600 rounded-md flex items-center justify-center pointer-events-none z-0">
                                            <span className="text-[10px] text-zinc-400 font-bold">MAIN L</span>
                                        </div>
                                        {/* MAIN R (Kamite side) */}
                                        <div className="absolute right-[15%] bottom-[15%] w-[12%] h-[8%] bg-zinc-800 border border-zinc-600 rounded-md flex items-center justify-center pointer-events-none z-0">
                                            <span className="text-[10px] text-zinc-400 font-bold">MAIN R</span>
                                        </div>

                                        {/* Monitors */}
                                        <div className="absolute left-[10%] bottom-[35%] w-[8%] h-[6%] bg-zinc-800/40 border border-zinc-600/40 rounded-sm flex items-center justify-center pointer-events-none z-0">
                                            <span className="text-[8px] text-zinc-400/70">MON1</span>
                                        </div>
                                        {/* MON2: Moved to Kamite (Right side) of Drums */}
                                        <div className="absolute left-[58%] top-[10%] w-[8%] h-[6%] bg-zinc-800/40 border border-zinc-600/40 rounded-sm flex items-center justify-center pointer-events-none z-0">
                                            <span className="text-[8px] text-zinc-400/70">MON2</span>
                                        </div>
                                        <div className="absolute left-[50%] bottom-[10%] -translate-x-1/2 w-[8%] h-[6%] bg-zinc-800/40 border border-zinc-600/40 rounded-sm flex items-center justify-center pointer-events-none z-0">
                                            <span className="text-[8px] text-zinc-400/70">MON3</span>
                                        </div>
                                        <div className="absolute right-[10%] bottom-[35%] w-[8%] h-[6%] bg-zinc-800/40 border border-zinc-600/40 rounded-sm flex items-center justify-center pointer-events-none z-0">
                                            <span className="text-[8px] text-zinc-400/70">MON4</span>
                                        </div>

                                        {/* Items */}
                                        {items.map(item => (
                                            <DraggableStageItem
                                                key={item.id}
                                                id={item.id}
                                                x={item.x}
                                                y={item.y}
                                                label={item.label}
                                                type="item"
                                                dashed={item.dashed}
                                                onRemove={() => removeItem(item.id)}
                                                onDoubleClick={() => setEditingItem({ id: item.id, type: 'item' })}
                                            />
                                        ))}

                                        {/* Members */}
                                        {members.map(member => {
                                            const displayName = member.realName ?? member.name;
                                            return (
                                                <DraggableStageItem
                                                    key={member.id}
                                                    id={member.id}
                                                    x={member.x}
                                                    y={member.y}
                                                    label={member.instrument || displayName.slice(0, 2)}
                                                    subLabel={displayName}
                                                    type="member"
                                                    dashed={false}
                                                    onDoubleClick={() => setEditingItem({ id: member.id, type: 'member' })}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <DragOverlay>
                                {activeObj ? (
                                    <DraggableStageItem
                                        id={activeObj.id}
                                        x={0}
                                        y={0}
                                        label={activeObj.label}
                                        type={activeObj.type}
                                        dashed={activeObj.dashed}
                                        isOverlay
                                    />
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    </div>
                </div>
            </CardContent>

            <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>オプション設定</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground mb-4">
                            {editingItem?.type === 'member' ? 'メンバー' : '機材'}の配置設定
                        </p>

                        {editingItem && (() => {
                            const target = editingItem.type === 'member'
                                ? members.find(m => m.id === editingItem.id)
                                : items.find(i => i.id === editingItem.id);

                            if (!target) return null;

                            return (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium">X 位置 (%)</label>
                                            <div className="text-sm p-2 border rounded bg-muted">
                                                {Math.round(target.x)}%
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium">Y 位置 (%)</label>
                                            <div className="text-sm p-2 border rounded bg-muted">
                                                {Math.round(target.y)}%
                                            </div>
                                        </div>
                                    </div>

                                    {editingItem.type === 'item' && (
                                        <Button
                                            variant="destructive"
                                            className="w-full"
                                            onClick={() => {
                                                removeItem(editingItem.id);
                                                setEditingItem(null);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            このアイテムを削除
                                        </Button>
                                    )}

                                    {editingItem.type === 'member' && (
                                        <p className="text-xs text-muted-foreground">
                                            ※メンバーの削除はメンバー管理リストから行ってください。
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
