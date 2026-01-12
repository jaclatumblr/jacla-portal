"use client";

import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import type { MaintenanceStatus, SortKey, BaseMaintenanceItem } from "./types";
import { sortOptions, formatDateTime } from "./types";

type CategoryOption<T extends string> = {
    value: T;
    label: string;
};

type ItemListCardProps<T extends BaseMaintenanceItem, C extends string> = {
    title: string;
    items: T[];
    loading: boolean;
    selectedId: string | null;
    onSelect: (item: T) => void;
    onNewClick: () => void;
    canEdit: boolean;
    // カテゴリ
    activeCategory: C;
    setActiveCategory: (category: C) => void;
    categoryOptions: CategoryOption<C>[];
    categoryField: keyof T;
    // 検索・ソート
    search: string;
    setSearch: (value: string) => void;
    sortKey: SortKey;
    setSortKey: (value: SortKey) => void;
};

export function ItemListCard<T extends BaseMaintenanceItem, C extends string>({
    title,
    items,
    loading,
    selectedId,
    onSelect,
    onNewClick,
    canEdit,
    activeCategory,
    setActiveCategory,
    categoryOptions,
    categoryField,
    search,
    setSearch,
    sortKey,
    setSortKey,
}: ItemListCardProps<T, C>) {
    // フィルタリング
    const query = search.trim().toLowerCase();
    const filteredItems = items.filter((item) => {
        if (item[categoryField] !== activeCategory) return false;
        if (!query) return true;
        const haystack = [item.name, item.manufacturer, item.model, item.location, item.notes]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        return haystack.includes(query);
    });

    return (
        <Card className="bg-card/60 border-border">
            <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg">{title}</CardTitle>
                    {canEdit && (
                        <Button type="button" variant="outline" onClick={onNewClick} size="sm">
                            新規追加
                        </Button>
                    )}
                </div>
                <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as C)}>
                    <TabsList>
                        {categoryOptions.map((opt) => (
                            <TabsTrigger key={opt.value} value={opt.value}>
                                {opt.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {categoryOptions.map((opt) => (
                        <TabsContent key={opt.value} value={opt.value} />
                    ))}
                </Tabs>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        placeholder="名前・メーカーで検索"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value as SortKey)}
                        className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                    >
                        {sortOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </CardHeader>
            <CardContent>
                {/* モバイル表示 */}
                <div className="space-y-3 md:hidden max-h-[60vh] overflow-y-auto pr-1">
                    {loading ? (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            読み込み中...
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                            表示できるアイテムがありません。
                        </div>
                    ) : (
                        filteredItems.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => onSelect(item)}
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
                                        <div className="text-sm text-foreground">数量 {item.quantity}</div>
                                        <div className="mt-2">
                                            <StatusBadge status={item.status} />
                                        </div>
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

                {/* デスクトップ表示 */}
                <div className="hidden md:block rounded-lg border border-border overflow-x-auto max-h-[520px] overflow-y-auto">
                    <Table className="w-full table-fixed">
                        <TableHeader>
                            <TableRow>
                                <TableHead>名前</TableHead>
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
                                        表示できるアイテムがありません。
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        onClick={() => onSelect(item)}
                                        className={cn(
                                            "cursor-pointer",
                                            item.id === selectedId ? "bg-primary/10" : "hover:bg-muted/40"
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
                                        <TableCell className="hidden lg:table-cell">{item.model ?? "-"}</TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            {item.location ?? "-"}
                                        </TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">
                                            <StatusBadge status={item.status} />
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
    );
}
