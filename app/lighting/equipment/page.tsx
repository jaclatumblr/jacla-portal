"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
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

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ja-JP");

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

export default function LightingEquipmentPage() {
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
        .eq("category", "Lighting")
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error("照明機材の取得に失敗しました。");
        setItems([]);
      } else {
        setItems((data ?? []) as EquipmentItem[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
  }, [items, search, sortKey]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
                <Link href="/lighting" className="hover:text-accent transition-colors">
                  照明に戻る
                </Link>
              </div>
              <div className="max-w-4xl mt-6">
                <span className="text-xs text-accent tracking-[0.3em] font-mono">
                  LIGHTING EQUIPMENT
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">
                  照明機材
                </h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  照明カテゴリの機材一覧です。備品管理で編集できます。
                </p>
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="機材名・メーカーで検索"
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

              <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
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
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
