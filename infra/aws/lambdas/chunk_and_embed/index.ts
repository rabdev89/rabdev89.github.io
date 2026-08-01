interface Input {
  workspaceId: string;
  documentId: string;
  s3Key: string;
  bucketName: string;
  docAiOutputUri: string;
  pages: unknown[];
}

export async function handler(event: Input) {
  console.log("Chunking and embedding", event);

  // TODO: read Document AI output
  // TODO: semantic chunking (split by sections/paragraphs, 512-1024 tokens each)
  // TODO: call Vertex AI text-embedding-005 to embed each chunk
  // TODO: insert chunks into Postgres with vector IDs

  return {
    ...event,
    chunks: [],
    chunkCount: 0,
  };
}
