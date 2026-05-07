"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "@/lib/icons";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/PageHeader";
import { getDepartmentConfig, type DepartmentKey } from "@/lib/departments";

type EquipmentStatus =
  | "ok"
  | "needs_repair"
  | "needs_replace"
  | "missing"
  | "loaned";

type EquipmentItem = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  quantity: number;
  status: EquipmentStatus;
  notes: string | null;
  updated_at: string;
};

type SortKey = "updated_desc" | "name_asc" | "quantity_desc" | "status";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "updated_desc", label: "更新: 新しい順" },
  { value: "name_asc", label: "名前順" },
  { value: "quantity_desc", label: "数量: 多い順" },
  { value: "status", label: "状態順" },
];

const statusOrder: Record<EquipmentStatus, number> = {
  needs_replace: 0,
  needs_repair: 1,
  missing: 2,
  loaned: 3,
  ok: 4,
};

const formatDateTime = (value: string) => new Date(value).toLocaleString("ja-JP");

const statusBadge = (status: EquipmentStatus) => {
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

export function DepartmentEquipmentPage({
  department,
}: {
  department: DepartmentKey;
}) {
  const config = getDepartmentConfig(department);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated_desc");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("equipment_items")
        .select(
          "id, name, manufacturer, model, location, quantity, status, notes, updated_at"
        )
        .eq("category", config.equipmentCategory)
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error(`${config.equipmentTitle}の取得に失敗しました。`);
        setItems([]);
      } else {
        setItems((data ?? []) as EquipmentItem[]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [config.equipmentCategory, config.equipmentTitle]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const searchedItems = query
      ? items.filter((item) => {
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
      : items;

    return [...searchedItems].sort((left, right) => {
      switch (sortKey) {
        case "name_asc":
          return left.name.localeCompare(right.name, "ja");
        case "quantity_desc":
          return right.quantity - left.quantity;
        case "status":
          return statusOrder[left.status] - statusOrder[right.status];
        case "updated_desc":
        default:
          return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      }
    });
  }, [items, search, sortKey]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker={config.equipmentKicker}
            title={config.equipmentTitle}
            description={`${config.label}カテゴリの機材一覧です。備品管理で編集できます。`}
            backHref={`/${department}`}
            backLabel={`${config.label}に戻る`}
            tone={config.tone}
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto space-y-4 px-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="機材名・メーカーで検索"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                  className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 md:hidden">
                {loading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    読み込み中...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                    表示できる機材がありません。
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-card/60 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.manufacturer ?? "-"} / {item.model ?? "-"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-foreground">数量 {item.quantity}</div>
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

              <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>機材</TableHead>
                      <TableHead className="hidden lg:table-cell">メーカー</TableHead>
                      <TableHead className="hidden lg:table-cell">型番</TableHead>
                      <TableHead className="hidden lg:table-cell">保管場所</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">状態</TableHead>
                      <TableHead className="hidden lg:table-cell">メモ</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">更新日</TableHead>
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
                          表示できる機材がありません。
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item) => (
                        <TableRow key={item.id} className={cn("hover:bg-muted/40")}>
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
                          <TableCell className="text-right">{statusBadge(item.status)}</TableCell>
                          <TableCell className="hidden max-w-[220px] text-sm text-muted-foreground lg:table-cell">
                            <span className="line-clamp-1">{item.notes ?? "-"}</span>
                          </TableCell>
                          <TableCell className="hidden text-right text-xs text-muted-foreground lg:table-cell">
                            {formatDateTime(item.updated_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
