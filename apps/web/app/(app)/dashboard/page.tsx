import { auth } from "@clerk/nextjs/server";
import { prisma } from "@documind/db";
import Link from "next/link";

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

  const workspace = await prisma.workspace.findUnique({
    where: { clerkOrgId: orgId },
  });

  let docCount = 0;
  let docReady = 0;
  let chunkCount = 0;
  let convCount = 0;
  let msgCount = 0;
  let traceCount = 0;

  if (workspace) {
    [docCount, docReady, chunkCount, convCount, msgCount, traceCount] =
      await Promise.all([
        prisma.document.count({ where: { workspaceId: workspace.id } }),
        prisma.document.count({
          where: { workspaceId: workspace.id, status: "READY" },
        }),
        prisma.chunk.count({ where: { workspaceId: workspace.id } }),
        prisma.conversation.count({ where: { workspaceId: workspace.id } }),
        prisma.message.count({
          where: { conversation: { workspaceId: workspace.id } },
        }),
        prisma.agentTrace.count({
          where: {
            message: { conversation: { workspaceId: workspace.id } },
          },
        }),
      ]);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-[var(--muted)]">
        Overview of your workspace documents and conversations.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Documents"
          value={docCount}
          detail={`${docReady} ready, ${chunkCount} chunks indexed`}
          href="/admin"
        />
        <StatCard
          label="Conversations"
          value={convCount}
          detail={`${msgCount} total messages`}
          href="/chat"
        />
        <StatCard
          label="Agent runs"
          value={traceCount}
          href="/admin"
        />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <QuickAction
          title="Start a conversation"
          description="Ask questions about your uploaded documents"
          href="/chat"
        />
        <QuickAction
          title="Admin dashboard"
          description="View documents, jobs, traces, and analytics"
          href="/admin"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: number;
  detail?: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--primary)]/30">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value.toLocaleString()}</p>
      {detail && (
        <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function QuickAction({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--primary)]/30"
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
    </Link>
  );
}
