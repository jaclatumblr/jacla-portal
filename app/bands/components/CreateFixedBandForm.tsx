"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";

type CreateFixedBandFormProps = {
    selfPart: string;
    onCreated: (newBandId: string) => Promise<void>;
};

export function CreateFixedBandForm({ selfPart, onCreated }: CreateFixedBandFormProps) {
    const { session } = useAuth();
    const userId = session?.user.id ?? null;

    const [bandName, setBandName] = useState("");
    const [instrument, setInstrument] = useState(selfPart);
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!userId) return;
        const name = bandName.trim();
        const inst = instrument.trim();

        if (!name) {
            toast.error("バンド名を入力してください。");
            return;
        }
        if (!inst) {
            toast.error("担当パートを入力してください。");
            return;
        }

        setCreating(true);
        const { data: bandData, error: bandError } = await supabase
            .from("bands")
            .insert({
                name,
                band_type: "fixed",
                created_by: userId,
            })
            .select("id")
            .maybeSingle();

        if (bandError || !bandData) {
            console.error(bandError);
            toast.error("固定バンドの作成に失敗しました。");
            setCreating(false);
            return;
        }

        const { error: memberError } = await supabase.from("band_members").insert({
            band_id: bandData.id,
            user_id: userId,
            instrument: inst,
            order_index: 1,
        });

        if (memberError) {
            console.error(memberError);
            toast.error("作成者の参加登録に失敗しました。");
        } else {
            toast.success("固定バンドを作成しました。");
        }

        setBandName("");
        setInstrument(selfPart || "");
        setCreating(false);
        await onCreated(bandData.id);
    };

    return (
        <Card className="bg-card/60">
            <CardHeader className="pb-4">
                <CardTitle className="text-base">固定バンドを作成</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">バンド名</label>
                    <Input
                        value={bandName}
                        onChange={(e) => setBandName(e.target.value)}
                        placeholder="例: Jacla Core"
                        className="h-9"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">あなたの担当パート</label>
                    <Input
                        value={instrument}
                        onChange={(e) => setInstrument(e.target.value)}
                        placeholder="例: Gt., Vo."
                        className="h-9"
                    />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full" size="sm">
                    {creating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            作成中...
                        </>
                    ) : (
                        "バンドを作成"
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
