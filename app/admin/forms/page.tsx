"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type FormRow = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  created_at: string | null;
};

type FieldRow = {
  id: string;
  form_id: string;
  label: string;
  field_type: string;
  is_required: boolean;
  options: string[] | null;
  placeholder: string | null;
  order_index: number | null;
};

const fieldTypeOptions = [
  { value: "short_text", label: "テキスト（短文）" },
  { value: "long_text", label: "テキスト（長文）" },
  { value: "select", label: "選択（単一）" },
  { value: "checkbox", label: "選択（複数）" },
  { value: "number", label: "数値" },
  { value: "email", label: "メール" },
];

export default function AdminFormsPage() {
  const { isAdmin, loading: roleLoading } = useRoleFlags();
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [savingForm, setSavingForm] = useState(false);

  const [formDraft, setFormDraft] = useState({
    title: "",
    description: "",
    is_published: false,
  });

  const [fieldDraft, setFieldDraft] = useState({
    label: "",
    field_type: fieldTypeOptions[0]?.value ?? "short_text",
    is_required: false,
    optionsText: "",
    placeholder: "",
  });

  const selectedForm = useMemo(
    () => forms.find((form) => form.id === selectedId) ?? null,
    [forms, selectedId]
  );

  const loadForms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("forms")
      .select("id, title, description, is_published, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("フォーム一覧の取得に失敗しました。");
      setForms([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as FormRow[];
    setForms(rows);
    if (!selectedId && rows.length > 0) {
      setSelectedId(rows[0].id);
    }
    setLoading(false);
  };

  const loadFields = async (formId: string) => {
    const { data, error } = await supabase
      .from("form_fields")
      .select("id, form_id, label, field_type, is_required, options, placeholder, order_index")
      .eq("form_id", formId)
      .order("order_index", { ascending: true });
    if (error) {
      console.error(error);
      toast.error("フォーム項目の取得に失敗しました。");
      setFields([]);
      return;
    }
    setFields((data ?? []) as FieldRow[]);
  };

  useEffect(() => {
    if (roleLoading || !isAdmin) return;
    void loadForms();
  }, [roleLoading, isAdmin]);

  useEffect(() => {
    if (!selectedForm) {
      setFields([]);
      return;
    }
    setFormDraft({
      title: selectedForm.title,
      description: selectedForm.description ?? "",
      is_published: selectedForm.is_published,
    });
    void loadFields(selectedForm.id);
  }, [selectedForm?.id]);

  const handleCreateForm = async () => {
    if (!newTitle.trim()) return;
    setSavingForm(true);
    const { data, error } = await supabase
      .from("forms")
      .insert([
        {
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          is_published: false,
        },
      ])
      .select("id, title, description, is_published, created_at")
      .maybeSingle();
    if (error || !data) {
      console.error(error);
      toast.error("フォームの作成に失敗しました。");
      setSavingForm(false);
      return;
    }
    const created = data as FormRow;
    setForms((prev) => [created, ...prev]);
    setSelectedId(created.id);
    setNewTitle("");
    setNewDescription("");
    toast.success("フォームを作成しました。");
    setSavingForm(false);
  };

  const handleSaveForm = async () => {
    if (!selectedForm) return;
    setSavingForm(true);
    const payload = {
      title: formDraft.title.trim() || "無題フォーム",
      description: formDraft.description.trim() || null,
      is_published: formDraft.is_published,
    };
    const { data, error } = await supabase
      .from("forms")
      .update(payload)
      .eq("id", selectedForm.id)
      .select("id, title, description, is_published, created_at")
      .maybeSingle();
    if (error || !data) {
      console.error(error);
      toast.error("フォームの更新に失敗しました。");
      setSavingForm(false);
      return;
    }
    const updated = data as FormRow;
    setForms((prev) => prev.map((form) => (form.id === updated.id ? updated : form)));
    toast.success("フォームを更新しました。");
    setSavingForm(false);
  };

  const handleAddField = async () => {
    if (!selectedForm || !fieldDraft.label.trim()) return;
    const options =
      fieldDraft.field_type === "select" || fieldDraft.field_type === "checkbox"
        ? fieldDraft.optionsText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
    const orderIndex =
      fields.length > 0
        ? Math.max(...fields.map((field) => field.order_index ?? 0)) + 1
        : 0;
    const payload = {
      form_id: selectedForm.id,
      label: fieldDraft.label.trim(),
      field_type: fieldDraft.field_type,
      is_required: fieldDraft.is_required,
      options,
      placeholder: fieldDraft.placeholder.trim() || null,
      order_index: orderIndex,
    };
    const { data, error } = await supabase
      .from("form_fields")
      .insert([payload])
      .select("id, form_id, label, field_type, is_required, options, placeholder, order_index")
      .maybeSingle();
    if (error || !data) {
      console.error(error);
      toast.error("項目の追加に失敗しました。");
      return;
    }
    setFields((prev) => [...prev, data as FieldRow]);
    setFieldDraft({
      label: "",
      field_type: fieldTypeOptions[0]?.value ?? "short_text",
      is_required: false,
      optionsText: "",
      placeholder: "",
    });
    toast.success("項目を追加しました。");
  };

  const handleDeleteField = async (id: string) => {
    const { error } = await supabase.from("form_fields").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("項目の削除に失敗しました。");
      return;
    }
    setFields((prev) => prev.filter((field) => field.id !== id));
    toast.success("項目を削除しました。");
  };

  if (roleLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">権限を確認しています...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">管理者のみアクセスできます。</p>
            <p className="text-sm text-muted-foreground">管理者にお問い合わせください。</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Admin"
            title="フォーム管理"
            description="フォームの作成・項目編集・公開設定を行います。"
            size="lg"
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">フォーム一覧</CardTitle>
                    <CardDescription>非公開のまま作成できます。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        placeholder="フォーム名"
                        value={newTitle}
                        onChange={(event) => setNewTitle(event.target.value)}
                      />
                      <Textarea
                        rows={3}
                        placeholder="説明（任意）"
                        value={newDescription}
                        onChange={(event) => setNewDescription(event.target.value)}
                      />
                      <Button
                        type="button"
                        className="w-full gap-2"
                        onClick={handleCreateForm}
                        disabled={savingForm || !newTitle.trim()}
                      >
                        {savingForm ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        フォームを作成
                      </Button>
                    </div>

                    {loading ? (
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        取得中...
                      </div>
                    ) : forms.length === 0 ? (
                      <p className="text-sm text-muted-foreground">フォームがありません。</p>
                    ) : (
                      <div className="space-y-2">
                        {forms.map((form) => (
                          <button
                            key={form.id}
                            type="button"
                            onClick={() => setSelectedId(form.id)}
                            className={cn(
                              "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                              selectedId === form.id
                                ? "border-primary/60 bg-primary/10"
                                : "border-border hover:border-primary/40 hover:bg-muted/40"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold">{form.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {form.description || "説明なし"}
                                </p>
                              </div>
                              <Badge variant={form.is_published ? "default" : "secondary"}>
                                {form.is_published ? "公開" : "非公開"}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">フォーム詳細</CardTitle>
                    <CardDescription>項目を追加して入力ページを構成します。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!selectedForm ? (
                      <p className="text-sm text-muted-foreground">フォームを選択してください。</p>
                    ) : (
                      <>
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                            <label className="space-y-1 text-sm">
                              <span className="text-foreground">フォーム名</span>
                              <Input
                                value={formDraft.title}
                                onChange={(event) =>
                                  setFormDraft((prev) => ({ ...prev, title: event.target.value }))
                                }
                              />
                            </label>
                            <label className="space-y-1 text-sm">
                              <span className="text-foreground">公開設定</span>
                              <select
                                value={formDraft.is_published ? "published" : "draft"}
                                onChange={(event) =>
                                  setFormDraft((prev) => ({
                                    ...prev,
                                    is_published: event.target.value === "published",
                                  }))
                                }
                                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                              >
                                <option value="draft">非公開</option>
                                <option value="published">公開</option>
                              </select>
                            </label>
                          </div>
                          <label className="space-y-1 text-sm">
                            <span className="text-foreground">説明</span>
                            <Textarea
                              rows={3}
                              value={formDraft.description}
                              onChange={(event) =>
                                setFormDraft((prev) => ({ ...prev, description: event.target.value }))
                              }
                            />
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" onClick={handleSaveForm} disabled={savingForm}>
                              {savingForm ? <RefreshCw className="w-4 h-4 animate-spin" /> : "保存"}
                            </Button>
                            <Button type="button" variant="outline" asChild>
                              <Link href={`/forms/${selectedForm.id}`} className="gap-2">
                                公開入力ページを開く
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-lg border border-border p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground">項目の追加</h4>
                          </div>
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                            <label className="space-y-1 text-sm">
                              <span className="text-foreground">項目名</span>
                              <Input
                                value={fieldDraft.label}
                                onChange={(event) =>
                                  setFieldDraft((prev) => ({ ...prev, label: event.target.value }))
                                }
                              />
                            </label>
                            <label className="space-y-1 text-sm">
                              <span className="text-foreground">タイプ</span>
                              <select
                                value={fieldDraft.field_type}
                                onChange={(event) =>
                                  setFieldDraft((prev) => ({ ...prev, field_type: event.target.value }))
                                }
                                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                              >
                                {fieldTypeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <label className="space-y-1 text-sm">
                            <span className="text-foreground">プレースホルダ</span>
                            <Input
                              value={fieldDraft.placeholder}
                              onChange={(event) =>
                                setFieldDraft((prev) => ({ ...prev, placeholder: event.target.value }))
                              }
                            />
                          </label>

                          {(fieldDraft.field_type === "select" ||
                            fieldDraft.field_type === "checkbox") && (
                            <label className="space-y-1 text-sm">
                              <span className="text-foreground">選択肢（カンマ区切り）</span>
                              <Input
                                value={fieldDraft.optionsText}
                                onChange={(event) =>
                                  setFieldDraft((prev) => ({ ...prev, optionsText: event.target.value }))
                                }
                                placeholder="例: はい, いいえ"
                              />
                            </label>
                          )}

                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={fieldDraft.is_required}
                              onChange={(event) =>
                                setFieldDraft((prev) => ({ ...prev, is_required: event.target.checked }))
                              }
                            />
                            必須項目にする
                          </label>

                          <Button type="button" onClick={handleAddField} className="gap-2">
                            <Plus className="w-4 h-4" />
                            追加
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-foreground">登録済みの項目</h4>
                          {fields.length === 0 ? (
                            <p className="text-sm text-muted-foreground">項目がありません。</p>
                          ) : (
                            <div className="space-y-2">
                              {fields.map((field) => (
                                <div
                                  key={field.id}
                                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                                >
                                  <div className="space-y-1">
                                    <p className="font-semibold text-foreground">
                                      {field.label}
                                      {field.is_required && (
                                        <span className="text-destructive ml-1">*</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      タイプ: {fieldTypeOptions.find((opt) => opt.value === field.field_type)?.label ?? field.field_type}
                                    </p>
                                    {field.options && field.options.length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        選択肢: {field.options.join(", ")}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => handleDeleteField(field.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    削除
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
