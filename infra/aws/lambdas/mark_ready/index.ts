import { query } from "../_shared/db";
import type { UpsertResult } from "../_shared/types";

export async function handler(event: UpsertResult) {
  const { workspaceId, documentId, vectorsUpserted } = event;

  console.log("Marking document as READY", { documentId, vectorsUpserted });

  await query(
    `UPDATE documents SET status = 'READY', updated_at = NOW() WHERE id = $1 AND workspace_id = $2`,
    [documentId, workspaceId]
  );

  await query(
    `UPDATE ingestion_jobs SET state = 'SUCCEEDED', ended_at = NOW()
     WHERE document_id = $1 AND state = 'PROCESSING'`,
    [documentId]
  );

  return { workspaceId, documentId, status: "READY", vectorsUpserted };
}
