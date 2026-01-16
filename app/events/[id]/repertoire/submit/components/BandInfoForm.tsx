"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BandRow } from "../types";

type BandInfoFormProps = {
  band: BandRow;
  onChange: (key: keyof BandRow, value: any) => void;
  readOnly?: boolean;
};

export function BandInfoForm({ band, onChange, readOnly }: BandInfoFormProps) {
  return (
    <Card className="bg-card/60">
      <CardHeader>
        <CardTitle>基本情報・要望</CardTitle>
        <CardDescription>
          バンド全体の基本情報と、PA・照明への全体的な要望を入力してください。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">バンド名</label>
            <Input disabled={readOnly}
              value={band.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="バンド名"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">代表者名</label>
            <Input disabled={readOnly}
              value={band.representative_name ?? ""}
              onChange={(e) => onChange("representative_name", e.target.value)}
              placeholder="連絡先代表者"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">全体備考</label>
          <Textarea disabled={readOnly}
            value={band.general_note ?? ""}
            onChange={(e) => onChange("general_note", e.target.value)}
            placeholder="全体を通しての連絡事項など"
            rows={3}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">PA要望（全体）</label>
            <Textarea disabled={readOnly}
              value={band.sound_note ?? ""}
              onChange={(e) => onChange("sound_note", e.target.value)}
              placeholder="音響に関する全体的な要望（ボーカル大きめ、リバーブ深め等）"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">照明要望（全体）</label>
            <Textarea disabled={readOnly}
              value={band.lighting_note ?? ""}
              onChange={(e) => onChange("lighting_note", e.target.value)}
              placeholder="照明に関する全体的な要望（暖色系メイン、派手に等）"
              rows={4}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
