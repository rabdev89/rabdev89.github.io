import { getGcpAccessToken } from "./gcp-auth";

const VERTEX_BASE = "https://{region}-aiplatform.googleapis.com/v1";

export async function embedTexts(
  texts: string[],
  options?: { model?: string; projectId?: string; region?: string }
): Promise<number[][]> {
  const projectId = options?.projectId || process.env.GCP_PROJECT_ID!;
  const region = options?.region || process.env.GCP_REGION || "us-central1";
  const model = options?.model || "text-embedding-005";

  const accessToken = await getGcpAccessToken();
  const baseUrl = VERTEX_BASE.replace("{region}", region);
  const url = `${baseUrl}/projects/${projectId}/locations/${region}/publishers/google/models/${model}:predict`;

  const batchSize = 250;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: batch.map((text) => ({ content: text })),
        parameters: { outputDimensionality: 768 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Vertex embedding failed: ${response.status} ${err}`);
    }

    const data = await response.json();
    const embeddings = data.predictions.map(
      (p: { embeddings: { values: number[] } }) => p.embeddings.values
    );
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

export async function upsertToVectorSearch(
  datapoints: Array<{
    datapointId: string;
    featureVector: number[];
    restricts: Array<{ namespace: string; allowList: string[] }>;
  }>
): Promise<void> {
  const projectId = process.env.GCP_PROJECT_ID!;
  const region = process.env.GCP_REGION || "us-central1";
  const indexEndpoint = process.env.VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT!;
  const indexId = process.env.VERTEX_VECTOR_SEARCH_INDEX_ID!;

  const accessToken = await getGcpAccessToken();
  const baseUrl = VERTEX_BASE.replace("{region}", region);

  const batchSize = 100;
  for (let i = 0; i < datapoints.length; i += batchSize) {
    const batch = datapoints.slice(i, i + batchSize);

    const url = `${baseUrl}/${indexEndpoint}:upsertDatapoints`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        datapoints: batch,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Vector Search upsert failed: ${response.status} ${err}`);
    }
  }
}
