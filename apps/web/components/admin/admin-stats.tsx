"use client";

import { usePoll } from "@/lib/use-poll";

interface Stats {
  documents: {
    total: number;
    ready: number;
    processing: number;
    failed: number;
  };
  chunks: number;
  conversations: number;
  messages: number;
  traces: {
    total: number;
    avgLatencyMs: number;
  };
  topAgents: {
    agent: string;
    count: number;
    avgLatencyMs: number;
  }[];
}

export function AdminStats() {
  const { data: stats, loading } = usePoll<Stats>("/api/admin/stats", 10000);

  if (loading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Documents"
          value={stats.documents.total}
          detail={`${stats.documents.ready} ready, ${stats.documents.processing} processing, ${stats.documents.failed} failed`}
        />
        <StatCard
          label="Chunks indexed"
          value={stats.chunks}
        />
        <StatCard
          label="Conversations"
          value={stats.conversations}
          detail={`${stats.messages} total messages`}
        />
        <StatCard
          label="Agent runs"
          value={stats.traces.total}
          detail={
            stats.traces.avgLatencyMs > 0
              ? `${stats.traces.avgLatencyMs}ms avg latency`
              : undefined
          }
        />
      </div>

      {stats.topAgents.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Agent usage</h3>
          <div className="space-y-2">
            {stats.topAgents.map((a) => {
              const maxCount = stats.topAgents[0].count;
              const pct = maxCount > 0 ? (a.count / maxCount) * 100 : 0;
              return (
                <div key={a.agent} className="flex items-center gap-3">
                  <span className="w-28 truncate text-sm font-medium">
                    {a.agent}
                  </span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--accent)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-12 text-right text-xs text-[var(--muted)]">
                    {a.count}
                  </span>
                  <span className="w-16 text-right text-xs text-[var(--muted)]">
                    {a.avgLatencyMs}ms
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value.toLocaleString()}</p>
      {detail && (
        <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
      )}
    </div>
  );
}
