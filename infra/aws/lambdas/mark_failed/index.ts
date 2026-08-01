import { query } from "../_shared/db";
import type { FailureInput } from "../_shared/types";

export async function handler(event: FailureInput) {
  const { workspaceId, documentId } = event;
  const errorMessage = event.error
    ? `${event.error.Error}: ${event.error.Cause}`
    : "Unknown error";

  console.error("Marking document as FAILED", { documentId, error: errorMessage });

  if (documentId) {
    await query(
      `UPDATE documents SET status = 'FAILED', error = $1, updated_at = NOW()
       WHERE id = $2 AND workspace_id = $3`,
      [errorMessage, documentId, workspaceId]
    );

    await query(
      `UPDATE ingestion_jobs SET state = 'FAILED', error = $1, ended_at = NOW()
       WHERE document_id = $2 AND state = 'PROCESSING'`,
      [errorMessage, documentId]
    );
  }

  return { workspaceId, documentId, status: "FAILED", error: errorMessage };
}
