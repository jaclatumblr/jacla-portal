"use client";

import Link from "next/link";

type Props = {
  activeTab?: "roles" | "accounts";
  canManageAccounts: boolean;
};

export function UserManagementTabs({ activeTab = "roles", canManageAccounts }: Props) {
  const tabs = [
    { id: "roles", href: "/admin/roles", label: "権限管理" },
    ...(canManageAccounts ? [{ id: "accounts", href: "/admin/accounts", label: "在籍・アカウント管理" }] : []),
  ];

  return (
    <nav aria-label="ユーザー管理の切り替え" className="container mx-auto px-4 py-5 sm:px-6">
      <div data-slot="tabs-list" className="inline-flex max-w-full items-center gap-1 rounded-xl border border-border/80 bg-surface-secondary p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={activeTab === tab.id ? "page" : undefined}
            data-slot="tabs-trigger"
            data-state={activeTab === tab.id ? "active" : "inactive"}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-transparent px-3 py-2 text-center text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
