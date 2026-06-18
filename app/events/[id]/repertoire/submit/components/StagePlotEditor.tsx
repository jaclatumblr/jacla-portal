"use client";

import { CSSProperties, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { RotateCcw, Trash2, ZoomIn, ZoomOut } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StagePlotDrumKit } from "@/components/StagePlotDrumKit";
import {
  createDefaultStageItems,
  normalizeStageItemsWithTemplateIds,
  STATIC_STAGE_MARKERS,
  splitStageItemLabel,
  type StageItemVariant,
} from "@/lib/stagePlot";
import { cn } from "@/lib/utils";
import {
  StageItem,
  StageMember,
  createTempId,
  getStageCategory,
  stageSlots,
} from "../types";

const GRID_STEP = 2.5;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.4;
const MIC_LABEL_PATTERN = /^mic(?:\s*(\d+))?$/i;

const clampPercent = (value: number) => Math.min(95, Math.max(5, value));
const snapToGrid = (value: number) => Math.round(value / GRID_STEP) * GRID_STEP;

type StagePlotEditorProps = {
  members: StageMember[];
  items: StageItem[];
  setMembers: (members: StageMember[]) => void;
  setItems: (items: StageItem[]) => void;
};

type DraggableItemProps = {
  id: string;
  x: number;
  y: number;
  label: string;
  variant?: StageItemVariant;
  subLabel?: string;
  type: "member" | "item" | "fixed";
  dashed?: boolean;
  onRemove?: () => void;
  isOverlay?: boolean;
  onDoubleClick?: () => void;
};

const getNextMicNumber = (items: StageItem[]) => {
  const usedNumbers = new Set<number>();

  items.forEach((item) => {
    const match = item.label.trim().match(MIC_LABEL_PATTERN);
    if (!match) return;
    usedNumbers.add(match[1] ? Number(match[1]) : 1);
  });

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  return nextNumber;
};

function StageItemLabel({ label, variant }: { label: string; variant?: StageItemVariant }) {
  if (variant === "split-backline") {
    const parts = splitStageItemLabel(label);
    if (parts.length >= 2) {
      return (
        <div className="flex h-full w-full items-stretch">
          <span className="flex flex-1 items-center justify-center px-1 text-center leading-none">
            {parts[0]}
          </span>
          <span className="w-px bg-slate-500/80" />
          <span className="flex flex-1 items-center justify-center px-1 text-center leading-none">
            {parts.slice(1).join(" / ")}
          </span>
        </div>
      );
    }
  }

  return <span className="px-1 text-center leading-none">{label}</span>;
}

function DraggableStageItem({
  id,
  x,
  y,
  label,
  variant,
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
    disabled: type === "fixed",
  });

  const isBackline = type === "item" && (variant === "backline" || variant === "split-backline");
  const style: CSSProperties = {
    left: `${x}%`,
    top: `${y}%`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    position: "absolute",
    touchAction: "none",
  };

  const className = cn(
    "flex items-center justify-center border whitespace-nowrap shadow-sm",
    dashed ? "border-dashed" : "border-solid",
    type === "member" &&
      "h-12 w-12 flex-col rounded-full border-primary bg-background text-[10px] font-bold text-foreground",
    type === "item" &&
      !isBackline &&
      "h-12 w-12 flex-col rounded-full border-muted-foreground bg-background text-[10px] text-muted-foreground",
    type === "item" &&
      isBackline &&
      "h-9 rounded-md border-slate-400 bg-slate-200/95 px-2 text-[9px] font-semibold text-slate-900"
  );

  if (isOverlay) {
    return (
      <div
        className={cn(className, "bg-background shadow-xl")}
        style={isBackline ? { width: variant === "split-backline" ? "8.5rem" : "4.5rem" } : undefined}
      >
        {isBackline ? <StageItemLabel label={label} variant={variant} /> : <span>{label}</span>}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        className,
        "group absolute -translate-x-1/2 -translate-y-1/2 cursor-grab transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-0"
      )}
      style={{
        ...style,
        width: isBackline ? (variant === "split-backline" ? "18%" : "10%") : undefined,
      }}
      title={subLabel ?? label}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onDoubleClick?.();
      }}
    >
      {isBackline ? (
        <StageItemLabel label={label} variant={variant} />
      ) : (
        <span className="max-w-[44px] overflow-hidden text-ellipsis px-1">{label}</span>
      )}
      {subLabel ? (
        <span className="max-w-[44px] overflow-hidden text-ellipsis text-[8px] text-muted-foreground">
          {subLabel}
        </span>
      ) : null}

      {onRemove && !isDragging ? (
        <button
          type="button"
          className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}

export function StagePlotEditor({
  members,
  items,
  setMembers,
  setItems,
}: StagePlotEditorProps) {
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string; type: "member" | "item" } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedItems = useMemo(() => normalizeStageItemsWithTemplateIds(items), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const { setNodeRef: setDroppableRef } = useDroppable({ id: "stage-area" });

  const setNormalizedItems = (nextItems: StageItem[]) => {
    setItems(normalizeStageItemsWithTemplateIds(nextItems));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveId(null);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentData = active.data.current as { x: number; y: number; type: string } | undefined;
    if (!currentData) return;

    const deltaXPercent = (delta.x / rect.width) * 100;
    const deltaYPercent = (delta.y / rect.height) * 100;
    const newX = clampPercent(snapToGrid(currentData.x + deltaXPercent));
    const newY = clampPercent(snapToGrid(currentData.y + deltaYPercent));

    if (currentData.type === "member") {
      setMembers(
        members.map((member) => (member.id === active.id ? { ...member, x: newX, y: newY } : member))
      );
    } else if (currentData.type === "item") {
      setNormalizedItems(
        normalizedItems.map((item) => (item.id === active.id ? { ...item, x: newX, y: newY } : item))
      );
    }
  };

  const addItem = (
    label: string,
    dashed: boolean,
    defaultPos?: { x: number; y: number },
    variant?: StageItemVariant
  ) => {
    const newItem: StageItem = {
      id: createTempId(),
      label,
      dashed,
      x: defaultPos?.x ?? 50,
      y: defaultPos?.y ?? 50,
      variant,
      fixed: false,
    };

    setNormalizedItems([...normalizedItems, newItem]);
  };

  const addMic = () => {
    const nextMicNumber = getNextMicNumber(normalizedItems);
    addItem(`Mic${nextMicNumber}`, false, { x: 50, y: 78 });
  };

  const updateItem = (id: string, patch: Partial<StageItem>) => {
    setNormalizedItems(normalizedItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    const targetItem = normalizedItems.find((item) => item.id === id);
    if (!targetItem) return false;

    if (!window.confirm(`配置図から機材「${targetItem.label}」を削除しますか？`)) {
      return false;
    }

    setNormalizedItems(normalizedItems.filter((item) => item.id !== id));
    return true;
  };

  const resetDefaultItems = () => {
    if (!window.confirm("初期機材を初期位置に戻しますか？ 追加したMicはそのまま残ります。")) {
      return;
    }

    const defaultItemIds = new Map(
      normalizedItems
        .filter((item) => item.templateId)
        .map((item) => [item.templateId, item.id])
    );

    const customItems = normalizedItems.filter((item) => !item.templateId);
    const resetItems = createDefaultStageItems(createTempId).map((item) => ({
      ...item,
      id: defaultItemIds.get(item.templateId) ?? item.id,
      fixed: false,
    }));

    setNormalizedItems([...resetItems, ...customItems]);
  };

  const autoLayout = () => {
    if (!window.confirm("現在のメンバー配置をリセットして自動配置しますか？")) return;

    const categoryCounts: Record<string, number> = {};
    const computedMembers = members.map((member) => {
      const category = getStageCategory(member.part || member.instrument);
      const index = categoryCounts[category] || 0;
      categoryCounts[category] = index + 1;

      const slots = stageSlots[category];
      const pos =
        slots && index < slots.length ? slots[index] : { x: clampPercent(20 + index * 10), y: 80 };

      return { ...member, x: pos.x, y: pos.y };
    });

    setMembers(computedMembers);
  };

  const activeObj = useMemo(() => {
    if (!activeId) return null;

    const member = members.find((entry) => entry.id === activeId);
    if (member) {
      return {
        id: member.id,
        label: member.realName ?? member.name,
        type: "member" as const,
        dashed: false,
      };
    }

    const item = normalizedItems.find((entry) => entry.id === activeId);
    if (item) {
      return {
        id: item.id,
        label: item.label,
        type: "item" as const,
        dashed: item.dashed,
        variant: item.variant,
      };
    }

    return null;
  }, [activeId, members, normalizedItems]);

  const fixedItems = useMemo(() => {
    const next = [...STATIC_STAGE_MARKERS];
    if (members.some((member) => member.isMc)) {
      next.push({ id: "mc-area", label: "MC", x: 50, y: 75, kind: "monitor" as const });
    }
    return next;
  }, [members]);

  return (
    <Card className="bg-card/60">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle>ステージプロット</CardTitle>
            <CardDescription>メンバーと機材の立ち位置を配置してください。</CardDescription>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[repeat(4,max-content)] lg:justify-end">
            <Button variant="outline" size="sm" onClick={addMic} className="w-full justify-center">
              Micを追加
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetDefaultItems}
              className="w-full justify-center"
            >
              初期機材に戻す
            </Button>
            <Button variant="outline" size="sm" onClick={autoLayout} className="w-full justify-center">
              <RotateCcw className="mr-2 h-4 w-4" />
              自動配置
            </Button>
            <div className="flex w-full items-center justify-between rounded-md border sm:col-span-2 lg:w-auto lg:min-w-[140px]">
              <Button variant="ghost" size="icon" onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - 0.2))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="flex-1 text-center text-xs">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + 0.2))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-none space-y-4 lg:w-48">
            <div>
              <h4 className="mb-2 text-sm font-medium">表示設定</h4>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(event) => setShowGrid(event.target.checked)}
                  className="rounded border-gray-300"
                />
                グリッドを表示
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              ドラッグで移動、ダブルクリックで表示名や座標を編集できます。
            </p>
          </div>

          <div className="relative min-h-[400px] flex-1 overflow-hidden rounded-lg border bg-muted/20">
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
                <div
                  ref={containerRef}
                  className="relative border bg-background shadow-sm transition-all duration-200"
                  style={{ width: `${800 * zoom}px`, height: `${400 * zoom}px` }}
                >
                  <div ref={setDroppableRef} className="absolute inset-0">
                    {showGrid ? (
                      <div
                        className="pointer-events-none absolute inset-0 opacity-20"
                        style={{
                          backgroundImage:
                            "linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)",
                          backgroundSize: `${GRID_STEP}% ${GRID_STEP}%`,
                        }}
                      />
                    ) : null}

                    <div className="pointer-events-none absolute left-4 top-4 select-none text-xs font-bold text-muted-foreground">
                      舞台奥 (Stage Back)
                    </div>
                    <div className="pointer-events-none absolute bottom-4 left-4 select-none text-xs font-bold text-muted-foreground">
                      下手 (Shimote)
                    </div>
                    <div className="pointer-events-none absolute bottom-4 right-4 select-none text-xs font-bold text-muted-foreground">
                      上手 (Kamite)
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-1 select-none text-center text-xs font-bold text-muted-foreground">
                      客席 (Audience)
                    </div>

                    <div className="pointer-events-none absolute left-1/2 top-[8%] z-0 h-[25%] w-[18%] -translate-x-1/2 select-none opacity-20">
                      <StagePlotDrumKit className="h-full w-full text-foreground" />
                    </div>

                    {fixedItems.map((item) => {
                      const isMain = item.kind === "main";
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "pointer-events-none absolute z-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border shadow-sm",
                            isMain
                              ? "rounded-md border-zinc-600 bg-zinc-800"
                              : "rounded-sm border-slate-500/70 bg-slate-300/80"
                          )}
                          style={{
                            left: `${item.x}%`,
                            top: `${item.y}%`,
                            width: isMain ? "13%" : "8%",
                            height: isMain ? "8%" : "6.5%",
                          }}
                        >
                          <span
                            className={cn(
                              "px-1 text-center leading-none",
                              isMain
                                ? "text-[10px] font-bold text-zinc-400"
                                : "text-[10px] font-semibold text-slate-700"
                            )}
                          >
                            {item.label}
                          </span>
                        </div>
                      );
                    })}

                    {normalizedItems.map((item) => (
                      <DraggableStageItem
                        key={item.id}
                        id={item.id}
                        x={item.x}
                        y={item.y}
                        label={item.label}
                        variant={item.variant}
                        type="item"
                        dashed={item.dashed}
                        onRemove={() => removeItem(item.id)}
                        onDoubleClick={() => setEditingItem({ id: item.id, type: "item" })}
                      />
                    ))}

                    {members.map((member) => {
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
                          onDoubleClick={() => setEditingItem({ id: member.id, type: "member" })}
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
                    variant={activeObj.variant}
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
            <p className="mb-4 text-sm text-muted-foreground">
              {editingItem?.type === "member" ? "メンバー" : "機材"}の設定です。
            </p>

            {editingItem
              ? (() => {
                  const target =
                    editingItem.type === "member"
                      ? members.find((member) => member.id === editingItem.id)
                      : normalizedItems.find((item) => item.id === editingItem.id);

                  if (!target) return null;

                  if (editingItem.type === "item") {
                    const itemTarget = target as StageItem;

                    return (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium">表示名</label>
                          <Input
                            value={itemTarget.label}
                            onChange={(event) => updateItem(editingItem.id, { label: event.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-medium">X 座標 (%)</label>
                            <Input
                              type="number"
                              min={5}
                              max={95}
                              value={Number(itemTarget.x.toFixed(1))}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                if (!Number.isNaN(next)) {
                                  updateItem(editingItem.id, { x: clampPercent(next) });
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium">Y 座標 (%)</label>
                            <Input
                              type="number"
                              min={5}
                              max={95}
                              value={Number(itemTarget.y.toFixed(1))}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                if (!Number.isNaN(next)) {
                                  updateItem(editingItem.id, { y: clampPercent(next) });
                                }
                              }}
                            />
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          className="w-full"
                          onClick={() => {
                            if (removeItem(editingItem.id)) {
                              setEditingItem(null);
                            }
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          このアイテムを削除
                        </Button>
                      </div>
                    );
                  }

                  const memberTarget = target as StageMember;

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium">X 座標 (%)</label>
                          <div className="rounded border bg-muted p-2 text-sm">
                            {Math.round(memberTarget.x)}%
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium">Y 座標 (%)</label>
                          <div className="rounded border bg-muted p-2 text-sm">
                            {Math.round(memberTarget.y)}%
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        メンバー名の変更はメンバー一覧から編集してください。
                      </p>
                    </div>
                  );
                })()
              : null}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
