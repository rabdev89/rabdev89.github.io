import { getGcpAccessToken } from "./gcp-auth";
import type { ParsedPage, ParsedSection } from "./types";

const DOCAI_BASE = "https://{region}-documentai.googleapis.com/v1";

export async function processDocument(
  fileBytes: Buffer,
  mimeType: string,
  options?: { projectId?: string; region?: string; processorId?: string }
): Promise<ParsedPage[]> {
  const projectId = options?.projectId || process.env.GCP_PROJECT_ID!;
  const region = options?.region || process.env.GCP_REGION || "us-central1";
  const processorId = options?.processorId || process.env.DOCUMENT_AI_PROCESSOR_ID!;

  const accessToken = await getGcpAccessToken();
  const baseUrl = DOCAI_BASE.replace("{region}", region);
  const url = `${baseUrl}/projects/${projectId}/locations/${region}/processors/${processorId}:process`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rawDocument: {
        content: fileBytes.toString("base64"),
        mimeType,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Document AI processing failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  return parseDocumentAiResponse(data.document);
}

function parseDocumentAiResponse(document: DocumentAiDocument): ParsedPage[] {
  const fullText = document.text || "";
  const pages: ParsedPage[] = [];

  if (!document.pages) return pages;

  for (const page of document.pages) {
    const pageNumber = (page.pageNumber || 1) as number;
    const sections: ParsedSection[] = [];

    let currentHeading = "";

    if (page.blocks) {
      for (const block of page.blocks) {
        const blockText = extractTextFromLayout(block.layout, fullText);
        if (!blockText.trim()) continue;

        const isHeading =
          block.layout?.confidence !== undefined &&
          block.layout.confidence > 0.8 &&
          blockText.length < 200 &&
          !blockText.endsWith(".");

        if (isHeading) {
          currentHeading = blockText.trim();
        } else {
          sections.push({
            heading: currentHeading,
            text: blockText.trim(),
          });
        }
      }
    }

    if (page.paragraphs && sections.length === 0) {
      for (const para of page.paragraphs) {
        const paraText = extractTextFromLayout(para.layout, fullText);
        if (paraText.trim()) {
          sections.push({
            heading: currentHeading,
            text: paraText.trim(),
          });
        }
      }
    }

    if (sections.length > 0) {
      pages.push({ pageNumber, sections });
    }
  }

  return pages;
}

function extractTextFromLayout(layout: Layout | undefined, fullText: string): string {
  if (!layout?.textAnchor?.textSegments) return "";

  return layout.textAnchor.textSegments
    .map((seg) => {
      const start = parseInt(seg.startIndex || "0", 10);
      const end = parseInt(seg.endIndex || "0", 10);
      return fullText.slice(start, end);
    })
    .join("");
}

interface TextSegment {
  startIndex?: string;
  endIndex?: string;
}

interface Layout {
  textAnchor?: {
    textSegments?: TextSegment[];
  };
  confidence?: number;
}

interface Block {
  layout: Layout;
}

interface Paragraph {
  layout: Layout;
}

interface Page {
  pageNumber?: number;
  blocks?: Block[];
  paragraphs?: Paragraph[];
}

interface DocumentAiDocument {
  text?: string;
  pages?: Page[];
}
