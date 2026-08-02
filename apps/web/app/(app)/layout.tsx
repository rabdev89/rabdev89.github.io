import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex h-screen">
      <Sidebar orgId={orgId} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
