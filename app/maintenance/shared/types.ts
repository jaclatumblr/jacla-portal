// 備品管理・楽器管理で共有する型定義

export type MaintenanceStatus =
    | "ok"
    | "needs_repair"
    | "needs_replace"
    | "missing"
    | "loaned";

export type SortKey = "updated_desc" | "name_asc" | "quantity_desc" | "status";

// 共通のステータスオプション
export const statusOptions: { value: MaintenanceStatus; label: string }[] = [
    { value: "ok", label: "OK" },
    { value: "needs_repair", label: "要修理" },
    { value: "needs_replace", label: "要交換" },
    { value: "missing", label: "欠品" },
    { value: "loaned", label: "貸出中" },
];

// 共通のソートオプション
export const sortOptions: { value: SortKey; label: string }[] = [
    { value: "updated_desc", label: "更新: 新しい順" },
    { value: "name_asc", label: "名前順" },
    { value: "quantity_desc", label: "数量: 多い順" },
    { value: "status", label: "状態順" },
];

// ステータス順序（ソート用）
export const statusOrder: Record<MaintenanceStatus, number> = {
    needs_replace: 0,
    needs_repair: 1,
    missing: 2,
    loaned: 3,
    ok: 4,
};

// 日時フォーマット
export const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("ja-JP");

// 基本アイテム型（equipment/instruments共通）
export type BaseMaintenanceItem = {
    id: string;
    name: string;
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

// ログの基本型
export type ProfileInfo = {
    real_name: string | null;
    display_name: string | null;
};

export type BaseMaintenanceLog = {
    id: string;
    status: MaintenanceStatus;
    note: string | null;
    created_at: string;
    changed_by: string | null;
    profiles?: ProfileInfo | null;
};

// ログレスポンスの正規化
export const normalizeLog = <T extends { profiles?: ProfileInfo | ProfileInfo[] | null }>(
    row: T
): Omit<T, "profiles"> & { profiles: ProfileInfo | null } => {
    const profileValue = Array.isArray(row.profiles)
        ? row.profiles[0] ?? null
        : row.profiles ?? null;
    return { ...row, profiles: profileValue };
};
