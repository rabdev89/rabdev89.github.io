export interface S3EventDetail {
  bucket: { name: string };
  object: { key: string; size: number; etag: string };
}

export interface PipelineState {
  workspaceId: string;
  documentId: string;
  s3Key: string;
  bucketName: string;
}

export interface DocAiResult extends PipelineState {
  pages: ParsedPage[];
}

export interface ParsedPage {
  pageNumber: number;
  sections: ParsedSection[];
}

export interface ParsedSection {
  heading: string;
  text: string;
}

export interface ChunkResult extends PipelineState {
  chunks: ChunkRecord[];
  chunkCount: number;
}

export interface ChunkRecord {
  id: string;
  text: string;
  page: number;
  section: string;
  ordinal: number;
  embedding: number[];
}

export interface UpsertResult {
  workspaceId: string;
  documentId: string;
  vectorsUpserted: number;
}

export interface FailureInput {
  workspaceId?: string;
  documentId?: string;
  error?: {
    Error: string;
    Cause: string;
  };
}
