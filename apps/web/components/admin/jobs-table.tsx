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
              <th className="px-4 py-3 text-left font-medium">Execution</th>
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
            {!loading && (!jobs || jobs.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  No ingestion jobs yet.
                </td>
              </tr>
            )}
            {jobs?.map((job) => (
              <tr
                key={job.id}
                className="border-b border-[var(--border)] last:border-0"
              >
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
                  {job.durationMs !== null
                    ? formatDuration(job.durationMs)
                    : "..."}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(job.startedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {job.sfnExecutionArn ? (
                    <SfnLink arn={job.sfnExecutionArn} />
                  ) : (
                    <span className="text-[var(--muted)]">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SfnLink({ arn }: { arn: string }) {
  const match = arn.match(
    /arn:aws:states:([^:]+):(\d+):execution:([^:]+):(.*)/
  );
  if (!match) {
    return (
      <span className="text-xs text-[var(--muted)]" title={arn}>
        {arn.slice(-20)}
      </span>
    );
  }

  const [, region, , , executionName] = match;
  const url = `https://${region}.console.aws.amazon.com/states/home?region=${region}#/v2/executions/details/${arn}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-[var(--primary)] hover:underline"
      title={arn}
    >
      {executionName.length > 20
        ? executionName.slice(0, 20) + "..."
        : executionName}
    </a>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
