import { auth } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const { orgId } = await auth();

  if (!orgId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Select a workspace</h2>
          <p className="mt-2 text-[var(--muted)]">
            Create or select an organization to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-[var(--muted)]">
        Overview of your workspace documents and conversations.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <StatCard label="Documents" value="0" />
        <StatCard label="Conversations" value="0" />
        <StatCard label="Agent runs" value="0" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}
