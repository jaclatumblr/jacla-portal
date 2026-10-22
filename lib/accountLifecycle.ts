export const accountStatuses = ["active", "dormant", "graduated", "withdrawn"] as const;
export type AccountStatus = typeof accountStatuses[number];
export const accountStatusLabels: Record<AccountStatus, string> = { active: "在籍中", dormant: "休眠", graduated: "卒業", withdrawn: "退部" };
export function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === "string" && (accountStatuses as readonly string[]).includes(value);
}
export type ManagedAccount = {
  profile_id: string;
  status: AccountStatus;
  last_active_at: string;
  activity_recorded: boolean;
  warning_at: string | null;
  status_changed_at: string;
  reason: string;
  display_name: string;
};
