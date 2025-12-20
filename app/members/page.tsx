import { MessageCircle, Music, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";

type Member = {
  id: number;
  name: string;
  discord: string;
  part: string;
  year: string;
  bands: string[];
};

const members: Member[] = [
  {
    id: 1,
    name: "山田 太郎",
    discord: "yamada#1234",
    part: "ボーカル",
    year: "3年",
    bands: ["The Rockers", "Acoustic Duo"],
  },
  {
    id: 2,
    name: "佐藤 花子",
    discord: "hanako#5678",
    part: "ギター",
    year: "2年",
    bands: ["Jazz Quartet"],
  },
  {
    id: 3,
    name: "鈴木 一郎",
    discord: "ichiro#9012",
    part: "ドラム",
    year: "4年",
    bands: ["The Rockers", "Metal Heads"],
  },
  {
    id: 4,
    name: "田中 美咲",
    discord: "misaki#3456",
    part: "ベース",
    year: "1年",
    bands: ["Pop Stars"],
  },
  {
    id: 5,
    name: "高橋 健太",
    discord: "kenta#7890",
    part: "キーボード",
    year: "3年",
    bands: ["Jazz Quartet", "Electronic Beats"],
  },
  {
    id: 6,
    name: "伊藤 さくら",
    discord: "sakura#2468",
    part: "ボーカル",
    year: "2年",
    bands: ["Indie Band"],
  },
];

export default function MembersPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-16 md:py-24 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="absolute top-0 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-5xl pt-12 md:pt-0">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">MEMBERS</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">部員一覧</h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-2xl mb-8">
                  部員情報と担当パートを確認できます。連絡はDiscordを利用してください。
                </p>

                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 max-w-xl">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="名前、パート、バンドで検索..."
                      className="pl-10 bg-card/50 border-border"
                    />
                  </div>
                  <Button variant="outline" className="bg-transparent w-full sm:w-auto">
                    絞り込み
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="grid lg:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
                {members.map((member, index) => (
                  <div
                    key={member.id}
                    className="group relative p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

                    <div className="relative flex items-start gap-3 md:gap-4">
                      <Avatar className="w-12 h-12 md:w-16 md:h-16 border-2 border-border shrink-0">
                        <AvatarImage src="/placeholder-user.jpg" alt={member.name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-base md:text-lg">
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3 className="font-bold text-base md:text-lg truncate">{member.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {member.year}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          <Music className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-sm text-muted-foreground">{member.part}</span>
                        </div>

                        <div className="space-y-1 mb-3 md:mb-4 text-xs md:text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MessageCircle className="w-4 h-4 shrink-0" />
                            <span className="truncate">Discord: {member.discord}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 md:gap-2">
                          {member.bands.map((band) => (
                            <Badge key={band} variant="outline" className="bg-transparent text-xs">
                              {band}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
