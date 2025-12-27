"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type MaintenanceStatus =
  | "ok"
  | "needs_repair"
  | "needs_replace"
  | "missing"
  | "loaned";

type EquipmentCategory = "PA" | "Lighting" | "General";

type EquipmentItem = {
  id: string;
  name: string;
  category: EquipmentCategory;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  quantity: number;
  status: MaintenanceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type ProfileInfo = {
  real_name: string | null;
  display_name: string | null;
};

type EquipmentLog = {
  id: string;
  equipment_id: string;
  status: MaintenanceStatus;
  note: string | null;
  created_at: string;
  changed_by: string | null;
  profiles?: ProfileInfo | null;
};

type EquipmentLogResponse = Omit<EquipmentLog, "profiles"> & {
  profiles?: ProfileInfo | ProfileInfo[] | null;
};

type SortKey = "updated_desc" | "name_asc" | "quantity_desc" | "status";

const categoryOptions: { value: EquipmentCategory; label: string }[] = [
  { value: "PA", label: "PA" },
  { value: "Lighting", label: "照明" },
  { value: "General", label: "総合" },
];

const statusOptions: { value: MaintenanceStatus; label: string }[] = [
  { value: "ok", label: "OK" },
  { value: "needs_repair", label: "要修理" },
  { value: "needs_replace", label: "要交換" },
  { value: "missing", label: "欠品" },
  { value: "loaned", label: "貸出中" },
];

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "updated_desc", label: "更新: 新しい順" },
  { value: "name_asc", label: "名前順" },
  { value: "quantity_desc", label: "数量: 多い順" },
  { value: "status", label: "状態順" },
];

const statusOrder: Record<MaintenanceStatus, number> = {
  needs_replace: 0,
  needs_repair: 1,
  missing: 2,
  loaned: 3,
  ok: 4,
};

const normalizeLog = (row: EquipmentLogResponse): EquipmentLog => {
  const profileValue = Array.isArray(row.profiles)
    ? row.profiles[0] ?? null
    : row.profiles ?? null;
  return { ...row, profiles: profileValue };
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ja-JP");

const statusBadge = (status: MaintenanceStatus) => {
  if (status === "ok") {
    return <Badge className="bg-emerald-600 text-white">OK</Badge>;
  }
  if (status === "needs_repair") {
    return <Badge className="bg-amber-500 text-black">要修理</Badge>;
  }
  if (status === "needs_replace") {
    return <Badge variant="destructive">要交換</Badge>;
  }
  if (status === "loaned") {
    return <Badge variant="secondary">貸出中</Badge>;
  }
  return (
    <Badge variant="outline" className="border-destructive text-destructive">
      欠品
    </Badge>
  );
};

export default function EquipmentMaintenancePage() {
  const {
    isAdmin,
    isPaLeader,
    isLightingLeader,
    isPartLeader,
    loading: roleLoading,
  } = useRoleFlags();

  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [logs, setLogs] = useState<EquipmentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [openToAll, setOpenToAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<EquipmentCategory>("PA");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated_desc");

  const [name, setName] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("General");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [status, setStatus] = useState<MaintenanceStatus>("ok");
  const [notes, setNotes] = useState("");

  const canEdit =
    openToAll || isAdmin || isPaLeader || isLightingLeader || isPartLeader;
  const canToggleOpen = isAdmin;

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const baseItems = items.filter((item) => item.category === activeCategory);
    const searchedItems = query
      ? baseItems.filter((item) => {
          const haystack = [
            item.name,
            item.manufacturer,
            item.model,
            item.location,
            item.notes,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
      : baseItems;

    return [...searchedItems].sort((a, b) => {
      switch (sortKey) {
        case "name_asc":
          return a.name.localeCompare(b.name, "ja");
        case "quantity_desc":
          return b.quantity - a.quantity;
        case "status":
          return statusOrder[a.status] - statusOrder[b.status];
        case "updated_desc":
        default:
          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
      }
    });
  }, [items, activeCategory, search, sortKey]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    const { data, error } = await supabase
      .from("equipment_settings")
      .select("open_to_all")
      .eq("scope", "equipment")
      .maybeSingle();
    if (error) {
      console.error(error);
      setSettingsError("編集設定の取得に失敗しました。");
      setOpenToAll(false);
    } else {
      setOpenToAll((data as { open_to_all?: boolean } | null)?.open_to_all ?? false);
    }
    setSettingsLoading(false);
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("equipment_items")
      .select(
        "id, name, category, manufacturer, model, location, quantity, status, notes, created_at, updated_at, created_by, updated_by"
      )
      .order("updated_at", { ascending: false });
    if (error) {
      console.error(error);
      setError("備品データの取得に失敗しました。");
      setItems([]);
    } else {
      setItems((data ?? []) as unknown as EquipmentItem[]);
    }
    setLoading(false);
  }, []);

  const fetchLogs = useCallback(async (itemId: string) => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from("equipment_item_logs")
      .select("id, equipment_id, status, note, created_at, changed_by, profiles:changed_by(real_name, display_name)")
      .eq("equipment_id", itemId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      setLogs([]);
    } else {
      const rows = (data ?? []) as EquipmentLogResponse[];
      setLogs(rows.map(normalizeLog));
    }
    setLogsLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchSettings();
      if (cancelled) return;
      await fetchItems();
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchItems, fetchSettings]);

  useEffect(() => {
    if (!selectedId) {
      setLogs([]);
      return;
    }
    void fetchLogs(selectedId);
  }, [fetchLogs, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const el = detailRef.current;
    if (!el) return;
    const paddingTop = Number.parseFloat(
      getComputedStyle(document.body).scrollPaddingTop || "0"
    );
    const rect = el.getBoundingClientRect();
    const viewportThreshold = window.innerHeight * 0.6;
    if (rect.top < paddingTop + 16 || rect.top > viewportThreshold) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedId]);

  const resetForm = useCallback(() => {
    setSelectedId(null);
    setName("");
    setCategory(activeCategory);
    setManufacturer("");
    setModel("");
    setLocation("");
    setQuantity("1");
    setStatus("ok");
    setNotes("");
  }, [activeCategory]);

  const loadForm = (item: EquipmentItem) => {
    setSelectedId(item.id);
    setName(item.name);
    setCategory(item.category);
    setManufacturer(item.manufacturer ?? "");
    setModel(item.model ?? "");
    setLocation(item.location ?? "");
    setQuantity(String(item.quantity ?? 0));
    setStatus(item.status);
    setNotes(item.notes ?? "");
  };

  const handleSave = async () => {
    if (!canEdit) return;
    if (!name.trim()) {
      setError("備品名を入力してください。");
      return;
    }
    const quantityValue = Number.parseInt(quantity, 10);
    if (Number.isNaN(quantityValue) || quantityValue < 0) {
      setError("数量は0以上の数値で入力してください。");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      category,
      manufacturer: manufacturer.trim() || null,
      model: model.trim() || null,
      location: location.trim() || null,
      quantity: quantityValue,
      status,
      notes: notes.trim() || null,
    };

    let nextId = selectedId;
    if (selectedId) {
      const { error } = await supabase
        .from("equipment_items")
        .update(payload)
        .eq("id", selectedId);
      if (error) {
        console.error(error);
        setError("更新に失敗しました。");
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("equipment_items")
        .insert(payload)
        .select(
          "id, name, category, manufacturer, model, location, quantity, status, notes, created_at, updated_at, created_by, updated_by"
        )
        .maybeSingle();
      if (error || !data) {
        console.error(error);
        setError("作成に失敗しました。");
        setSaving(false);
        return;
      }
      nextId = (data as EquipmentItem).id;
      setSelectedId(nextId);
      setActiveCategory((data as EquipmentItem).category);
    }

    await fetchItems();
    if (nextId) {
      await fetchLogs(nextId);
    }
    setSaving(false);
  };

  const handleToggleOpen = async () => {
    if (!canToggleOpen || settingsLoading) return;
    const nextValue = !openToAll;
    setOpenToAll(nextValue);
    const { error } = await supabase
      .from("equipment_settings")
      .update({ open_to_all: nextValue })
      .eq("scope", "equipment");
    if (error) {
      console.error(error);
      setOpenToAll(!nextValue);
      setSettingsError("編集権限の更新に失敗しました。");
    }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
                <Link href="/maintenance" className="hover:text-primary transition-colors">
                  備品管理に戻る
                </Link>
              </div>
              <div className="max-w-4xl mt-6">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">EQUIPMENT</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">
                  備品管理
                </h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  PA / 照明 / 総合の備品を記録し、状態の更新履歴を残します。
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Badge variant={openToAll ? "default" : "secondary"}>
                    {openToAll ? "編集: 全員に開放" : "編集: リーダー以上"}
                  </Badge>
                  {canToggleOpen && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleToggleOpen}
                      disabled={settingsLoading}
                      className="gap-2"
                    >
                      <ClipboardList className="w-4 h-4" />
                      {openToAll ? "全員編集を解除" : "全員編集を許可"}
                    </Button>
                  )}
                  {settingsError && (
                    <span className="text-xs text-destructive">{settingsError}</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
                  <RefreshCw className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="grid lg:grid-cols-[1.15fr,1fr] gap-6">
                <div className="order-2 space-y-6">
                  <Card ref={detailRef} className="bg-card/60 border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">備品の詳細</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!canEdit && (
                        <div className="text-xs text-muted-foreground">
                          編集権限がありません。開放中の場合のみ更新できます。
                        </div>
                      )}
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">備品名</span>
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          disabled={!canEdit || roleLoading}
                        />
                      </label>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">カテゴリ</span>
                          <select
                            value={category}
                            onChange={(e) =>
                              setCategory(e.target.value as EquipmentCategory)
                            }
                            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                            disabled={!canEdit || roleLoading}
                          >
                            {categoryOptions.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">状態</span>
                          <select
                            value={status}
                            onChange={(e) =>
                              setStatus(e.target.value as MaintenanceStatus)
                            }
                            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                            disabled={!canEdit || roleLoading}
                          >
                            {statusOptions.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">メーカー</span>
                          <Input
                            value={manufacturer}
                            onChange={(e) => setManufacturer(e.target.value)}
                            disabled={!canEdit || roleLoading}
                          />
                        </label>
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">型番</span>
                          <Input
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            disabled={!canEdit || roleLoading}
                          />
                        </label>
                      </div>

                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">保管場所</span>
                        <Input
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          disabled={!canEdit || roleLoading}
                        />
                      </label>

                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">数量</span>
                        <Input
                          type="number"
                          min={0}
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          disabled={!canEdit || roleLoading}
                        />
                      </label>

                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">メモ</span>
                        <Textarea
                          rows={4}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          disabled={!canEdit || roleLoading}
                        />
                      </label>

                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={handleSave}
                          disabled={!canEdit || saving || roleLoading}
                          className="gap-2"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          保存
                        </Button>
                        {selectedItem?.updated_at && (
                          <span className="text-xs text-muted-foreground">
                            更新: {formatDateTime(selectedItem.updated_at)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/60 border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">履歴</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!selectedId && (
                        <p className="text-xs text-muted-foreground">
                          備品を選択すると履歴を表示します。
                        </p>
                      )}
                      {selectedId && logsLoading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          読み込み中...
                        </div>
                      )}
                      {selectedId && !logsLoading && logs.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          まだ履歴がありません。
                        </p>
                      )}
                      {logs.map((log) => {
                        const actor =
                          log.profiles?.real_name ??
                          log.profiles?.display_name ??
                          "Unknown";
                        return (
                          <div
                            key={log.id}
                            className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {statusBadge(log.status)}
                                <span className="text-foreground">{actor}</span>
                              </div>
                              <span className="text-muted-foreground">
                                {formatDateTime(log.created_at)}
                              </span>
                            </div>
                            {log.note && (
                              <div className="text-muted-foreground">{log.note}</div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>

                <Card className="order-1 bg-card/60 border-border">
                  <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-lg">備品一覧</CardTitle>
                      {canEdit && (
                        <Button type="button" variant="outline" onClick={resetForm}>
                          新規追加
                        </Button>
                      )}
                    </div>
                    <Tabs
                      value={activeCategory}
                      onValueChange={(value) => setActiveCategory(value as EquipmentCategory)}
                    >
                    <TabsList>
                      {categoryOptions.map((item) => (
                        <TabsTrigger key={item.value} value={item.value}>
                          {item.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {categoryOptions.map((item) => (
                      <TabsContent key={item.value} value={item.value} />
                    ))}
                  </Tabs>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="備品名・メーカーで検索"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <select
                      value={sortKey}
                      onChange={(event) => setSortKey(event.target.value as SortKey)}
                      className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                    >
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardHeader>
                  <CardContent>
                    <div className="space-y-3 md:hidden max-h-[60vh] overflow-y-auto pr-1">
                      {loading ? (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          読み込み中...
                        </div>
                      ) : filteredItems.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                          表示できる備品がありません。
                        </div>
                      ) : (
                        filteredItems.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => loadForm(item)}
                            className={cn(
                              "cursor-pointer rounded-lg border border-border px-4 py-3 transition-colors",
                              item.id === selectedId
                                ? "border-primary/50 bg-primary/10"
                                : "bg-card/60 hover:bg-muted/40"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {item.manufacturer ?? "-"} / {item.model ?? "-"}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-foreground">
                                  数量 {item.quantity}
                                </div>
                                <div className="mt-2">{statusBadge(item.status)}</div>
                              </div>
                            </div>
                            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                              <div>保管場所: {item.location ?? "-"}</div>
                              <div>更新: {formatDateTime(item.updated_at)}</div>
                              {item.notes && <div>メモ: {item.notes}</div>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="hidden md:block rounded-lg border border-border overflow-x-auto max-h-[520px] overflow-y-auto">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead>備品</TableHead>
                            <TableHead className="hidden lg:table-cell">メーカー</TableHead>
                            <TableHead className="hidden lg:table-cell">型番</TableHead>
                            <TableHead className="hidden lg:table-cell">保管場所</TableHead>
                            <TableHead className="text-right">数量</TableHead>
                            <TableHead className="text-right">状態</TableHead>
                            <TableHead className="hidden lg:table-cell">メモ</TableHead>
                            <TableHead className="hidden lg:table-cell text-right">更新日</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  読み込み中...
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : filteredItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-sm text-muted-foreground">
                                表示できる備品がありません。
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredItems.map((item) => (
                              <TableRow
                                key={item.id}
                                onClick={() => loadForm(item)}
                                className={cn(
                                  "cursor-pointer",
                                  item.id === selectedId
                                    ? "bg-primary/10"
                                    : "hover:bg-muted/40"
                                )}
                              >
                                <TableCell className="font-medium">
                                  <div>{item.name}</div>
                                  <div className="mt-1 space-y-1 text-xs text-muted-foreground lg:hidden">
                                    <div>メーカー: {item.manufacturer ?? "-"}</div>
                                    <div>型番: {item.model ?? "-"}</div>
                                    <div>保管場所: {item.location ?? "-"}</div>
                                    <div>更新: {formatDateTime(item.updated_at)}</div>
                                    {item.notes && <div>メモ: {item.notes}</div>}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {item.manufacturer ?? "-"}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {item.model ?? "-"}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {item.location ?? "-"}
                                </TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">
                                  {statusBadge(item.status)}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell max-w-[220px] text-sm text-muted-foreground">
                                  <span className="line-clamp-1">{item.notes ?? "-"}</span>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-right text-xs text-muted-foreground">
                                  {formatDateTime(item.updated_at)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
