import { upsertToVectorSearch } from "../_shared/vertex";
import type { ChunkResult, UpsertResult } from "../_shared/types";

export async function handler(event: ChunkResult): Promise<UpsertResult> {
  const { workspaceId, documentId, chunks } = event;

  console.log("Upserting vectors to Vertex Vector Search", {
    documentId,
    chunkCount: chunks.length,
  });

  if (chunks.length === 0) {
    console.log("No chunks to upsert", { documentId });
    return { workspaceId, documentId, vectorsUpserted: 0 };
  }

  const datapoints = chunks.map((chunk) => ({
    datapointId: chunk.id,
    featureVector: chunk.embedding,
    restricts: [
      { namespace: "workspace_id", allowList: [workspaceId] },
      { namespace: "document_id", allowList: [documentId] },
    ],
  }));

  await upsertToVectorSearch(datapoints);

  console.log("Upserted vectors", {
    documentId,
    count: datapoints.length,
  });

  return {
    workspaceId,
    documentId,
    vectorsUpserted: datapoints.length,
  };
}
