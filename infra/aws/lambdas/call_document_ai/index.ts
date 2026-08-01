import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { processDocument } from "../_shared/document-ai";
import type { PipelineState, DocAiResult } from "../_shared/types";

const s3 = new S3Client({});

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/plain",
  ".csv": "text/csv",
};

export async function handler(event: PipelineState): Promise<DocAiResult> {
  const { workspaceId, documentId, s3Key, bucketName } = event;

  console.log("Downloading file from S3", { bucketName, s3Key });

  const getObj = await s3.send(
    new GetObjectCommand({ Bucket: bucketName, Key: s3Key })
  );

  if (!getObj.Body) {
    throw new Error(`Empty body for s3://${bucketName}/${s3Key}`);
  }

  const bodyBytes = Buffer.from(await getObj.Body.transformToByteArray());
  const ext = s3Key.substring(s3Key.lastIndexOf(".")).toLowerCase();
  const mimeType = MIME_MAP[ext] || "application/pdf";

  console.log("Sending to Document AI", {
    documentId,
    size: bodyBytes.length,
    mimeType,
  });

  const pages = await processDocument(bodyBytes, mimeType);

  console.log("Document AI parsed", {
    documentId,
    pageCount: pages.length,
    totalSections: pages.reduce((sum, p) => sum + p.sections.length, 0),
  });

  return {
    workspaceId,
    documentId,
    s3Key,
    bucketName,
    pages,
  };
}
