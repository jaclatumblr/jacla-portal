import { AdminDepartmentShiftPage } from "../components/AdminDepartmentShiftPage";

type AdminEventShiftPageProps = {
  searchParams?: Promise<{
    department?: string;
  }>;
};

export default async function AdminEventShiftPage({ searchParams }: AdminEventShiftPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const department = resolvedSearchParams?.department === "lighting" ? "lighting" : "pa";

  return <AdminDepartmentShiftPage key={department} department={department} />;
}
