"use client";

import Link from "next/link";
import { ClipboardList, Package, Guitar } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";

export default function MaintenanceIndexPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Equipment"
            title="備品管理"
            description="備品と楽器の状態を記録し、必要に応じて更新できます。"
            size="lg"
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="grid gap-4 md:gap-6 sm:grid-cols-2 max-w-4xl">
                <Link href="/maintenance/equipment" className="group">
                  <div className="relative h-40 md:h-44 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                    <div className="relative h-full flex flex-col">
                      <Package className="w-6 h-6 md:w-7 md:h-7 text-primary mb-3" />
                      <h2 className="text-lg font-bold mb-2">備品管理</h2>
                      <p className="text-sm text-muted-foreground flex-1">
                        PA / 照明 / 総合の備品を管理します。
                      </p>
                      <div className="flex items-center gap-2 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>開く</span>
                        <ClipboardList className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                <Link href="/maintenance/instruments" className="group">
                  <div className="relative h-40 md:h-44 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                    <div className="relative h-full flex flex-col">
                      <Guitar className="w-6 h-6 md:w-7 md:h-7 text-primary mb-3" />
                      <h2 className="text-lg font-bold mb-2">楽器管理</h2>
                      <p className="text-sm text-muted-foreground flex-1">
                        セクション別の楽器状態を記録します。
                      </p>
                      <div className="flex items-center gap-2 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>開く</span>
                        <ClipboardList className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
