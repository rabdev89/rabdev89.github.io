interface Input {
  workspaceId?: string;
  documentId?: string;
  error?: {
    Error: string;
    Cause: string;
  };
}

export async function handler(event: Input) {
  console.error("Marking document as FAILED", event);

  // TODO: update documents.status = 'FAILED', documents.error = error message
  // TODO: update ingestion_jobs.state = 'FAILED', set ended_at and error

  return {
    workspaceId: event.workspaceId,
    documentId: event.documentId,
    status: "FAILED",
    error: event.error,
  };
}
