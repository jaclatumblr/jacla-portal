"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "@/lib/toast";
import {
  MaintenanceStatus,
  SortKey,
  BaseMaintenanceItem,
  BaseMaintenanceLog,
  statusOrder,
  normalizeLog,
  ItemDetailForm,
  ItemListCard,
} from "../shared";

// 楽器固有の型
type InstrumentSection =
  | "ギター"
  | "ベース"
  | "ドラム"
  | "キーボード"
  | "ボーカル"
  | "その他";

type InstrumentItem = BaseMaintenanceItem & {
  section: InstrumentSection;
};

type InstrumentLog = BaseMaintenanceLog & {
  instrument_id: string;
};

// セクションオプション
const sectionOptions: { value: InstrumentSection; label: string }[] = [
  { value: "ギター", label: "ギター" },
  { value: "ベース", label: "ベース" },
  { value: "ドラム", label: "ドラム" },
  { value: "キーボード", label: "キーボード" },
  { value: "ボーカル", label: "ボーカル" },
  { value: "その他", label: "その他" },
];

export default function InstrumentMaintenancePage() {
  const { isAdmin, isPaLeader, isLightingLeader, isPartLeader, loading: roleLoading } =
    useRoleFlags();

  const [items, setItems] = useState<InstrumentItem[]>([]);
  const [logs, setLogs] = useState<InstrumentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [openToAll, setOpenToAll] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<InstrumentSection>("ギター");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated_desc");

  // フォームステート
  const [name, setName] = useState("");
  const [section, setSection] = useState<InstrumentSection>("ギター");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [status, setStatus] = useState<MaintenanceStatus>("ok");
  const [notes, setNotes] = useState("");

  const canEdit = openToAll || isAdmin || isPaLeader || isLightingLeader || isPartLeader;
  const canToggleOpen = isAdmin;

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  // ソート済みアイテム
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      switch (sortKey) {
        case "name_asc":
          return a.name.localeCompare(b.name, "ja");
        case "quantity_desc":
          return b.quantity - a.quantity;
        case "status":
          return statusOrder[a.status] - statusOrder[b.status];
        case "updated_desc":
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
  }, [items, sortKey]);

  // 設定取得
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    const { data, error } = await supabase
      .from("equipment_settings")
      .select("open_to_all")
      .eq("scope", "instruments")
      .maybeSingle();
    if (error) {
      console.error(error);
      toast.error("編集設定の取得に失敗しました。");
      setOpenToAll(false);
    } else {
      setOpenToAll((data as { open_to_all?: boolean } | null)?.open_to_all ?? false);
    }
    setSettingsLoading(false);
  }, []);

  // アイテム取得
  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("instrument_items")
      .select(
        "id, name, section, manufacturer, model, location, quantity, status, notes, created_at, updated_at, created_by, updated_by"
      )
      .order("updated_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("楽器データの取得に失敗しました。");
      setItems([]);
    } else {
      setItems((data ?? []) as unknown as InstrumentItem[]);
    }
    setLoading(false);
  }, []);

  // ログ取得
  const fetchLogs = useCallback(async (itemId: string) => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from("instrument_item_logs")
      .select(
        "id, instrument_id, status, note, created_at, changed_by, profiles:changed_by(real_name, display_name)"
      )
      .eq("instrument_id", itemId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      setLogs([]);
    } else {
      setLogs((data ?? []).map((row) => normalizeLog(row) as InstrumentLog));
    }
    setLogsLoading(false);
  }, []);

  // 初期読み込み
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

  // 選択時にログ取得
  useEffect(() => {
    if (!selectedId) {
      setLogs([]);
      return;
    }
    void fetchLogs(selectedId);
  }, [fetchLogs, selectedId]);

  // 選択時にスクロール
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
    setSection(activeSection);
    setManufacturer("");
    setModel("");
    setLocation("");
    setQuantity("1");
    setStatus("ok");
    setNotes("");
  }, [activeSection]);

  const loadForm = (item: InstrumentItem) => {
    setSelectedId(item.id);
    setName(item.name);
    setSection(item.section);
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
      toast.error("楽器名を入力してください。");
      return;
    }
    const quantityValue = Number.parseInt(quantity, 10);
    if (Number.isNaN(quantityValue) || quantityValue < 0) {
      toast.error("数量は0以上の数値で入力してください。");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      section,
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
        .from("instrument_items")
        .update(payload)
        .eq("id", selectedId);
      if (error) {
        console.error(error);
        toast.error("更新に失敗しました。");
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("instrument_items")
        .insert(payload)
        .select(
          "id, name, section, manufacturer, model, location, quantity, status, notes, created_at, updated_at, created_by, updated_by"
        )
        .maybeSingle();
      if (error || !data) {
        console.error(error);
        toast.error("作成に失敗しました。");
        setSaving(false);
        return;
      }
      nextId = (data as InstrumentItem).id;
      setSelectedId(nextId);
      setActiveSection((data as InstrumentItem).section);
    }

    await fetchItems();
    if (nextId) await fetchLogs(nextId);
    toast.success("保存しました。");
    setSaving(false);
  };

  const handleToggleOpen = async () => {
    if (!canToggleOpen || settingsLoading) return;
    const nextValue = !openToAll;
    setOpenToAll(nextValue);
    const { error } = await supabase
      .from("equipment_settings")
      .update({ open_to_all: nextValue })
      .eq("scope", "instruments");
    if (error) {
      console.error(error);
      setOpenToAll(!nextValue);
      toast.error("編集権限の更新に失敗しました。");
    }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Instruments"
            title="楽器管理"
            description="セクション別の楽器を記録し、状態の更新履歴を残します。"
            backHref="/maintenance"
            backLabel="備品管理に戻る"
            actions={
              <div className="flex flex-wrap items-center gap-3">
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
              </div>
            }
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              <div className="grid lg:grid-cols-[1.15fr,1fr] gap-6">
                {/* 詳細フォーム */}
                <div ref={detailRef} className="order-2">
                  <ItemDetailForm
                    selectedId={selectedId}
                    updatedAt={selectedItem?.updated_at ?? null}
                    name={name}
                    setName={setName}
                    category={section}
                    setCategory={setSection}
                    categoryOptions={sectionOptions}
                    categoryLabel="セクション"
                    manufacturer={manufacturer}
                    setManufacturer={setManufacturer}
                    model={model}
                    setModel={setModel}
                    location={location}
                    setLocation={setLocation}
                    quantity={quantity}
                    setQuantity={setQuantity}
                    status={status}
                    setStatus={setStatus}
                    notes={notes}
                    setNotes={setNotes}
                    canEdit={canEdit}
                    saving={saving}
                    roleLoading={roleLoading}
                    onSave={handleSave}
                    logs={logs}
                    logsLoading={logsLoading}
                  />
                </div>

                {/* 一覧 */}
                <div className="order-1">
                  <ItemListCard
                    title="楽器一覧"
                    items={sortedItems}
                    loading={loading}
                    selectedId={selectedId}
                    onSelect={loadForm}
                    onNewClick={resetForm}
                    canEdit={canEdit}
                    activeCategory={activeSection}
                    setActiveCategory={setActiveSection}
                    categoryOptions={sectionOptions}
                    categoryField="section"
                    search={search}
                    setSearch={setSearch}
                    sortKey={sortKey}
                    setSortKey={setSortKey}
                  />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
