"use client";

import { usePoll } from "@/lib/use-poll";
import { StatusBadge } from "./status-badge";

interface JobRow {
  id: string;
  documentId: string;
  filename: string;
  state: string;
  error: string | null;
  sfnExecutionArn: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
}

export function JobsTable() {
  const { data: jobs, loading } = usePoll<JobRow[]>("/api/admin/jobs", 5000);

  return (
    <section>
      <h2 className="text-lg font-semibold">Ingestion Jobs</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--accent)]">
              <th className="px-4 py-3 text-left font-medium">Document</th>
              <th className="px-4 py-3 text-left font-medium">State</th>
              <th className="px-4 py-3 text-left font-medium">Duration</th>
              <th className="px-4 py-3 text-left font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && (!jobs || jobs.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                  No ingestion jobs yet.
                </td>
              </tr>
            )}
            {jobs?.map((job) => (
              <tr key={job.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{job.filename}</div>
                  {job.error && (
                    <div className="mt-1 text-xs text-red-500">{job.error}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={job.state} />
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {job.durationMs !== null ? formatDuration(job.durationMs) : "..."}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(job.startedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
