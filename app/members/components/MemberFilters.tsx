"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SortKey } from "../types";
import { sortOptions } from "../types";

type MemberFiltersProps = {
    searchText: string;
    onSearchChange: (value: string) => void;
    sortKey: SortKey;
    onSortChange: (value: SortKey) => void;
};

export function MemberFilters({
    searchText,
    onSearchChange,
    sortKey,
    onSortChange,
}: MemberFiltersProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    value={searchText}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="名前、役職、パート、バンドで検索..."
                    className="pl-10 bg-card/50 border-border"
                    aria-label="部員を検索"
                />
            </div>
            <select
                value={sortKey}
                onChange={(event) => onSortChange(event.target.value as SortKey)}
                className="h-10 w-full sm:w-auto rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="並び替え"
            >
                {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
