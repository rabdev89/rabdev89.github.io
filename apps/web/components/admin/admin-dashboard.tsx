"use client";

import { useState } from "react";
import { AdminStats } from "./admin-stats";
import { DocumentsTable } from "./documents-table";
import { JobsTable } from "./jobs-table";
import { TracesTable } from "./traces-table";
import { ConversationsTable } from "./conversations-table";

type Tab = "overview" | "documents" | "jobs" | "traces" | "conversations";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "documents", label: "Documents" },
  { key: "jobs", label: "Jobs" },
  { key: "traces", label: "Traces" },
  { key: "conversations", label: "Conversations" },
];

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-2 text-[var(--muted)]">
        Documents, ingestion jobs, and agent traces for your workspace.
      </p>

      <div className="mt-6 flex gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-[var(--primary)] text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "documents" && <DocumentsTable />}
        {tab === "jobs" && <JobsTable />}
        {tab === "traces" && <TracesTable />}
        {tab === "conversations" && <ConversationsTable />}
      </div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-8">
      <AdminStats />
      <DocumentsTable />
      <JobsTable />
    </div>
  );
}
