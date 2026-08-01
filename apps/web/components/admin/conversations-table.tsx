"use client";

import { usePoll } from "@/lib/use-poll";

interface ConversationRow {
  id: string;
  title: string | null;
  userId: string;
  messageCount: number;
  traceCount: number;
  lastActiveAt: string;
  createdAt: string;
}

export function ConversationsTable() {
  const { data: conversations, loading } = usePoll<ConversationRow[]>(
    "/api/admin/conversations",
    10000
  );

  return (
    <section>
      <h2 className="text-lg font-semibold">Conversations</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--accent)]">
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Messages</th>
              <th className="px-4 py-3 text-left font-medium">Traces</th>
              <th className="px-4 py-3 text-left font-medium">Last active</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  Loading...
                </td>
              </tr>
            )}
            {!loading && (!conversations || conversations.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  No conversations yet.
                </td>
              </tr>
            )}
            {conversations?.map((c) => (
              <tr
                key={c.id}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {c.title || "Untitled"}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {c.id.slice(0, 8)}...
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {c.messageCount}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {c.traceCount}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatRelative(c.lastActiveAt)}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
