import { redirect } from "next/navigation";

export default async function AdminEventShiftLightingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/events/${id}/shift?department=lighting`);
}
