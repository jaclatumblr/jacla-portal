export type HomeEventSummary = {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  status: string;
  openTime: string | null;
  startTime: string | null;
};

// Keep today's events visible all day; a start time alone is not an end time.
export function nextHomeEvent(events: HomeEventSummary[], today: string): HomeEventSummary | null {
  return events.filter((event) => event.date >= today && !["draft", "closed", "下書き", "終了"].includes(event.status))
    .sort((a, b) => a.date.localeCompare(b.date)
      || (a.startTime || a.openTime || "99:99").localeCompare(b.startTime || b.openTime || "99:99")
      || a.id.localeCompare(b.id))[0] ?? null;
}

export function homeEventStatusLabel(status: string) {
  const labels: Record<string, string> = { draft: "下書き", recruiting: "募集中", fixed: "確定", closed: "終了" };
  return Object.hasOwn(labels, status) ? labels[status] : status;
}

export function homeCalendarSelection(dates: string[], requested: string | null, today: string): string | null {
  if (requested && dates.includes(requested)) return requested;
  if (dates.includes(today)) return today;
  return dates[0] ?? null;
}
