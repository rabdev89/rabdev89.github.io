"use client";

import { usePoll } from "@/lib/use-poll";
import { StatusBadge } from "./status-badge";

interface DocRow {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  error: string | null;
  chunkCount: number;
  createdAt: string;
}

export function DocumentsTable() {
  const { data: docs, loading } = usePoll<DocRow[]>("/api/documents", 5000);

  return (
    <section>
      <h2 className="text-lg font-semibold">Documents</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--accent)]">
              <th className="px-4 py-3 text-left font-medium">Filename</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Size</th>
              <th className="px-4 py-3 text-left font-medium">Chunks</th>
              <th className="px-4 py-3 text-left font-medium">Uploaded</th>
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
            {!loading && (!docs || docs.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  No documents uploaded yet.
                </td>
              </tr>
            )}
            {docs?.map((doc) => (
              <tr key={doc.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{doc.filename}</div>
                  {doc.error && (
                    <div className="mt-1 text-xs text-red-500">{doc.error}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatBytes(doc.sizeBytes)}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{doc.chunkCount}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
