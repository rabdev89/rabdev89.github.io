"use client";

import { usePoll } from "@/lib/use-poll";

interface TraceRow {
  id: string;
  messageId: string;
  agentName: string;
  step: string;
  latencyMs: number;
  tokens: number;
  createdAt: string;
}

export function TracesTable() {
  const { data: traces, loading } = usePoll<TraceRow[]>("/api/admin/traces", 10000);

  return (
    <section>
      <h2 className="text-lg font-semibold">Agent Traces</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--accent)]">
              <th className="px-4 py-3 text-left font-medium">Agent</th>
              <th className="px-4 py-3 text-left font-medium">Step</th>
              <th className="px-4 py-3 text-left font-medium">Latency</th>
              <th className="px-4 py-3 text-left font-medium">Tokens</th>
              <th className="px-4 py-3 text-left font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && (!traces || traces.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  No agent traces yet.
                </td>
              </tr>
            )}
            {traces?.map((t) => (
              <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-medium">{t.agentName}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{t.step}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{t.latencyMs}ms</td>
                <td className="px-4 py-3 text-[var(--muted)]">{t.tokens}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(t.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
