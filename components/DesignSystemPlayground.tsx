"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Calendar, ArrowRight } from "@/lib/icons";

export function DesignSystemPlayground() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">次のライブ</h2><p className="mt-1 text-sm text-muted-foreground">ボタン・入力・一覧を実際に操作して確認できます。</p></div>
        <Badge variant="success">受付中</Badge>
      </div>
      <Tabs defaultValue="event">
        <TabsList aria-label="テーマの表示例"><TabsTrigger value="event">イベント</TabsTrigger><TabsTrigger value="band">バンド</TabsTrigger></TabsList>
        <TabsContent value="event"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>イベント</TableHead><TableHead>開催日</TableHead><TableHead>状態</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>定期ライブ</TableCell><TableCell className="whitespace-nowrap">11月21日</TableCell><TableCell><Badge>募集中</Badge></TableCell></TableRow><TableRow><TableCell>新入生ライブ</TableCell><TableCell className="whitespace-nowrap">4月18日</TableCell><TableCell><Badge variant="success">提出済み</Badge></TableCell></TableRow></TableBody></Table></div></TabsContent>
        <TabsContent value="band"><p className="py-4 text-sm text-muted-foreground">所属バンドの曲・メンバー・提出状況を一覧で確認できます。</p></TabsContent>
      </Tabs>
      <Input label="バンド名" placeholder="バンド名を入力" supportingText="テーマの表示例です。入力内容は保存されません。" />
      <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setOpen(true)}><Calendar />イベントの表示例<ArrowRight /></Button><Button type="button" variant="secondary" onClick={() => setOpen(true)}>詳細を見る</Button></div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="定期ライブ" description="イベントの詳細を確認するダイアログの表示例です。">
          <div className="space-y-5 pt-3"><p className="text-sm leading-relaxed text-muted-foreground">テーマによって、文字・面の色・形・余白・操作時の表示が変わります。</p><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>閉じる</Button><Button type="button" onClick={() => setOpen(false)}>確認しました</Button></div></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
