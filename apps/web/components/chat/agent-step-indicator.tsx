"use client";

const AGENT_LABELS: Record<string, string> = {
  RootOrchestrator: "Routing your request...",
  Retriever: "Searching documents...",
  Analyzer: "Analyzing relevant content...",
  Writer: "Drafting answer...",
  Critic: "Verifying citations...",
  PM: "Clarifying requirements...",
  Architect: "Designing architecture...",
  Coder: "Writing code...",
  Reviewer: "Reviewing code...",
  QA: "Writing tests...",
};

export function AgentStepIndicator({ agent }: { agent: string }) {
  const label = AGENT_LABELS[agent] || `${agent} is working...`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--muted)]">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
      {label}
    </div>
  );
}
