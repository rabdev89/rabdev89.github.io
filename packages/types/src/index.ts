export interface ChatRequest {
  conversationId: string;
  message: string;
}

export interface AgentRunRequest {
  workspace_id: string;
  user_id: string;
  conversation_id: string;
  message: string;
}

export interface Citation {
  docId: string;
  chunkId: string;
  page: number;
  section?: string;
  text: string;
  score: number;
}

export interface AgentTraceEvent {
  agentName: string;
  step: string;
  input: unknown;
  output: unknown;
  latencyMs: number;
  tokens: number;
}

export interface PresignRequest {
  filename: string;
  contentType: string;
  size: number;
}

export interface PresignResponse {
  uploadUrl: string;
  documentId: string;
  s3Key: string;
}

export type DocumentStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";

export interface DocumentSummary {
  id: string;
  workspaceId: string;
  filename: string;
  status: DocumentStatus;
  chunkCount: number;
  createdAt: string;
}

export interface IngestionJobSummary {
  id: string;
  documentId: string;
  state: string;
  startedAt: string;
  endedAt?: string;
}
