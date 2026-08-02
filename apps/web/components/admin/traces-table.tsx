"use client";

import { useState, useMemo } from "react";
import { usePoll } from "@/lib/use-poll";

interface TraceRow {
  id: string;
  messageId: string;
  conversationId: string;
  agentName: string;
  step: string;
  input: string | null;
  output: string | null;
  latencyMs: number;
  tokens: number;
  createdAt: string;
}

export function TracesTable() {
  const { data: traces, loading } = usePoll<TraceRow[]>(
    "/api/admin/traces",
    10000
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>("");

  const agents = useMemo(() => {
    if (!traces) return [];
    const set = new Set(traces.map((t) => t.agentName));
    return Array.from(set).sort();
  }, [traces]);

  const filtered = useMemo(() => {
    if (!traces) return [];
    if (!agentFilter) return traces;
    return traces.filter((t) => t.agentName === agentFilter);
  }, [traces, agentFilter]);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agent Traces</h2>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm outline-none"
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--accent)]">
              <th className="w-8 px-2 py-3" />
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
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  Loading...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  No agent traces yet.
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <TraceRowItem
                key={t.id}
                trace={t}
                expanded={expandedId === t.id}
                onToggle={() =>
                  setExpandedId(expandedId === t.id ? null : t.id)
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TraceRowItem({
  trace,
  expanded,
  onToggle,
}: {
  trace: TraceRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetail = trace.input || trace.output;

  return (
    <>
      <tr
        className={`border-b border-[var(--border)] last:border-0 ${
          hasDetail ? "cursor-pointer hover:bg-[var(--accent)]/50" : ""
        }`}
        onClick={hasDetail ? onToggle : undefined}
      >
        <td className="px-2 py-3 text-center text-[var(--muted)]">
          {hasDetail && (
            <span className="text-xs">{expanded ? "▼" : "▶"}</span>
          )}
        </td>
        <td className="px-4 py-3 font-medium">{trace.agentName}</td>
        <td className="px-4 py-3 text-[var(--muted)]">{trace.step}</td>
        <td className="px-4 py-3 text-[var(--muted)]">
          <LatencyBadge ms={trace.latencyMs} />
        </td>
        <td className="px-4 py-3 text-[var(--muted)]">{trace.tokens}</td>
        <td className="px-4 py-3 text-[var(--muted)]">
          {new Date(trace.createdAt).toLocaleTimeString()}
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr className="border-b border-[var(--border)]">
          <td colSpan={6} className="bg-[var(--accent)]/30 px-4 py-3">
            <div className="grid gap-4 md:grid-cols-2">
              {trace.input && (
                <JsonBlock label="Input" json={trace.input} />
              )}
              {trace.output && (
                <JsonBlock label="Output" json={trace.output} />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LatencyBadge({ ms }: { ms: number }) {
  let color = "text-green-500";
  if (ms > 5000) color = "text-red-500";
  else if (ms > 2000) color = "text-yellow-500";

  return <span className={color}>{ms}ms</span>;
}

function JsonBlock({ label, json }: { label: string; json: string }) {
  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    formatted = json;
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-[var(--muted)]">{label}</p>
      <pre className="max-h-48 overflow-auto rounded-md bg-[var(--card)] p-3 text-xs">
        {formatted.length > 2000 ? formatted.slice(0, 2000) + "\n..." : formatted}
      </pre>
    </div>
  );
}
