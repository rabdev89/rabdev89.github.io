"use client";

const AGENT_LABELS: Record<string, string> = {
  RootOrchestrator: "Routing your request...",
  Retriever: "Searching documents...",
  Analyzer: "Analyzing relevant content...",
  Writer: "Drafting answer...",
  Critic: "Verifying citations...",
  WriterCriticLoop: "Refining answer...",
  PM: "Clarifying requirements...",
  Architect: "Designing architecture...",
  Coder: "Writing code...",
  Reviewer: "Reviewing code...",
  CoderReviewerLoop: "Code review cycle...",
  QA: "Writing tests...",
};

const TOOL_LABELS: Record<string, string> = {
  vector_search: "Searching vectors...",
  list_workspace_documents: "Listing documents...",
  get_document_metadata: "Reading document info...",
  fetch_chunk: "Fetching content...",
  classify_intent: "Classifying intent...",
  rag_team: "Querying documents...",
};

interface Props {
  agent: string;
  tool?: string | null;
}

export function AgentStepIndicator({ agent, tool }: Props) {
  const toolLabel = tool ? TOOL_LABELS[tool] || `Using ${tool}...` : null;
  const agentLabel = AGENT_LABELS[agent] || `${agent} is working...`;
  const label = toolLabel || agentLabel;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--muted)]">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
      <span>{label}</span>
    </div>
  );
}
