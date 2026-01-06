"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";

type FormRow = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
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

type AnswerValue = string | string[];

export default function FormDetailPage() {
  const params = useParams();
  const formId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === "string" ? raw : raw?.[0] ?? null;
  }, [params]);
  const { session } = useAuth();
  const { isAdmin, loading: roleLoading } = useRoleFlags();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormRow | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!formId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [formRes, fieldsRes] = await Promise.all([
        supabase
          .from("forms")
          .select("id, title, description, is_published")
          .eq("id", formId)
          .maybeSingle(),
        supabase
          .from("form_fields")
          .select("id, form_id, label, field_type, is_required, options, placeholder, order_index")
          .eq("form_id", formId)
          .order("order_index", { ascending: true }),
      ]);

      if (cancelled) return;

      if (formRes.error) {
        console.error(formRes.error);
        toast.error("フォームの取得に失敗しました。");
        setForm(null);
        setFields([]);
      } else {
        setForm(formRes.data as FormRow | null);
        setFields((fieldsRes.data ?? []) as FieldRow[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [formId]);

  const handleAnswerChange = (fieldId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleCheckboxToggle = (fieldId: string, option: string, checked: boolean) => {
    const current = answers[fieldId];
    const next = new Set(Array.isArray(current) ? current : []);
    if (checked) {
      next.add(option);
    } else {
      next.delete(option);
    }
    handleAnswerChange(fieldId, Array.from(next));
  };

  const validateRequired = () => {
    for (const field of fields) {
      if (!field.is_required) continue;
      const value = answers[field.id];
      if (Array.isArray(value)) {
        if (value.length === 0) return field.label;
      } else if (!value || value.trim() === "") {
        return field.label;
      }
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!formId || !form || submitting) return;
    const userId = session?.user.id;
    if (!userId) {
      toast.error("ログイン情報が取得できませんでした。");
      return;
    }

    const missingLabel = validateRequired();
    if (missingLabel) {
      toast.error(`${missingLabel} を入力してください。`);
      return;
    }

    setSubmitting(true);
    const { data: responseData, error: responseError } = await supabase
      .from("form_responses")
      .insert({ form_id: formId, submitted_by: userId })
      .select("id")
      .maybeSingle();

    if (responseError || !responseData?.id) {
      console.error(responseError);
      toast.error("送信に失敗しました。時間をおいて再度お試しください。");
      setSubmitting(false);
      return;
    }

    const answerRows = fields.map((field) => {
      const value = answers[field.id];
      const resolved =
        Array.isArray(value) ? value.join(", ") : value?.toString().trim() || null;
      return {
        response_id: responseData.id,
        field_id: field.id,
        value: resolved,
      };
    });

    const { error: answerError } = await supabase
      .from("form_response_answers")
      .insert(answerRows);

    if (answerError) {
      console.error(answerError);
      toast.error("送信に失敗しました。時間をおいて再度お試しください。");
      setSubmitting(false);
      return;
    }

    toast.success("送信しました。");
    setAnswers({});
    setSubmitting(false);
  };

  const isVisible = form?.is_published || isAdmin;

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Form"
            title={form?.title ?? "フォーム"}
            description={form?.description ?? "フォームに回答してください。"}
            backHref="/"
            backLabel="ホームに戻る"
            size="lg"
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6">
              <Card className="bg-card/60 border-border max-w-3xl">
                <CardHeader>
                  <CardTitle className="text-xl">回答フォーム</CardTitle>
                  <CardDescription>
                    {loading
                      ? "読み込み中..."
                      : !isVisible
                        ? "このフォームは非公開です。"
                        : "必須項目はすべて入力してください。"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!loading && !isVisible && (
                    <div className="text-sm text-muted-foreground">
                      公開されるまでお待ちください。
                    </div>
                  )}

                  {!loading && isVisible && (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {fields.map((field) => {
                        const value = answers[field.id];
                        const label = (
                          <span className="text-foreground">
                            {field.label}
                            {field.is_required && <span className="text-destructive"> *</span>}
                          </span>
                        );

                        if (field.field_type === "long_text") {
                          return (
                            <label key={field.id} className="space-y-2 block text-sm">
                              {label}
                              <Textarea
                                rows={4}
                                value={typeof value === "string" ? value : ""}
                                onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                                placeholder={field.placeholder ?? ""}
                              />
                            </label>
                          );
                        }

                        if (field.field_type === "select") {
                          return (
                            <label key={field.id} className="space-y-2 block text-sm">
                              {label}
                              <select
                                value={typeof value === "string" ? value : ""}
                                onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                              >
                                <option value="">選択してください</option>
                                {(field.options ?? []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>
                          );
                        }

                        if (field.field_type === "checkbox") {
                          const selected = Array.isArray(value) ? value : [];
                          return (
                            <div key={field.id} className="space-y-2">
                              <div className="text-sm">{label}</div>
                              <div className="flex flex-wrap gap-3">
                                {(field.options ?? []).map((option) => (
                                  <label
                                    key={option}
                                    className="flex items-center gap-2 text-sm text-muted-foreground"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected.includes(option)}
                                      onChange={(e) =>
                                        handleCheckboxToggle(field.id, option, e.target.checked)
                                      }
                                    />
                                    <span>{option}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <label key={field.id} className="space-y-2 block text-sm">
                            {label}
                            <Input
                              type={field.field_type === "number" ? "number" : field.field_type === "email" ? "email" : "text"}
                              value={typeof value === "string" ? value : ""}
                              onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                              placeholder={field.placeholder ?? ""}
                            />
                          </label>
                        );
                      })}

                      <div className="flex justify-end">
                        <Button type="submit" disabled={submitting}>
                          {submitting ? "送信中..." : "送信する"}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
