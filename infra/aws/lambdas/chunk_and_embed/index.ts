import { randomUUID } from "crypto";
import { query } from "../_shared/db";
import { embedTexts } from "../_shared/vertex";
import type { DocAiResult, ChunkResult, ChunkRecord, ParsedPage } from "../_shared/types";

const TARGET_CHUNK_SIZE = 800;
const MAX_CHUNK_SIZE = 1200;
const OVERLAP_SIZE = 100;

export async function handler(event: DocAiResult): Promise<ChunkResult> {
  const { workspaceId, documentId, s3Key, bucketName, pages } = event;

  console.log("Chunking document", { documentId, pageCount: pages.length });

  const rawChunks = chunkPages(pages);

  console.log("Created chunks", { documentId, chunkCount: rawChunks.length });

  const texts = rawChunks.map((c) => c.text);
  const embeddings = await embedTexts(texts);

  console.log("Embedded chunks", { documentId, embeddingCount: embeddings.length });

  const chunks: ChunkRecord[] = rawChunks.map((c, i) => ({
    id: randomUUID(),
    text: c.text,
    page: c.page,
    section: c.section,
    ordinal: i,
    embedding: embeddings[i],
  }));

  const insertValues: unknown[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const chunk of chunks) {
    placeholders.push(
      `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
    );
    insertValues.push(
      chunk.id,
      documentId,
      workspaceId,
      chunk.ordinal,
      chunk.page,
      chunk.section,
      chunk.text,
      chunk.id
    );
  }

  if (placeholders.length > 0) {
    await query(
      `INSERT INTO chunks (id, document_id, workspace_id, ordinal, page, section, text, vector_id)
       VALUES ${placeholders.join(", ")}`,
      insertValues
    );
  }

  console.log("Inserted chunks into DB", { documentId, count: chunks.length });

  return {
    workspaceId,
    documentId,
    s3Key,
    bucketName,
    chunks,
    chunkCount: chunks.length,
  };
}

interface RawChunk {
  text: string;
  page: number;
  section: string;
}

function chunkPages(pages: ParsedPage[]): RawChunk[] {
  const chunks: RawChunk[] = [];

  for (const page of pages) {
    let buffer = "";
    let currentSection = "";

    for (const section of page.sections) {
      const sectionText = section.text;
      currentSection = section.heading || currentSection;

      if (buffer.length + sectionText.length > MAX_CHUNK_SIZE && buffer.length > 0) {
        chunks.push({
          text: buffer.trim(),
          page: page.pageNumber,
          section: currentSection,
        });

        const overlap = buffer.slice(-OVERLAP_SIZE);
        buffer = overlap + " " + sectionText;
      } else {
        buffer += (buffer ? "\n\n" : "") + sectionText;
      }

      if (buffer.length >= TARGET_CHUNK_SIZE) {
        chunks.push({
          text: buffer.trim(),
          page: page.pageNumber,
          section: currentSection,
        });

        const overlap = buffer.slice(-OVERLAP_SIZE);
        buffer = overlap;
      }
    }

    if (buffer.trim().length > 0) {
      chunks.push({
        text: buffer.trim(),
        page: page.pageNumber,
        section: currentSection,
      });
    }
  }

  return chunks;
}
