"use client";

import { DocumentsTable } from "./documents-table";
import { JobsTable } from "./jobs-table";
import { TracesTable } from "./traces-table";

export function AdminDashboard() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-2 text-[var(--muted)]">
        Documents, ingestion jobs, and agent traces for your workspace.
      </p>

      <div className="mt-8 space-y-8">
        <DocumentsTable />
        <JobsTable />
        <TracesTable />
      </div>
    </div>
  );
}
