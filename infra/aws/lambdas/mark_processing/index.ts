interface S3Event {
  bucket: { name: string };
  object: { key: string; size: number };
}

export async function handler(event: S3Event) {
  const { key } = event.object;
  const [workspaceId, documentId] = key.split("/");

  console.log("Marking document as PROCESSING", { workspaceId, documentId });

  // TODO: update documents.status = 'PROCESSING' via Prisma/RDS Proxy
  // TODO: insert ingestion_jobs row

  return { workspaceId, documentId, s3Key: key, bucketName: event.bucket.name };
}
