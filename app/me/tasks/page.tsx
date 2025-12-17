import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";

const tasks = {
  pending: [
    {
      id: 1,
      title: "春ライブ レパートリー提出",
      deadline: "2025-03-01",
      type: "提出",
      urgent: true,
      link: "/events",
    },
    {
      id: 2,
      title: "新歓コンサート バンドメンバー確認",
      deadline: "2025-03-15",
      type: "確認",
      urgent: false,
      link: "/events",
    },
  ],
  assigned: [
    {
      id: 3,
      title: "PA機材点検（担当）",
      deadline: "2025-02-15",
      type: "担当",
      urgent: false,
      link: "/pa",
    },
  ],
  completed: [
    {
      id: 4,
      title: "部員情報更新",
      completedAt: "2025-01-10",
      type: "完了",
    },
  ],
};

export default function MyTasksPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl pt-12 md:pt-0">
                <Link
                  href="/me/profile"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">マイページ</span>
                </Link>

                <span className="text-xs text-primary tracking-[0.3em] font-mono">MY TASKS</span>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 mb-2">やること</h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  未提出・担当・確認待ちのタスク一覧
                </p>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto">
                <Tabs defaultValue="pending">
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
                    <TabsList className="bg-card/50 border border-border w-max sm:w-auto">
                      <TabsTrigger value="pending" className="text-sm gap-2">
                        <AlertCircle className="w-4 h-4" />
                        未完了 ({tasks.pending.length})
                      </TabsTrigger>
                      <TabsTrigger value="assigned" className="text-sm gap-2">
                        <Clock className="w-4 h-4" />
                        担当 ({tasks.assigned.length})
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="text-sm gap-2">
                        <CheckCircle className="w-4 h-4" />
                        完了 ({tasks.completed.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="pending" className="space-y-3">
                    {tasks.pending.map((task) => (
                      <Link
                        key={task.id}
                        href={task.link}
                        className={`group flex items-center justify-between p-4 rounded-lg border transition-all ${
                          task.urgent
                            ? "border-orange-500/50 bg-orange-500/5 hover:border-orange-500"
                            : "border-border bg-card/50 hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              task.urgent ? "bg-orange-500" : "bg-primary"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-sm md:text-base truncate group-hover:text-primary transition-colors">
                              {task.title}
                            </p>
                            <p className="text-xs text-muted-foreground">締切: {task.deadline}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={task.urgent ? "destructive" : "outline"} className="text-xs">
                            {task.type}
                          </Badge>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </TabsContent>

                  <TabsContent value="assigned" className="space-y-3">
                    {tasks.assigned.map((task) => (
                      <Link
                        key={task.id}
                        href={task.link}
                        className="group flex items-center justify-between p-4 rounded-lg border border-border bg-card/50 hover:border-primary/50 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-secondary shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm md:text-base truncate group-hover:text-primary transition-colors">
                              {task.title}
                            </p>
                            <p className="text-xs text-muted-foreground">締切: {task.deadline}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {task.type}
                          </Badge>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </TabsContent>

                  <TabsContent value="completed" className="space-y-3">
                    {tasks.completed.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50 opacity-60"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm md:text-base truncate line-through">
                              {task.title}
                            </p>
                            <p className="text-xs text-muted-foreground">完了: {task.completedAt}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                          {task.type}
                        </Badge>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}

