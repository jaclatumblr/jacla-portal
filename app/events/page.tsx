// app/events/page.tsx
"use client";

import { AppLayout } from "@/components/AppLayout";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState } from "react";

type Event = {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  status: string;
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, date, venue, status")
        .order("date", { ascending: true });

      if (error) {
        console.error(error);
      } else {
        setEvents(data as Event[]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <AuthGuard>
      <AppLayout>
        <h1 className="text-xl font-semibold mb-4">イベント一覧</h1>

        {loading ? (
          <div className="text-sm text-gray-600">読み込み中...</div>
        ) : (
          <div className="bg-white border rounded-lg shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr className="text-left">
                  <th className="px-4 py-2 w-32">日付</th>
                  <th className="px-4 py-2">イベント名</th>
                  <th className="px-4 py-2 w-40">会場</th>
                  <th className="px-4 py-2 w-24">状態</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2">{ev.date}</td>
                    <td className="px-4 py-2">
                      <Link href={`/events/${ev.id}`} className="text-blue-600 underline">
                        {ev.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{ev.venue ?? "-"}</td>
                    <td className="px-4 py-2">{ev.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppLayout>
    </AuthGuard>
  );
}
