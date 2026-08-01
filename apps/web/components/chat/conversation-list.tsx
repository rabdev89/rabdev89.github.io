"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePoll } from "@/lib/use-poll";

interface ConversationSummary {
  id: string;
  title: string | null;
  messageCount: number;
  createdAt: string;
}

export function ConversationList() {
  const pathname = usePathname();
  const { data: conversations, loading } = usePoll<ConversationSummary[]>(
    "/api/conversations",
    15000
  );

  if (loading) {
    return (
      <div className="px-3 py-2 text-xs text-[var(--muted)]">Loading...</div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-[var(--muted)]">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {conversations.map((c) => {
        const active = pathname === `/chat/${c.id}`;
        const label = c.title || `Conversation`;
        const date = new Date(c.createdAt);
        const timeStr = date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });

        return (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className={`group flex flex-col rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-[var(--accent)] font-medium"
                : "text-[var(--muted)] hover:bg-[var(--accent)]"
            }`}
          >
            <span className="truncate">{label}</span>
            <span className="text-xs text-[var(--muted)]">
              {timeStr} &middot; {c.messageCount} msgs
            </span>
          </Link>
        );
      })}
    </div>
  );
}
