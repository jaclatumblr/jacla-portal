"use client";

import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  RotateCcw,
  Save,
  Copy,
  Eye,
  EyeOff,
  Layers3,
  Plus,
  Trash2,
  Lock,
  LockOpen,
  ArrowUp,
  ArrowDown,
} from "@/lib/icons";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { supabase } from "@/lib/supabaseClient";
import {
  defaultVoxSetlistLayout,
  normalizeVoxSetlistLayout,
  type CustomLayer,
  type LayoutTextField,
  type VoxSetlistLayout,
} from "@/lib/voxSetlistLayout";

const storageKey = (eventId: string) => `voxSetlistLayout:${eventId}`;

const parseStoredLayout = (raw: string | null) => {
  if (!raw) return defaultVoxSetlistLayout;
  try {
    return normalizeVoxSetlistLayout(JSON.parse(raw));
  } catch {
    return defaultVoxSetlistLayout;
  }
};

const numberValue = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createLayer = (type: CustomLayer["type"]): CustomLayer => ({
  id: `layer-${crypto.randomUUID()}`,
  name: `layer-${type}`,
  type,
  x: 120,
  y: 120,
  width: type === "text" ? 140 : 80,
  height: type === "rect" ? 30 : 20,
  radius: 10,
  size: 10,
  text: type === "text" ? "新規テキスト" : "",
  color: "#000000",
  visible: true,
  locked: false,
});

function TextFieldEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: LayoutTextField;
  onChange: (next: LayoutTextField) => void;
}) {
  return (
    <Card className="bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground">x</span>
          <Input
            type="number"
            value={value.x}
            onChange={(e) => onChange({ ...value, x: numberValue(e.target.value, value.x) })}
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground">y</span>
          <Input
            type="number"
            value={value.y}
            onChange={(e) => onChange({ ...value, y: numberValue(e.target.value, value.y) })}
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground">width</span>
          <Input
            type="number"
            value={value.maxWidth}
            onChange={(e) => onChange({ ...value, maxWidth: numberValue(e.target.value, value.maxWidth) })}
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground">size</span>
          <Input
            type="number"
            value={value.size}
            onChange={(e) => onChange({ ...value, size: numberValue(e.target.value, value.size) })}
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground">align</span>
          <select
            value={value.align ?? "left"}
            onChange={(e) =>
              onChange({
                ...value,
                align: e.target.value === "center" || e.target.value === "right" ? e.target.value : "left",
              })
            }
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </label>
      </CardContent>
    </Card>
  );
}

export default function VoxLayoutPage() {
  const params = useParams<{ id: string }>();
  const eventId = typeof params?.id === "string" ? params.id : "";

  const [layout, setLayout] = useState<VoxSetlistLayout>(defaultVoxSetlistLayout);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedKey, setSelectedKey] = useState("fields.bandName");
  const [hiddenLayers, setHiddenLayers] = useState<Record<string, boolean>>({});

  const pageWidth = 595;
  const pageHeight = 842;
  const viewWidth = 760;
  const scale = viewWidth / pageWidth;

  useEffect(() => {
    if (!eventId) return;
    setLayout(parseStoredLayout(localStorage.getItem(storageKey(eventId))));
  }, [eventId]);

  const save = () => {
    if (!eventId) return;
    localStorage.setItem(storageKey(eventId), JSON.stringify(layout));
    toast.success("レイアウトを保存しました");
  };

  const reset = () => {
    setLayout(defaultVoxSetlistLayout);
    if (eventId) localStorage.removeItem(storageKey(eventId));
    toast.success("デフォルトに戻しました");
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
      toast.success("JSONをコピーしました");
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  const loadPreview = async () => {
    if (!eventId) return;
    setLoadingPreview(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("no access token");

      const response = await fetch(
        `/api/admin/match-vox-setlist-template?eventId=${encodeURIComponent(eventId)}&preview=template`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`preview failed: ${response.status} ${detail}`);
      }

      const blob = await response.blob();
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      toast.success("PDFプレビューを更新しました");
    } catch (error) {
      console.error(error);
      toast.error("PDFプレビューの作成に失敗しました");
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!eventId || previewUrl) return;
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, previewUrl]);

  const setTextFieldByKey = (key: string, updater: (prev: LayoutTextField) => LayoutTextField) => {
    const [group, field] = key.split(".");
    if (group === "fields" && field && field in layout.fields) {
      setLayout((prev) => ({
        ...prev,
        fields: {
          ...prev.fields,
          [field]: updater(prev.fields[field as keyof VoxSetlistLayout["fields"]]),
        },
      }));
      return;
    }
    if (group === "notes" && field && field in layout.notes) {
      setLayout((prev) => ({
        ...prev,
        notes: {
          ...prev.notes,
          [field]: updater(prev.notes[field as keyof VoxSetlistLayout["notes"]]),
        },
      }));
    }
  };

  const updateCustomLayer = (id: string, updater: (prev: CustomLayer) => CustomLayer) => {
    setLayout((prev) => ({
      ...prev,
      customLayers: prev.customLayers.map((layer) => (layer.id === id ? updater(layer) : layer)),
    }));
  };

  const getCustomLayerBySelectedKey = (key: string) => {
    if (!key.startsWith("custom.")) return null;
    const id = key.replace("custom.", "");
    return layout.customLayers.find((layer) => layer.id === id) ?? null;
  };

  const addCustomLayer = (type: CustomLayer["type"]) => {
    const countOfType = layout.customLayers.filter((layer) => layer.type === type).length + 1;
    const layer = { ...createLayer(type), name: `${type}-${countOfType}` };
    setLayout((prev) => ({ ...prev, customLayers: [...prev.customLayers, layer] }));
    setSelectedKey(`custom.${layer.id}`);
  };

  const removeSelectedCustomLayer = () => {
    if (!selectedKey.startsWith("custom.")) return;
    const id = selectedKey.replace("custom.", "");
    setLayout((prev) => ({ ...prev, customLayers: prev.customLayers.filter((layer) => layer.id !== id) }));
    setSelectedKey("fields.bandName");
  };

  const duplicateSelectedCustomLayer = () => {
    const selected = getCustomLayerBySelectedKey(selectedKey);
    if (!selected) return;
    const duplicated: CustomLayer = {
      ...selected,
      id: `layer-${crypto.randomUUID()}`,
      name: `${selected.name}-copy`,
      x: selected.x + 8,
      y: selected.y - 8,
      locked: false,
    };
    setLayout((prev) => ({ ...prev, customLayers: [...prev.customLayers, duplicated] }));
    setSelectedKey(`custom.${duplicated.id}`);
  };

  const moveSelectedCustomLayer = (direction: -1 | 1, targetId?: string) => {
    const id = targetId ?? (selectedKey.startsWith("custom.") ? selectedKey.replace("custom.", "") : "");
    if (!id) return;
    setLayout((prev) => {
      const index = prev.customLayers.findIndex((layer) => layer.id === id);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.customLayers.length) return prev;
      const nextLayers = prev.customLayers.slice();
      const [layer] = nextLayers.splice(index, 1);
      nextLayers.splice(nextIndex, 0, layer);
      return { ...prev, customLayers: nextLayers };
    });
  };

  const toggleCustomLayerVisibility = (id: string) => {
    updateCustomLayer(id, (prev) => ({ ...prev, visible: !prev.visible }));
  };

  const toggleCustomLayerLock = (id: string) => {
    updateCustomLayer(id, (prev) => ({ ...prev, locked: !prev.locked }));
  };

  const getBasePosition = (key: string) => {
    if (key.startsWith("custom.")) {
      const id = key.replace("custom.", "");
      const layer = layout.customLayers.find((item) => item.id === id);
      return { x: layer?.x ?? 0, y: layer?.y ?? 0 };
    }
    const [group, field] = key.split(".");
    if (group === "fields" && field && field in layout.fields) {
      const value = layout.fields[field as keyof VoxSetlistLayout["fields"]];
      return { x: value.x, y: value.y };
    }
    if (group === "notes" && field && field in layout.notes) {
      const value = layout.notes[field as keyof VoxSetlistLayout["notes"]];
      return { x: value.x, y: value.y };
    }
    return { x: 0, y: 0 };
  };

  const onDragStart = (event: ReactPointerEvent<HTMLDivElement>, key: string) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedKey(key);

    if (key.startsWith("custom.")) {
      const selected = getCustomLayerBySelectedKey(key);
      if (selected?.locked) return;
    }

    const target = event.currentTarget;
    const pointerId = event.pointerId;
    target.setPointerCapture?.(pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const base = getBasePosition(key);

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (key.startsWith("custom.")) {
        const id = key.replace("custom.", "");
        updateCustomLayer(id, (prev) => ({
          ...prev,
          x: clamp(base.x + dx, 0, pageWidth),
          y: clamp(base.y - dy, 0, pageHeight),
        }));
      } else {
        setTextFieldByKey(key, (prev) => ({
          ...prev,
          x: clamp(base.x + dx, 0, pageWidth),
          y: clamp(base.y - dy, 0, pageHeight),
        }));
      }
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      target.releasePointerCapture?.(pointerId);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (hiddenLayers[selectedKey]) return;
    if (selectedKey.startsWith("custom.")) {
      const id = selectedKey.replace("custom.", "");
      updateCustomLayer(id, (prev) => {
        if (prev.locked || prev.visible === false) return prev;
        return { ...prev, x: prev.x + dx, y: prev.y + dy };
      });
      return;
    }
    setTextFieldByKey(selectedKey, (prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

  const selectedLayerInfo = useMemo(() => {
    if (selectedKey.startsWith("custom.")) {
      const id = selectedKey.replace("custom.", "");
      const layer = layout.customLayers.find((item) => item.id === id);
      if (!layer) return null;
      return {
        kind: "custom" as const,
        id,
        layer,
        label: layer.name || `custom:${layer.type}`,
        x: layer.x,
        y: layer.y,
      };
    }

    const [group, field] = selectedKey.split(".");
    if (group === "fields" && field && field in layout.fields) {
      const value = layout.fields[field as keyof VoxSetlistLayout["fields"]];
      return { kind: "text" as const, label: selectedKey, value, x: value.x, y: value.y };
    }
    if (group === "notes" && field && field in layout.notes) {
      const value = layout.notes[field as keyof VoxSetlistLayout["notes"]];
      return { kind: "text" as const, label: selectedKey, value, x: value.x, y: value.y };
    }

    return null;
  }, [selectedKey, layout]);

  const previewMarks = useMemo(
    () => [
      { key: "fields.bandName", label: "bandName", ...layout.fields.bandName },
      { key: "fields.pageLabel", label: "pageLabel", ...layout.fields.pageLabel },
      { key: "fields.setOrder", label: "setOrder", ...layout.fields.setOrder },
      { key: "fields.totalDuration", label: "totalDuration", ...layout.fields.totalDuration },
      { key: "fields.plannedStartTime", label: "plannedStart", ...layout.fields.plannedStartTime },
      { key: "notes.lighting", label: "lighting", ...layout.notes.lighting },
      { key: "notes.pa", label: "pa", ...layout.notes.pa },
      { key: "notes.stageSummary", label: "stageSummary", ...layout.notes.stageSummary },
    ],
    [layout]
  );

  const layers = useMemo(
    () => [
      ...previewMarks.map((m) => ({ key: m.key, label: m.label })),
      ...layout.customLayers.map((layer, idx) => ({
        key: `custom.${layer.id}`,
        label: layer.name || `custom:${layer.type}:${idx + 1}`,
      })),
    ],
    [previewMarks, layout.customLayers]
  );

  const toggleLayerVisible = (key: string) => {
    if (key.startsWith("custom.")) {
      toggleCustomLayerVisibility(key.replace("custom.", ""));
      return;
    }
    setHiddenLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Admin Tools"
            title="Match Vox レイアウト編集"
            description="プロットは使わず、文字と図形の配置のみ編集します。"
            backHref={`/admin/events/${eventId}`}
            backLabel="イベント編集に戻る"
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={loadPreview} disabled={loadingPreview}>
                  {loadingPreview ? "プレビュー生成中..." : "PDFプレビュー更新"}
                </Button>
                <Button variant="outline" onClick={copyJson} className="gap-2">
                  <Copy className="w-4 h-4" />
                  JSONコピー
                </Button>
                <Button variant="outline" onClick={reset} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  リセット
                </Button>
                <Button onClick={save} className="gap-2">
                  <Save className="w-4 h-4" />
                  保存
                </Button>
              </div>
            }
          />

          <section className="pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              <Card className="bg-card/60">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers3 className="w-4 h-4" />
                    レイヤー
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {layers.map((layer) => {
                    const isSelected = selectedKey === layer.key;
                    const customId = layer.key.startsWith("custom.") ? layer.key.replace("custom.", "") : "";
                    const customLayer = customId
                      ? layout.customLayers.find((item) => item.id === customId) ?? null
                      : null;
                    const isHidden = customLayer ? !customLayer.visible : Boolean(hiddenLayers[layer.key]);
                    const isLocked = customLayer ? customLayer.locked : false;
                    return (
                      <div
                        key={layer.key}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                          isSelected ? "border-primary bg-primary/10" : "border-border bg-background/40"
                        }`}
                      >
                        <button
                          type="button"
                          className="text-sm text-left flex-1"
                          onClick={() => setSelectedKey(layer.key)}
                        >
                          {layer.label}
                        </button>
                        {customLayer && (
                          <button
                            type="button"
                            className="ml-2 text-muted-foreground hover:text-foreground"
                            onClick={() => toggleCustomLayerLock(customLayer.id)}
                            aria-label={isLocked ? "ロック解除" : "ロック"}
                          >
                            {isLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          type="button"
                          className="ml-2 text-muted-foreground hover:text-foreground"
                          onClick={() => toggleLayerVisible(layer.key)}
                          aria-label={isHidden ? "レイヤーを表示" : "レイヤーを非表示"}
                        >
                          {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        {customLayer && (
                          <>
                            <button
                              type="button"
                              className="ml-2 text-muted-foreground hover:text-foreground"
                              onClick={() => moveSelectedCustomLayer(-1, customLayer.id)}
                              aria-label="上へ"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="ml-1 text-muted-foreground hover:text-foreground"
                              onClick={() => moveSelectedCustomLayer(1, customLayer.id)}
                              aria-label="下へ"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
                <CardContent className="pt-0 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addCustomLayer("text")}>
                    <Plus className="w-4 h-4 mr-1" />Text
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addCustomLayer("rect")}>
                    <Plus className="w-4 h-4 mr-1" />Rect
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addCustomLayer("circle")}>
                    <Plus className="w-4 h-4 mr-1" />Circle
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={removeSelectedCustomLayer}>
                    <Trash2 className="w-4 h-4 mr-1" />Delete Selected
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={duplicateSelectedCustomLayer}>
                    <Copy className="w-4 h-4 mr-1" />Duplicate Selected
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/60">
                <CardHeader>
                  <CardTitle className="text-sm">PDFプレビュー上で配置</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto border rounded-md bg-muted/20 p-4">
                    <div className="mb-3 text-xs text-muted-foreground">
                      操作は「1. レイヤーを選択 → 2. 下の選択中レイヤーで数値編集」です。ここではドラッグ移動と矢印キー微調整のみ行います。
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => nudgeSelected(-1, 0)}>←</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => nudgeSelected(1, 0)}>→</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => nudgeSelected(0, 1)}>↑</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => nudgeSelected(0, -1)}>↓</Button>
                      <span className="text-xs text-muted-foreground">selected: {selectedKey}</span>
                    </div>

                    <div className="relative" style={{ width: viewWidth, height: pageHeight * scale }}>
                      {previewUrl ? (
                        <object
                          data={`${previewUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit`}
                          type="application/pdf"
                          className="absolute inset-0 w-full h-full rounded-sm"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-sm">
                          「PDFプレビュー更新」で背景PDFを読み込んでください
                        </div>
                      )}

                      {previewMarks
                        .filter((m) => !hiddenLayers[m.key])
                        .map((m) => (
                          <div
                            key={`${m.key}-${m.x}-${m.y}`}
                            className={`absolute border ${selectedKey === m.key ? "border-rose-500" : "border-emerald-500/80"} bg-emerald-500/15 text-[10px] px-1 cursor-move`}
                            onPointerDown={(e) => onDragStart(e, m.key)}
                            style={{
                              left: m.x * scale,
                              top: (pageHeight - m.y - 12) * scale,
                              width: Math.max(56, m.maxWidth * scale),
                              zIndex: selectedKey === m.key ? 40 : 25,
                            }}
                          >
                            {m.label}
                          </div>
                        ))}

                      {layout.customLayers
                        .filter((layer) => layer.visible)
                        .map((layer) => {
                          const key = `custom.${layer.id}`;
                          const selected = selectedKey === key;
                          const cursorClass = layer.locked ? "cursor-not-allowed" : "cursor-move";
                          if (layer.type === "text") {
                            return (
                              <div
                                key={key}
                                className={`absolute border ${selected ? "border-rose-500" : "border-sky-500/80"} bg-sky-500/15 text-[10px] px-1 ${cursorClass}`}
                                onPointerDown={(e) => onDragStart(e, key)}
                                style={{
                                  left: layer.x * scale,
                                  top: (pageHeight - layer.y - 12) * scale,
                                  width: Math.max(56, (layer.width ?? 120) * scale),
                                  zIndex: selected ? 45 : 30,
                                }}
                              >
                                {layer.text || "text"}
                              </div>
                            );
                          }

                          if (layer.type === "rect") {
                            return (
                              <div
                                key={key}
                                className={`absolute border-2 ${selected ? "border-rose-500" : "border-amber-500"} bg-amber-500/10 ${cursorClass}`}
                                onPointerDown={(e) => onDragStart(e, key)}
                                style={{
                                  left: layer.x * scale,
                                  top: (pageHeight - layer.y - (layer.height ?? 20)) * scale,
                                  width: (layer.width ?? 80) * scale,
                                  height: (layer.height ?? 20) * scale,
                                  zIndex: selected ? 45 : 30,
                                }}
                              />
                            );
                          }

                          return (
                            <div
                              key={key}
                              className={`absolute rounded-full border-2 ${selected ? "border-rose-500" : "border-violet-500"} bg-violet-500/15 ${cursorClass}`}
                              onPointerDown={(e) => onDragStart(e, key)}
                              style={{
                                left: (layer.x - (layer.radius ?? 10)) * scale,
                                top: (pageHeight - layer.y - (layer.radius ?? 10)) * scale,
                                width: (layer.radius ?? 10) * 2 * scale,
                                height: (layer.radius ?? 10) * 2 * scale,
                                zIndex: selected ? 45 : 30,
                              }}
                            />
                          );
                        })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedLayerInfo && (
                <Card className="bg-card/60">
                  <CardHeader>
                    <CardTitle className="text-sm">選択中レイヤー: {selectedLayerInfo.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <label className="text-xs space-y-1">
                      <span className="text-muted-foreground">x</span>
                      <Input
                        type="number"
                        value={selectedLayerInfo.x}
                        onChange={(e) => {
                          const next = numberValue(e.target.value, selectedLayerInfo.x);
                          if (selectedLayerInfo.kind === "custom") {
                            updateCustomLayer(selectedLayerInfo.id, (p) => ({ ...p, x: next }));
                          } else {
                            setTextFieldByKey(selectedKey, (p) => ({ ...p, x: next }));
                          }
                        }}
                      />
                    </label>
                    <label className="text-xs space-y-1">
                      <span className="text-muted-foreground">y</span>
                      <Input
                        type="number"
                        value={selectedLayerInfo.y}
                        onChange={(e) => {
                          const next = numberValue(e.target.value, selectedLayerInfo.y);
                          if (selectedLayerInfo.kind === "custom") {
                            updateCustomLayer(selectedLayerInfo.id, (p) => ({ ...p, y: next }));
                          } else {
                            setTextFieldByKey(selectedKey, (p) => ({ ...p, y: next }));
                          }
                        }}
                      />
                    </label>

                    {selectedLayerInfo.kind === "text" && (
                      <>
                        <label className="text-xs space-y-1">
                          <span className="text-muted-foreground">width(maxWidth)</span>
                          <Input
                            type="number"
                            value={selectedLayerInfo.value.maxWidth}
                            onChange={(e) =>
                              setTextFieldByKey(selectedKey, (p) => ({
                                ...p,
                                maxWidth: numberValue(e.target.value, p.maxWidth),
                              }))
                            }
                          />
                        </label>
                        <label className="text-xs space-y-1">
                          <span className="text-muted-foreground">size</span>
                          <Input
                            type="number"
                            value={selectedLayerInfo.value.size}
                            onChange={(e) =>
                              setTextFieldByKey(selectedKey, (p) => ({
                                ...p,
                                size: numberValue(e.target.value, p.size),
                              }))
                            }
                          />
                        </label>
                      </>
                    )}

                    {selectedLayerInfo.kind === "custom" && selectedLayerInfo.layer.type === "text" && (
                      <>
                        <label className="text-xs space-y-1 col-span-2 md:col-span-4">
                          <span className="text-muted-foreground">name</span>
                          <Input value={selectedLayerInfo.layer.name ?? ""} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, name: e.target.value }))} />
                        </label>
                        <label className="text-xs space-y-1">
                          <span className="text-muted-foreground">color</span>
                          <Input type="color" value={selectedLayerInfo.layer.color ?? "#000000"} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, color: e.target.value }))} />
                        </label>
                        <label className="text-xs flex items-center gap-2 mt-6"><input type="checkbox" checked={selectedLayerInfo.layer.visible !== false} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, visible: e.target.checked }))} /><span>表示</span></label>
                        <label className="text-xs flex items-center gap-2 mt-6"><input type="checkbox" checked={Boolean(selectedLayerInfo.layer.locked)} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, locked: e.target.checked }))} /><span>ロック</span></label>
                        <label className="text-xs space-y-1"><span className="text-muted-foreground">width</span><Input type="number" value={selectedLayerInfo.layer.width ?? 120} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, width: numberValue(e.target.value,p.width ?? 120) }))} /></label>
                        <label className="text-xs space-y-1"><span className="text-muted-foreground">size</span><Input type="number" value={selectedLayerInfo.layer.size ?? 10} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, size: numberValue(e.target.value,p.size ?? 10) }))} /></label>
                        <label className="text-xs space-y-1 col-span-2 md:col-span-4"><span className="text-muted-foreground">text</span><Input value={selectedLayerInfo.layer.text ?? ""} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, text: e.target.value }))} /></label>
                      </>
                    )}

                    {selectedLayerInfo.kind === "custom" && selectedLayerInfo.layer.type === "rect" && (
                      <>
                        <label className="text-xs space-y-1 col-span-2 md:col-span-4"><span className="text-muted-foreground">name</span><Input value={selectedLayerInfo.layer.name ?? ""} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, name: e.target.value }))} /></label>
                        <label className="text-xs space-y-1"><span className="text-muted-foreground">color</span><Input type="color" value={selectedLayerInfo.layer.color ?? "#000000"} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, color: e.target.value }))} /></label>
                        <label className="text-xs flex items-center gap-2 mt-6"><input type="checkbox" checked={selectedLayerInfo.layer.visible !== false} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, visible: e.target.checked }))} /><span>表示</span></label>
                        <label className="text-xs flex items-center gap-2 mt-6"><input type="checkbox" checked={Boolean(selectedLayerInfo.layer.locked)} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, locked: e.target.checked }))} /><span>ロック</span></label>
                        <label className="text-xs space-y-1"><span className="text-muted-foreground">width</span><Input type="number" value={selectedLayerInfo.layer.width ?? 80} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, width: numberValue(e.target.value,p.width ?? 80) }))} /></label>
                        <label className="text-xs space-y-1"><span className="text-muted-foreground">height</span><Input type="number" value={selectedLayerInfo.layer.height ?? 20} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, height: numberValue(e.target.value,p.height ?? 20) }))} /></label>
                      </>
                    )}

                    {selectedLayerInfo.kind === "custom" && selectedLayerInfo.layer.type === "circle" && (
                      <>
                        <label className="text-xs space-y-1 col-span-2 md:col-span-4"><span className="text-muted-foreground">name</span><Input value={selectedLayerInfo.layer.name ?? ""} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, name: e.target.value }))} /></label>
                        <label className="text-xs space-y-1"><span className="text-muted-foreground">color</span><Input type="color" value={selectedLayerInfo.layer.color ?? "#000000"} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, color: e.target.value }))} /></label>
                        <label className="text-xs flex items-center gap-2 mt-6"><input type="checkbox" checked={selectedLayerInfo.layer.visible !== false} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, visible: e.target.checked }))} /><span>表示</span></label>
                        <label className="text-xs flex items-center gap-2 mt-6"><input type="checkbox" checked={Boolean(selectedLayerInfo.layer.locked)} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, locked: e.target.checked }))} /><span>ロック</span></label>
                        <label className="text-xs space-y-1"><span className="text-muted-foreground">radius</span><Input type="number" value={selectedLayerInfo.layer.radius ?? 10} onChange={(e)=>updateCustomLayer(selectedLayerInfo.id,(p)=>({ ...p, radius: numberValue(e.target.value,p.radius ?? 10) }))} /></label>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <TextFieldEditor
                  title="Band Name"
                  value={layout.fields.bandName}
                  onChange={(next) => setLayout((prev) => ({ ...prev, fields: { ...prev.fields, bandName: next } }))}
                />
                <TextFieldEditor
                  title="Page Label"
                  value={layout.fields.pageLabel}
                  onChange={(next) => setLayout((prev) => ({ ...prev, fields: { ...prev.fields, pageLabel: next } }))}
                />
                <TextFieldEditor
                  title="Set Order"
                  value={layout.fields.setOrder}
                  onChange={(next) => setLayout((prev) => ({ ...prev, fields: { ...prev.fields, setOrder: next } }))}
                />
                <TextFieldEditor
                  title="Planned Start Time"
                  value={layout.fields.plannedStartTime}
                  onChange={(next) => setLayout((prev) => ({ ...prev, fields: { ...prev.fields, plannedStartTime: next } }))}
                />
                <TextFieldEditor
                  title="Total Duration"
                  value={layout.fields.totalDuration}
                  onChange={(next) => setLayout((prev) => ({ ...prev, fields: { ...prev.fields, totalDuration: next } }))}
                />
                <TextFieldEditor
                  title="Event Date"
                  value={layout.fields.eventDate}
                  onChange={(next) => setLayout((prev) => ({ ...prev, fields: { ...prev.fields, eventDate: next } }))}
                />
                <TextFieldEditor
                  title="Lighting Note"
                  value={layout.notes.lighting}
                  onChange={(next) => setLayout((prev) => ({ ...prev, notes: { ...prev.notes, lighting: next } }))}
                />
                <TextFieldEditor
                  title="PA Note"
                  value={layout.notes.pa}
                  onChange={(next) => setLayout((prev) => ({ ...prev, notes: { ...prev.notes, pa: next } }))}
                />
                <TextFieldEditor
                  title="Stage Summary"
                  value={layout.notes.stageSummary}
                  onChange={(next) => setLayout((prev) => ({ ...prev, notes: { ...prev.notes, stageSummary: next } }))}
                />
              </div>

              <div className="text-sm text-muted-foreground">
                エクスポート時にこのレイアウトが自動適用されます。
                <Link className="ml-2 text-primary underline" href={`/admin/events/${eventId}`}>
                  イベント編集へ戻る
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
