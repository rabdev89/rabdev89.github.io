interface Input {
  workspaceId: string;
  documentId: string;
  vectorsUpserted: number;
}

export async function handler(event: Input) {
  console.log("Marking document as READY", event);

  // TODO: update documents.status = 'READY'
  // TODO: update ingestion_jobs.state = 'SUCCEEDED', set ended_at

  return { ...event, status: "READY" };
}
