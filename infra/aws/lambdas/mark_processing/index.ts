import { query } from "../_shared/db";
import type { S3EventDetail, PipelineState } from "../_shared/types";

export async function handler(event: S3EventDetail): Promise<PipelineState> {
  const { key } = event.object;
  const parts = key.split("/");
  if (parts.length < 3) {
    throw new Error(`Unexpected S3 key format: ${key}. Expected {workspaceId}/{documentId}/{filename}`);
  }

  const [workspaceId, documentId] = parts;

  console.log("Marking document as PROCESSING", { workspaceId, documentId, key });

  await query(
    `UPDATE documents SET status = 'PROCESSING', updated_at = NOW() WHERE id = $1 AND workspace_id = $2`,
    [documentId, workspaceId]
  );

  await query(
    `INSERT INTO ingestion_jobs (id, document_id, state, started_at)
     VALUES (gen_random_uuid(), $1, 'PROCESSING', NOW())
     ON CONFLICT (document_id) WHERE state IN ('PENDING', 'FAILED')
     DO UPDATE SET state = 'PROCESSING', started_at = NOW(), error = NULL, ended_at = NULL`,
    [documentId]
  );

  return {
    workspaceId,
    documentId,
    s3Key: key,
    bucketName: event.bucket.name,
  };
}
