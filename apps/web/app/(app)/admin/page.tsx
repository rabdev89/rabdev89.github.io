import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  const { orgId } = await auth();
  if (!orgId) redirect("/dashboard");

  return <AdminDashboard />;
}
