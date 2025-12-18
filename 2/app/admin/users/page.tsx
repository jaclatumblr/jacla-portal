import Link from "next/link"
import { ArrowLeft, Search, Shield, MoreVertical } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SideNav } from "@/components/side-nav"

const users = [
  { id: 1, name: "山田太郎", email: "yamada@example.com", role: "admin", status: "active" },
  { id: 2, name: "佐藤花子", email: "sato@example.com", role: "supervisor", status: "active" },
  { id: 3, name: "鈴木一郎", email: "suzuki@example.com", role: "member", status: "active" },
  { id: 4, name: "田中美咲", email: "tanaka@example.com", role: "member", status: "active" },
  { id: 5, name: "高橋健太", email: "takahashi@example.com", role: "member", status: "muted" },
]

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: "管理者", color: "bg-red-500/20 text-red-500" },
  supervisor: { label: "運営", color: "bg-orange-500/20 text-orange-500" },
  member: { label: "一般", color: "bg-blue-500/20 text-blue-500" },
}

export default function AdminUsersPage() {
  return (
    <div className="flex min-h-screen">
      <SideNav />

      <main className="flex-1 md:ml-20">
        {/* ヘッダー */}
        <section className="relative py-12 md:py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

          <div className="relative z-10 container mx-auto px-4 sm:px-6">
            <div className="max-w-5xl pt-12 md:pt-0">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">管理ページ</span>
              </Link>

              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-xs text-primary tracking-[0.3em] font-mono">ADMIN</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">部員管理</h1>

              <div className="flex flex-col sm:flex-row gap-3 max-w-xl mt-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="名前、メールで検索..." className="pl-10 bg-card/50" />
                </div>
                <Button variant="outline" className="bg-transparent">
                  絞り込み
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ユーザー一覧 */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-5xl mx-auto space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-card/50 border border-border rounded-lg hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src="/placeholder-user.jpg" alt={user.name} />
                      <AvatarFallback className="bg-primary/10 text-primary">{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <Badge className={`text-xs ${roleLabels[user.role].color}`}>
                          {roleLabels[user.role].label}
                        </Badge>
                        {user.status === "muted" && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            ミュート
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>編集</DropdownMenuItem>
                      <DropdownMenuItem>権限変更</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">ミュート</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
